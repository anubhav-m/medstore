import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { ComponentProps } from "react";
import { useDesign } from "../theme/DesignProvider";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

type IconSize = "inline" | "badge" | "mark" | "state";

interface IconProps {
  name: IconName;
  size?: IconSize;
  /** A colour from the theme. Icons next to text are decorative; the text carries the meaning. */
  color: string;
}

/** Material Community Icons, the only icon set (DESIGN.md). Hidden from TalkBack. */
export function Icon({ name, size = "inline", color }: IconProps) {
  const { sizes } = useDesign();
  const pixels = {
    inline: sizes.iconInline,
    badge: sizes.iconBadge,
    mark: sizes.markGlyph,
    state: sizes.stateGlyph,
  }[size];
  return (
    <MaterialCommunityIcons
      name={name}
      size={pixels}
      color={color}
      accessible={false}
      importantForAccessibility="no"
      // The glyph is drawn with a font, but it is an icon sized in dp like native Android icons:
      // scaling it with the text size would overflow the fixed discs it sits in. Text still scales.
      allowFontScaling={false}
    />
  );
}
