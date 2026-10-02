---
name: MedStore
description: Route Marks. One design system for the MedStore customer app (comfortable density) and MedStore Admin (compact density).
colors:
  ground: "#F4F5F1"
  surface: "#FFFFFF"
  sunken: "#E9ECE7"
  ink: "#17211F"
  ink-secondary: "#4A5652"
  ink-tertiary: "#5E6A66"
  ink-disabled: "#9AA39F"
  disabled-fill: "#E3E6E2"
  border-subtle: "#D6DBD6"
  border-strong: "#7A8581"
  scrim: "#17211F80"
  pressed-overlay: "#17211F1F"
  haldi: "#F2B705"
  haldi-pressed: "#D9A300"
  haldi-edge: "#8F6A00"
  haldi-tint: "#FFF3C4"
  on-haldi-tint: "#5C4300"
  slate: "#3E5C7E"
  slate-tint: "#E4EBF3"
  on-slate-tint: "#2C4560"
  indigo: "#3949A0"
  indigo-tint: "#E6E9F7"
  on-indigo-tint: "#28357A"
  teal: "#0B6E69"
  teal-tint: "#DDF1EF"
  on-teal-tint: "#08524E"
  green: "#2E7D32"
  green-tint: "#E3F2E3"
  on-green-tint: "#1F5B23"
  brick: "#B3261E"
  brick-pressed: "#8A1C16"
  brick-tint: "#FBE6E4"
  on-brick-tint: "#8A1C16"
  rust: "#A84B0C"
  rust-tint: "#FCEBDD"
  on-rust-tint: "#7A3608"
  grey: "#5E6A66"
  grey-tint: "#E9ECE7"
  on-grey-tint: "#3C4643"
typography:
  display:
    fontFamily: "AnekLatin_700Bold"
    fontSize: "34sp"
    lineHeight: "42sp"
  headline:
    fontFamily: "AnekLatin_700Bold"
    fontSize: "26sp"
    lineHeight: "34sp"
  title:
    fontFamily: "AnekLatin_600SemiBold"
    fontSize: "21sp"
    lineHeight: "28sp"
  body:
    fontFamily: "AnekLatin_400Regular"
    fontSize: "18sp"
    lineHeight: "27sp"
  body-strong:
    fontFamily: "AnekLatin_600SemiBold"
    fontSize: "18sp"
    lineHeight: "27sp"
  label:
    fontFamily: "AnekLatin_600SemiBold"
    fontSize: "17sp"
    lineHeight: "24sp"
  caption:
    fontFamily: "AnekLatin_400Regular"
    fontSize: "15sp"
    lineHeight: "22sp"
  display-compact:
    fontFamily: "AnekLatin_700Bold"
    fontSize: "26sp"
    lineHeight: "32sp"
  headline-compact:
    fontFamily: "AnekLatin_700Bold"
    fontSize: "21sp"
    lineHeight: "28sp"
  title-compact:
    fontFamily: "AnekLatin_600SemiBold"
    fontSize: "17sp"
    lineHeight: "24sp"
  body-compact:
    fontFamily: "AnekLatin_400Regular"
    fontSize: "15sp"
    lineHeight: "22sp"
  body-strong-compact:
    fontFamily: "AnekLatin_600SemiBold"
    fontSize: "15sp"
    lineHeight: "22sp"
  label-compact:
    fontFamily: "AnekLatin_600SemiBold"
    fontSize: "14sp"
    lineHeight: "20sp"
  caption-compact:
    fontFamily: "AnekLatin_400Regular"
    fontSize: "13sp"
    lineHeight: "18sp"
rounded:
  badge: "8dp"
  control: "10dp"
  plate: "14dp"
  dialog: "20dp"
  mark: "999dp"
spacing:
  xxs: "4dp"
  xs: "8dp"
  sm: "12dp"
  md: "16dp"
  lg: "20dp"
  xl: "24dp"
  2xl: "32dp"
  3xl: "40dp"
  4xl: "48dp"
components:
  button-primary:
    backgroundColor: "{colors.haldi}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "56dp"
  button-primary-pressed:
    backgroundColor: "{colors.haldi-pressed}"
    textColor: "{colors.ink}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "56dp"
  button-secondary-pressed:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink}"
  button-text:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    height: "48dp"
  button-text-pressed:
    backgroundColor: "{colors.pressed-overlay}"
    textColor: "{colors.ink}"
  button-danger:
    backgroundColor: "{colors.brick}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "56dp"
  button-danger-pressed:
    backgroundColor: "{colors.brick-pressed}"
    textColor: "{colors.surface}"
  button-danger-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.brick}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "56dp"
  button-disabled:
    backgroundColor: "{colors.disabled-fill}"
    textColor: "{colors.ink-disabled}"
  button-primary-compact:
    backgroundColor: "{colors.haldi}"
    textColor: "{colors.ink}"
    typography: "{typography.label-compact}"
    rounded: "{rounded.control}"
    height: "48dp"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "56dp"
  input-disabled:
    backgroundColor: "{colors.disabled-fill}"
    textColor: "{colors.ink-disabled}"
  input-compact:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.control}"
    height: "48dp"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "20dp"
  card-pressed:
    backgroundColor: "{colors.sunken}"
  card-turn:
    backgroundColor: "{colors.haldi-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "20dp"
  card-compact:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "12dp"
  badge:
    rounded: "{rounded.badge}"
    typography: "{typography.label}"
    height: "32dp"
  badge-compact:
    rounded: "{rounded.badge}"
    typography: "{typography.label-compact}"
    height: "28dp"
  mark:
    rounded: "{rounded.mark}"
    size: "48dp"
  mark-compact:
    rounded: "{rounded.mark}"
    size: "36dp"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "24dp"
---

<!-- Written with the user before any UI code existed, then reconciled with the implementation in mobile/core/src (theme and ui) on 2026-10-03, after the design review. The code and this file now agree; a change to either updates the other in the same change. -->

# Design System: MedStore

## Overview

**Creative North Star: "Route Marks"**

Dabbawalas paint a few flat colours, a symbol and a short code on every tiffin lid. Those marks get each lunch to the right door through many hands, and the carriers don't have to read a sentence to use them. MedStore works the same way. Every order carries a **mark**: a coloured disc with one glyph, always next to a plain word. A customer who isn't confident with apps can see where their order is at a glance, and a pharmacist can scan a busy queue by mark. The system is flat and painted, not glossy. Its plates are white on a cotton ground, the type is sturdy and sign-like, and colour is rationed so that every colour on screen means something.

