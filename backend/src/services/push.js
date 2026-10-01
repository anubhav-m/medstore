import { Expo } from "expo-server-sdk";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

const DEVICE_NOT_REGISTERED = "DeviceNotRegistered";

// Without a token, sends work only while enhanced push security is off in the Expo project.
const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN });

export const isPushToken = (token) => Expo.isExpoPushToken(token);

/**
 * Sends `messages` (`{ to, title, body, data }`, one token each) in Expo-sized chunks. Never
 * throws: failures are logged with counts and error codes only — never tokens or texts.
 * Returns the tokens whose tickets say `DeviceNotRegistered`, for the caller to delete.
 */
export const sendPushNotifications = async (messages) => {
  const unregisteredTokens = [];
  const ticketErrors = {};
  const chunks = expo.chunkPushNotifications(
    messages.map((message) => ({ ...message, sound: "default", priority: "high" })),
  );
  for (const chunk of chunks) {
    let tickets;
    try {
      tickets = await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      logger.error(
        { errorName: error.name, errorCode: error.code, messages: chunk.length },
        "push provider request failed",
      );
      continue;
    }
    // Tickets come back in message order.
    for (const [index, ticket] of tickets.entries()) {
      if (ticket.status !== "error") continue;
      const code = ticket.details?.error ?? "Unknown";
      ticketErrors[code] = (ticketErrors[code] ?? 0) + 1;
      if (code === DEVICE_NOT_REGISTERED) unregisteredTokens.push(chunk[index].to);
    }
  }
  if (Object.keys(ticketErrors).length > 0) {
    logger.warn({ ticketErrors }, "push tickets reported errors");
  }
  return { unregisteredTokens };
};
