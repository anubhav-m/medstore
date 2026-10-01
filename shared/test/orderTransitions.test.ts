import { describe, expect, it } from "vitest";
import {
  OPEN_ORDER_STATUSES,
  ORDER_TRANSITIONS,
  OrderAction,
  OrderStatus,
  TERMINAL_ORDER_STATUSES,
  TransitionActor,
} from "../src/index.js";

const allStatuses = Object.values(OrderStatus);
const actors = Object.values(TransitionActor);

const findTransition = (action: OrderAction) => ORDER_TRANSITIONS.find((t) => t.action === action);

describe("ORDER_TRANSITIONS", () => {
  it("mentions every status as a source or a target", () => {
    const mentioned = new Set(ORDER_TRANSITIONS.flatMap((t) => [...t.from, t.to]));
    for (const status of allStatuses) {
      expect(mentioned, status).toContain(status);
    }
  });

  it("gives terminal statuses no outgoing transitions", () => {
    for (const status of TERMINAL_ORDER_STATUSES) {
      const outgoing = ORDER_TRANSITIONS.filter((t) => t.from.includes(status));
      expect(outgoing, status).toEqual([]);
    }
  });

  it("names a valid actor on every transition", () => {
    for (const transition of ORDER_TRANSITIONS) {
      expect(actors, transition.action).toContain(transition.actor);
    }
  });

  it("uses each action exactly once and covers every action", () => {
    const actions = ORDER_TRANSITIONS.map((t) => t.action);
    expect(new Set(actions).size).toBe(actions.length);
    expect(new Set(actions)).toEqual(new Set(Object.values(OrderAction)));
  });

  it("lets every non-terminal status reach a terminal status", () => {
    const nonTerminal = allStatuses.filter((s) => !TERMINAL_ORDER_STATUSES.includes(s));
    for (const start of nonTerminal) {
      const seen = new Set<OrderStatus>([start]);
      const queue: OrderStatus[] = [start];
      let reachesTerminal = false;
      while (queue.length > 0 && !reachesTerminal) {
        const current = queue.shift() as OrderStatus;
        for (const t of ORDER_TRANSITIONS.filter((tr) => tr.from.includes(current))) {
          if (TERMINAL_ORDER_STATUSES.includes(t.to)) reachesTerminal = true;
          if (!seen.has(t.to)) {
            seen.add(t.to);
            queue.push(t.to);
          }
        }
      }
      expect(reachesTerminal, start).toBe(true);
    }
  });

  it("splits every status into open or terminal", () => {
    expect([...OPEN_ORDER_STATUSES, ...TERMINAL_ORDER_STATUSES].sort()).toEqual(
      [...allStatuses].sort(),
    );
    expect(OPEN_ORDER_STATUSES.filter((s) => TERMINAL_ORDER_STATUSES.includes(s))).toEqual([]);
  });

  it("lets only the customer confirm a bill", () => {
    expect(findTransition(OrderAction.CONFIRM)).toMatchObject({
      from: [OrderStatus.AWAITING_CONFIRMATION],
      to: OrderStatus.CONFIRMED,
      actor: TransitionActor.CUSTOMER,
    });
  });

  it("lets the system cancel an unconfirmed bill", () => {
    expect(findTransition(OrderAction.EXPIRE_BILL)).toMatchObject({
      from: [OrderStatus.AWAITING_CONFIRMATION],
      to: OrderStatus.CANCELLED,
      actor: TransitionActor.SYSTEM,
    });
  });

  it("lets staff cancel from AWAITING_CONFIRMATION, CONFIRMED and PACKED only", () => {
    expect(findTransition(OrderAction.STAFF_CANCEL)).toMatchObject({
      from: [OrderStatus.AWAITING_CONFIRMATION, OrderStatus.CONFIRMED, OrderStatus.PACKED],
      to: OrderStatus.CANCELLED,
      actor: TransitionActor.STAFF,
    });
  });
});