One token set serves two densities. The **customer app** is *comfortable*: large type, generous space, one obvious action per screen, built for older people on small, cheap phones with the system font turned up. **MedStore Admin** is *compact*: the same colours, glyphs, shapes and components, with tighter spacing and smaller type so more orders fit on a screen and numbers line up for comparison. Touch targets never shrink below 48 dp in either density.

The structure follows Material Design 3: top app bar, navigation bar or rail, dialogs, and system Back. The brand comes through in Material's own channels: colour roles, type, shape and motion. Material You dynamic colour is **off**, because colours drawn from the user's wallpaper would break the meaning of the marks.

**Key Characteristics:**
- Status is a mark: a coloured disc, a glyph and a word, so it is never shown by colour alone.
- Turmeric (*haldi*) appears only where the customer has to act: the primary button and "Confirm your bill".
- A neutral cotton ground with white plates. Colour lives only in marks, semantic feedback and the primary action.
- One family, Anek Latin, at every size. Every number uses tabular figures.
- Flat by default. Depth means a border or a tonal step, not a shadow.
- Light theme only in v1.

## Colors

A restrained, coded palette: green-tinted ink on a cool cotton ground, one turmeric accent, and six status/semantic families, each with a solid colour, a tint and an "on-tint" text colour.

### Primary
- **Haldi Turmeric** (`haldi`): the brand colour, and the colour of "you need to do this". It fills the primary button and the `AWAITING_CONFIRMATION` mark. It never carries text: ink sits on it (9.07:1).
- **Haldi Pressed** (`haldi-pressed`): pressed state of the primary button (ink on it 7.21:1).
- **Haldi Edge** (`haldi-edge`): the 2 dp painted edge around every turmeric fill. Haldi alone is only 1.82:1 on white, so the edge provides the 3:1 boundary (4.97:1 on surface, 4.53:1 on ground). It is also the icon colour on haldi tint (4.46:1).
- **Haldi Tint** / **On Haldi Tint** (`haldi-tint`, `on-haldi-tint`): background for the "your turn" card and the haldi badge. On-tint text 8.36:1; ink 14.81:1.

### Status and semantic families
Each family has a solid colour (mark disc, icons, coloured text on light surfaces), a tint (badge and banner background) and an on-tint text colour.

| Family | Solid | Used for |
|---|---|---|
| **Slate** (`slate`) | Waiting with someone else | `PENDING_REVIEW`; `AWAITING_CONFIRMATION` in the admin app (staff are waiting on the customer); the **info** semantic |
| **Indigo** (`indigo`) | Being prepared | `CONFIRMED`, `PACKED` |
| **Teal** (`teal`) | Moving | `OUT_FOR_DELIVERY` |
| **Green** (`green`) | Done well | `DELIVERED`; the **success** semantic |
| **Brick** (`brick`) | Stopped by a problem | `REJECTED`, `DELIVERY_FAILED`; the **danger** semantic and destructive buttons |
| **Rust** (`rust`) | Needs attention soon | The **warning** semantic: bill about to expire, cash mismatch |
| **Grey** (`grey`) | Ended without a problem | `CANCELLED` |

Rust and haldi never stand in for each other. Warnings are rust with an `alert-outline` triangle. Haldi only ever means "your move".

### Neutral
- **Cotton Ground** (`ground`): screen background behind plates. Cool, not cream.
- **Plate White** (`surface`): cards, inputs, dialogs, the top app bar.
- **Sunken Cotton** (`sunken`): pressed card and secondary-button background, placeholder blocks while loading, the empty- and error-state disc, the pressed icon button.
- **Ink** (`ink`): primary text, icons, the secondary-button border, the focus ring.
- **Ink Secondary** (`ink-secondary`): supporting text: the next-step line, metadata, quantities × rates.
- **Ink Tertiary** (`ink-tertiary`): placeholders and the least important metadata. Only on `surface`, `ground` or `sunken`.
- **Ink Disabled** / **Disabled Fill** (`ink-disabled`, `disabled-fill`): disabled controls only. WCAG exempts disabled controls from the contrast minimum; they are always paired with a visible reason nearby.
- **Border Subtle** (`border-subtle`): 1 dp dividers and plate outlines. It is decorative, and never the only boundary of something the user has to find.
- **Border Strong** (`border-strong`): input borders and any boundary that identifies a control (3.82:1 on surface, 3.49:1 on ground).
- **Scrim** (`scrim`): ink at 50 % behind dialogs.
- **Pressed Overlay** (`pressed-overlay`, `#17211F1F`): ink at 12 %, the pressed fill of text buttons. Being translucent, it shows on white and on every tint (a text button inside a banner).

### Contrast (WCAG 2.2 AA)
Every pair this system allows, measured. Text needs 4.5:1; marks, icons, borders and focus rings need 3:1. Large display text is held to 4.5:1 anyway.

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| ink | surface / ground / sunken | 16.49 / 15.06 / 13.83 | All primary text |
| ink-secondary | surface / ground / sunken | 7.65 / 6.99 / 6.42 | Supporting text |
| ink-secondary | haldi-tint / brick-tint / disabled-fill | 6.88 / 6.39 / 6.08 | Supporting text inside the turn card, a danger banner, a disabled input |
| ink-tertiary | surface / ground / sunken | 5.63 / 5.14 / 4.72 | Placeholders, minor metadata |
| ink | haldi / haldi-pressed | 9.07 / 7.21 | Primary button label, haldi mark glyph |
| ink | haldi-tint / brick-tint / green-tint / slate-tint / rust-tint | 14.81 / 13.77 / 14.19 / 13.72 / 14.18 | Body text inside tinted plates (banner messages) |
| ink | pressed-overlay on surface / on slate-tint | 12.94 / 10.80 | A pressed text button's label |
| on-haldi-tint | haldi-tint | 8.36 | Haldi badge label |
| surface | slate / indigo / teal / green / brick / rust / grey | 6.91 / 7.97 / 6.09 / 5.13 / 6.54 / 5.71 / 5.63 | White glyph on a mark disc; white text on a danger button |
| surface | brick-pressed | 9.30 | Pressed danger button |
| slate / indigo / teal / green / brick / rust / grey | surface | same as above | Coloured text, icons and mark discs on white |
| slate / indigo / teal / green / brick / rust / grey | ground | 6.31 / 7.28 / 5.56 / 4.68 / 5.97 / 5.22 / 5.14 | The same on the cotton ground |
| on-slate / on-indigo / on-teal / on-green / on-brick / on-rust / on-grey tint | its own tint | 8.22 / 9.23 / 7.69 / 7.01 / 7.77 / 7.66 / 8.20 | Badge and banner text |
| family solid | its own tint | 5.75 / 6.59 / 5.19 / 4.41 / 5.46 / 4.91 / 4.72 | Badge and banner icon |
| haldi-edge | surface / ground / haldi-tint | 4.97 / 4.53 / 4.46 | Edge of every haldi fill; haldi icon on tint |
| border-strong | surface / ground | 3.82 / 3.49 | Control boundaries |
| ink (focus ring) | surface / ground | 16.49 / 15.06 | Focus ring |
| surface | ink | 16.49 | Reserved for inverse text (not used in v1) |

