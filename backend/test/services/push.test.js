import { Expo } from "expo-server-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "../../src/config/logger.js";
import { isPushToken, sendPushNotifications } from "../../src/services/push.js";

const { client } = vi.hoisted(() => ({
  client: { chunkPushNotifications: vi.fn(), sendPushNotificationsAsync: vi.fn() },
}));
vi.mock("expo-server-sdk", () => ({
  Expo: Object.assign(
    vi.fn(function () {
      return client;
    }),
    { isExpoPushToken: vi.fn() },
  ),
}));
vi.mock("../../src/config/env.js", async (importOriginal) => {
  const { env } = await importOriginal();
  return { env: { ...env, EXPO_ACCESS_TOKEN: "expo-access-token" } };
});

// The client is built once at import, before mockReset clears the recorded calls.
const [clientOptions] = vi.mocked(Expo).mock.calls[0];

const message = (n) => ({
  to: `ExponentPushToken[device-${n}]`,
  title: "Order ST01-000001 delivered",
  body: "Thank you for ordering with us.",
  data: { orderId: "order-id", event: "DELIVERED" },
});

const ok = { status: "ok", id: "receipt-id" };
const failed = (error) => ({ status: "error", message: "failed", details: { error } });

beforeEach(() => {
  // Two messages per chunk, so tests can see more than one request.
  client.chunkPushNotifications.mockImplementation((messages) => {
    const chunks = [];
    for (let i = 0; i < messages.length; i += 2) chunks.push(messages.slice(i, i + 2));
    return chunks;
  });
});

describe("services/push.js", () => {
  it("creates the client with EXPO_ACCESS_TOKEN", () => {
    expect(clientOptions).toEqual({ accessToken: "expo-access-token" });
  });

  it("checks tokens with the SDK", () => {
    vi.mocked(Expo.isExpoPushToken).mockReturnValueOnce(true).mockReturnValueOnce(false);
    expect(isPushToken("ExponentPushToken[a]")).toBe(true);
    expect(isPushToken("nope")).toBe(false);
  });

  it("sends every chunk with sound and high priority", async () => {
    client.sendPushNotificationsAsync.mockImplementation(async (chunk) => chunk.map(() => ok));

    const result = await sendPushNotifications([message(1), message(2), message(3)]);

    expect(result).toEqual({ unregisteredTokens: [] });
    expect(client.sendPushNotificationsAsync).toHaveBeenCalledTimes(2);
    const sent = client.sendPushNotificationsAsync.mock.calls.flatMap(([chunk]) => chunk);
    expect(sent).toEqual(
      [1, 2, 3].map((n) => ({ ...message(n), sound: "default", priority: "high" })),
    );
  });

  it("returns the tokens whose tickets say DeviceNotRegistered, in message order", async () => {
    client.sendPushNotificationsAsync
      .mockResolvedValueOnce([failed("DeviceNotRegistered"), ok])
      .mockResolvedValueOnce([failed("MessageRateExceeded"), failed("DeviceNotRegistered")]);
    const warn = vi.spyOn(logger, "warn");

    const result = await sendPushNotifications([1, 2, 3, 4].map(message));

    expect(result.unregisteredTokens).toEqual([message(1).to, message(4).to]);
    expect(warn).toHaveBeenCalledWith(
      { ticketErrors: { DeviceNotRegistered: 2, MessageRateExceeded: 1 } },
      "push tickets reported errors",
    );
    warn.mockRestore();
  });

  it("keeps sending after a failed request, never throws and logs no tokens or text", async () => {
    client.sendPushNotificationsAsync
      .mockRejectedValueOnce(new Error("ExponentPushToken[device-1] failed"))
      .mockResolvedValueOnce([failed("DeviceNotRegistered")]);
    const error = vi.spyOn(logger, "error");

    const result = await sendPushNotifications([1, 2, 3].map(message));

    expect(result.unregisteredTokens).toEqual([message(3).to]);
    expect(error).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain("ExponentPushToken");
    expect(logged).not.toContain("delivered");
    error.mockRestore();
  });
});
