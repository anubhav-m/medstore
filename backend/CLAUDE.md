# Backend — CLAUDE.md

Express + MongoDB API serving both apps. Plain JavaScript, ES modules. The root `CLAUDE.md` rules (especially section 3, the domain rules, and 3.8, the limits) apply here too; this file adds backend rules.

- `"type": "module"` in `package.json`; relative imports include the `.js` extension; built-ins use the `node:` prefix.
- Prefer built-ins: `node --env-file` over dotenv, `node --watch` over nodemon, `express.json()` over body-parser, `crypto.randomUUID()` over uuid, global `fetch` over axios/node-fetch.

## 1. Structure

```text
backend/
├── scripts/                  # CLI: admin-create.js, admin-reset-password.js, admin-disable.js,
│                             # admin-enable.js, admin-set-stores.js, admin-list.js, storage-setup.js
└── src/
    ├── app.js                # builds the Express app — no listen()
    ├── server.js             # connects DB, starts server + jobs, graceful shutdown
    ├── config/               # env.js (Zod-validated, fails fast), db.js, logger.js
    ├── middleware/           # authCustomer, authAdmin, requireOnboarded, requireRole, validate,
    │                         # rateLimit, requestId, notFound, errorHandler
    ├── modules/
    │   ├── auth/             # customer: register, verify email, login, Google, reset, refresh, logout
    │   ├── admin-auth/       # admin: login, refresh, logout, change password, me, push tokens
    │   ├── admins/           # admin model + service (used by admin-auth and scripts)
    │   ├── users/            # profile, password change, onboarding, account deletion, push tokens
    │   ├── addresses/
    │   ├── stores/           # store model, isStoreOpen, nextOpensAt, geo queries
    │   ├── uploads/          # upload model, signed upload URLs
    │   ├── orders/           # both surfaces, transitions, bill, reorder, counters, item suggestions
    │   ├── customers/        # admin side: block / unblock
    │   └── reports/          # daily summary
    ├── services/             # integrations only: storage.js, email.js, push.js, googleAuth.js
    ├── jobs/                 # expireUnconfirmedBills.js, deleteUnusedUploads.js
    ├── routes/               # customer.routes.js (/api/v1), admin.routes.js (/api/v1/admin)
    └── utils/                # AppError, sendSuccess, pagination, time (IST), money, escapeRegex
```

A module that serves both apps keeps one service and splits the HTTP layer:

```text
orders/
├── order.routes.js           # customer surface
├── order.controller.js
├── order.admin.routes.js     # admin surface
├── order.admin.controller.js
├── order.service.js          # all business rules, used by both
├── order.model.js
└── order.validation.js       # Zod schemas for both surfaces
```

Each file in `services/` is the **only** place that talks to its integration (bucket, email provider, Expo push, Google). Modules call these services; they never import the SDKs directly.

## 2. Layering

```text
Route → auth / role / validate middleware → Controller → Service → Model
```

- **Routes**: wire path + middleware + controller. No logic.
- **Controllers**: read validated input, call one service function, respond via `sendSuccess`. No business logic, no DB queries.
- **Services**: all business rules and DB access. Throw `AppError` for every known failure. Never touch `req`/`res`.
- **Models**: schema, indexes, small instance helpers only.

## 3. Centralised error handling (critical)

There is exactly **one** place that turns errors into HTTP responses: `middleware/errorHandler.js`, registered **last**.

```js
// app.js (order matters)
app.use(requestId);
app.use(helmet());
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1", customerRoutes);
app.use(notFound);      // throws AppError 404 ROUTE_NOT_FOUND
app.use(errorHandler);  // always last
```

**Known errors are thrown as `AppError`** with a message, status and a code imported from `@medstore/shared`:

```js
throw new AppError("This store is closed right now", 409, ErrorCodes.STORE_CLOSED);
```

**Every controller follows this exact pattern** — catch blocks never build responses:

```js
export const confirmBill = async (req, res, next) => {
  try {
    const order = await orderService.confirmBill(req.user.id, req.validated.params.id, req.validated.body.billVersion);
    return sendSuccess(res, { message: "Order confirmed", data: { order } });
  } catch (error) {
    return next(error);
  }
};
```

**The error handler classifies before it falls back.** `500 INTERNAL_SERVER_ERROR` is only for errors matching nothing below — an unclassified 500 is a bug to fix by adding a classification.