Exempt but recorded: ink-disabled on disabled-fill (2.06:1) and on surface (2.59:1), for disabled controls only. A value people need to read is never shown as a disabled field: use `ReadOnlyField`.

Not allowed: haldi as a text or icon colour, ink-tertiary on `disabled-fill` (4.47:1), and any family solid on another family's tint.

### Theme: light only for v1
v1 ships **light only**. Both apps set `userInterfaceStyle: "light"`.
- Customers are often older, and read in daylight or under bright shop lighting. A light plate with ink text is the most legible combination for them.
- The marks are a code. Each colour was tuned and measured against one ground. A dark scheme needs a second, separately verified set, and haldi in particular changes character on dark.
- Staff read prescription photos on these screens. A neutral light frame doesn't tint how paper and ink look in the photo.
- Two densities × font scales × one theme is already the test matrix. Adding dark doubles it before v1 has any users.

Tokens are colour **roles**, never raw hex in components, so a dark scheme can be added later without touching a single component.

### Named Rules
**The Your-Move Rule.** Turmeric means one thing: the person holding the phone has to act. It appears on at most one button per screen, plus the customer's `AWAITING_CONFIRMATION` mark, badge and turn card. Staff screens use it only for their single primary action, so staff never see a turmeric status (they see "Awaiting customer" in slate). It is never a navigation indicator, a focus cue, a warning or decoration. The placeholder brand mark is the one exception, until the real logo arrives. (The text caret uses `haldi-edge`, the dark edge colour, not turmeric.)

**The Painted Edge Rule.** Every haldi fill carries its 2 dp `haldi-edge` border. A turmeric shape without its edge fails 3:1 against the ground.

**The Quarantine Rule.** Colour appears only in marks, badges, banners, the primary action and destructive actions. Everything else is ink on cotton and white. A screen with no status and no action should be fully neutral.

## Typography

**Display Font:** Anek Latin (by Ek Type), loaded with `expo-font` from `@expo-google-fonts/anek-latin`.
**Body Font:** Anek Latin, the same family.
**Devanagari:** Anek Devanagari, the same design in its Devanagari version, for when Hindi lands.

**Character:** A sturdy Indian humanist sans with the directness of hand-painted shop lettering. It is clear at 13 sp and confident at 34 sp. Its figures are open and easy to tell apart, which matters for prices.

Verified in the font files (`@expo-google-fonts` 0.4.x): Anek Latin and Anek Devanagari both include the ₹ sign (U+20B9) and the OpenType `tnum` (tabular figures) feature. Anek Devanagari covers the full Devanagari block and basic Latin. Hind and Martel were ruled out because they have no tabular figures.

### Weights and loading
Load exactly three weights: `AnekLatin_400Regular`, `AnekLatin_600SemiBold`, `AnekLatin_700Bold`. On Android each weight is its own `fontFamily` name. Text styles set the family name and **never** `fontWeight`, which would make Android synthesise a fake bold.

Base text style: `includeFontPadding: false` (Android) with an explicit `lineHeight` from the scale, so text sits in its line box the same way in both densities.

### Hierarchy
Sizes are in sp, so they follow the phone's font-size setting. The comfortable size is used in the customer app, the compact size in the admin app.

| Role | Weight | Comfortable | Compact | Used for |
|---|---|---|---|---|
| **Display** | Bold | 34 / 42 | 26 / 32 | Bill total, the order hero (mark label on order detail), report totals |
| **Headline** | Bold | 26 / 34 | 21 / 28 | Screen titles |
| **Title** | SemiBold | 21 / 28 | 17 / 24 | Card titles, section headings, dialog titles |
| **Body** | Regular | 18 / 27 | 15 / 22 | Running text, the next-step line, addresses |
| **Body Strong** | SemiBold | 18 / 27 | 15 / 22 | Amounts in rows, emphasised values, list primary line |
| **Label** | SemiBold | 17 / 24 | 14 / 20 | Buttons, field labels, badges, tabs |
| **Caption** | Regular | 15 / 22 | 13 / 18 | Helper text, timestamps, counters |

Customer text never goes below 15 sp, and admin text never below 13 sp. Everything is sentence case. No uppercase labels, no letter-spacing except order numbers (+0.25).

### Numbers
Every price, quantity, total, count, time, distance and order number uses `fontVariant: ['tabular-nums']`, so columns line up and digits don't jitter as a countdown changes. Amounts in a column are right-aligned. The `Text` component has `money` and `number` variants that apply this, so screens never set it by hand.

### Hindi (planned, not in v1)
When Hindi arrives, text in Hindi switches `fontFamily` to Anek Devanagari in the same weights. Android won't fall back from a custom Latin font to Anek Devanagari by itself; it would use the system font instead. Devanagari needs taller lines: Hindi line heights use at least 1.6 × the font size. Every component already lets text grow vertically (see Layout), so no component changes.

### Named Rules
**The One Family Rule.** Anek at three weights, nothing else. Hierarchy comes from size and weight, never from a second typeface or from colour alone.

**The Tabular Rule.** If it is a number someone might compare, check or read aloud, it is tabular.

## Layout

### Spacing
A 4 dp grid. The primitives are in the frontmatter (`xxs` 4 … `4xl` 48). Components never use a primitive directly. They read a **semantic spacing** token, and the density decides its value:

