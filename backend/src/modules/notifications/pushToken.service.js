import { MAX_PUSH_TOKENS_PER_ACCOUNT } from "@medstore/shared";
import mongoose from "mongoose";
import { Admin } from "../admins/admin.model.js";
import { SubjectKind } from "../auth/refreshToken.model.js";
import { User } from "../users/user.model.js";

const MODELS = { [SubjectKind.CUSTOMER]: User, [SubjectKind.ADMIN]: Admin };

const pull = (tokens) => ({ $pull: { pushTokens: { token: { $in: tokens } } } });

// One pipeline update: drop the token if present, append it as the newest, keep the newest
// MAX_PUSH_TOKENS_PER_ACCOUNT. $literal keeps the value from being read as a field path.
const claim = (token, now) => [
  {
    $set: {
      pushTokens: {
        $slice: [
          {
            $concatArrays: [
              {
                $filter: {
                  input: { $ifNull: ["$pushTokens", []] },
                  cond: { $ne: ["$$this.token", { $literal: token }] },
                },
              },
              [{ token: { $literal: token }, createdAt: now }],
            ],
          },
          -MAX_PUSH_TOKENS_PER_ACCOUNT,
        ],
      },
    },
  },
];

// A device belongs to one account at a time, so a shared phone never shows the previous
// account's notifications: the token is removed from every other customer and admin.
export const registerPushToken = (kind, subjectId, token) =>
  mongoose.connection.transaction(async (session) => {
    await MODELS[kind].updateOne({ _id: subjectId }, claim(token, new Date()), {
      session,
      updatePipeline: true,
    });
    for (const [otherKind, Model] of Object.entries(MODELS)) {
      const others = otherKind === kind ? { _id: { $ne: subjectId } } : {};
      await Model.updateMany({ ...others, "pushTokens.token": token }, pull([token]), { session });
    }
  });

// Only ever the caller's own account.
export const removePushToken = (kind, subjectId, token) =>
  MODELS[kind].updateOne({ _id: subjectId }, pull([token]));

// Devices signed out by revoking every session stop receiving notifications too.
export const removeAllPushTokens = (kind, subjectId) =>
  MODELS[kind].updateOne({ _id: subjectId }, { $set: { pushTokens: [] } });

// Tokens Expo reports as DeviceNotRegistered (e.g. the app was uninstalled).
export const removeUnregisteredTokens = (tokens) =>
  Promise.all(
    Object.values(MODELS).map((Model) =>
      Model.updateMany({ "pushTokens.token": { $in: tokens } }, pull(tokens)),
    ),
  );
