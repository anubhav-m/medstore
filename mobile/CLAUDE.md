# Mobile — CLAUDE.md

Two Expo (React Native) apps for Android plus a shared package. TypeScript in strict mode everywhere. The root `CLAUDE.md` rules (especially section 3, the domain rules) apply here too; this file adds mobile rules.

## 1. Structure

```text
mobile/
├── core/                     # @medstore/mobile-core — TypeScript source, no build step
│   └── src/
│       ├── ui/               # Button, Input, Text, Screen, Card, Loader, ErrorState, EmptyState,
│       │                     # StatusBadge, ImageViewer, ConfirmDialog
│       ├── theme/            # colors, spacing, typography, radii
│       ├── api/              # createBaseQuery: auth header, single-flight refresh, error normalisation
│       ├── auth/             # SecureStore token storage
│       ├── errors/           # error-messages.ts (code → user text), getErrorMessage.ts
│       ├── format/           # formatCurrency (paise → ₹), formatDateTime (IST), formatPhone
│       └── index.ts
├── customer/
│   └── src/
│       ├── app/              # Expo Router — thin route files only
│       ├── features/         # auth, onboarding, addresses, stores, orders, profile
│       ├── store/            # configureStore, typed hooks, baseApi
│       └── config/env.ts
└── admin/
    └── src/
        ├── app/
        ├── features/         # auth, orders, stores, customers, reports
        ├── store/
        └── config/env.ts
```

Each feature folder:

```text
features/orders/
├── components/               # feature-specific UI
├── screens/                  # compose components + hooks
├── hooks/                    # logic lives here, not in JSX
├── api.ts                    # RTK Query endpoints injected into the app's baseApi
├── slice.ts                  # client state for this feature (only if needed)
└── index.ts                  # the feature's public API
```

### What goes where

- Code needed by **both** apps goes in `core`. Code needed by one app stays in that app. **Never copy code between apps** — move it to `core` instead.
- Constants, types and the order transition table come from `@medstore/shared`. Never redefine statuses, error codes or limits.
- `core` never imports from an app. It lists `react`, `react-native` and `expo-*` packages as **peerDependencies** — a second copy of React causes "Invalid hook call" errors. Check with `npm why react`.
- Expo's default Metro config handles npm workspaces. Don't add custom `watchFolders` or resolver config unless `expo-doctor` or a build error requires it.
- Route files in `src/app` contain no logic: they import a screen and export it. Nothing except routes lives in `src/app`.
- Import with the `@/` alias inside an app and by package name across packages — never deep relative paths (`../../../`).
- Each app has its own `app.config.ts` with a distinct name, slug, scheme, icon and Android package. Names for now: **MedStore** and **MedStore Admin** (they will change). The package prefix is an open decision (root D3) — ask before scaffolding an app.

## 2. Components & UI

- **Everything is a modular component.** Screens compose; components present; hooks hold logic. Components stay under ~150 lines.
- **One component per purpose, with variants.** One `Button` with a `variant` prop — never `MyButton`, `PrimaryButton`, `CustomButton`.
- Only React Native primitives: `View`, `Text`, `Pressable`, `TextInput`, `FlatList`/`ScrollView`, `expo-image`. **Never** `div`, `span`, `button`, `input` or CSS files.
- Styles via `StyleSheet.create` with values from `theme` — no magic numbers or colors. **No web-only CSS**: `:hover`, `::before`, `cursor`, `position: sticky`, `overflow-x`, `backdrop-filter`.
- **Responsive**: `flex`, percentages and `useWindowDimensions` — never fixed device sizes like `width: 400`. Works on small phones, large phones and (admin) tablets.
- Safe areas via `react-native-safe-area-context`; status bar via `expo-status-bar`.
- **Keyboard**: every screen with inputs uses `KeyboardAvoidingView` and/or a `ScrollView` with `keyboardShouldPersistTaps="handled"`. Forms stay usable with the keyboard open.
- **Lists**: `FlatList` with `keyExtractor` and a memoized item component. Never `items.map()` inside a `ScrollView` for dynamic lists.
- Touch targets ≥ 48×48 dp with ≥ 8 dp between them (Material 3); interactive elements have `accessibilityLabel` / `accessibilityRole`.
- Animations use `react-native-reanimated`.
- Delete Expo template leftovers right after scaffolding (example directories, `reset-project` script, sample themed components, unused assets).

## 3. State management — Redux Toolkit

