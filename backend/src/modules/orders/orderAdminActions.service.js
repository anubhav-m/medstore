import { HistoryActorKind, OrderAction, PaymentStatus } from "@medstore/shared";
import { Store } from "../stores/store.model.js";
import { getStoreScope } from "../stores/storeScope.js";
import { billExpiresAt, computeBill } from "./orderBill.js";
import { orderNotFound, transitionOrder } from "./orderTransition.js";
import { presentAdminOrder } from "./order.admin.view.js";
import { Order } from "./order.model.js";

// Staff actions. Each goes through transitionOrder, which records the admin's id in the history
// and limits the order to the admin's stores.

const asAdmin = async (admin) => ({
  by: { kind: HistoryActorKind.ADMIN, id: admin.id },
  scope: { storeId: { $in: await getStoreScope(admin) } },
});

const act = async (admin, orderId, action, fields = {}) =>
  presentAdminOrder(
    await transitionOrder({ orderId, action, ...(await asAdmin(admin)), ...fields }),
  );

const withReason = (key, { reasonCode, note }, extra = {}) => ({
  set: { [key]: { ...extra, code: reasonCode, note: note ?? null } },
  note: note ?? null,
});

export const rejectOrder = (admin, orderId, input) =>
  act(admin, orderId, OrderAction.REJECT, withReason("rejection", input));

export const cancelOrder = (admin, orderId, input) =>
  act(
    admin,
    orderId,
    OrderAction.STAFF_CANCEL,
    withReason("cancellation", input, { byKind: HistoryActorKind.ADMIN }),
  );

export const failDelivery = (admin, orderId, input) =>
  act(admin, orderId, OrderAction.FAIL_DELIVERY, withReason("deliveryFailure", input));

export const packOrder = (admin, orderId) => act(admin, orderId, OrderAction.PACK);

export const dispatchOrder = (admin, orderId) => act(admin, orderId, OrderAction.DISPATCH);

export const deliverOrder = (admin, orderId, { cashCollectedPaise }) => {
  const now = new Date();
  return act(admin, orderId, OrderAction.DELIVER, {
    set: { paymentStatus: PaymentStatus.COLLECTED, cashCollectedPaise, deliveredAt: now },
    now,
  });
};

// Version 0 sends the first bill; the current version revises it. The update matches the
// expected version, so a bill someone else changed meanwhile is BILL_CHANGED. The delivery fee
// defaults to the order's current one (copied from the store, or the previous bill's).
export const sendBill = async (admin, orderId, input) => {
  const actor = await asAdmin(admin);
  const order = await Order.findOne(
    { _id: orderId, ...actor.scope },
    { storeId: 1, deliveryFeePaise: 1 },
  ).lean();
  if (!order) throw orderNotFound();
  const store = await Store.findById(order.storeId, { closingMinutes: 1 }).lean();

  const now = new Date();
  const bill = computeBill({
    items: input.items,
    deliveryFeePaise: input.deliveryFeePaise ?? order.deliveryFeePaise,
    discountPaise: input.discountPaise ?? 0,
  });
  const updated = await transitionOrder({
    orderId,
    action: input.expectedBillVersion === 0 ? OrderAction.SEND_BILL : OrderAction.REVISE_BILL,
    ...actor,
    billVersion: input.expectedBillVersion,
    set: {
      ...bill,
      billVersion: input.expectedBillVersion + 1,
      billSentAt: now,
      billExpiresAt: billExpiresAt(store, now),
    },
    now,
  });
  return presentAdminOrder(updated);
};
