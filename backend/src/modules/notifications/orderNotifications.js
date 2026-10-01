import { AdminRole, NotificationEvent, OrderAction } from "@medstore/shared";
import { logger } from "../../config/logger.js";
import { sendPushNotifications } from "../../services/push.js";
import { Admin } from "../admins/admin.model.js";
import { User } from "../users/user.model.js";
import { NOTIFICATION_TEXTS } from "./notificationTexts.js";
import { removeUnregisteredTokens } from "./pushToken.service.js";

// Root 3.6. PACK notifies nobody.
const EVENT_FOR_ACTION = {
  [OrderAction.REJECT]: NotificationEvent.ORDER_REJECTED,
  [OrderAction.SEND_BILL]: NotificationEvent.BILL_SENT,
  [OrderAction.REVISE_BILL]: NotificationEvent.BILL_REVISED,
  [OrderAction.CONFIRM]: NotificationEvent.CUSTOMER_CONFIRMED,
  [OrderAction.CUSTOMER_CANCEL]: NotificationEvent.CUSTOMER_CANCELLED,
  [OrderAction.EXPIRE_BILL]: NotificationEvent.BILL_EXPIRED,
  [OrderAction.STAFF_CANCEL]: NotificationEvent.CANCELLED_BY_STORE,
  [OrderAction.DISPATCH]: NotificationEvent.OUT_FOR_DELIVERY,
  [OrderAction.DELIVER]: NotificationEvent.DELIVERED,
  [OrderAction.FAIL_DELIVERY]: NotificationEvent.DELIVERY_FAILED,
};

// Bounds the recipient query; admins are a handful.
const MAX_NOTIFIED_ADMINS = 500;

const tokensOf = (accounts) =>
  accounts.flatMap((account) => account?.pushTokens?.map(({ token }) => token) ?? []);

const RECIPIENT_TOKENS = {
  customer: async (order) =>
    tokensOf([await User.findById(order.userId, { pushTokens: 1 }).lean()]),
  // Active staff of the order's store, plus every active owner.
  admins: async (order) =>
    tokensOf(
      await Admin.find(
        {
          isActive: true,
          $or: [{ role: AdminRole.OWNER }, { role: AdminRole.STAFF, storeIds: order.storeId }],
        },
        { pushTokens: 1 },
      )
        .limit(MAX_NOTIFIED_ADMINS)
        .lean(),
    ),
};

const deliver = async (order, event) => {
  const data = { orderId: String(order._id), event };
  const audiences = await Promise.all(
    Object.entries(NOTIFICATION_TEXTS[event]).map(async ([audience, buildText]) => {
      const tokens = await RECIPIENT_TOKENS[audience](order);
      return tokens.map((to) => ({ to, ...buildText(order), data }));
    }),
  );
  // A token sits on one account, but concurrent registrations could briefly leave it on two.
  const messages = [...new Map(audiences.flat().map((message) => [message.to, message])).values()];
  if (messages.length === 0) return;

  const { unregisteredTokens } = await sendPushNotifications(messages);
  if (unregisteredTokens.length > 0) await removeUnregisteredTokens(unregisteredTokens);
};

// Logs ids only: the order holds personal data, and errors may echo tokens.
const deliverSafely = async (order, event) => {
  try {
    await deliver(order, event);
  } catch (error) {
    logger.error(
      { errorName: error.name, orderId: String(order._id), event },
      "order notification failed",
    );
  }
};

// Called after the write has committed. Both start sending and return at once: the request
// never waits for Expo, and a failure here never changes its response.
export const notifyOrderPlaced = (order) => {
  void deliverSafely(order, NotificationEvent.ORDER_PLACED);
};

export const notifyTransition = (order, action) => {
  const event = EVENT_FOR_ACTION[action];
  if (event) void deliverSafely(order, event);
};
