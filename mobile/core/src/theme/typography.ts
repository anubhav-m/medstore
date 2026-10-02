import type { Density } from "./density";

// Each weight is its own family on Android; styles never set fontWeight (Android would fake it).
export const fontFamilies = {
  regular: "AnekLatin_400Regular",
  semiBold: "AnekLatin_600SemiBold",
  bold: "AnekLatin_700Bold",
} as const;

export type TextRole =
  "display" | "headline" | "title" | "body" | "bodyStrong" | "label" | "caption";

export interface TextStyleToken {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}

const role = (fontFamily: string, fontSize: number, lineHeight: number): TextStyleToken => ({
  fontFamily,
  fontSize,
  lineHeight,
});

export const typeScale: Record<Density, Record<TextRole, TextStyleToken>> = {
  comfortable: {
    display: role(fontFamilies.bold, 34, 42),
    headline: role(fontFamilies.bold, 26, 34),
    title: role(fontFamilies.semiBold, 21, 28),
    body: role(fontFamilies.regular, 18, 27),
    bodyStrong: role(fontFamilies.semiBold, 18, 27),
    label: role(fontFamilies.semiBold, 17, 24),
    caption: role(fontFamilies.regular, 15, 22),
  },
  compact: {
    display: role(fontFamilies.bold, 26, 32),
    headline: role(fontFamilies.bold, 21, 28),
    title: role(fontFamilies.semiBold, 17, 24),
    body: role(fontFamilies.regular, 15, 22),
    bodyStrong: role(fontFamilies.semiBold, 15, 22),
    label: role(fontFamilies.semiBold, 14, 20),
    caption: role(fontFamilies.regular, 13, 18),
  },
};

/** Letter-spacing for order numbers, the only tracked text in the system. */
export const ORDER_NUMBER_TRACKING = 0.25;