| Source                                     | Status  | Code                                                   |
| ------------------------------------------ | ------- | ------------------------------------------------------ |
| `AppError`                                 | its own | its own                                                |
| Zod validation failure                     | 400     | `VALIDATION_ERROR` (+ per-field `errors`)              |
| Mongoose `ValidationError`                 | 400     | `VALIDATION_ERROR` (+ per-field `errors`)              |
| Mongoose `CastError` (bad ObjectId)        | 400     | `INVALID_ID`                                           |
| Mongo duplicate key (`code 11000`)         | 409     | `DUPLICATE_RESOURCE` (name the field, never the value) |
| Malformed JSON (`entity.parse.failed`)     | 400     | `INVALID_JSON`                                         |
| Body too large (`entity.too.large`)        | 413     | `PAYLOAD_TOO_LARGE`                                    |
| JWT expired / invalid                      | 401     | `TOKEN_EXPIRED` / `INVALID_TOKEN`                      |
| Rate limit exceeded                        | 429     | `TOO_MANY_REQUESTS`                                    |
| Mongo connection / server-selection errors | 503     | `SERVICE_UNAVAILABLE`                                  |
| **Anything else**                          | 500     | `INTERNAL_SERVER_ERROR` (generic message)              |

**Domain codes** (thrown as `AppError`; all defined in `@medstore/shared`):

