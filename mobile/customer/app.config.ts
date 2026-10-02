import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "MedStore",
  slug: "medstore",
  scheme: "medstore",
  version: "1.0.0",
  orientation: "portrait",
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
