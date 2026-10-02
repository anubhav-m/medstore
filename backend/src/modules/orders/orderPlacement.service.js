import {
  ErrorCodes,
  HistoryActorKind,
  MAX_OPEN_ORDERS,
  OPEN_ORDER_STATUSES,
  OrderStatus,
} from "@medstore/shared";
import mongoose from "mongoose";
import { AppError, invalidToken } from "../../utils/AppError.js";
import { Address } from "../addresses/address.model.js";
import { addressNotFound } from "../addresses/address.service.js";
import { findStoreForPin, deliversTo, toDistanceKm } from "../stores/store.service.js";
import { isStoreOpen } from "../stores/storeHours.js";
import { notifyOrderPlaced } from "../notifications/orderNotifications.js";
import { Upload } from "../uploads/upload.model.js";
import { User } from "../users/user.model.js";
import { nextOrderNumber } from "./counter.model.js";
import { verifyOrderImages } from "./orderImages.js";
import { orderNotFound } from "./orderTransition.js";
import { Order } from "./order.model.js";
import { presentOrder } from "./order.view.js";

// New orders and reorders run the checks of root 3.4 in its order; idempotency comes first.

const findByIdempotencyKey = (userId, idempotencyKey, session) =>
  Order.findOne({ userId, idempotencyKey }, null, { session }).lean();

// Check 1 (onboarding is enforced by requireOnboarded). Returns the contact details to copy.
// The account may have been deleted since the request was authenticated.
const loadOrderingCustomer = async (userId) => {
  const user = await User.findById(userId, { isBlocked: 1, name: 1, phone: 1 }).lean();
  if (!user) throw invalidToken();
  if (user.isBlocked) {
    throw new AppError(
      "Your account can't place orders right now",
      403,
      ErrorCodes.ACCOUNT_BLOCKED,
    );
  }
  return user;
};

// Checks 3 and 4: measured from the delivery address pin, never the phone's location.
const findStoreTakingOrder = async (storeId, location, now) => {
  const store = await findStoreForPin(storeId, location);
  if (!store) throw new AppError("Store not found", 404, ErrorCodes.STORE_NOT_FOUND);
  if (!store.isActive || !store.isAcceptingOrders) {
    throw new AppError(
      "This store isn't taking orders right now",
      409,
      ErrorCodes.STORE_NOT_ACCEPTING_ORDERS,
    );
  }
  if (!isStoreOpen(store, now)) {
    throw new AppError("This store is closed right now", 409, ErrorCodes.STORE_CLOSED);
  }
  if (!deliversTo(store)) {
    throw new AppError(
      "This store doesn't deliver to this address",
      422,
      ErrorCodes.OUTSIDE_DELIVERY_AREA,
    );
  }
  return store;
};

const copyAddress = ({ label, line1, line2, landmark, city, pincode, location }) => ({
  label,
  line1,
  line2: line2 ?? null,
  landmark: landmark ?? null,
  city,
  pincode,
  location: { type: "Point", coordinates: location.coordinates },
});

// Check 6 and the insert. Bumping the user document first makes concurrent creates of one
// customer conflict, so the transaction driver retries them one at a time: the open-order count
// stays exact, and a request that lost the race on the same idempotency key finds the winner's
// order here instead of creating another. Staff hear only about an order this call created,
// once the transaction has committed.
const insertOrder = async ({ userId, idempotencyKey, imagePaths, now, ...fields }) => {
  const orderNumber = await nextOrderNumber(fields.store.code);
  const { order, created } = await mongoose.connection.transaction(async (session) => {
    const locked = await User.updateOne(
      { _id: userId },
      { $inc: { orderCreateSeq: 1 } },
      { session },
    );
    // Deleted meanwhile: an order must never outlive the check that the account had none open.
    if (locked.matchedCount === 0) throw invalidToken();
    const existing = await findByIdempotencyKey(userId, idempotencyKey, session);
    if (existing) return { order: existing, created: false };

    const open = await Order.countDocuments(
      { userId, status: { $in: OPEN_ORDER_STATUSES } },
      { session },
    );
    if (open >= MAX_OPEN_ORDERS) {
      throw new AppError(
        `You can have up to ${MAX_OPEN_ORDERS} orders in progress`,
        409,
        ErrorCodes.TOO_MANY_OPEN_ORDERS,
      );
    }

    const [inserted] = await Order.create(
      [
        {
          orderNumber,
          userId,
          storeId: fields.store._id,
          status: OrderStatus.PENDING_REVIEW,
          idempotencyKey,
          reorderedFrom: fields.reorderedFrom ?? null,
          patientName: fields.patientName,
          customerNote: fields.note ?? null,
          customerName: fields.customer.name,
          customerPhone: fields.customer.phone,
          images: imagePaths.map((path) => ({ path })),
          deliveryAddress: copyAddress(fields.address),
          distanceKm: toDistanceKm(fields.store.distanceMeters),
          deliveryFeePaise: fields.store.deliveryFeePaise,
          statusHistory: [
            {
              status: OrderStatus.PENDING_REVIEW,
              at: now,
              by: { kind: HistoryActorKind.CUSTOMER, id: userId },
            },
          ],
        },
      ],
      { session },
    );
    await Upload.updateMany(
      { userId, path: { $in: imagePaths }, attachedAt: null },
      { $set: { attachedAt: now } },
      { session },
    );
    return { order: inserted.toObject(), created: true };
  });
  if (created) notifyOrderPlaced(order);
  return order;
};

export const createOrder = async (userId, idempotencyKey, input) => {
  const existing = await findByIdempotencyKey(userId, idempotencyKey);
  if (existing) return presentOrder(existing);

  const now = new Date();
  const customer = await loadOrderingCustomer(userId);
  const address = await Address.findOne({ _id: input.addressId, userId }).lean();
  if (!address) throw addressNotFound();
  const store = await findStoreTakingOrder(input.storeId, address.location, now);
  await verifyOrderImages(userId, input.imagePaths);

  const order = await insertOrder({
    userId,
    idempotencyKey,
    imagePaths: input.imagePaths,
    now,
    store,
    customer,
    address,
    patientName: input.patientName ?? customer.name,
    note: input.note,
  });
  return presentOrder(order);
};

// Same store, images, patient and copied address as a DELIVERED order; full review again.
export const reorder = async (userId, sourceOrderId, idempotencyKey, { note }) => {
  const existing = await findByIdempotencyKey(userId, idempotencyKey);
  if (existing) return presentOrder(existing);

  const now = new Date();
  const customer = await loadOrderingCustomer(userId);
  const source = await Order.findOne({ _id: sourceOrderId, userId }).lean();
  if (!source) throw orderNotFound();
  if (source.status !== OrderStatus.DELIVERED) {
    throw new AppError(
      "Only delivered orders can be reordered",
      409,
      ErrorCodes.REORDER_NOT_ALLOWED,
    );
  }
  const store = await findStoreTakingOrder(source.storeId, source.deliveryAddress.location, now);
  const imagePaths = source.images.map((image) => image.path);
  await verifyOrderImages(userId, imagePaths);

  const order = await insertOrder({
    userId,
    idempotencyKey,
    imagePaths,
    now,
    store,
    customer,
    address: source.deliveryAddress,
    patientName: source.patientName,
    note,
    reorderedFrom: source._id,
  });
  return presentOrder(order);
};
