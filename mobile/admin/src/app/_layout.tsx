import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// Imported here so a missing or malformed EXPO_PUBLIC_API_URL fails at startup.
import "@/config/env";

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </>
  );
}
