// An Expo push token for test device `n`.
export const pushToken = (n) => `ExponentPushToken[device-${n}]`;

// The push tokens stored on the one account matching `filter`, oldest first.
export const storedTokens = async (Model, filter) => {
  const account = await Model.findOne(filter, { pushTokens: 1 }).lean();
  return account.pushTokens.map(({ token }) => token);
};