| Semantic token | Comfortable (customer) | Compact (admin) |
|---|---|---|
| `screenPadding` (left and right gutter) | 20 (`lg`) | 12 (`sm`) |
| `sectionGap` (between groups on a screen) | 32 (`2xl`) | 20 (`lg`) |
| `stackGap` (between items in a group) | 16 (`md`) | 8 (`xs`) |
| `inlineGap` (icon to text, mark to label) | 12 (`sm`) | 8 (`xs`) |
| `platePadding` (inside cards, banners) | 20 (`lg`) | 12 (`sm`) |
| `rowPaddingVertical` (list rows) | 16 (`md`) | 10 |
| `controlPadding` (inside buttons and inputs, left and right) | 16 (`md`) | 12 (`sm`) |
| `fieldGap` (label to field, field to helper line, title to message) | 8 (`xs`) | 4 (`xxs`) |
| `dialogPadding` | 24 (`xl`) | 24 (`xl`) |
| `controlHeight` (buttons and inputs, minimum) | 56 | 48 |
| `touchTarget` (minimum, every pressable) | 48 | 48 |
| `touchGap` (minimum between targets) | 8 | 8 |

Density is set once, at each app's root, through a provider in `mobile-core`. Components read it. Screens never pass sizes.

### Structure
- **Customer app:** a single column. Bottom navigation bar with three labelled destinations (Home, Orders, Profile). The screen's one primary action sits in a bottom **action bar** that stays on screen above the keyboard and the system navigation bar, where the thumb is. On screens wider than 600 dp, content is capped at 560 dp and centred.
- **Admin app:** on phones, the order queue and order detail are separate screens. On widths of 840 dp and up (tablets), they become list and detail side by side, with a navigation rail instead of the bottom bar. Staff see only Orders, so no navigation bar is shown for them. The owner gets Orders, Reports, Stores and Customers.
- Width classes come from `useWindowDimensions`: compact < 600, medium 600–839, expanded ≥ 840. No fixed device widths.
- Edge to edge, with safe-area insets on all four sides and the keyboard (IME) inset on every form.

### Surviving the largest font setting
- Never set `allowFontScaling={false}` or `maxFontSizeMultiplier`.
- Nothing that holds text has a fixed `height`. Use `minHeight`, and let text wrap.
- **Stacked mode:** when `fontScale >= 1.3`, any row with a label and a value (bill line, summary row, key-value detail) becomes two lines: label on top, value below and right-aligned. Buttons in a row stack vertically, full width. The bill total steps down from Display to Headline, and the phone field's "+91" patch and text padding halve so all ten digits stay visible.
- **One-line fit:** an amount and a navigation label never break across lines (mid-number or mid-word). They stay on one line and shrink only if they still don't fit the width (`fitOneLine` on `Text`, which `Amount` always sets). Nothing else shrinks.
- Button labels may wrap to two lines. The button grows.
- Admin tabs scroll horizontally and are never squeezed or truncated.
- Every new screen is checked on a 360 × 640 dp phone at font scale 1.0, 1.3 and 2.0.

### Named Rules
**The One-Action Rule.** Each customer screen has exactly one primary (turmeric) button, in the bottom action bar. Everything else is secondary, text, or a pressable card.

**The Grow-Down Rule.** When text gets bigger, the layout gets taller, never clipped and never truncated. Only list rows may truncate, at 2 lines, and only for addresses and medicine names whose full text is one tap away.

## Elevation & Depth

Flat by default. Plates sit on the cotton ground and are separated by the change from `ground` to `surface` plus a 1 dp `border-subtle` outline. Depth is never used to rank importance. Colour and size do that.

Android `elevation` is used in exactly two places:
- **Dialogs:** elevation 6 over the 50 % ink scrim.
- **Menus and bottom sheets**, if one is added later: elevation 3.

The top app bar and the bottom action bar have no shadow. The action bar is separated from the content by a 1 dp `border-subtle` top border.

### Named Rules
**The Painted Not Lifted Rule.** If something needs to stand out, give it a mark, a tint or the haldi edge. Never use a shadow.

## Shapes

- **Marks are circles.** The disc is the signature shape, like the painted circle on a lid. Only marks and the brand mark are circular.
- **Plates** (cards, banners, placeholder rows): 14 dp corners (`plate`) in both densities.
- **Controls** (buttons, inputs): 10 dp corners (`control`).
- **Badges:** 8 dp corners (`badge`). A rounded rectangle, never a pill, so a badge never reads as a button.
- **Dialogs:** 20 dp corners (`dialog`).
- **Borders:** 1 dp for dividers and plate outlines; 2 dp for anything you operate (input, secondary button, haldi edge, mark ring); 3 dp ink for the focus ring, drawn 2 dp outside the control.

## Components

All components live in `mobile/core/src/ui`, read colours, type and spacing only from `theme`, and take density from the provider. State names below: **default, pressed, disabled, loading, error, focused**. "n/a" means the state can't happen for that component.