- **Server data → RTK Query.** Each app has one `baseApi` built with `createBaseQuery` from `core`, with `injectEndpoints` per feature and tags for invalidation. Components never call `fetch`; screens never contain API code.
- **Client state → slices** (`createSlice`): auth session, selected store and address, UI flags. Keep the store serializable.
- Typed hooks `useAppDispatch` / `useAppSelector`. Derived data from selectors (`createSelector`) or `useMemo` — **never** `useEffect` + `setState`.
- No prop drilling past two levels. No arrays of separate `useState`s for collections.
- `createBaseQuery` handles the auth header, `401` with code **`TOKEN_EXPIRED`** → single-flight refresh → retry, and logout when refresh fails. Any other 401 (e.g. `INVALID_CREDENTIALS` for a wrong current password) is a normal error shown to the user — it never triggers a refresh or logout.
- Logout sends the refresh token and this device's push token in the body, then clears SecureStore.
- React Native has no window focus events: call `setupListeners` with an `AppState`-based handler so refetch-on-focus and reconnect work.

## 4. Errors: always visible, always human

Users never see raw errors, status codes, stack traces or developer messages.

- Backend failures arrive as `{ success: false, message, code, errors? }`. `getErrorMessage` in `core` is the **only** converter from any error to user text:
  - `code` → `error-messages.ts`, for example:
    - `STORE_CLOSED` → "This store isn't taking orders right now. Please check its opening hours."
    - `OUTSIDE_DELIVERY_AREA` → "This store doesn't deliver to the selected address. Pick a nearer store or another address."
    - `TOO_MANY_OPEN_ORDERS` → "You already have orders in progress. Please wait for one to finish before placing another."
    - `BILL_CHANGED` → "The store updated your bill. Please review the new total before confirming."
    - `ORDER_STATUS_CHANGED` → "Someone else already updated this order. Showing the latest version." (then refetch)
    - `ACCOUNT_BLOCKED` → "Your account can't place orders right now. Please contact the store."
    - `BILL_EXPIRED` → "This bill has expired and the order was cancelled. You can place a new order."
  - `FETCH_ERROR` → "Can't reach the server. Check your internet connection and try again."
  - `TIMEOUT_ERROR` → "This is taking too long. Please try again."
  - Session expired after a failed refresh → "Your session expired. Please sign in again." (and log out)
  - 5xx or unknown code → "Something went wrong on our side. Please try again."
