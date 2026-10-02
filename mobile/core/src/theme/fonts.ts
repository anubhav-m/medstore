import { AnekLatin_400Regular } from "@expo-google-fonts/anek-latin/400Regular";
import { AnekLatin_600SemiBold } from "@expo-google-fonts/anek-latin/600SemiBold";
import { AnekLatin_700Bold } from "@expo-google-fonts/anek-latin/700Bold";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { fontFamilies } from "./typography";

/**
 * Everything each app passes to expo-font's useFonts before hiding the splash screen. The icon
 * font is included so icons don't appear late. Weights are imported by path so only these three
 * files are bundled.
 */
export const fontAssets = {
  [fontFamilies.regular]: AnekLatin_400Regular,
  [fontFamilies.semiBold]: AnekLatin_600SemiBold,
  [fontFamilies.bold]: AnekLatin_700Bold,
  ...MaterialCommunityIcons.font,
};
