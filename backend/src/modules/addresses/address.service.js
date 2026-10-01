import { ErrorCodes, MAX_ADDRESSES } from "@medstore/shared";
import mongoose from "mongoose";
import { AppError } from "../../utils/AppError.js";
import { fromPoint, toPoint } from "../../utils/geo.js";
import { User } from "../users/user.model.js";
import { Address } from "./address.model.js";

export const addressNotFound = () =>
  new AppError("Address not found", 404, ErrorCodes.ADDRESS_NOT_FOUND);

const toAddressResponse = (address) => ({
  id: String(address._id),
  label: address.label,
  line1: address.line1,
  line2: address.line2 ?? null,
  landmark: address.landmark ?? null,
  city: address.city,
  pincode: address.pincode,
  ...fromPoint(address.location),
  isDefault: address.isDefault,
  createdAt: address.createdAt,
  updatedAt: address.updatedAt,
});

// Validation guarantees lat and lng arrive together.
const toAddressFields = ({ lat, lng, ...fields }) => ({
  ...fields,
  ...(lat !== undefined && { location: toPoint({ lat, lng }) }),
});

// Bumping the user document first makes concurrent address writes of one customer conflict, so
// the transaction driver retries them one at a time and the cap and single default stay exact.
const withAddressLock = (userId, fn) =>
  mongoose.connection.transaction(async (session) => {
    await User.updateOne({ _id: userId }, { $inc: { addressWriteSeq: 1 } }, { session });
    return fn(session);
  });

// Unset before set: the partial unique index allows only one default at any moment.
const unsetDefault = (userId, session) =>
  Address.updateMany({ userId, isDefault: true }, { $set: { isDefault: false } }, { session });

// Also used by onboarding inside its own transaction.
export const insertAddress = async (userId, input, isDefault, session) => {
  const [address] = await Address.create([{ userId, ...toAddressFields(input), isDefault }], {
    session,
  });
  return toAddressResponse(address);
};

export const listAddresses = async (userId) => {
  const addresses = await Address.find({ userId })
    .sort({ isDefault: -1, createdAt: -1, _id: -1 })
    .limit(MAX_ADDRESSES)
    .lean();
  return addresses.map(toAddressResponse);
};

export const createAddress = (userId, { isDefault, ...input }) =>
  withAddressLock(userId, async (session) => {
    const count = await Address.countDocuments({ userId }, { session });
    if (count >= MAX_ADDRESSES) {
      throw new AppError(
        `You can save up to ${MAX_ADDRESSES} addresses`,
        409,
        ErrorCodes.ADDRESS_LIMIT_REACHED,
      );
    }
    const makeDefault = isDefault === true || count === 0;
    if (makeDefault) await unsetDefault(userId, session);
    return insertAddress(userId, input, makeDefault, session);
  });

export const updateAddress = (userId, addressId, { isDefault, ...input }) =>
  withAddressLock(userId, async (session) => {
    // If the address isn't found, the throw below rolls this back.
    if (isDefault) await unsetDefault(userId, session);
    const address = await Address.findOneAndUpdate(
      { _id: addressId, userId },
      { $set: { ...toAddressFields(input), ...(isDefault && { isDefault: true }) } },
      { session, returnDocument: "after", runValidators: true },
    ).lean();
    if (!address) throw addressNotFound();
    return toAddressResponse(address);
  });

// Deleting the default promotes the most recently created remaining address (root 3.2).
export const deleteAddress = (userId, addressId) =>
  withAddressLock(userId, async (session) => {
    const deleted = await Address.findOneAndDelete({ _id: addressId, userId }, { session }).lean();
    if (!deleted) throw addressNotFound();
    if (deleted.isDefault) {
      await Address.findOneAndUpdate(
        { userId },
        { $set: { isDefault: true } },
        { session, sort: { createdAt: -1, _id: -1 } },
      );
    }
  });