- Some codes navigate instead of showing text: `ONBOARDING_REQUIRED` → onboarding, `PASSWORD_CHANGE_REQUIRED` → change-password screen.
- Field-level `errors[]` are shown **under the matching input**.
- Every data screen renders **loading, error (with Retry), empty and success** states using the `core` components.
- Every mutation gives visible feedback on both success and failure.
- A root `ErrorBoundary` (Expo Router's exported `ErrorBoundary`) shows a friendly fallback on render crashes.
- Every error code in `@medstore/shared` has a message in `error-messages.ts` — add it in the same change as the code.

## 5. Effects, performance, cleanup

- Every `useEffect` that starts a timer, listener, subscription or poll returns a cleanup.
- Memoize list items (`React.memo`) and callbacks passed to them (`useCallback`).
- Don't use `useEffect` for values that can be computed during render.
- Debounce search inputs (order search, item-name suggestions).

## 6. Permissions & device features

- Request permission **before** using a feature, at the moment the user asks for it, and handle "denied" with an explanation and a shortcut to system settings. Never fail silently.
  - Camera: `ImagePicker.requestCameraPermissionsAsync()` before `launchCameraAsync`.
  - Location: foreground only, requested when the user taps "Use current location". If denied, the user can still move the map manually.
  - Notifications: customer app after the first successful order; admin app at first login.
- Maps use `react-native-maps` with the Google provider. The key is read in `app.config.ts` from `GOOGLE_MAPS_ANDROID_API_KEY` at build time.
- The address picker uses a **fixed centre pin** (the map moves under it). `Location.reverseGeocodeAsync` prefills the text fields, which stay editable. House/flat and pincode are required.
- Never call Google web APIs (Places, Geocoding, Distance Matrix, Routes) from the apps.

## 7. Security

- **Tokens live in `expo-secure-store`** via `core/auth` — never AsyncStorage, never `redux-persist` with AsyncStorage. Hydrate the auth slice from SecureStore on start. AsyncStorage is only for non-sensitive preferences (e.g. last selected store).
- `EXPO_PUBLIC_*` variables are bundled into the app and are **public**. Only the API URL and public client IDs go there.
- Never log tokens, images, phone numbers, addresses, patient names, notes or bill items.
- Money: the API sends paise integers; display only via `formatCurrency`. Never do float math on money.

## 8. Expo specifics

- Install packages with `npx expo install <pkg>` from inside the app folder so versions match the SDK. Prefer `expo-*` modules over bare React Native equivalents.
- Before adding a package, check it supports this Expo SDK. If it needs native code (a development build), say so before adding it.
- Expo Router is the **only** navigation system. Enable typed routes and type all route params. Guard route groups in layouts using auth state and `onboardingCompleted` (customer) / `mustChangePassword` (admin).
- Run `npx expo-doctor` in each app after dependency changes.

## 9. Customer app

- **Flow**: sign in / sign up → verify email (email sign-ups; register returns no tokens, `verify-email` does) → onboarding (name, phone, first address, consent to `CONSENT_VERSION`) → home. `EMAIL_NOT_VERIFIED` on login goes to the verify-email screen (a new code has been sent).
- **Google Sign-In** uses `@react-native-google-signin/google-signin`, which needs a **development build**; Expo Go cannot run this app. Send the ID token to `POST /auth/google`.
- **Home**: header with the selected delivery address and store, a primary "Upload prescription" action, and active orders.
- **Store selection** calls `GET /stores?addressId=` and shows each store's server-computed status ("Delivers here · 2.3 km", "Out of range · 7.1 km", "Closed · opens 10:00 AM"). "Select nearby" picks the nearest store that is open and delivers to the address; if only one qualifies, preselect it.
- **Upload**: camera or gallery, up to 5 images. Each image is resized to max 1600px and saved as JPEG (~0.7 quality) with `expo-image-manipulator` before upload. Upload each image with a plain HTTP `PUT` to the signed URL from `POST /uploads/prescriptions` (confirm the exact request format against Supabase's signed-upload docs when implementing) — the app never installs `@supabase/supabase-js` or holds a Supabase key. Show per-image upload state with retry; submit stays disabled until every image is uploaded. Generate the `Idempotency-Key` once per submission (`expo-crypto` `randomUUID`) and reuse it on retries.
- **Orders**: active and past lists (`GET /orders?scope=active|past`).
- **Order detail**: status timeline from `statusHistory`; when `AWAITING_CONFIRMATION`, a bill card showing "Confirm by {billExpiresAt}" with Confirm (sends `billVersion`) and Cancel (optional reason from the shared customer-cancel codes). Show Cancel only where the transition table allows it. "Reorder" only on `DELIVERED` orders, with its own `Idempotency-Key`.
- **Profile**: edit details, manage addresses (max 10), change password (only when `hasPassword`; otherwise point to forgot-password), sign out, delete account. Deleting asks for the password, or a fresh Google sign-in for accounts without one, and explains `ACCOUNT_HAS_OPEN_ORDERS`.

## 10. Admin app

- **Flow**: login → change password if `mustChangePassword` → store picker if the admin has more than one store (owner also gets "All stores") → orders home. On app start with stored tokens, call `GET /admin/me` for role, stores and `mustChangePassword` — never decode the JWT for them.
- **Orders home**: status tabs with counts from `ADMIN_ORDER_TABS` in `shared` (New, Awaiting customer, Preparing, Out for delivery, Delivered, Closed) with the sort defined there. New shows waiting time. Search by order number or phone. Poll every 20 seconds while the app is foregrounded (RTK Query `pollingInterval`, stopped in the background) plus pull-to-refresh.
- **Order detail**: zoomable, rotatable images (never cached to disk — check `expo-image`'s cache options for the installed version); patient name, customer note, tap-to-call (`Linking` `tel:`), address with a Navigate button (Google Maps URL), timeline. Actions come from the shared transition table for the current status and role.
  - Reject, cancel, delivery failed: reason codes from `shared` plus a note (required for `OTHER`).
  - Bill builder: rows of name (debounced suggestions), quantity and unit price; delivery fee; discount. Prices are typed in rupees and converted to paise by **parsing the string** (max 2 decimals) — never `parseFloat(x) * 100`. The total shown is a preview; the server's total is final.
  - Delivered: confirm the cash collected.
  - On `ORDER_STATUS_CHANGED`: show the message and refetch.
- **Owner-only** screens (store settings and creation, blocking customers, reports) are hidden from staff. The server still enforces this.
- **Notifications**: an Android channel for new orders with high importance and sound. Register the push token with `POST /admin/me/push-tokens` at first login.
- **Distribution**: EAS build profile producing an APK for internal distribution — not published on the Play Store.

## 11. Environment variables

```text
customer: EXPO_PUBLIC_API_URL  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  GOOGLE_MAPS_ANDROID_API_KEY (build time)
admin:    EXPO_PUBLIC_API_URL  GOOGLE_MAPS_ANDROID_API_KEY (build time)
```

Read only in `src/config/env.ts` (and `app.config.ts` for the build-time key).

## 12. Commands (from `mobile/customer/` or `mobile/admin/`)

```bash
npx expo start               # customer app needs a development build
npx expo install <pkg>
npm run lint
npm run typecheck            # tsc --noEmit
npm run knip
npx expo-doctor
eas build --profile development
eas build --profile preview
eas build --profile production
```
