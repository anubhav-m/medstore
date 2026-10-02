import { colors, familyColors } from "./colors";
import { densityForApp, type AppKind, type Density } from "./density";
import { borderWidths, elevation, radii } from "./shape";
import { sizes } from "./sizes";
import { space, spacing } from "./spacing";
import { typeScale } from "./typography";

function buildTokens(app: AppKind) {
  const density: Density = densityForApp[app];
  return {
    app,
    density,
    colors,
    familyColors,
    type: typeScale[density],
    spacing: spacing[density],
    /** The 4 dp grid, for the few fixed gaps that don't change with density. */
    space,
    sizes: sizes[density],
    radii,
    borderWidths,
    elevation,
  };
}

export type Tokens = ReturnType<typeof buildTokens>;

/** Resolved once per app; components read these through useDesign(). */
export const tokensByApp: Record<AppKind, Tokens> = {
  customer: buildTokens("customer"),
  admin: buildTokens("admin"),
};
