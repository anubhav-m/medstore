import { HistoryActorKind, OrderStatus, PAYMENT_METHOD_COD, PaymentStatus } from "@medstore/shared";
import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const reasonSchema = new mongoose.Schema(
  { code: { type: String, required: true }, note: { type: String, default: null } },
  { _id: false },
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    at: { type: Date, required: true },
    // `id` is the customer's or admin's id; SYSTEM has none. Customers never receive it.
    by: {
      kind: { type: String, enum: Object.values(HistoryActorKind), required: true },
      id: { type: ObjectId, default: null },
    },
    note: { type: String, default: null },
  },
  { _id: false },
);

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    // Lowercased, trimmed name for item suggestions
    nameKey: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPricePaise: { type: Number, required: true },
    lineTotalPaise: { type: Number, required: true },
  },
  { _id: false },
);

// Money is integer paise. The address, customer contact and delivery fee are copies taken at
// creation, so later edits never change a placed order.
const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true },
    userId: { type: ObjectId, ref: "User", required: true },
    storeId: { type: ObjectId, ref: "Store", required: true },
    status: { type: String, enum: Object.values(OrderStatus), required: true },
    // Lowercased UUID from the Idempotency-Key header
    idempotencyKey: { type: String, required: true },
    reorderedFrom: { type: ObjectId, ref: "Order", default: null },
    patientName: { type: String, required: true },
    customerNote: { type: String, default: null },
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    // `{userId}/{uuid}.{ext}` in the bucket; a reorder shares the original order's objects.
    images: [new mongoose.Schema({ path: { type: String, required: true } }, { _id: false })],
    deliveryAddress: {
      label: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String, default: null },
      landmark: { type: String, default: null },
      city: { type: String, required: true },
      pincode: { type: String, required: true },
      // GeoJSON: coordinates are [lng, lat]
      location: {
        type: { type: String, enum: ["Point"], required: true },
        coordinates: { type: [Number], required: true },
      },
    },
    distanceKm: { type: Number, required: true },
    items: { type: [itemSchema], default: [] },
    // null until the first bill
    subtotalPaise: { type: Number, default: null },
    deliveryFeePaise: { type: Number, required: true },
    discountPaise: { type: Number, default: null },
    totalPaise: { type: Number, default: null },
    billVersion: { type: Number, default: 0 },
    billSentAt: { type: Date, default: null },
    billExpiresAt: { type: Date, default: null },
    paymentMethod: { type: String, enum: [PAYMENT_METHOD_COD], default: PAYMENT_METHOD_COD },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    cashCollectedPaise: { type: Number, default: null },
    deliveredAt: { type: Date, default: null },
    rejection: { type: reasonSchema, default: null },
    cancellation: {
      type: new mongoose.Schema(
        {
          byKind: { type: String, enum: Object.values(HistoryActorKind), required: true },
          code: { type: String, default: null },
          note: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    deliveryFailure: { type: reasonSchema, default: null },
    statusHistory: { type: [historySchema], default: [] },
  },
  { timestamps: true },
);

orderSchema.index({ orderNumber: 1 }, { unique: true });
// A retried create or reorder finds its order instead of making another.
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
// A customer's orders (lists, open-order count).
orderSchema.index({ userId: 1, status: 1, createdAt: -1 });
// Admin tabs.
orderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
// Admin search by phone (order-number prefixes use the unique index).
orderSchema.index({ storeId: 1, customerPhone: 1 });
// Item-name suggestions.
orderSchema.index({ storeId: 1, "items.nameKey": 1 });
// Bill-expiry job: bills awaiting confirmation whose expiry has passed.
orderSchema.index({ status: 1, billExpiresAt: 1 });
// Daily report: orders delivered on a day.
orderSchema.index({ storeId: 1, deliveredAt: 1 });
// Whether any order still references an image.
orderSchema.index({ "images.path": 1 });

export const Order = mongoose.model("Order", orderSchema);
