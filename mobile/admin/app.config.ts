import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MedStore Admin",
  slug: "medstore-admin",
  scheme: "medstoreadmin",
  version: "1.0.0",
  orientation: "portrait",
  // Light only in v1 (DESIGN.md). Android needs expo-system-ui for this to apply.
  userInterfaceStyle: "light",
  android: {
    package: "com.medico.medstore.admin",
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: "com.medico.medstore.admin",
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
