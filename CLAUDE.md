# Medical Store — CLAUDE.md

Customers photograph a prescription or medicine, choose a nearby store and place a cash-on-delivery order. Store staff review the photos, then reject the order or send a bill, and deliver it. There is **no product catalog, no cart, no chat and no online payment**.

This file holds the project-wide rules. `backend/CLAUDE.md` and `mobile/CLAUDE.md` add the rules for those folders. **Before writing any code in `backend/` or `mobile/`, read that folder's CLAUDE.md**, even when creating new files there. If a request conflicts with a rule, say so and ask before breaking it.

## Repo layout

```text
medical-store/                # npm workspaces
├── CLAUDE.md
├── package.json              # workspaces + repo-wide scripts and dev tooling only
├── eslint.config.js          # flat config for all workspaces (JS + TS)
├── knip.json                 # one entry per workspace
├── .prettierrc.json          # + .prettierignore (Markdown is hand-formatted, not Prettier'd)
├── .gitattributes            # * text=auto eol=lf
├── .nvmrc                    # exact Node version
├── .npmrc                    # engine-strict=true: npm refuses the wrong Node version
├── backend/                  # Express + MongoDB API — JavaScript, ES modules
├── shared/                   # @medstore/shared — constants + types used by backend AND apps
└── mobile/
    ├── core/                 # @medstore/mobile-core — UI kit, theme, API base, error messages (both apps)
    ├── customer/             # Expo app for customers (Play Store)
    └── admin/                # Expo app for store staff and the owner (APK, internal distribution)
```

### What goes in `shared/`
Only what must be identical on server and client: order statuses and the transition table, admin order tabs (3.4), reason codes (3.4), error codes, admin roles, `CONSENT_VERSION`, the limits in section 3.8, and API request/response types. No runtime dependencies, no React, no Node APIs.

It is written in TypeScript and built with `tsc` to `dist/` (ESM + `.d.ts`). The backend and apps import the built output. Run `npm run build:shared` after changing it (root `postinstall` also builds it; `npm run dev:shared` watches).

The API types are hand-written (the backend validates with Zod in JavaScript), so nothing keeps them in sync automatically: **any change to an endpoint's request or response updates its type in `shared` in the same change.**

## Stack

