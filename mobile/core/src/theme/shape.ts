export const radii = {
  badge: 8,
  control: 10,
  plate: 14,
  dialog: 20,
  mark: 999,
} as const;

export const borderWidths = {
  /** Dividers and plate outlines. */
  divider: 1,
  /** Anything you operate: inputs, secondary buttons, the haldi edge, mark rings. */
  control: 2,
  /** Ink focus ring, drawn `focusOffset` outside the control (and around a focused input). */
  focus: 3,
  focusOffset: 2,
  /** The selected tab's underline. */
  tabIndicator: 3,
} as const;

/** Android elevation, used only for dialogs and menus. Everything else is flat. */
export const elevation = {
  dialog: 6,
  menu: 3,
} as const;
