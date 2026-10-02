import { parseApiUrl } from "@medstore/mobile-core";

export const env = {
  apiUrl: parseApiUrl(process.env.EXPO_PUBLIC_API_URL),
};