| Area | Choice |
|---|---|
| Monorepo | npm workspaces |
| Runtime | Node.js **22.14.0** (Node 22, maintenance LTS — kept by the user's choice; Node 24 is the active LTS), pinned in `.nvmrc`, `engines` (`^22.14.0`) and enforced by `.npmrc` `engine-strict`. Upgrading Node is its own session. |
| API | Express 5, Mongoose, Zod, Pino, Helmet, express-rate-limit |
| Auth | argon2, jsonwebtoken, google-auth-library |
| Database | MongoDB Atlas (replica set, so transactions work); tests use `mongodb-memory-server` |
| Hosting | Render — one always-on web service instance (see `backend/CLAUDE.md` §15) |
| Files | Supabase Storage — **storage only** (no Supabase database or auth), private bucket, project in the Mumbai region, signed URLs via `@supabase/supabase-js` on the backend |
| Push | Expo push service with enhanced push security (`expo-server-sdk` on the backend, `expo-notifications` in apps) |
| Email | Resend, called with global `fetch` from `backend/src/services/email.js` (no SDK) |
| Mobile | Expo SDK (latest stable), Expo Router, Redux Toolkit + RTK Query, react-native-reanimated, react-native-maps, expo-location, expo-image-picker, expo-image-manipulator, expo-secure-store |
| Quality | ESLint (flat config, `defineConfig`) + Prettier (`endOfLine: "lf"`), knip, Vitest + Supertest |
| TypeScript | 6.0.x in `shared` — **not 7.x** until `typescript-eslint` supports it (its peer range stops below 6.1) |

Verify exact versions with `npm view <pkg> version` — never rely on memory for versions.

## Build plan & git

- Remote: `git@github.com:anubhav-m/medstore.git`, default branch `main`.
- Backend first, one feature per session, each on its own branch `feat/<name>` from `main`: scaffold → customer auth → admin auth + CLI scripts → onboarding + addresses → stores → uploads → customer orders → admin order actions → notifications → owner tools (reports, blocking customers) → jobs (bill expiry, unused uploads) → account deletion → full security review. Mobile apps come after.
- Every session starts with a cleared context. Decisions live in these CLAUDE.md files and in the code, never only in chat.

---

## 1. How to work

- **Read before you write.** Open neighbouring files in the same module/feature and match their patterns.
- **Never guess APIs.** Check the installed version's types/docs. If you cannot verify an API, say so — never invent functions, hooks, or packages.
- **Product scope is fixed.** Do not add a catalog, cart, chat, online payment, live tracking, or any feature not described in section 3 unless asked.
- **Smallest change that fully solves the task.** No unrequested refactors or "improvements".
- **Ask first** when: order, money, auth or prescription logic is ambiguous; adding a large dependency; changing a convention in any CLAUDE.md; any migration that deletes or rewrites data; any work that touches an **open decision** in section 6.
- **Verify before saying "done".** Run the checks in section 5 and report real results, including failures.
- Don't create README/docs/summary files unless asked. Never commit or push unless asked.
- `.env` files may be created and edited (e.g. to fill in values the user provides). They must stay git-ignored — check with `git check-ignore` before writing one in a new location — and are never committed. Never echo secret values back in chat, logs, command output or any committed file. Never run destructive DB commands except against a local test database.
- When a convention changes, update the relevant CLAUDE.md in the same change.

---

## 2. Universal code rules

### No dead code — ever
- No unused imports, variables, parameters, functions, exports, files, or dependencies.
- No commented-out code, `TODO` stubs, placeholder files, `console.log`, or unreachable branches.
- No speculative "just in case" code or abstractions for needs that don't exist yet.
- When replacing something, delete the old version in the same change.
- Scaffolding/template leftovers are deleted immediately after generation.
- `npm run lint` and `npm run knip` pass with zero findings.

### Dependencies
- Latest **stable** releases only — no alpha/beta/rc/canary unless asked.
- Before adding a package: `npm view <pkg>` (last publish, deprecation, dist-tags), prefer built-ins, and mention the new dependency and why in your summary.
- After installing: `npm audit`. No high/critical vulnerabilities — fix, replace, or stop and ask.
- Never use deprecated or abandoned packages.
- Add a dependency to the workspace that uses it (`npm install <pkg> -w backend`; in Expo apps `npx expo install <pkg>` from inside the app folder). The root `package.json` holds only repo-wide dev tooling.

### Modern JavaScript/TypeScript
- **ES modules only**: `import { x } from "y"` / `export`. Never `require`, `module.exports`, or `__dirname` (use `import.meta.dirname`).
- `const` by default, `let` only when reassigned, never `var`.
- `async/await` only — no callbacks or `.then()` chains. Optional chaining, nullish coalescing, destructuring, named exports (default exports only where a framework requires them).
- `for...of` or `Promise.all` for async iteration — **never** `array.forEach(async ...)`.

### Modularity & sharing
- One responsibility per file. Files under ~200 lines, functions under ~40. If bigger, split.
- Workspaces import each other by package name (`@medstore/shared`), never by relative paths across workspace boundaries.
- **Never duplicate** a constant, type, or rule that lives in `@medstore/shared` — import it.
- Names say what things are: `order.service.js`, `BillBuilder.tsx`, `useOrderActions.ts`. Error codes are `UPPER_SNAKE_CASE`.
- Comments explain *why*, never *what*.

### Secrets & config
- Never hardcode secrets, ports, URLs, keys, or DB strings — they come from environment variables.
- Each workspace has its own git-ignored `.env` and a committed `.env.example` with placeholders, kept in sync.
- Env access is centralised in one config file per workspace. Nothing else reads `process.env`.

### Windows development, Linux deployment
Development happens on Windows in PowerShell; the server runs Linux.
- **npm scripts run in `cmd.exe` on Windows**, not PowerShell or bash. Write them cross-platform: no `rm -rf`, `cp`, `VAR=value cmd`, single-quoted arguments, or `$(...)`. Use tool flags instead (`tsc --build --clean`, `node --env-file=.env`), set test env in the Vitest config, and quote globs with escaped double quotes (`\"src/**/*.js\"`).
- **File names are case-sensitive on the server.** Import paths must match the file name exactly — Windows won't catch a mismatch.
- Never build URL paths or storage object keys with `node:path` (it joins with `\` on Windows). Use template strings.
- Line endings are LF (`.gitattributes` + Prettier).
- If PowerShell refuses `npm`/`npx` ("running scripts is disabled"): `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. nvm-windows may ignore `.nvmrc` — run `nvm use <version>` explicitly, or use fnm.
- Command examples in these files are PowerShell-safe; write new ones the same way.

---

## 3. Product & domain rules

These apply everywhere. The backend **enforces** them; the apps only reflect them.

### 3.1 Roles

| Role | App | Can do |
|---|---|---|
| `CUSTOMER` | customer | Own profile, addresses and orders only |
| `STAFF` | admin | Orders and item suggestions of the stores in their `storeIds` |
| `OWNER` | admin | Everything staff can, for all stores; create/edit stores; block customers; daily reports |

Reports are **owner-only**. Admins are created and managed only with the backend CLI scripts (create, reset password, disable, enable, set stores, list) — never by self sign-up and never by inserting documents by hand. Owner-side admin management inside the app is a later phase.

### 3.2 Customer accounts
- **Email sign-up**: register creates an unverified account and emails a 6-digit code; no tokens are issued until `verify-email` succeeds. Registering an email whose account is still unverified replaces that pending account's password and sends a new code (same response as a fresh sign-up). An email with a verified account → `EMAIL_ALREADY_REGISTERED`.
- **Login** with the correct password on an unverified account → `EMAIL_NOT_VERIFIED`, and a new code is sent (subject to the resend limits).
- **Google**: match by `googleId`, then by email. A match by email links the accounts, never duplicates. **If the matched account's email was unverified, its password is deleted and the email marked verified** — otherwise someone who pre-registered the victim's email could still sign in with their password.
- **Codes** (email verification and password reset): 6 digits, stored hashed, expire in 10 minutes, at most 5 attempts per code. A new code invalidates the previous one. Resend cooldown 60 seconds, max 5 codes per email per hour. Forgot-password and resend responses never reveal whether the email exists.
- **Passwords**: Google-only accounts may set a password through forgot-password. Signed-in customers change their password with the current one. A reset or change revokes every other session.
- **Onboarding** (once, after first sign-in): full name, mobile number (Indian, 10 digits starting 6–9, stored as `+91XXXXXXXXXX`, unverified in v1), first delivery address with a map pin, and acceptance of terms & privacy policy (stores `consentAcceptedAt` and `consentVersion` = `CONSENT_VERSION` from `shared`). This sets `onboardingCompleted`. Date of birth and gender are optional profile fields and are never asked during onboarding.
  - Profile, consent and the first address (as the default) are saved in one transaction; a second onboarding → `409 ONBOARDING_ALREADY_COMPLETED`.
  - Phone input may be `9876543210`, `+919876543210` or `09876543210`, with spaces or dashes (`INDIAN_MOBILE_INPUT_PATTERN`, applied after removing them).
  - Date of birth: a real `YYYY-MM-DD` date from `DOB_MIN` (1900-01-01) to yesterday in IST. Gender: `MALE`, `FEMALE` or `OTHER`; leaving it out means "prefer not to say". `null` clears either.
  - `PATCH /me` changes only name, phone, date of birth and gender.
- Until onboarding is complete, everything except auth, profile and onboarding returns `403 ONBOARDING_REQUIRED`.
- **Addresses**: at most 10 per customer (`409 ADDRESS_LIMIT_REACHED`). Label (free text), house/flat (`line1`), city and pincode are required; `line2` and landmark are optional. The pin must lie inside `INDIA_BOUNDS`. Deleting the default address makes the most recently created remaining one the default. Editing or deleting addresses never changes existing orders (orders hold a copy).
  - Exactly one default whenever the customer has an address. A new address becomes the default when asked or when it is the only one; moving the default unsets the old one in the same transaction. The default can be moved but never unset (`PATCH` accepts only `isDefault: true`).
  - Deleting the last address is allowed.
- **Blocked** customers can sign in, see their history, and confirm or cancel orders already in progress. They cannot request upload URLs, place orders or reorder (`403 ACCOUNT_BLOCKED`). Blocking doesn't change existing orders.
  - The owner blocks or unblocks (`PATCH /api/v1/admin/customers/:id/block`), optionally with a reason when blocking. Blocking records `blockedAt`, `blockedBy` (the admin) and `blockReason`; blocking again replaces them; unblocking clears them. The response carries only the block state, and the customer never sees the reason.
- **Account deletion** is available in the customer app (Google Play requirement):
  - Requires re-authentication: the current password, or a fresh Google ID token for accounts without a password.
  - Refused with `409 ACCOUNT_HAS_OPEN_ORDERS` while any non-terminal order exists.
  - Deletes profile, addresses, push tokens and sessions in one transaction.
  - Past orders and their prescription images are **kept** (D1): orders keep their copied name, phone and address, and their images stay in the bucket.
  - Google Play also needs a web link: a static page (not served by this backend) explaining in-app deletion and giving a support email for requests (**open decision D2**).

### 3.3 Stores
- Fields: `code` (2–6 uppercase letters/digits, unique, used in order numbers), `name`, address (`line1`, `line2`, `city`, `pincode`), `phone`, `location`, `deliveryRadiusKm` (0.5–50, one decimal), `openingMinutes` / `closingMinutes` (minutes after midnight, IST, opening < closing — no overnight or 24-hour stores in v1), `deliveryFeePaise`, `isAcceptingOrders`, `isActive`.
  - `code` **can never change** after creation (it is part of every order number). Input is trimmed and uppercased.
  - Hours are integers 0–1440 with opening < closing; `0`–`1440` (open all day) is rejected. **24-hour stores are future work**: allowing them means skipping the closing-time cap on `billExpiresAt` (3.4) for those stores. Overnight hours (closing after midnight) are not planned.
  - `phone`: an Indian 10-digit number starting 1–9 (mobile, or landline with its STD code), entered like a customer phone and stored as `+91XXXXXXXXXX`.
  - New stores are active and accepting orders unless the owner sends `isActive` / `isAcceptingOrders`.
  - Hours, radius, fee and everything else except `code` can be edited by the owner at any time (`PATCH /api/v1/admin/stores/:id`). Staff can't create or edit stores.
- A store is **open** when `isActive && isAcceptingOrders && openingMinutes <= nowIST < closingMinutes`. This check exists in exactly one function, `isStoreOpen(store, now)`, which takes `now` as an argument. Nothing re-implements it.
- Time is always evaluated in **Asia/Kolkata**. Never use the server's local time — servers run in UTC.
- The delivery radius is measured from the **delivery address pin** (not the phone's current location) to the store, as straight-line distance using MongoDB 2dsphere queries. Never call road-distance APIs.
- **GeoJSON coordinates are `[longitude, latitude]`.** Google and UIs use lat/lng — convert at the boundaries and name variables `lat` / `lng` explicitly.
- The customer stores endpoint returns only **active** stores, each with server-computed `distanceKm`, `deliversToAddress`, `isOpen` and `nextOpensAt` (the next IST opening instant when the store is closed only because of its hours; `null` when it is open, paused with `isAcceptingOrders: false`, or inactive). `nextOpensAt(store, now)` lives next to `isStoreOpen` and is the only place that computes it. Apps display these and never calculate distance or opening hours themselves.
- Changing hours, radius or delivery fee affects new orders only.
- Stores are created by the owner through `POST /api/v1/admin/stores` (with an HTTP client until the admin app exists).

### 3.4 Orders

**Creation** (customer): 1–5 distinct photos (JPEG/PNG, ≤ 5 MB each; the same path twice is a `400 VALIDATION_ERROR`), optional patient name (defaults to the customer's name), optional note (≤ 500 chars), one of their saved addresses, a store, and an `Idempotency-Key` header (a UUID).

**Idempotency comes first.** Before any other check, the server looks up `(userId, Idempotency-Key)` (the key is a UUID, compared lowercase). If an order exists, it is returned as-is — whatever the body and whatever the store's current state; there is no body hash and no "key reused" error. If a concurrent request with the same key wins the insert, the loser returns that order too: the lookup is repeated inside the creation transaction (check 6), after the user-document write that serialises one customer's creates.

Then the server checks in this order and fails with the first matching code:

1. Customer is onboarded → `ONBOARDING_REQUIRED`; not blocked → `ACCOUNT_BLOCKED`
2. Address belongs to the customer → `ADDRESS_NOT_FOUND`
3. Store exists → `STORE_NOT_FOUND`; is active and accepting orders → `STORE_NOT_ACCEPTING_ORDERS`; within hours → `STORE_CLOSED`
4. Address is within the store's radius → `OUTSIDE_DELIVERY_AREA`
5. Every image path matches `{userId}/{uuid}.{jpg|png}` exactly, was issued to this customer, and exists in storage with an allowed type and size, the type it was issued for, and a real JPEG/PNG file signature in its first bytes (the bucket only checks the uploader's header) → `INVALID_UPLOAD`
6. Fewer than 3 non-terminal orders across all stores → `TOO_MANY_OPEN_ORDERS`. Check 6 and the insert run in **one transaction that first writes the customer's user document** (`$inc orderCreateSeq`), so two simultaneous orders can't both pass. The limit is **counted** from the orders in that transaction — there is no stored open-order counter, so transitions into terminal statuses touch only the order.

On success: status `PENDING_REVIEW`, an order number is assigned, the address is **copied** into the order (with location and `distanceKm`), the customer's name and phone are copied in (staff search and call with them), the store's current `deliveryFeePaise` is copied in, and staff are notified.

**State machine** — defined once in `@medstore/shared` as a transition table. The backend enforces it; the apps use it only to decide which actions to show.

| From | To | By | Requires |
|---|---|---|---|
| `PENDING_REVIEW` | `REJECTED` | staff | reject reason code (+ note) |
| `PENDING_REVIEW` | `AWAITING_CONFIRMATION` | staff | bill with ≥ 1 item |
| `AWAITING_CONFIRMATION` | `AWAITING_CONFIRMATION` | staff | revised bill (`billVersion` + 1, expiry restarts, customer notified again) |
| `AWAITING_CONFIRMATION` | `CONFIRMED` | customer | the `billVersion` they were shown, before `billExpiresAt` |
| `PENDING_REVIEW`, `AWAITING_CONFIRMATION` | `CANCELLED` | customer | optional cancel reason code (+ note) |
| `AWAITING_CONFIRMATION` | `CANCELLED` | system | `billExpiresAt` has passed (reason `BILL_EXPIRED`) |
| `AWAITING_CONFIRMATION`, `CONFIRMED`, `PACKED` | `CANCELLED` | staff | staff cancel reason code (+ note) |
| `CONFIRMED` | `PACKED` | staff | — |
| `PACKED` | `OUT_FOR_DELIVERY` | staff | — |
| `OUT_FOR_DELIVERY` | `DELIVERED` | staff | `cashCollectedPaise` |
| `OUT_FOR_DELIVERY` | `DELIVERY_FAILED` | staff | delivery-failed reason code (+ note) |

"staff" means `STAFF` of that order's store, or `OWNER`. Terminal statuses: `REJECTED`, `CANCELLED`, `DELIVERED`, `DELIVERY_FAILED`.

- Every status change goes through one function, `transitionOrder` (`backend/src/modules/orders/orderTransition.js`) — customer, admin and system actions alike.
- A transition not in the table, or by the wrong actor → `409 INVALID_ORDER_TRANSITION`.
- Every transition is **one conditional update** matching the expected current status (plus `billVersion` and `billExpiresAt > now` for confirm, and the expected `billVersion` for a revision) that also pushes a `statusHistory` entry `{ status, at, by: { kind, id }, note }` (`kind` is `CUSTOMER`, `ADMIN` or `SYSTEM`; customers see only `kind`, never an admin's id). If nothing matched, re-read the order to classify: someone else got there first → `409 ORDER_STATUS_CHANGED`; the bill changed → `409 BILL_CHANGED`; the bill expired → `409 BILL_EXPIRED`.
- Push notifications are sent after the write succeeds. A failed push never fails the request.

**Reason codes** (in `shared`; display labels live in `mobile-core`). Notes are ≤ 300 chars and required when the code is `OTHER`. A customer cancel note needs a reason code.

| Used for | Codes |
|---|---|
| Reject (required) | `PRESCRIPTION_UNCLEAR`, `PRESCRIPTION_EXPIRED`, `PRESCRIPTION_REQUIRED`, `MEDICINE_UNAVAILABLE`, `OTHER` |
| Customer cancel (optional) | `CHANGED_MIND`, `PRICE_TOO_HIGH`, `ORDERED_BY_MISTAKE`, `BOUGHT_ELSEWHERE`, `OTHER` |
| Staff cancel (required) | `CUSTOMER_REQUESTED`, `MEDICINE_UNAVAILABLE`, `UNABLE_TO_DELIVER`, `OTHER` |
| Delivery failed (required) | `CUSTOMER_UNREACHABLE`, `CUSTOMER_REFUSED`, `WRONG_ADDRESS`, `OTHER` |
| System cancel | `BILL_EXPIRED` |

**Bill**
- Items are free text: `name` (2–100 chars), `quantity` (integer 1–999), `unitPricePaise` (integer 1–10,000,000); 1–50 items.
- The server computes `lineTotalPaise`, `subtotalPaise` and `totalPaise = subtotal + deliveryFee − discount`. `deliveryFeePaise` (0–100,000) defaults to the order's current fee (copied from the store at creation, or what the previous bill used) and staff may change it; `discountPaise` is 0–subtotal. Totals are never taken from a client: sending one is a `400 VALIDATION_ERROR` (strict schemas).
- **Expiry**: sending or revising a bill sets `billSentAt` and `billExpiresAt = billSentAt + BILL_CONFIRMATION_TIMEOUT_MINUTES` (default 60). If the bill is sent before the store's closing time that IST day, `billExpiresAt` is capped at closing time. A revision restarts the expiry.
- Item-name suggestions come from names previously billed at the same store: case-insensitive prefix match, distinct, max 10. There is no catalog collection.
  - Only items on the bills currently stored count. A revision replaces an order's items, so a name it removed is no longer suggested unless another order still has it. Decided by the user: this is accepted, and it also drops typos corrected in a revision.

**Reorder**
- Only from the customer's own **`DELIVERED`** orders → otherwise `409 REORDER_NOT_ALLOWED`.
- Creates a new `PENDING_REVIEW` order at the **same store** with the old order's images, patient name and copied delivery address. A new optional note may be sent; the old note is not copied.
- Needs its own `Idempotency-Key`. Checks run in the creation order above, with check 2 replaced by the source-order check, check 4 using the copied address pin, and check 5 confirming the images still exist. It goes through full review.

**Admin order tabs** (`ADMIN_ORDER_TABS` in `shared`)

| Tab | Statuses | Sort |
|---|---|---|
| New | `PENDING_REVIEW` | oldest first |
| Awaiting customer | `AWAITING_CONFIRMATION` | `billExpiresAt` soonest first |
| Preparing | `CONFIRMED`, `PACKED` | oldest first |
| Out for delivery | `OUT_FOR_DELIVERY` | oldest first |
| Delivered | `DELIVERED` | newest first |
| Closed | `REJECTED`, `CANCELLED`, `DELIVERY_FAILED` | newest first |

Oldest and newest are by `createdAt`. Without a tab, the admin list shows every status, newest first.

**Other order rules**
- **Money is integer paise.** Never floats — not in the DB, API, or app math.
- Order numbers are `{storeCode}-{6-digit sequence}` (e.g. `ST01-000042`) from an atomic `$inc` on one counter per store that **never resets**. Gaps are acceptable.
- Store hours gate **new** orders and reorders only. Orders already placed continue after closing.
- `DELIVERED` sets `paymentStatus: COLLECTED`, `deliveredAt`, and records `cashCollectedPaise` (integer ≥ 0, may differ from the total — it is recorded as given).
- **Daily report** (owner-only, any store including inactive ones), per store for one IST date (IST midnight to midnight; not in the future): counts of orders created that day by their current status; and for orders whose `deliveredAt` falls on that day, the delivered count, expected cash (sum of `totalPaise`) vs collected cash (sum of `cashCollectedPaise`) and the difference (collected − expected), plus the orders where collected ≠ expected (order number and both amounts; oldest delivery first, at most `MAX_REPORT_CASH_MISMATCHES` = 100 listed, all counted).

### 3.5 Prescription images & privacy
- Images live in the **private** Supabase bucket named by `SUPABASE_BUCKET` (`prescriptions`) at the path `{userId}/{uuid}.{ext}`. The bucket is never public and there are never public URLs.
- The bucket itself rejects anything that isn't `image/jpeg` or `image/png` or is over 5 MB; the backend checks the same limits before issuing an upload URL.
- **Upload**: the app requests a signed upload URL from the backend, uploads directly to Supabase, then sends the object paths with the order. Image bytes never pass through Express. Every issued path is recorded (`uploads` collection) with the customer it was issued to. Limits: 20 upload URLs per customer per hour and 30 per IST day (`UPLOAD_LIMIT_REACHED`).
- Uploads never attached to an order are deleted after 24 hours by a job. Reorders share image objects with the original order, so an image is deleted only when no order references it.
- **Viewing**: signed URLs valid ≤ 10 minutes, issued by the backend only to the order's customer and to staff of its store / the owner, and only in order **detail** responses — never in lists. The admin app never caches prescription images to disk.
- Only the backend holds a Supabase key. The apps never install `@supabase/supabase-js` and never see any Supabase key.
- Never log or send to analytics: images, phone numbers, addresses, patient names, notes, or bill items (medicine names reveal health conditions). Log IDs instead. Request logs record the route pattern, never the raw URL (search queries contain phone numbers).
- Each role receives the minimum fields it needs. Staff see customer contact details only for their stores' orders.

### 3.6 Notifications

| Event | Recipient |
|---|---|
| Order placed (including reorders) | Staff of that store + owners |
| Bill sent or revised | Customer |
| Rejected, cancelled by store, out for delivery, delivered, delivery failed | Customer |
| Customer confirmed or cancelled | Staff of that store + owners |
| Bill expired (system cancel) | Customer + staff of that store + owners |

- Push text may contain the order number, status and total — never items, patient names, notes or addresses. The payload `data` is `{ orderId, event }`. Texts are listed in `backend/CLAUDE.md`.
- The payload's `event` is a `NotificationEvent` from `shared`. Recipients "staff of that store + owners" means **active** admins: `STAFF` whose `storeIds` include the order's store, and every `OWNER`. Staff of other stores and disabled admins get nothing.
- Pushes go out after the write has committed, without the request waiting. A failed push or recipient lookup is logged (ids only) and never changes the response.
- Customers and admins both register push tokens, per device:
  - Tokens must pass the Expo SDK's push-token check. An account keeps its newest 10 (`MAX_PUSH_TOKENS_PER_ACCOUNT`); registering another drops the oldest, and re-registering one makes it the newest.
  - **A device token belongs to one account**: registering it removes it from every other customer and admin, so a shared phone never shows the previous account's notifications.
  - A token is removed on logout (the logout request carries the device's token; it is removed only from the account the refresh token belongs to) and deleted when Expo reports `DeviceNotRegistered`.
  - **Revoking all of an account's sessions also deletes all its push tokens** (decided by the user): password reset or change, admin disable or password reset by script, refresh-token reuse, account deletion. The apps re-register their token after every sign-in and after a password change.

### 3.7 Maps & Google cost
- Allowed Google usage: **Maps SDK for Android** (map display via react-native-maps) and **Google Sign-In**. Nothing else without asking — no Places, Geocoding, Distance Matrix or Routes APIs.
- Current location comes from `expo-location`. Address text for a pin comes from `Location.reverseGeocodeAsync` (the phone's geocoder) and only prefills editable fields.
- Staff navigation opens `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}` via `Linking` — no API key or cost.
- The Android Maps key ships inside the app, so it is not a secret: it must be restricted in Google Cloud to the app's package name + SHA-1 and to Maps SDK for Android only. Set a budget alert on the Google Cloud project.

### 3.8 Limits (constants in `shared`)

| Limit | Value |
|---|---|
| Images per order | 1–5, JPEG/PNG, ≤ 5 MB each |
| Open (non-terminal) orders per customer | 3 |
| Saved addresses per customer | 10 |
| Upload URLs per customer | 20 per hour, 30 per IST day |
| Order creations + reorders per customer | 10 per hour |
| Push tokens per customer or admin account | 10 (the oldest is dropped) |
| Code resend | 60 s cooldown, 5 per email per hour; 5 attempts per code; 10-minute expiry |
| Login attempts | customer: 10 per 15 min per IP+email; admin: 5 failed per 15 min per username, plus 20 failed per 15 min per IP (shared with admin change-password) |
| Email | ≤ 254 chars, trimmed and lowercased |
| Customer password / admin password | 8–128 / 12–128 chars (admins see every customer's health data) |
| Admin username | 3–30 chars, lowercase letters, digits, `.` `_` |
| Names | customer 2–80 chars; admin 2–80 chars; patient 2–100 chars |
| Customer note / reason note / block reason | ≤ 500 / ≤ 300 / ≤ 300 chars |
| Cash mismatches listed in a daily report | 100 (all are counted) |
| Address label / line1 / line2 / landmark / city | ≤ 30 / 120 / 120 / 120 / 60 chars; pincode 6 digits, not starting with 0 |
| Address pin | inside India: lat 6.4–37.6, lng 68.1–97.5 (`INDIA_BOUNDS`) |
| Date of birth | 1900-01-01 to yesterday (IST) |
| Bill | 1–50 items; name 2–100 chars; quantity 1–999; unit price 1–10,000,000 paise; delivery fee 0–100,000 paise |
| Delivery radius | 0.5–50 km, one decimal |
| Store | code 2–6 of `A–Z 0–9`; name 2–80 chars; phone Indian 10 digits starting 1–9; hours 0–1440 minutes, opening < closing, not 0–1440; delivery fee 0–100,000 paise; address limits as for customer addresses |
| Search / suggestion query | 1–50 chars; suggestions max 10 |
| Pagination | default 20, max 100 |
| Signed view URL lifetime | ≤ 600 s |

---

## 4. Commands (repo root)

```bash
npm install            # installs all workspaces; postinstall builds shared/
npm run build:shared
npm run dev:shared     # tsc --watch while editing shared/
npm run lint           # eslint + prettier --check, all workspaces
npm run typecheck      # shared (+ mobile workspaces later)
npm run knip
npm test               # all workspaces with tests
npm audit
```

Workspace-specific commands are in `backend/CLAUDE.md` and `mobile/CLAUDE.md`. These scripts must exist — add them when scaffolding, cross-platform (section 2).

---

## 5. Definition of done

Before reporting a task complete, confirm every item that applies:

- [ ] Lint, typecheck and knip pass with zero findings; no dead code, commented code, or `console.*`
- [ ] Backend tests written and passing, including every error code the changed endpoints can return
- [ ] `npm audit` shows no high/critical issues for any dependency you added
- [ ] Nothing duplicated that belongs in `@medstore/shared` or `@medstore/mobile-core`; `shared/` rebuilt if changed; API types in `shared` match the changed endpoints
- [ ] Domain rules in section 3 respected — especially paise, IST, `[lng, lat]`, conditional status updates, and private images
- [ ] Backend: every failure is a classified error through the central error middleware; every response uses the fixed `{ success, ... }` shape
- [ ] Mobile: loading / error / empty / success states handled; errors shown in user-friendly language
- [ ] No secrets or hardcoded config; `.env.example` updated if a variable was added
- [ ] npm scripts work in `cmd.exe` (Windows) and on Linux
- [ ] Relevant CLAUDE.md updated if a convention changed

---

## 6. Decisions from the client

**Open** items have no answer yet. When a task needs one, stop and ask the user — never pick a value yourself. Record the answer here and in the relevant rule when it arrives.

| ID | Decision | Status |
|---|---|---|
| D1 | Retention of orders and prescription images | **Decided (for now):** keep everything, including after account deletion. No retention or image-deletion job. Revisit when storage runs low. |
| D2 | Support email; where the account-deletion page, terms and privacy policy are hosted | **Open** — ask when building account deletion, onboarding consent, or the Play listing |
| D3 | App names, Android package prefix, email sender name and address | **Partly decided:** app name is **MedStore** for now (will change later). Package prefix and email sender are **open** — ask when scaffolding an app or building `services/email.js` |
| D4 | Hosting provider for the backend | **Decided:** Render, one web service instance. Plan (free vs paid instance) and region are **open** — ask before the first deployment. |
| D5 | Staff reviewing prescriptions meet the drug-licence requirements | **Confirmed** by the client. The app still records who reviewed each order. |
