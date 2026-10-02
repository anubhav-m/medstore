// React Native's URL polyfill doesn't implement most getters, so the shape is checked by pattern.
const API_URL_PATTERN = /^https?:\/\/[^\s/?#]+(\/[^\s?#]*)?$/;

export function parseApiUrl(value: string | undefined): string {
  const url = value?.trim();
  if (!url || !API_URL_PATTERN.test(url)) {
    throw new Error(
      "EXPO_PUBLIC_API_URL must be an absolute http(s) URL, e.g. http://192.168.1.10:4000/api/v1. Set it in this app's .env and restart Expo.",
    );
  }
  return url.replace(/\/+$/, "");
}
