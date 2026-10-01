/** What a push notification is about; sent as `data.event` so the apps can route a tap. */
export const NotificationEvent = {
  ORDER_PLACED: "ORDER_PLACED",
  BILL_SENT: "BILL_SENT",
  BILL_REVISED: "BILL_REVISED",
  ORDER_REJECTED: "ORDER_REJECTED",
  CANCELLED_BY_STORE: "CANCELLED_BY_STORE",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  BILL_EXPIRED: "BILL_EXPIRED",
  CUSTOMER_CONFIRMED: "CUSTOMER_CONFIRMED",
  CUSTOMER_CANCELLED: "CUSTOMER_CANCELLED",
} as const;

export type NotificationEvent = (typeof NotificationEvent)[keyof typeof NotificationEvent];

/** The `data` payload of every push notification. */
export interface PushNotificationData {
  orderId: string;
  event: NotificationEvent;
}

/**
 * Body of POST and DELETE /me/push-tokens and /admin/me/push-tokens. An Expo push token
 * (`ExponentPushToken[…]`). Registering moves it off every other customer and admin account.
 */
export interface PushTokenRequest {
  token: string;
}
