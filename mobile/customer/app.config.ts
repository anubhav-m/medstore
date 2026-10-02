import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MedStore",
  slug: "medstore",
  scheme: "medstore",
  version: "1.0.0",
  orientation: "portrait",
  // Light only in v1 (DESIGN.md). Android needs expo-system-ui for this to apply.
  userInterfaceStyle: "light",
  android: {
    package: "com.medico.medstore",
    predictiveBackGestureEnabled: false,
  },
  ios: {
    bundleIdentifier: "com.medico.medstore",
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