### Text
The only way to put words on screen.
- **Variants:** `display`, `headline`, `title`, `body`, `bodyStrong`, `label`, `caption`, plus `money` (Body Strong or Display, tabular, right-aligned in rows) and `number` (any role, tabular).
- **Colour prop** limited to roles: `ink` (default), `secondary`, `tertiary`, `disabled` (inside a disabled control only), `onSolid` (white, on a solid fill), the family solids for coloured status text, and `{family}.onTint` for text on a tint. No free hex.
- **Other props:** `tabular`; `fitOneLine` (one line, shrinks only when it can't fit: amounts and navigation labels); `numberOfLines` (list rows only); `letterSpacing` (order numbers only); `underline` (text buttons only).
- **Sizes:** chosen by density (see Typography). Screens never pass a font size.
- **States:** default only. Disabled text belongs to its control.
- Headings (`display`, `headline`, `title`) set `accessibilityRole="header"`, so TalkBack users can jump between them.

### Button
Character: painted, solid, impossible to miss, and never more than one turmeric button per screen.

| Variant | Fill | Border | Label | When |
|---|---|---|---|---|
| `primary` | haldi | 2 dp haldi-edge | ink | The one action this screen exists for |
| `secondary` | surface | 2 dp ink | ink | Other actions (Call, Navigate, Add photo, Retry) |
| `text` | none | none | ink, underlined | Low-weight actions (Forgot password, Change store) |
| `danger` | brick | none | white | Destructive and final actions (Reject, Cancel order, Delete account) |
| `dangerSecondary` | surface | 2 dp brick | brick | A destructive action that isn't the main one on the screen |

- **Sizes:** comfortable 56 dp minimum height, full width by default. Compact 48 dp minimum height, fits its content by default (full width in the action bar). The `text` variant's touch area is still 48 dp tall.
- **Icon:** optional leading icon, 24 dp comfortable / 20 dp compact, with `inlineGap` to the label. With an icon, a label that wraps starts beside the icon (left-aligned) instead of centring away from it. A content-width `text` button starts its label at its own edge rather than centring it, so the label lines up with the text it sits under (a Banner's message); every other button centres its content. Icon-only buttons exist only as the password eye and the input clear button, and they always have an `accessibilityLabel`.
- **Labels** are verbs that say what happens: "Place order", "Confirm bill", "Send bill". Never "OK", "Submit" or "Yes".

| State | Treatment |
|---|---|
| default | As above |
| pressed | primary → `haldi-pressed`; secondary → `sunken` background; text → `pressed-overlay`, so the press shows on tinted banners too; danger → `brick-pressed`. No scale or ripple-only feedback: the fill change must be visible |
| disabled | `disabled-fill` background, `ink-disabled` label, no border. `accessibilityState.disabled`. A visible line nearby says why ("Add at least one photo") |
| loading | A small native spinner replaces the leading icon, the label changes to the ongoing verb ("Placing order…"), and presses are ignored. The button keeps its width: it is always as wide as the wider of its resting and loading content, so a content-width button never jumps. `accessibilityState.busy` |
| error | n/a. A failed action is reported in a Banner, and the button returns to default so the user can retry |
| focused | 3 dp ink ring, 2 dp outside the button (keyboard and switch access). TalkBack draws its own focus. Check focus-event support on `Pressable` in the installed React Native version before building this |

### Input
Character: a label you can always see, a sturdy 2 dp border, and errors that say how to fix them.
- **Anatomy:** label above the field (Label role, ink), the field, then one helper or error line below (Caption). Placeholder text is only an example, never the label.
- **TalkBack:** the field carries the label (the visible label is hidden from TalkBack so it isn't read twice), and its hint is the error, or else the helper, so a rule like "At least 8 characters" is heard before typing.
- **Field:** `surface` fill, 2 dp `border-strong`, 10 dp corners, minimum height 56 (comfortable) / 48 (compact), Body text, 16 dp / 12 dp horizontal padding (`controlPadding`, halved in stacked mode). Text sits centred vertically (`textAlignVertical: 'center'`). Placeholder in `ink-tertiary`. The caret and selection handles are `haldi-edge`.

| Variant | Behaviour |
|---|---|
| `text` | Default single line |
| `multiline` | Order note, reason note. Grows to 5 lines, then scrolls. Live counter "120 / 500" at the right of the helper line, which turns rust within 20 characters of the limit |
| `phone` | A fixed "+91" prefix on a `sunken` patch inside the field (not editable, not part of the value). Phone keypad. Shows "98765 43210" as you type. Accepts 10 digits, and pasted input with +91 or 0 in front |
| `password` | Hidden text, with a 48 dp eye button at the end ("Show password" / "Hide password"). Autofill hint `password` or `new-password`. The helper line states the rule ("At least 8 characters") before any error |
| `code` | 6-digit email code. One field (not six boxes), numeric keypad, tabular figures with wide letter-spacing, one-time-code autofill hint |
| `money` | Admin bill builder. A "₹" prefix, decimal keypad, right-aligned tabular figures. The typed rupee string is parsed to paise; it is never `parseFloat` × 100 |
| `search` | Magnify icon at the start, clear button at the end, 300 ms debounce, `returnKeyType="search"` |

| State | Treatment |
|---|---|
| default | 2 dp `border-strong` |
| pressed | n/a (focus is the visible response) |
| focused | Border becomes 2 dp ink, plus the 3 dp ink focus ring 2 dp outside it, the same ring every control uses. The ring is visible at 15:1 on the ground; turmeric is never a focus cue |
| disabled | `disabled-fill` background, `border-subtle` border, `ink-disabled` text. Label stays ink so the user can still read what the field is |
| loading | For fields that look something up (item-name suggestions): a small spinner at the end of the field. The field stays editable |
| error | 2 dp brick border, an `alert-circle-outline` icon and the message in brick on the line below ("Enter a 10-digit mobile number"). The message comes from the server's `errors[]` or the form's validation. The field gets `accessibilityHint` with the message, so TalkBack reads it |

### ReadOnlyField
A value the user can see but not edit here (the email on the profile). Label (Label role), the value in Body **ink**, and an optional Caption saying why ("Your email can't be changed."). Never a disabled Input: disabled grey is 2:1 and too faint for a value people need to check. TalkBack reads "{label}: {value}" with the reason as the hint.

### Screen
The frame of every route.
- **Variants:** `scroll` (content scrolls), `list` (the content is a FlatList that owns scrolling), `form` (keyboard avoiding + scroll with `keyboardShouldPersistTaps="handled"`).
- **Parts:** a top app bar (`surface`, minimum height 64 / 56 dp below the status-bar inset, title in Headline that wraps rather than truncating, Back arrow when there's history, at most one trailing action), the content on `ground` with `screenPadding`, and an optional bottom action bar (`surface`, 1 dp top border, holds the primary button, sits above the IME and system navigation inset).
- **States:** Screen doesn't own data states. Its content renders Loader, ErrorState, EmptyState or the data. System Back always works and is never intercepted, except to confirm leaving a half-filled order ("Discard this order?").

### Card
A white plate.

| Variant | Treatment |
|---|---|
| `plain` | `surface`, 1 dp `border-subtle`, 14 dp corners, `platePadding`, contents `stackGap` apart. No chevron |
| `pressable` | As `plain`, plus a trailing `chevron-right` and `accessibilityRole="button"`, with a label that describes the whole card ("Order S T 0 1, 0 0 0 0 4 2, Status: On the way, 1 thousand 250 rupees"). TalkBack reads only that label, so it is required by the component's type for `pressable` and `turn` cards and must include everything the card shows that matters, status included |
| `turn` | The "your turn" plate: `haldi-tint` fill, 2 dp `haldi-edge` border, and the trailing `chevron-right` (it opens the bill). Used only where the customer must act (a bill waiting for confirmation). At most one per screen. It holds no status badge: the tint already says "your turn", and a haldi badge on haldi tint loses its plate. Typical content: "Your bill is ready", the total, "Confirm by 4:30 PM" and the Countdown |

| State | Treatment |
|---|---|
| default | As above |
| pressed | `plain` and `pressable` turn `sunken`. The `turn` card keeps its haldi tint, so its meaning doesn't flicker, and its border changes from haldi-edge to ink |
| disabled | n/a. A card that can't be opened isn't pressable |
| loading | A placeholder plate: same size, `sunken` blocks where text will be, no shimmer |
| error | n/a. Errors are a Banner or ErrorState, not a card style |
| focused | 3 dp ink ring outside the plate |

### Loader
Character: honest about waiting, quiet, and never a full-screen block if partial content exists.

| Variant | Use |
|---|---|
| `screen` | First load with nothing to show: the native Android spinner in ink (48 dp) and a Body line saying what's loading ("Loading your orders"). The line appears after 400 ms so fast loads don't flash. After 10 s it adds "Still loading. Your connection may be slow." |
| `inline` | Inside buttons and fields: the native spinner at 20 dp |
| `placeholder` | Lists: three static placeholder plates the shape of real rows (`surface` with a 1 dp `border-subtle` outline, holding a `sunken` title block at 45 % width and a body block at 80 %, each as tall as its line at the current font size). No shimmer, which costs battery on cheap phones and moves under reduced motion |

States: only default; a Loader is itself a state. The `screen` loader sets `accessibilityLiveRegion="polite"` so its text is announced.

### ErrorState
Shown in place of content that failed to load.
- **Variants:** `screen` (centred in the content area) and `section` (inside a card, when only part of a screen failed).
- **Anatomy:** a 56 dp grey disc with the icon (`cloud-off-outline` for a network error, `alert-circle-outline` for everything else), a Title ("Couldn't load your orders"), one Body line from `getErrorMessage` (never a code), and a secondary **Retry** button, content width and centred under the text. Retry has no icon: a refresh glyph looks like the spinner it becomes while retrying.
- The title and message are announced when the state appears (`announceForAccessibility`): Android live regions only announce changes to views that already exist.
- **States:** default; retrying (the Retry button is `loading`); n/a for the others.

### EmptyState
Shown when a list loaded and has nothing in it.
- **Anatomy:** a 56 dp `sunken` disc with a grey glyph that suits the list, a Title, one Body sentence saying what will appear here and how, and at most one action: a **secondary** button, content width and centred. An empty state never holds a turmeric button; the screen's one primary action stays in its bottom action bar.
- **Examples:** Customer orders: `clipboard-text-outline`, "No orders yet", "Upload a photo of your prescription and a nearby pharmacist will send you a bill.", with a secondary "Upload prescription" button. Admin "New" tab: `file-search-outline`, "No new orders", "New orders appear here. This list refreshes every 20 seconds." (no action).
- **States:** default only. No illustrations.

### StatusBadge — the mark (signature component)
The mark is how status is shown, everywhere, always as **disc + glyph + word**. It reads the status from `@medstore/shared` and its label, colour and glyph from one map in `mobile-core`. No screen picks a status colour itself.

| Variant | Anatomy | Where |
|---|---|---|
| `mark` | A disc (48 dp comfortable / 36 dp compact) in the family's solid colour with a white glyph (28 / 20 dp), and the label beside it in Title ink. Customer app adds the next-step line beneath it in Body ink-secondary | Order detail header, customer home's active order |
| `badge` | A rounded rectangle (8 dp corners, minimum height 32 / 28 dp) in the family tint, glyph (18 / 16 dp) in the family solid, label in Label on-tint | List rows, the admin queue, the timeline |

In the customer app, the `AWAITING_CONFIRMATION` mark is a haldi disc with a 2 dp haldi-edge ring and an **ink** glyph, and its badge is haldi tint with a haldi-edge glyph and on-haldi-tint label. In the admin app the same status is slate ("Awaiting customer"): staff are waiting, not acting, so it shares slate with "New" and differs by glyph and word. The family per app comes from `statusLook(status, app)`; no screen picks it.

In the `mark` variant the label's first line is centred on the disc, and a wrapping next-step line grows downwards only. The badge is not interactive, so it has no touch-target minimum. It sets `accessibilityLabel` to "Status: {label}".

**Order statuses** (`OrderStatus` in `@medstore/shared`; the glyphs are Material Community Icons names, all checked against `@expo/vector-icons` 15.1.1):

| Status | Customer label | Staff label | Family | Glyph | Customer next-step line |
|---|---|---|---|---|---|
| `PENDING_REVIEW` | Being checked | New | slate | `file-search-outline` | "A pharmacist is checking your photos. You'll get a bill here." |
| `AWAITING_CONFIRMATION` | Confirm your bill | Awaiting customer | haldi (customer) / slate (staff) | `receipt-text-clock-outline` | "Check the bill and confirm by {time}. If you don't, the order is cancelled." |
| `CONFIRMED` | Confirmed | Confirmed | indigo | `receipt-text-check-outline` | "The store is getting your medicines ready." |
| `PACKED` | Packed | Packed | indigo | `package-variant-closed` | "Your order is packed. It goes out for delivery next." |
| `OUT_FOR_DELIVERY` | On the way | Out for delivery | teal | `moped-outline` | "Keep {total} ready in cash." |
| `DELIVERED` | Delivered | Delivered | green | `check-decagram-outline` | "Handed over: {dateTime}." (the mark already says "Delivered") |
| `DELIVERY_FAILED` | Couldn't deliver | Delivery failed | brick | `map-marker-alert-outline` | "The store couldn't deliver this order. The reason is below." |
| `REJECTED` | Not accepted | Rejected | brick | `file-cancel-outline` | "The pharmacist couldn't accept this order. The reason is below." |
| `CANCELLED` | Cancelled | Cancelled | grey | `close-circle-outline` | "This order was cancelled. The reason is below." |

Labels are display text, so they live in `mobile-core` next to the reason-code labels. A status this build doesn't know (added on the server after release) shows as grey `help-circle-outline` with "Status not available" (customer) or "Unknown status" (staff), and no next-step line. `CONFIRMED` and `PACKED` share a family and differ by glyph and word. `REJECTED` and `DELIVERY_FAILED` share brick for the same reason.

**Motion:** when a status changes while the user watches (on refetch or a push), the old disc shrinks to 0.9 and fades over 120 ms, and the new one lands with a 1.08 → 1 scale over 220 ms (standard easing). Under reduced motion the mark swaps instantly. The change is announced through the screen's live region ("Status: On the way").

### ConfirmDialog
For decisions that must interrupt. A Material dialog.
- **Anatomy:** title as a question in Title ("Reject this order?"), one Body paragraph saying what happens next ("The customer gets a notification with the reason. This can't be undone."), optional extra content, then the actions.
- **Variants:** `default` (primary confirm), `destructive` (danger confirm), `withReason` (a list of radio rows for the reason codes from `@medstore/shared`, labels from `mobile-core`, each row 48 dp+, plus a multiline note that becomes required when `OTHER` is chosen).
- **Actions:** the confirm label is a verb ("Reject order", "Cancel order", "Delete account"). The dismiss label says what staying means ("Keep order", "Go back"). In compact density with normal font size, they sit side by side, right-aligned, dismiss on the left as a `text` button, `touchGap` apart. In comfortable density, or in stacked mode, they stack full width with confirm on top and dismiss as a `secondary` button.
- **Size:** full width minus `screenPadding` (plus the safe-area insets) on phones, at most 560 dp wide. Body text is `stackGap` apart.
- **withReason note:** labelled "Note (optional)", or "Note (required)" once `OTHER` is chosen.

| State | Treatment |
|---|---|
| default | 20 dp corners, elevation 6, 50 % ink scrim, 24 dp padding. Enters by fading in and growing from 0.95 (`emphasized`); exits by fading out (`exit`). Back press and tapping the scrim dismiss it. The scrim is touch-only: TalkBack users get the dismiss button and Back, not a second copy of it |
| pressed | Buttons behave as Button |
| disabled | The confirm button is disabled until a required reason (and a required note) is given |
| loading | Confirm button `loading`. The dialog can't be dismissed (Back, scrim and dismiss do nothing) until the request settles |
| error | A danger Banner appears inside the dialog, above the actions and outside the scrolling body, so a long reason list never hides it. The dialog stays open with its input intact |
| focused | Focus moves into the dialog when it opens (title first for TalkBack) and returns to the button that opened it when it closes: the screen passes that button's ref as `returnFocusTo` |

### Banner — the feedback pattern after an action
**Choice: inline banners, not snackbars or toasts.**
- Customers are often older, may have the font at 200 %, and may not be looking at the bottom of the screen. A snackbar disappears after a few seconds, and that is a time limit on information they need. At large font sizes it also covers the action bar where they are about to tap.
- A banner appears at the top of the content, where the result of the action belongs. It stays until the user does something else or dismisses it. TalkBack announces it through a live region (`polite` for success and info, `assertive` for errors).
- The admin app uses the same banner at compact density, so staff learn one pattern. Banners there clear on the next action, so they never pile up.
- Material's guidance prefers snackbars for transient feedback. This is a deliberate deviation for this audience.

| Variant | Fill | Icon | Example |
|---|---|---|---|
| `success` | green tint | `check-circle-outline` (green) | "Order placed. A pharmacist will check your photos and send you a bill." |
| `info` | slate tint | `information-outline` (slate) | "The store updated your bill. Please check the new total." |
| `warning` | rust tint | `alert-outline` (rust) | "This bill expires at 4:30 PM." |
| `danger` | brick tint | `alert-octagon-outline` (brick) | "Couldn't confirm your bill. Check your internet connection and try again." |

- **Anatomy:** a plate with 14 dp corners and `platePadding`; its parts are `fieldGap` apart. A title row: icon (24 / 20 dp, in the family solid) with `inlineGap`, then the title in Body Strong on-tint. Below it, at the plate's full width: an optional message in Body ink, then an optional action (a content-width text button: "Retry", "View order") whose label lines up with the message.
- **Dismiss:** an optional close button (48 dp, "Dismiss") in the plate's top-right corner, with its glyph on the plate's padding edge. It is positioned on the plate, not in the title row, so its 48 dp target never makes the row taller than the title and the title-to-message gap is the same with or without it. Only the title row leaves room for it, so the message isn't squeezed at large font sizes.
- The icon and the close button are centred on the title's **first line**, so a title that wraps grows downwards and both stay beside its start.
- The banner is announced when it appears (`announceForAccessibility`), since Android live regions don't announce a newly mounted view.
- When an action moves the user to another screen (Reject → back to the queue), the banner shows on the destination screen ("Order ST01-000042 rejected.").
- **States:** default, and the action button's own states. A banner is never pressable as a whole.

### Navigation
- Bottom navigation bar (customer; admin owner on phones): `surface` with a 1 dp top border, minimum height 80 / 72 dp above the system navigation inset, three or four destinations, icon + label always visible (Label role). The indicator is a 64 × 32 / 56 × 28 dp capsule; a pressed inactive destination shows it in `sunken`. The active destination has an ink label and its icon on a `sunken` indicator with a 2 dp ink outline, so the active one isn't shown by colour alone and turmeric stays free for "your move". Labels use one-line fit, so "Customers" never breaks mid-word at large font sizes. Inactive destinations: ink-secondary.
- Admin tabs (New, Awaiting customer, Preparing, Out for delivery, Delivered, Closed): a horizontally scrolling row. Each tab shows its label and a tabular count. The selected tab has a 3 dp ink underline and an ink label; others are ink-secondary. When the selected tab is off screen (large font sizes, or a screen that opens on "Closed"), the row scrolls just enough to show it.

### Money, dates, times and order numbers
All formatting goes through `mobile-core/format`. No screen formats these values by itself.

**Money** (`formatCurrency`, from integer paise):
- "₹1,23,456.50": the ₹ sign directly before the number, Indian digit grouping (lakh and crore), and **always two decimals**, including "₹450.00" and "₹0.00". A missing ".00" is the kind of ambiguity Principle 2 rules out.
- The grouping is done from the integer, not with `Intl` and not with floats, so the result doesn't depend on the device.
- Discounts and shortfalls use a real minus sign (U+2212): "−₹20.00". Report differences read "+₹50.00 extra" or "−₹50.00 short", in rust with the warning icon. A match reads "Matches" in green.
- Bill rows: the item name on line 1, then "2 × ₹45.50" in ink-secondary on the left and the line total right-aligned in Body Strong. The total is a Display-size amount in its own row under a 1 dp rule. All amounts are tabular.
- A value that isn't whole paise (missing from a response) shows "—" and is read as "Amount not available": never a guessed amount, and never a crash that takes the screen down.
- Every amount has an `accessibilityLabel` in Indian units, such as "1 thousand 250 rupees 50 paise" or "1 lakh 23 thousand 456 rupees".
- **Rows:** `AmountRow` (a label and a right-aligned amount; `total` puts a Display amount under a 1 dp rule) and `BillRow` (the bill line above). Both stack in stacked mode and read as one phrase to TalkBack. In an `AmountRow` the label never shrinks (labels are a word or two); an amount too long for what's left of the row shrinks to fit (one-line fit) instead of squeezing the label.
- **Admin rows** (in the admin app, since only it uses them): `OrderRow` is the queue row, two lines on `surface` split by hairlines: the order number (sequence emphasised) and the right-aligned total, then the staff badge and the waiting time ("Waiting 12 min", or the countdown, rust with `timer-sand` when urgent). No patient names, photos or medicines. Its TalkBack label is built from all four. `CashMismatchRow` lists a report mismatch: the order number and `CashDifference` ("+₹50.00 extra" / "−₹50.00 short" in rust with `alert-outline`, "Matches" in green with `check-circle-outline`), then "Expected ₹X · Collected ₹Y" in Caption.

**Dates and times** (`formatDateTime`, always computed in Asia/Kolkata):

| Style | Output |
|---|---|
| `time` | "4:30 PM" |
| `dateTime` | "Today, 4:30 PM" · "Yesterday, 9:05 AM" · "Mon 28 Sep, 4:30 PM" · "28 Sep 2025, 4:30 PM" (a different year) |
| `date` | "Mon 28 Sep" · "28 Sep 2025" |
| `waiting` (admin) | "Just now" · "12 min" · "1 h 5 min" · "2 days" |
| `countdown` (bill expiry) | "25 min left"; under 10 minutes it turns rust with a `timer-sand` icon; at zero, "Time's up". Drawn by the `Countdown` component, which TalkBack reads in whole words ("25 minutes left") |

- Always 12-hour clock with AM/PM, never seconds, never ISO strings.
- The customer app never shows "IST". The admin daily report states it once in its header ("Report for Mon 28 Sep 2026 (IST)").
- Countdowns and waiting times update once a minute, not every second, and again as soon as the app returns to the foreground, so a phone left in a pocket never shows a stale time.

**Order numbers:**
- Always shown in full as the server sends them: "ST01-000042". Never trimmed, and leading zeros are never dropped.
- Tabular figures, +0.25 letter-spacing. In admin rows the sequence part is Body Strong and the store code is Body, so the changing digits stand out.
- `accessibilityLabel` spaces the characters ("S T 0 1, 0 0 0 0 4 2") so TalkBack reads them one by one, the way staff read them out on the phone.

**Phone numbers:** "+91 98765 43210".

### Brand mark (placeholder)
Until a real logo exists, the brand mark is a haldi disc with its haldi-edge ring and an ink "M" in Title (SemiBold), next to the wordmark "MedStore" (or "MedStore Admin") in Headline Bold ink. It is drawn by one component, `BrandMark`, and used nowhere else, so the real logo replaces one file. App icons are separate image assets and get replaced the same way.

### Icons
One set only: **Material Community Icons** from `@expo/vector-icons` (15.1.1, installed in both apps with `npx expo install`). Outline style throughout. Sizes: 24 dp comfortable / 20 dp compact inline, 18 / 16 dp in badges, 28 dp in the empty- and error-state disc; mark glyphs as above. Icons are sized in dp and don't follow the font size (they sit in fixed discs); the text beside them does. Icon-only buttons are 48 dp circles that turn `sunken` when pressed. An icon is never the only label of anything. Every icon next to text is decorative to TalkBack (`importantForAccessibility="no"`), and the few icon-only buttons have an `accessibilityLabel`.

### Motion
Motion confirms that something happened. It never decorates. Everything runs on `react-native-reanimated`.

| Token | Duration | Easing | Use |
|---|---|---|---|
| `fast` | 120 ms | standard | Press feedback, the old mark leaving, banner exit |
| `standard` | 220 ms | standard | The new mark landing, banner enter |
| `emphasized` | 320 ms | emphasized decelerate | Dialog enter, screen transitions (the platform's default stack transition) |
| `exit` | 160 ms | accelerate | Dialog exit |

- **Easing curves** (Material 3): standard `bezier(0.2, 0, 0, 1)`, emphasized decelerate `bezier(0.05, 0.7, 0.1, 1)`, accelerate `bezier(0.3, 0, 0.8, 0.15)`.
- **Reduced motion:** when the system's "Remove animations" setting is on (`useReducedMotion()` / `ReduceMotion.System` in Reanimated 4.5, both confirmed in the installed version), every movement becomes an instant change or a 120 ms fade with no scale or translation. Nothing loops in either mode. Spinners are the native ones, which follow the system setting themselves.

## Do's and Don'ts

### Do:
- **Do** show every status as mark or badge: disc or tint + glyph + word, from the one status map.
- **Do** keep exactly one turmeric action per customer screen, in the bottom action bar, with its 2 dp haldi edge.
- **Do** set every amount through `formatCurrency` with tabular figures, two decimals and right alignment in columns.
- **Do** tell the user what happens next, in the next-step line under a mark, in dialog bodies and in banners.
- **Do** test each screen at font scale 1.0, 1.3 and 2.0 on a 360 × 640 dp phone, and switch label-value rows to stacked mode at 1.3.
- **Do** keep every pressable at least 48 × 48 dp with 8 dp between targets, in both densities.

### Don't:
- **Don't** show a status by colour alone: no coloured dots, no tinted rows without a badge, no colour-only tabs.
- **Don't** use turmeric for warnings, decoration, headers or anything the customer doesn't have to act on. Warnings are rust.
- **Don't** disable font scaling (`allowFontScaling={false}`, `maxFontSizeMultiplier`), or give text containers a fixed height.
- **Don't** use snackbars or toasts for results. Use the Banner.
- **Don't** show prescription images, medicine names or patient names in lists, banners, empty states or any preview. They appear only on order detail.
- **Don't** show raw error codes, status enums (`OUT_FOR_DELIVERY`), ISO dates, paise values or a currency without ₹.
- **Don't** use gradients, glassmorphism, shadows for emphasis, emoji, hero illustrations, a green cross, or a pill-shaped badge.
- **Don't** add a second typeface, a second icon set, uppercase labels, or a dark theme in v1.
- **Don't** enable Material You dynamic colour. Brand and status colours are fixed.
- **Don't** shimmer placeholders or animate anything in a loop.