| Area | Code | Status |
| --- | --- | --- |
| Auth | `INVALID_CREDENTIALS` | 401 |
| | `EMAIL_NOT_VERIFIED`, `ACCOUNT_DISABLED`, `PASSWORD_CHANGE_REQUIRED`, `FORBIDDEN` | 403 |
| | `EMAIL_ALREADY_REGISTERED` | 409 |
| | `INVALID_OR_EXPIRED_CODE` | 400 |
| | `TOO_MANY_ATTEMPTS` | 429 |
| Customers | `ONBOARDING_REQUIRED`, `ACCOUNT_BLOCKED` | 403 |
| | `ONBOARDING_ALREADY_COMPLETED`, `ACCOUNT_HAS_OPEN_ORDERS`, `ADDRESS_LIMIT_REACHED` | 409 |
| Stores | `STORE_CLOSED`, `STORE_NOT_ACCEPTING_ORDERS` | 409 |
| | `OUTSIDE_DELIVERY_AREA` | 422 |
| Uploads | `INVALID_UPLOAD` | 422 |
| | `UPLOAD_LIMIT_REACHED` | 429 |
| Orders | `TOO_MANY_OPEN_ORDERS`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED`, `BILL_CHANGED`, `BILL_EXPIRED`, `REORDER_NOT_ALLOWED` | 409 |
| Not found | `ORDER_NOT_FOUND`, `STORE_NOT_FOUND`, `ADDRESS_NOT_FOUND`, `CUSTOMER_NOT_FOUND`, `ROUTE_NOT_FOUND` | 404 |

Rules:

- When you meet a new kind of failure, **add it to the classifier or to the codes in `@medstore/shared`** (and its user message in `mobile/core`) instead of letting it fall through to 500.
- A resource that exists but belongs to someone else returns **404**, not 403 — never confirm that another user's or store's data exists. A `storeId` filter outside the admin's scope is `404 STORE_NOT_FOUND`.
- **401 means "not authenticated"** and is used only for `INVALID_CREDENTIALS`, `INVALID_TOKEN` and `TOKEN_EXPIRED`. The apps refresh tokens **only** on `TOKEN_EXPIRED`; a wrong current password on change-password or account deletion is shown as an error, not treated as an expired session.
- Log the full error server-side with the request id — 5xx as `error`, 4xx as `warn`. **Never** return stack traces, raw DB errors, or internal messages.
- If `res.headersSent`, delegate with `next(err)`.
- Never swallow errors (`catch (e) {}`), never `console.log(e)`, never respond from a catch block.
- `process.on("unhandledRejection")` / `uncaughtException` handlers log and exit.

## 4. Response format (fixed — no exceptions)

Controllers **never** call `res.json()` / `res.send()` directly. Success goes through `sendSuccess`, failure through the error handler.

```jsonc
// success
{ "success": true, "message": "Order placed", "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }

// failure — `message` and `code` are ALWAYS present
{ "success": false, "message": "Some fields are invalid", "code": "VALIDATION_ERROR",
  "errors": [{ "field": "phone", "message": "Enter a 10-digit mobile number" }] }
```

`meta` only on paginated lists; `errors` only for field-level failures.

## 5. Validation

- Every route validates `body`, `params`, `query` **and the headers it reads** with Zod via the `validate` middleware. Schemas are strict (unknown keys rejected), strings trimmed, sizes bounded by the limits in root 3.8. `Idempotency-Key` is a required UUID on `POST /orders` and `POST /orders/:id/reorder`.
- Validated data goes on `req.validated`. Do not reassign `req.query` (read-only in Express 5).
- Never pass `req.body` / `req.query` straight into Mongoose. Destructure the fields you need; strict schemas also block NoSQL operator injection (`{ "$ne": null }`).
- User text used in a regex (order search, item suggestions) always goes through `utils/escapeRegex` and is anchored as a prefix (`^`).
- Rupee inputs never exist on the API — money fields are integer paise.

## 6. Authentication & authorization

### Tokens

- Customers and admins are **separate token worlds**: different secrets (4 total: access + refresh for each) and an `aud` claim of `customer` or `admin`. `authCustomer` and `authAdmin` each verify their own secret **and** audience, so a customer token can never pass admin middleware.
- JWTs are signed and verified with `HS256` only (pass `algorithms: ["HS256"]` to verify). `env.js` requires each secret to be ≥ 32 characters and all four to be distinct.
- Access tokens: JWT, 15 minutes. Refresh tokens: random opaque strings (`crypto.randomBytes`), stored as SHA-256 hashes, rotated on every use, revoked on logout. Customer refresh lifetime 30 days, admin 7 days. Refresh and logout take the refresh token in the body.
- Reuse of an already-rotated refresh token revokes all of that subject's sessions. Rotated tokens are kept (revoked) until they expire so reuse can be detected.
- **The auth middleware loads the subject on every request** (one indexed read). A deleted customer → `INVALID_TOKEN`. An inactive admin → `ACCOUNT_DISABLED`. An admin's `role`, `storeIds` and `mustChangePassword` always come from the database, never from the token, so changes apply immediately.
- **All of a subject's sessions are revoked** on password reset, password change (the response carries fresh tokens for the current device), admin disable, admin password reset by script, and account deletion.
- Passwords: argon2id; lengths from root 3.8. Auth failures are generic ("Invalid email or password").

### Customers

- Sign-up, verification, codes and Google linking follow root 3.2 exactly.
- Google: verify the ID token with `google-auth-library` `verifyIdToken` (audience = `GOOGLE_WEB_CLIENT_ID`) and require `email_verified`. A bad token or an unverified Google email → `INVALID_CREDENTIALS`.
- OTP codes: from `crypto.randomInt`, one active code per user and purpose (a new code replaces the old document). Never log codes.
- `requireOnboarded` guards every customer route except auth, profile and onboarding.
- Every customer query includes `userId: req.user.id`.
- Account deletion requires re-authentication with `{ password }` or `{ googleIdToken }` (root 3.2).

### Admins

- Login with username + password. `isActive: false` → `ACCOUNT_DISABLED`. Record `lastLoginAt`. No lockout (it would let anyone lock staff out); failed logins are rate-limited per username and per IP instead.
- If `mustChangePassword` is set, the admin may call only change-password, logout and `GET /me`; everything else returns `PASSWORD_CHANGE_REQUIRED`.
- `requireRole("OWNER")` guards owner-only routes (`FORBIDDEN` for staff).
- **Store scoping**: every admin query on orders and item suggestions includes `storeId: { $in: scope }`, where `scope` comes from one helper, `getStoreScope(admin)` (all stores for `OWNER`, `admin.storeIds` for `STAFF`). Out-of-scope resources return 404. Customer and report endpoints are owner-only.

### Admin CLI scripts (`backend/scripts/`)

- `npm run admin:create` — prompts for username, name, role, store codes (staff only) and password. Hashes with argon2 and sets `mustChangePassword: true`.
- `npm run admin:reset-password` (sets `mustChangePassword`, revokes sessions), `admin:disable` (revokes sessions), `admin:enable`, `admin:set-stores` (replaces a staff member's store codes), `admin:list` (username, name, role, store codes, active — never hashes).
- Passwords are entered in a **hidden prompt**, never as a CLI argument (arguments end up in shell history, including PowerShell's). Implement it with `node:readline` plus `process.stdin.setRawMode`; if stdin is not a TTY, refuse to run with a clear message (Git Bash's mintty is not a TTY — use PowerShell, Windows Terminal or the VS Code terminal).
- Before writing, every script prints the target database host and name and requires typing `yes`.
- Scripts reuse `modules/admins/admin.service.js` and `config/env.js`; they contain no separate hashing or DB logic.

### Rate limits

Values from root 3.8. Strict on `/auth/*` and `/admin/auth/*` (login, register, codes, refresh), on code sends per email, on upload URLs and on order creation/reorder per customer. A sane global limit on everything else. The limiter uses the default in-memory store (one Render instance — §15); moving to several instances means moving it to a shared store. `app.set("trust proxy", env.TRUST_PROXY)` so limits see real client IPs and `X-Forwarded-For` can't be spoofed.

## 7. API surface

Every endpoint can also return the generic codes from section 3 (`VALIDATION_ERROR`, `INVALID_ID`, `INVALID_JSON`, `TOO_MANY_REQUESTS`, …). Authenticated endpoints can return `INVALID_TOKEN` / `TOKEN_EXPIRED`. Customer endpoints marked † also return `ONBOARDING_REQUIRED`. Admin endpoints after login also return `ACCOUNT_DISABLED` and `PASSWORD_CHANGE_REQUIRED`. The table lists the **domain** codes each endpoint can return — tests cover every one.

Customer — `/api/v1`:

| Endpoint | Notes | Domain errors |
| --- | --- | --- |
| `POST /auth/register` | `{ email, password }`; sends a code; no tokens | `EMAIL_ALREADY_REGISTERED` |
| `POST /auth/verify-email` | `{ email, code }` → tokens + user | `INVALID_OR_EXPIRED_CODE`, `TOO_MANY_ATTEMPTS` |
| `POST /auth/resend-code` | `{ email, purpose }`; same response whether or not the email exists | — |
| `POST /auth/login` | `{ email, password }` → tokens + user | `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED` |
| `POST /auth/google` | `{ idToken }` → tokens + user | `INVALID_CREDENTIALS` |
| `POST /auth/forgot-password` | `{ email }`; same response whether or not the email exists | — |
| `POST /auth/reset-password` | `{ email, code, newPassword }`; revokes all sessions; no tokens | `INVALID_OR_EXPIRED_CODE`, `TOO_MANY_ATTEMPTS` |
| `POST /auth/refresh` | `{ refreshToken }` → new pair | `INVALID_TOKEN` |
| `POST /auth/logout` | `{ refreshToken, pushToken? }` | — |
| `GET /me` | profile incl. `onboardingCompleted`, `isBlocked`, `hasPassword` | — |
| `PATCH /me` | name, phone, dob, gender | — |
| `POST /me/password` | `{ currentPassword, newPassword }` → fresh tokens | `INVALID_CREDENTIALS` (also when the account has no password) |
| `DELETE /me` | `{ password }` or `{ googleIdToken }` | `INVALID_CREDENTIALS`, `ACCOUNT_HAS_OPEN_ORDERS` |
| `POST /me/onboarding` | name, phone, first address, `consentAccepted: true` | `ONBOARDING_ALREADY_COMPLETED` |
| `POST /me/push-tokens` · `DELETE /me/push-tokens` | `{ token }` in the body (never in the URL) | — |
| `GET /addresses` † | all (≤ 10), not paginated | — |
| `POST /addresses` † | | `ADDRESS_LIMIT_REACHED` |
| `PATCH /addresses/:id` · `DELETE /addresses/:id` † | | `ADDRESS_NOT_FOUND` |
| `GET /stores?addressId=` † | active stores with `distanceKm`, `deliversToAddress`, `isOpen`, `nextOpensAt`; not paginated | `ADDRESS_NOT_FOUND` |
| `POST /uploads/prescriptions` † | `{ contentType, sizeBytes }` → `{ path, signedUrl, token }` | `ACCOUNT_BLOCKED`, `UPLOAD_LIMIT_REACHED` |
| `POST /orders` † | `Idempotency-Key` header | `ACCOUNT_BLOCKED`, `ADDRESS_NOT_FOUND`, `STORE_NOT_FOUND`, `STORE_NOT_ACCEPTING_ORDERS`, `STORE_CLOSED`, `OUTSIDE_DELIVERY_AREA`, `INVALID_UPLOAD`, `TOO_MANY_OPEN_ORDERS` |
| `GET /orders?scope=active\|past&page=` † | paginated; no image URLs | — |
| `GET /orders/:id` † | includes signed `imageUrls` | `ORDER_NOT_FOUND` |
| `POST /orders/:id/confirm` † | `{ billVersion }` | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `BILL_CHANGED`, `BILL_EXPIRED`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/cancel` † | `{ reasonCode?, note? }` | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/reorder` † | `{ note? }` + `Idempotency-Key` header | `ORDER_NOT_FOUND`, `REORDER_NOT_ALLOWED`, `ACCOUNT_BLOCKED`, `STORE_NOT_ACCEPTING_ORDERS`, `STORE_CLOSED`, `OUTSIDE_DELIVERY_AREA`, `INVALID_UPLOAD`, `TOO_MANY_OPEN_ORDERS` |

Admin — `/api/v1/admin`:

| Endpoint | Notes | Domain errors |
| --- | --- | --- |
| `POST /auth/login` | `{ username, password }` → tokens + admin (role, stores, `mustChangePassword`) | `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED` |
| `POST /auth/refresh` | `{ refreshToken }` | `INVALID_TOKEN`, `ACCOUNT_DISABLED` |
| `POST /auth/logout` | `{ refreshToken, pushToken? }` | — |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` → fresh tokens; clears `mustChangePassword` | `INVALID_CREDENTIALS` |
| `GET /me` | admin + scoped stores `{ id, code, name }` | — |
| `POST /me/push-tokens` · `DELETE /me/push-tokens` | `{ token }` in the body | — |
| `GET /orders?storeId=&tab=&q=&page=` | `tab` from `ADMIN_ORDER_TABS`; `q` = order number or phone prefix; no image URLs | `STORE_NOT_FOUND` |
| `GET /orders/counts?storeId=` | count per tab | `STORE_NOT_FOUND` |
| `GET /orders/:id` | includes signed `imageUrls` and customer contact | `ORDER_NOT_FOUND` |
| `POST /orders/:id/reject` | `{ reasonCode, note? }` | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/bill` | `{ expectedBillVersion, items, deliveryFeePaise?, discountPaise? }`; creates (version 0 → 1) or revises | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED`, `BILL_CHANGED` |
| `POST /orders/:id/pack` · `/dispatch` | | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/deliver` | `{ cashCollectedPaise }` | same as above |
| `POST /orders/:id/fail` · `/cancel` | `{ reasonCode, note? }` | same as above |
| `GET /item-suggestions?storeId=&q=` | | `STORE_NOT_FOUND` |
| `GET /stores` | scoped stores (owner: all, including inactive); not paginated | — |
| `POST /stores` (owner) | | `FORBIDDEN`, `DUPLICATE_RESOURCE` |
| `PATCH /stores/:id` (owner) | | `FORBIDDEN`, `STORE_NOT_FOUND` |
| `PATCH /customers/:id/block` (owner) | `{ isBlocked }` | `FORBIDDEN`, `CUSTOMER_NOT_FOUND` |
| `GET /reports/daily?storeId=&date=` (owner) | IST date | `FORBIDDEN`, `STORE_NOT_FOUND` |

Plus `GET /health` (no auth). Each transition has its own action endpoint with its own Zod schema; there is no generic "set status" endpoint. `DELETE` endpoints that take a body are called only by our own apps, never through a browser or CDN.

## 8. Database (MongoDB / Mongoose)

### Data model

All schemas use `timestamps: true`. Money fields are integer paise. Locations are GeoJSON `Point` `{ type: "Point", coordinates: [lng, lat] }`.

```text
users          email (lowercase), emailVerified, passwordHash (select: false; null for Google-only),
               googleId?, name, phone (+91XXXXXXXXXX), dob?, gender? (MALE | FEMALE | OTHER),
               onboardingCompleted, consentAcceptedAt, consentVersion, isBlocked,
               pushTokens[{ token, createdAt }], orderCreateSeq (written inside the order-creation
               transaction so concurrent creates conflict — root 3.4 check 6)
addresses      userId, label, line1 (house/flat), line2?, landmark?, city, pincode, location, isDefault
stores         code, name, address { line1, line2?, city, pincode }, phone, location, deliveryRadiusKm,
               openingMinutes, closingMinutes, deliveryFeePaise, isAcceptingOrders, isActive
admins         username (lowercase), passwordHash (select: false), name, role (OWNER | STAFF),
               storeIds[], isActive, mustChangePassword, pushTokens[{ token, createdAt }], lastLoginAt
orders         orderNumber, userId, storeId, status, idempotencyKey, reorderedFrom?,
               patientName, customerNote?, customerName, customerPhone (copied at creation),
               images[{ path }], deliveryAddress { label, line1, line2, landmark, city, pincode,
               location }, distanceKm,
               items[{ name, nameKey (lowercase, trimmed), quantity, unitPricePaise, lineTotalPaise }],
               subtotalPaise, deliveryFeePaise (copied from the store at creation), discountPaise,
               totalPaise, billVersion (0 until the first bill), billSentAt?, billExpiresAt?,
               paymentMethod ("COD"), paymentStatus (PENDING | COLLECTED), cashCollectedPaise?,
               deliveredAt?, rejection? { code, note }, cancellation? { byKind, code, note },
               deliveryFailure? { code, note }, statusHistory[{ status, at, by { kind, id? }, note? }]
uploads        userId, path, contentType, sizeBytes, attachedAt? (set when first used by an order)
refreshTokens  tokenHash, subjectKind (CUSTOMER | ADMIN), subjectId, expiresAt, revokedAt?
otpCodes       userId, purpose (VERIFY_EMAIL | RESET_PASSWORD), codeHash, attempts, expiresAt
counters       _id (store code), seq — never reset
```

### Rules

- `toJSON` strips `__v`, `passwordHash` and other secrets. Customers never receive `statusHistory[].by.id`.
- **Index every field you query, sort or keep unique.** Required indexes:
  - `users`: `email` unique; `googleId` unique sparse
  - `admins`: `username` unique
  - `stores`: `code` unique; `location` 2dsphere
  - `addresses`: `userId`
  - `orders`: `orderNumber` unique; `{ storeId, status, createdAt }`; `{ userId, status, createdAt }`; `{ userId, idempotencyKey }` unique; `{ status, billExpiresAt }` (expiry job); `{ storeId, "items.nameKey" }` (suggestions); `{ storeId, customerPhone }` (search); `{ storeId, deliveredAt }` (report); `images.path` (reference checks)
  - `uploads`: `path` unique; `{ userId, createdAt }`; `{ attachedAt, createdAt }` (cleanup job)
  - `refreshTokens`: `tokenHash` unique; `{ subjectKind, subjectId }`; TTL on `expiresAt`
  - `otpCodes`: `{ userId, purpose }` unique; TTL on `expiresAt`
- **Every unbounded list endpoint is paginated** (default 20, max 100). Bounded lists (addresses ≤ 10, stores) are not. Never `Model.find()` without a limit.
- Reads use `.lean()` and projections. No N+1 loops — use `$in` or aggregation.
- Keep a state change inside **one document** where possible (order status, history and bill live on the order), so single-document atomicity is enough. Use `session.withTransaction` when several documents must change together: order creation/reorder (user lock + count + insert + marking uploads attached) and account deletion. Local and test Mongo run as a single-node replica set.
- Idempotency: look up `(userId, idempotencyKey)` before anything else; on a duplicate-key error for that index during insert, fetch and return the existing order.
- Never read-modify-write counters or statuses; use atomic operators and conditional filters.
- Geo: store locations and address pins are GeoJSON `Point` with `[lng, lat]`. Distance/eligibility uses `$geoNear` from the address point.

## 9. Integrations

- **Storage** (`services/storage.js`) — Supabase Storage through `@supabase/supabase-js`, used for storage only:
  - Create one server-side client with the **secret key** (never the publishable/anon key) and `auth: { persistSession: false, autoRefreshToken: false }`. It lives only in `services/storage.js`.
  - Bucket setup is code, not dashboard clicks: `npm run storage:setup` creates or updates the `SUPABASE_BUCKET` bucket as **private**, with a 5 MB file size limit and allowed MIME types `image/jpeg` and `image/png`. It is safe to run repeatedly.
  - Upload: validate the requested content type and byte size, build the path `` `${userId}/${crypto.randomUUID()}.${ext}` `` on the server (a template string — never `node:path`; never accept a path from the client), record it in `uploads`, then return `createSignedUploadUrl(path)`.
  - Order creation: each path must match the exact pattern `^{userId}/{uuid}\.(jpg|png)$`, exist in `uploads` for this customer, and exist in storage with an allowed type and size. Look up the installed storage-js API for reading one object's metadata — don't guess a method name, and don't rely on `list()` over the whole folder (it is paginated, so it breaks for customers with many uploads).
  - Viewing: `createSignedUrls` for all of an order's images in one call, lifetime ≤ 600 s.
  - No Storage RLS policies: nothing reaches the bucket except this service and the signed URLs it issues. Never make the bucket public.
  - Tests mock `services/storage.js`; they never call Supabase.
- **Push** (`services/push.js`): `expo-server-sdk` with `accessToken: EXPO_ACCESS_TOKEN` (enhanced push security), send in chunks, delete tokens that return `DeviceNotRegistered`. Called after the DB write; errors are logged, never thrown to the request. Texts (`{n}` = order number, amounts formatted from paise, times in IST):

  | Event | To | Title / body |
  | --- | --- | --- |
  | Order placed | admins | "New order {n}" / "Tap to review the prescription." |
  | Bill sent | customer | "Your bill is ready" / "{n} · ₹{total}. Please confirm by {time}." |
  | Bill revised | customer | "Your bill was updated" / "{n} · ₹{total}. Please review and confirm by {time}." |
  | Rejected | customer | "Order {n} couldn't be accepted" / "Tap to see why." |
  | Cancelled by store | customer | "Order {n} was cancelled by the store" / "Tap for details." |
  | Out for delivery | customer | "Your order is on the way" / "{n} · keep ₹{total} ready." |
  | Delivered | customer | "Order {n} delivered" / "Thank you for ordering with us." |
  | Delivery failed | customer | "We couldn't deliver order {n}" / "Tap for details." |
  | Bill expired | customer | "Order {n} was cancelled" / "The bill wasn't confirmed in time." |
  | Customer confirmed | admins | "{n} confirmed" / "Ready to pack." |
  | Customer cancelled | admins | "{n} cancelled by the customer" / "No action needed." |
  | Bill expired | admins | "{n} expired" / "The customer didn't confirm the bill." |

- **Email** (`services/email.js`): Resend's REST API via global `fetch`, verification and reset codes only. Subjects "Your verification code" / "Your password reset code"; body: the code, "It expires in 10 minutes.", "If you didn't request this, you can ignore this email." Sender from `EMAIL_FROM` (root D3). Never log codes or email bodies. Tests mock this service.
- **Google** (`services/googleAuth.js`): `verifyIdToken` only. Tests mock this service.
- **Time** (`utils/time.js`): IST helpers built on `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"` (IST has no DST; no date library needed). All functions take `now` as an argument.

## 10. Jobs

Each job is an exported function taking `now`, so tests call it directly. `server.js` schedules them with `setInterval` and clears them on shutdown. With one always-on instance (§15) that is enough; every job is safe to run twice.

- `jobs/expireUnconfirmedBills.js` — every 5 minutes: cancels `AWAITING_CONFIRMATION` orders with `billExpiresAt <= now` using the same conditional transition as everything else (`by.kind: SYSTEM`, reason `BILL_EXPIRED`), then notifies per root 3.6.
- `jobs/deleteUnusedUploads.js` — hourly: for uploads with no `attachedAt` created more than 24 hours ago, deletes the storage object, then the record.
- There is no retention job: orders and images attached to orders are kept (root D1).

## 11. Security, logging, lifecycle

- `helmet()`, `x-powered-by` disabled, 100 kb body limit (no files pass through the API), rate limiting.
- **CORS**: native apps are not subject to CORS, so no CORS middleware is installed. If a web client is added later, add an allow-list from a new env var — never bare `cors()`.
- Pino + `pino-http` with a request id on every line. Request logs record method, **route pattern** (e.g. `/api/v1/admin/orders`), status and duration — never `req.url` or the query string. `redact` authorization headers, cookies, passwords, tokens, codes, phone, address, patient name, notes and bill items. No `console.*`.
- `GET /health` reports process + DB readiness as `{ status, db }` — no versions, hostnames or error details.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop accepting connections, clear jobs, finish in-flight requests, close Mongo, exit (with a hard timeout). Windows has no `SIGTERM` — test shutdown locally with Ctrl+C (`SIGINT`); `node --watch` restarts without running the handler.

## 12. Testing

- Vitest + Supertest + `mongodb-memory-server` (replica-set mode). The first run downloads a `mongod` binary (slow on Windows with antivirus) — set a generous `hookTimeout`.
- Every endpoint: at least one success test **and** a test for each domain error code listed for it in section 7.
- The order transition table is tested exhaustively: every allowed transition succeeds, every other pair returns `INVALID_ORDER_TRANSITION`, and concurrent transitions produce exactly one winner and one `ORDER_STATUS_CHANGED`.
- Concurrency: two simultaneous order creations at 2 open orders produce exactly one success and one `TOO_MANY_OPEN_ORDERS`; two simultaneous requests with the same `Idempotency-Key` produce one order, returned to both.
- Time and distance logic (`isStoreOpen`, `nextOpensAt`, `billExpiresAt`, radius checks) is tested with injected `now` values around opening and closing boundaries. Where a service reads the clock, use `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime` — faking all timers hangs the Mongo driver.
- Jobs are tested by calling the exported function with a `now`, never by waiting for the interval.
- Authorization tests: a customer token on admin routes, an admin token on customer routes, staff accessing another store's order or `storeId`, a customer accessing another customer's order, staff on owner-only routes, a disabled admin with a still-valid access token — all rejected.
- Security tests: Google linking to an unverified account removes its password; a rotated refresh token reused revokes all sessions; regex metacharacters in `q` are matched literally.

## 13. Environment variables

```text
NODE_ENV  PORT  LOG_LEVEL  TRUST_PROXY  MONGODB_URI
JWT_CUSTOMER_ACCESS_SECRET  JWT_CUSTOMER_REFRESH_SECRET
JWT_ADMIN_ACCESS_SECRET     JWT_ADMIN_REFRESH_SECRET
GOOGLE_WEB_CLIENT_ID
SUPABASE_URL  SUPABASE_SECRET_KEY  SUPABASE_BUCKET
EMAIL_API_KEY  EMAIL_FROM
EXPO_ACCESS_TOKEN
BILL_CONFIRMATION_TIMEOUT_MINUTES     # 60 in .env.example
```

All validated by Zod in `config/env.js`; the app refuses to start if any required value is missing. `TRUST_PROXY` is the number of proxy hops in front of the app (`0` locally).

Local development uses a separate Atlas dev cluster (or Docker `mongo` started with `--replSet rs0`). A MongoDB installed as a Windows service starts standalone; it needs `replication.replSetName` in `mongod.cfg` and a one-time `rs.initiate()` before transactions work.

## 14. Commands (from `backend/`)

```bash
npm run dev                   # node --watch --env-file=.env src/server.js
npm start                     # node src/server.js (env comes from the host)
npm run lint
npm run knip
npm test
npm run admin:create          # node --env-file=.env scripts/admin-create.js
npm run admin:reset-password
npm run admin:disable
npm run admin:enable
npm run admin:set-stores
npm run admin:list
npm run storage:setup         # create/update the private prescriptions bucket
```

Run the admin scripts from PowerShell, Windows Terminal or the VS Code terminal (they need a TTY for the hidden password prompt).

## 15. Deployment (Render)

- One **web service**, one instance, autoscaling off (rate limits and jobs are in-process). The instance must be **always on**: Render's free instances spin down when idle, which stops the bill-expiry and cleanup jobs and makes the first request after a pause slow. Plan and region are open decisions (root D4) — ask before the first deployment.
- The backend depends on the `shared` workspace, so Render builds from the **repo root**: build command installs the workspaces (root `postinstall` builds `shared`), start command runs the backend's `start` script. Pin Node through `engines` / `.nvmrc`, and check how Render picks the Node version when setting it up.
- Environment variables are set in the Render dashboard (never committed); `PORT` is provided by Render and `env.js` reads it like any other value.
- Health check path: `/health`.
- Render stops the old instance with `SIGTERM` on each deploy, so graceful shutdown (§11) must finish within Render's shutdown grace period.
- `TRUST_PROXY`: Render sits in front of the app as a proxy. Don't guess the hop count — at first deployment, verify that `req.ip` is the real client IP (e.g. temporarily log it for your own request, or follow express-rate-limit's trust-proxy troubleshooting) and set the value from that.
- Admin CLI scripts run from a developer machine against the production `MONGODB_URI` (they confirm the target first, §6), not on Render.
