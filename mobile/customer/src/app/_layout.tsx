import { DesignProvider, fontAssets } from "@medstore/mobile-core";
import { useFonts } from "expo-font";
import { SplashScreen, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

// Imported here so a missing or malformed EXPO_PUBLIC_API_URL fails at startup.
import "@/config/env";

// The splash screen stays up until the fonts are ready, so text never flashes in a fallback font.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <DesignProvider app="customer">
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="dark" />
    </DesignProvider>
  );
}
