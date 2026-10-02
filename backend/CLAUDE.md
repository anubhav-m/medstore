# Backend — CLAUDE.md

Express + MongoDB API serving both apps. Plain JavaScript, ES modules. The root `CLAUDE.md` rules (especially section 3, the domain rules, and 3.8, the limits) apply here too; this file adds backend rules.

- `"type": "module"` in `package.json`; relative imports include the `.js` extension; built-ins use the `node:` prefix.
- Prefer built-ins: `node --env-file` over dotenv, `node --watch` over nodemon, `express.json()` over body-parser, `crypto.randomUUID()` over uuid, global `fetch` over axios/node-fetch.

## 1. Structure

```text
backend/
├── scripts/                  # CLI: admin-create.js, admin-reset-password.js, admin-disable.js,
│                             # admin-enable.js, admin-set-stores.js, admin-list.js, storage-setup.js,
│                             # seed-dev.js (development only)
└── src/
    ├── app.js                # builds the Express app — no listen()
    ├── server.js             # connects DB, starts server + jobs, graceful shutdown
    ├── config/               # env.js (Zod-validated, fails fast), db.js, logger.js,
    │                         # rateLimits.js (the only place rate-limit numbers live)
    ├── middleware/           # authCustomer, authAdmin, requireOnboarded, requireRole, validate,
    │                         # rateLimit, requestId, requestLogger, notFound, errorHandler
    ├── modules/
    │   ├── health/           # GET /health (mounted at the root, not under /api/v1)
    │   ├── auth/             # customer: register, verify email, login, Google, reset, refresh, logout
    │   ├── admin-auth/       # admin: login, refresh, logout, change password, me, push tokens
    │   ├── admins/           # admin model + service (used by admin-auth and scripts)
    │   ├── users/            # profile, password change, onboarding, account deletion, push tokens
    │   ├── addresses/
    │   ├── stores/           # store model, isStoreOpen, nextOpensAt, geo queries
    │   ├── uploads/          # upload model, signed upload URLs
    │   ├── orders/           # both surfaces, transitions, bill, reorder, counters, item suggestions
    │   ├── notifications/    # push tokens (register / remove / move, used by users + admin-auth),
    │   │                     # order notifications (recipients, texts, sending)
    │   ├── customers/        # admin side: block / unblock
    │   └── reports/          # daily summary
    ├── services/             # integrations only: storage.js, email.js, push.js, googleAuth.js
    ├── jobs/                 # schedule.js, expireUnconfirmedBills.js, deleteUnusedUploads.js,
    │                         # deleteUnverifiedAccounts.js
    ├── routes/               # customer.routes.js (/api/v1), admin.routes.js (/api/v1/admin)
    └── utils/                # AppError (+ invalidToken), sendSuccess, pagination, time (IST), money, escapeRegex,
                              # geo (lat/lng ↔ GeoJSON), idParams (+ objectId), phone (Indian phone schema)
test/                         # mirrors src/; globalSetup.js (memory replica set), setup.js
```

Folders and files are created by the feature that first needs them — no empty modules, routers or middleware.

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

`orders/` also has, because one service file would exceed ~200 lines: `orderTransition.js` (`transitionOrder` — the only code that changes an order's status), `orderPlacement.service.js` (create + reorder: the creation checks and the creation transaction), `orderImages.js` (creation check 5), `order.view.js` (customer response shapes) and `counter.model.js` (order numbers). The admin surface has `order.admin.service.js` (list, counts, detail, item suggestions), `orderAdminActions.service.js` (reject, bill, pack, dispatch, deliver, fail, cancel), `orderBill.js` (bill totals and `billExpiresAt`), `order.admin.view.js` (admin response shapes) and `order.admin.validation.js`.

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
// app.js — createApp({ rateLimits }) (order matters)
app.disable("x-powered-by");
app.set("trust proxy", env.TRUST_PROXY);
app.use(requestId);                          // always generated; incoming X-Request-Id ignored
app.use(helmet());
app.use(requestLogger);
app.use(healthRoutes);                        // before the limiter: health checks share one IP
app.use(createRateLimit(rateLimits.global)); // before body parsing, so bad bodies are still counted
app.use(express.json({ limit: "100kb" }));
app.use("/api/v1/admin", adminRoutes);       // added by the admin features
app.use("/api/v1", customerRoutes);          // added by the customer features
app.use(notFound);      // AppError 404 ROUTE_NOT_FOUND
app.use(errorHandler);  // always last
```

Rate limiters are built with `createRateLimit({ windowMs, limit })` from `middleware/rateLimit.js`; its handler forwards `AppError` 429 `TOO_MANY_REQUESTS` to the error handler. Numbers come from `config/rateLimits.js`.

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
| Malformed `:id` path param (`validate`)    | 400     | `INVALID_ID`                                           |
| Mongo duplicate key (`code 11000`)         | 409     | `DUPLICATE_RESOURCE` (name the field, never the value) |
| Malformed JSON (`entity.parse.failed`)     | 400     | `INVALID_JSON`                                         |
| Body too large (`entity.too.large`)        | 413     | `PAYLOAD_TOO_LARGE`                                    |
| Other body-parser 4xx (charset, encoding…) | 400     | `INVALID_JSON`                                         |
| Undecodable path param (`URIError`, 400)   | 400     | `INVALID_ID`                                           |
| JWT expired / invalid                      | 401     | `TOKEN_EXPIRED` / `INVALID_TOKEN`                      |
| Rate limit exceeded                        | 429     | `TOO_MANY_REQUESTS`                                    |
| Mongo connection / server-selection errors | 503     | `SERVICE_UNAVAILABLE`                                  |
| **Anything else**                          | 500     | `INTERNAL_SERVER_ERROR` (generic message)              |

JWT errors (`TokenExpiredError`, `JsonWebTokenError`, `NotBeforeError`) and Mongo connection errors (`MongooseServerSelectionError`, `MongoServerSelectionError`, `MongoNetworkError`, `MongoNetworkTimeoutError`, `MongoNotConnectedError`) are matched by `error.name`, so the classifier doesn't import `jsonwebtoken` or `mongodb`. Mongoose validation cast failures get the message "Invalid value" so rejected values are never echoed. 4xx errors are logged with only their code and error name (messages can echo input); 5xx errors are logged in full.

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

- Every route validates `body`, `params`, `query` **and the headers it reads** with Zod via the `validate` middleware. Schemas are strict (unknown keys rejected; the error handler reports each unknown key as its own `field`, e.g. `address.userId`), strings trimmed, sizes bounded by the limits in root 3.8. `Idempotency-Key` is a required UUID on `POST /orders` and `POST /orders/:id/reorder` (lowercased by the schema; the field in errors is `idempotency-key`). Header schemas use `z.object`, not strict — clients send many headers.
- Validated data goes on `req.validated`. Do not reassign `req.query` (read-only in Express 5).
- Path params are always ObjectIds, validated with `idParamsSchema` (`utils/idParams.js`). `validate` turns a `params` failure into `400 INVALID_ID`, never `VALIDATION_ERROR`.
- Never pass `req.body` / `req.query` straight into Mongoose. Destructure the fields you need; strict schemas also block NoSQL operator injection (`{ "$ne": null }`).
- User text used in a regex (order search, item suggestions) always goes through `utils/escapeRegex` (`prefixPattern`: escaped and anchored with `^`). Match against a stored lowercase or uppercase key instead of using the `i` flag, so the index applies.
- Rupee inputs never exist on the API — money fields are integer paise.

## 6. Authentication & authorization

### Tokens

- Customers and admins are **separate token worlds**: different access-token secrets (`JWT_CUSTOMER_ACCESS_SECRET`, `JWT_ADMIN_ACCESS_SECRET`) and an `aud` claim of `customer` or `admin`. `authCustomer` and `authAdmin` each verify their own secret **and** audience, so a customer token can never pass admin middleware.
- JWTs are signed and verified with `HS256` only (pass `algorithms: ["HS256"]` to verify). `env.js` requires every secret (the access-token secrets and `OTP_HMAC_SECRET`) to be ≥ 32 characters and all of them to be distinct.
- Access tokens: JWT, 15 minutes. Refresh tokens: 32 random bytes (`crypto.randomBytes`, base64url), opaque, so they need no signing secret. They are stored as SHA-256 hashes, rotated on every use and revoked on logout. Customer refresh lifetime 30 days, admin 7 days. Refresh and logout take the refresh token in the body.
- `modules/auth/session.service.js` holds the token logic for both worlds (`subjectKind` `CUSTOMER` | `ADMIN`): `issueTokens`, `verifyAccessToken` (used by `authCustomer` and `authAdmin`), `rotateRefreshToken`, `logout`, `revokeAllSessions`. Every refresh-token query includes `subjectKind`, so a token from one world never refreshes or logs out the other. Rotation is one conditional update (`{ tokenHash, subjectKind, revokedAt: null, expiresAt > now }` → set `revokedAt` and `rotatedAt`).
- Reuse of an already-rotated refresh token (`rotatedAt` set) revokes all of that subject's sessions. Rotated tokens are kept (revoked) until they expire so reuse can be detected. A token revoked by logout, password change or a script is just `INVALID_TOKEN`: other devices present it in good faith, and treating that as reuse would also revoke the fresh session a password change just issued. An unknown or expired token is just `INVALID_TOKEN`.
- **The auth middleware loads the subject on every request** (one indexed read). A deleted customer → `INVALID_TOKEN`. An inactive admin → `ACCOUNT_DISABLED`. An admin's `role`, `storeIds` and `mustChangePassword` always come from the database, never from the token, so changes apply immediately.
- **All of a subject's sessions are revoked** on password reset, password change (the response carries fresh tokens for the current device), admin disable, admin password reset by script, and account deletion. `revokeAllSessions` also deletes all of the subject's push tokens (root 3.6), so the current device re-registers its token after a password change.
- `logout(subjectKind, { refreshToken, pushToken? })` revokes the refresh token and removes `pushToken` from the subject that token was issued to — also when it was already revoked (a password change elsewhere), never when it is unknown. So nobody can remove another account's push token by sending it with their own or a made-up refresh token.
- Passwords: argon2id (`utils/password.js`); lengths from root 3.8. Auth failures are generic ("Invalid email or password"). An unknown email, or an account without a password, is still verified against a fixed dummy hash, so response time doesn't reveal which emails exist.

### Customers

- Sign-up, verification, codes and Google linking follow root 3.2 exactly.
- Google: verify the ID token with `google-auth-library` `verifyIdToken` (audience = `GOOGLE_WEB_CLIENT_ID`) and require `email_verified`. A bad token or an unverified Google email → `INVALID_CREDENTIALS`. An email already linked to a **different** `googleId` → `INVALID_CREDENTIALS`; accounts are never relinked silently.
- OTP codes (`modules/auth/otp.service.js`):
  - From `crypto.randomInt`, one active code per user and purpose (a new code replaces the old document).
  - Stored as HMAC-SHA256 keyed with `OTP_HMAC_SECRET` (a plain hash of 6 digits is reversible offline) and compared with `crypto.timingSafeEqual`.
  - `expiresAt` is checked in code, not only by the TTL index.
  - Every guess first takes an attempt with one conditional `$inc` (`attempts < 5`, not expired), then compares, so a code is compared at most 5 times however many guesses arrive at once. Wrong guesses 1–4 → `INVALID_OR_EXPIRED_CODE`; the 5th deletes the code → `TOO_MANY_ATTEMPTS`. A correct code is consumed by one conditional delete (matching its hash), so it works once.
  - Never log codes.
- Code sends: every request to send a code is recorded in `codeSends` **whether or not the email has an account**. The 60 s per email+purpose cooldown and the 5 per email per hour cap (root 3.8) are counted from it, so `429 TOO_MANY_REQUESTS` answers identically for known and unknown emails.
  - The checks and the insert run in one transaction that first bumps the email's `codeSendLocks` document, so concurrent requests for one email run one at a time and the limits stay exact. The lock is upserted just before the transaction (concurrent first upserts inside one could fail with a non-transient duplicate key).
  - `register`: a provider failure → `503 SERVICE_UNAVAILABLE`. The account is kept and the send released, so `resend-code` works at once.
  - `resend-code` / `forgot-password`: a provider failure is logged and the generic success returned (a 503 would reveal that the email exists).
  - `login` on an unverified account sends a code only if the limits allow (silently skipped otherwise) and always answers `EMAIL_NOT_VERIFIED`.
- `authCustomer` sets `req.user = { id, onboardingCompleted }` from its one read. `requireOnboarded` (after it) guards every customer route except auth, profile and onboarding.
- Every customer query includes `userId: req.user.id`.
- Account deletion (`DELETE /me`, `users/accountDeletion.service.js`) requires re-authentication (root 3.2), so a stolen access token alone can't delete an account:
  - An account with a password must send `{ password }` — `{ googleIdToken }` is `INVALID_CREDENTIALS` even when Google is linked. An account without one sends `{ googleIdToken }`, verified like Google sign-in; its `sub` must equal the account's `googleId`. A wrong password (or a password for a Google-only account, checked against the dummy hash) → `INVALID_CREDENTIALS`. The `customerReauth` limiter applies.
  - One transaction: delete the user document **first**, then check for open orders (`ACCOUNT_HAS_OPEN_ORDERS` aborts it, so nothing is deleted), then delete addresses, refresh tokens and OTP codes. Push tokens live on the user document.
  - Kept: orders and their photos (root D1), `uploads` records (unattached ones go with the cleanup job), and `codeSends`, so the per-email send limits still apply when the freed email registers again.
  - Order creation, upload-URL issue and address writes all write the user document first in their transactions, so they conflict with a deletion; each checks that the document still exists (`matchedCount` / `null`) and otherwise throws `INVALID_TOKEN`, so nothing is ever written for a deleted account.

### Admins

- Login with username (trimmed, lowercased) + password. The password is checked first (unknown usernames against the dummy hash), then `isActive: false` → `ACCOUNT_DISABLED`, so a wrong password never reveals a disabled account. Record `lastLoginAt`.
- No account lockout flag. Failed logins are rate-limited instead (`adminLogin`, 5 failed per 15 min per username across all IPs; `adminLoginIp`, 20 failed per 15 min per IP, shared with change-password). Only failed attempts count, so staff sharing a shop's IP don't block each other. Trade-off (accepted): anyone can block new logins for one username for up to 15 minutes; existing sessions keep refreshing.
- Admin passwords are 12–128 characters (customers 8–128) because admins can see every customer's health data.
- `middleware/authAdmin.js` exports `authAdmin` (every admin route) and `authAdminAllowPasswordChange` (only change-password and `GET /me`; logout uses the refresh token alone). While `mustChangePassword` is set, `authAdmin` returns `PASSWORD_CHANGE_REQUIRED`. Both set `req.admin = { id, role, storeIds }` (read from the database on every request, never from the token).
- `change-password` `{ currentPassword, newPassword }`: wrong current → `INVALID_CREDENTIALS`; a new password equal to the current one → `VALIDATION_ERROR` on `newPassword`. Success clears `mustChangePassword`, revokes every session and returns a fresh pair.
- `requireRole("OWNER")` guards owner-only routes (`FORBIDDEN` for staff). It runs before `validate`, so staff get `FORBIDDEN` whatever they send.
- **Store scoping**: every admin query on orders and item suggestions includes `storeId: { $in: scope }`, where `scope` comes from one helper, `getStoreScope(admin)` in `modules/stores/storeScope.js` (an array of store ids: every store, including inactive ones, for `OWNER`; `admin.storeIds` for `STAFF`). Out-of-scope resources return 404. Customer and report endpoints are owner-only.

### Admin CLI scripts (`backend/scripts/`)

- `npm run admin:create` — prompts for username, name, role, store codes (staff only) and password. Hashes with argon2 and sets `mustChangePassword: true`. Owners have no store codes (they act on every store); staff need at least one. Codes must name existing stores (inactive ones allowed): the script checks them before the password prompt and re-asks, and `createAdmin` / `setAdminStores` check again (`STORE_NOT_FOUND`).
- `npm run admin:reset-password` (sets `mustChangePassword`, revokes sessions), `admin:disable` (revokes sessions), `admin:enable`, `admin:set-stores` (replaces a staff member's store codes), `admin:list` (username, role, store codes or `all stores`, active, name — never hashes). `admin:set-stores` works on staff only and needs no sign-out: `storeIds` are read on every request.
- Passwords are entered in a **hidden prompt**, twice, never as a CLI argument (arguments end up in shell history, including PowerShell's). `scripts/lib/prompt.js` implements it with `node:readline` keypress events plus `process.stdin.setRawMode`; if stdin is not a TTY, `scripts/lib/runAdminScript.js` refuses to run with a clear message (Git Bash's mintty is not a TTY — use PowerShell, Windows Terminal or the VS Code terminal). Answers are validated with the Zod field schemas in `modules/admins/admin.validation.js` and re-asked when invalid.
- Scripts print with `process.stdout.write` (no `console.*`) and never print a password or hash.
- Before writing, every script prints the target database host and name and requires typing `yes`.
- Scripts reuse `modules/admins/admin.service.js` and `config/env.js`; they contain no separate hashing or DB logic.

### Rate limits

Values from root 3.8. The limiters in `config/rateLimits.js` are `global`, `authIp` (register, google, resend-code, forgot-password), `customerLogin` (per IP+email), `customerLoginIp` (per IP, failed only — customers share IPs behind carrier NAT), `codeCheck` (verify-email, reset-password), `refresh` (both worlds), `logout` (both worlds, per IP), `customerReauth` (10 per 15 min per customer, keyed by `customerKey`; one limiter instance shared by `POST /me/password` and `DELETE /me`), `adminLogin` (per username, failed only), `adminLoginIp` (per IP, failed only; admin login and change-password) and `orderCreate` (10 per hour per customer, keyed by `customerKey` after `authCustomer`; one limiter instance shared by `POST /orders` and reorder). Strict on `/auth/*` and `/admin/auth/*` (login, register, codes, refresh), on code sends per email, on upload URLs and on order creation/reorder per customer. The per-email code-send and per-customer upload-URL limits are **domain limits** (numbers in `@medstore/shared`), counted from the database in `otp.service.js` and `upload.service.js`, not `express-rate-limit` — the upload day is the IST calendar day, which a rolling window can't express. A sane global limit on everything else. The limiter uses the default in-memory store (one Render instance — §15); moving to several instances means moving it to a shared store. `app.set("trust proxy", env.TRUST_PROXY)` so limits see real client IPs and `X-Forwarded-For` can't be spoofed.

## 7. API surface

Every endpoint can also return the generic codes from section 3 (`VALIDATION_ERROR`, `INVALID_ID`, `INVALID_JSON`, `TOO_MANY_REQUESTS`, …). Authenticated endpoints can return `INVALID_TOKEN` / `TOKEN_EXPIRED`. Customer endpoints marked † also return `ONBOARDING_REQUIRED`. Admin endpoints after login also return `ACCOUNT_DISABLED` and `PASSWORD_CHANGE_REQUIRED`. The table lists the **domain** codes each endpoint can return — tests cover every one.

Customer — `/api/v1`:

| Endpoint | Notes | Domain errors |
| --- | --- | --- |
| `POST /auth/register` | `{ email, password }`; sends a code; no tokens | `EMAIL_ALREADY_REGISTERED`, `SERVICE_UNAVAILABLE` (email not sent) |
| `POST /auth/verify-email` | `{ email, code }` → tokens + user | `INVALID_OR_EXPIRED_CODE`, `TOO_MANY_ATTEMPTS` |
| `POST /auth/resend-code` | `{ email, purpose }`; same response whether or not the email exists | — |
| `POST /auth/login` | `{ email, password }` → tokens + user | `INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED` |
| `POST /auth/google` | `{ idToken }` → tokens + user | `INVALID_CREDENTIALS` |
| `POST /auth/forgot-password` | `{ email }`; same response whether or not the email exists | — |
| `POST /auth/reset-password` | `{ email, code, newPassword }`; revokes all sessions; no tokens | `INVALID_OR_EXPIRED_CODE`, `TOO_MANY_ATTEMPTS` |
| `POST /auth/refresh` | `{ refreshToken }` → new pair | `INVALID_TOKEN` |
| `POST /auth/logout` | `{ refreshToken, pushToken? }`; `pushToken` is removed from the refresh token's account (§6); always succeeds | — |
| `GET /me` | `{ user: CustomerProfile }`: auth fields + `isBlocked`, `hasPassword`, `name`, `phone`, `dob`, `gender`, `consentAcceptedAt`, `consentVersion` (auth endpoints still return `AuthUser`) | — |
| `PATCH /me` | `{ name?, phone?, dob?, gender? }`, at least one; `null` clears `dob` / `gender` | — |
| `POST /me/password` | `{ currentPassword, newPassword }` → `AuthSession` (fresh tokens for this device). A new password equal to the current one → `VALIDATION_ERROR` on `newPassword`. Revokes every session and push token; the update matches the verified hash, so a reset in between isn't overwritten. `customerReauth` limiter. Not †: works before onboarding | `INVALID_CREDENTIALS` (also when the account has no password) |
| `DELETE /me` | exactly one of `{ password }` / `{ googleIdToken }` (§6); no data in the response. Not †: works before onboarding | `INVALID_CREDENTIALS`, `ACCOUNT_HAS_OPEN_ORDERS` |
| `POST /me/onboarding` | `{ name, phone, address, consentAccepted: true }` → `{ user, address }` | `ONBOARDING_ALREADY_COMPLETED` |
| `POST /me/push-tokens` · `DELETE /me/push-tokens` | `{ token }` in the body (never in the URL), an Expo push token (≤ 200 chars, SDK check); no data in the response. POST makes it the account's newest (≤ 10 kept) and removes it from every other customer and admin; DELETE removes it from the caller only. Not †: works before onboarding and for blocked customers | — |
| `GET /addresses` † | all (≤ 10), default first then newest; not paginated | — |
| `POST /addresses` † | `{ label, line1, line2?, landmark?, city, pincode, lat, lng, isDefault? }` → `{ address }` | `ADDRESS_LIMIT_REACHED` |
| `PATCH /addresses/:id` † | any of the create fields (`lat` + `lng` together; `null` clears `line2` / `landmark`; `isDefault` only `true`) → `{ address }` | `ADDRESS_NOT_FOUND` |
| `DELETE /addresses/:id` † | promotes the newest remaining address if the default is deleted | `ADDRESS_NOT_FOUND` |
| `GET /stores?addressId=` † | `{ stores: CustomerStore[] }`: active stores nearest first (`$geoNear` from the address pin) with public fields only (`id`, `name`, `address`, `phone`, hours, `deliveryFeePaise`) plus `distanceKm` (1 decimal), `deliversToAddress`, `isOpen`, `nextOpensAt`; not paginated | `ADDRESS_NOT_FOUND` |
| `POST /uploads/prescriptions` † | `{ contentType, sizeBytes }` (strict: no path, file name or folder) → `{ path, signedUrl, token }` | `ACCOUNT_BLOCKED`, `UPLOAD_LIMIT_REACHED`, `SERVICE_UNAVAILABLE` (signing failed) |
| `POST /orders` † | `Idempotency-Key` header; `{ storeId, addressId, imagePaths (1–5 distinct), patientName?, note? }` → `{ order: CustomerOrder }` | `ACCOUNT_BLOCKED`, `ADDRESS_NOT_FOUND`, `STORE_NOT_FOUND`, `STORE_NOT_ACCEPTING_ORDERS`, `STORE_CLOSED`, `OUTSIDE_DELIVERY_AREA`, `INVALID_UPLOAD`, `TOO_MANY_OPEN_ORDERS`, `SERVICE_UNAVAILABLE` (storage check failed) |
| `GET /orders?scope=active\|past&page=&limit=` † | `scope` optional (both when absent); newest first; `{ orders: CustomerOrderSummary[] }` + `meta`; no image URLs | — |
| `GET /orders/:id` † | `{ order: CustomerOrderDetail }` — `CustomerOrder` + signed `imageUrls` (600 s) | `ORDER_NOT_FOUND`, `SERVICE_UNAVAILABLE` (signing failed) |
| `POST /orders/:id/confirm` † | `{ billVersion }` → `{ order }` | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `BILL_CHANGED`, `BILL_EXPIRED`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/cancel` † | `{ reasonCode?, note? }` (`note` needs a code; required for `OTHER`) → `{ order }` | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/reorder` † | `{ note? }` + `Idempotency-Key` header → `{ order }` | `ACCOUNT_BLOCKED`, `ORDER_NOT_FOUND`, `REORDER_NOT_ALLOWED`, `STORE_NOT_ACCEPTING_ORDERS`, `STORE_CLOSED`, `OUTSIDE_DELIVERY_AREA`, `INVALID_UPLOAD`, `TOO_MANY_OPEN_ORDERS`, `SERVICE_UNAVAILABLE` |

Customer order responses (`order.view.js`) pick fields explicitly and never include `userId`, `idempotencyKey`, image paths, `items[].nameKey`, `customerName` / `customerPhone` or `statusHistory[].by.id`. Only `GET /orders/:id` signs image URLs; the POST endpoints return `CustomerOrder` without them, so a write never waits on Supabase.

Admin — `/api/v1/admin`:

| Endpoint | Notes | Domain errors |
| --- | --- | --- |
| `POST /auth/login` | `{ username, password }` → tokens + admin (role, stores, `mustChangePassword`) | `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED` |
| `POST /auth/refresh` | `{ refreshToken }` | `INVALID_TOKEN`, `ACCOUNT_DISABLED` |
| `POST /auth/logout` | `{ refreshToken, pushToken? }`; no access token needed; `pushToken` is removed from the refresh token's admin (§6); always succeeds | — |
| `POST /auth/change-password` | `{ currentPassword, newPassword }` → fresh tokens; clears `mustChangePassword` | `INVALID_CREDENTIALS` |
| `GET /me` | `{ admin: { id, username, name, role, storeIds, mustChangePassword }, stores: [{ id, code, name }] }` — `stores` are the scoped stores by code | — |
| `POST /me/push-tokens` · `DELETE /me/push-tokens` | `{ token }` in the body; same rules as the customer endpoints (`authAdmin`, so not while `mustChangePassword`) | — |
| `GET /orders?storeId=&tab=&q=&page=&limit=` | `{ orders: AdminOrderSummary[] }` + `meta`; `tab` from `ADMIN_ORDER_TABS`, sorted as its table says (no `tab`: every status, newest first); `q` (1–50 chars) = order-number prefix or phone (see below); no image URLs | `STORE_NOT_FOUND` |
| `GET /orders/counts?storeId=` | `{ counts: Record<AdminOrderTab, number> }` from one aggregation | `STORE_NOT_FOUND` |
| `GET /orders/:id` | `{ order: AdminOrderDetail }`: signed `imageUrls` (600 s), the copied customer `{ id, name, phone, isDeleted }` (`isDeleted`: the account was deleted; every `AdminOrder` has it), history with admin names | `ORDER_NOT_FOUND`, `SERVICE_UNAVAILABLE` (signing failed) |
| `POST /orders/:id/reject` | `{ reasonCode, note? }` (`RejectReason`; `note` required for `OTHER`) → `{ order: AdminOrder }` | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/bill` | `{ expectedBillVersion, items[{ name, quantity, unitPricePaise }], deliveryFeePaise?, discountPaise? }`; creates (version 0 → 1) or revises (version + 1); fee defaults to the order's current one, discount to 0; client totals are a 400 | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED`, `BILL_CHANGED` |
| `POST /orders/:id/pack` · `/dispatch` | | `ORDER_NOT_FOUND`, `INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED` |
| `POST /orders/:id/deliver` | `{ cashCollectedPaise }` (integer 0 – `CASH_COLLECTED_MAX_PAISE`, so report sums stay exact) | same as above |
| `POST /orders/:id/fail` · `/cancel` | `{ reasonCode, note? }` (`DeliveryFailedReason` / `StaffCancelReason`) | same as above |
| `GET /item-suggestions?storeId=&q=` | `{ suggestions: string[] }`: `q` 1–50 chars; distinct names (latest spelling), sorted, ≤ 10 | `STORE_NOT_FOUND` |
| `GET /stores` | `{ stores: AdminStore[] }`: scoped stores by code (owner: all, including inactive); not paginated | — |
| `POST /stores` (owner) | `{ code, name, address { line1, line2?, city, pincode }, phone, lat, lng, deliveryRadiusKm, openingMinutes, closingMinutes, deliveryFeePaise, isAcceptingOrders?, isActive? }` → `{ store }` | `FORBIDDEN`, `DUPLICATE_RESOURCE` (field `code`) |
| `PATCH /stores/:id` (owner) | any create field except `code` (sending it is a 400); `address` is replaced whole; `lat` + `lng` together; `openingMinutes` + `closingMinutes` together → `{ store }` | `FORBIDDEN`, `STORE_NOT_FOUND` |
| `PATCH /customers/:id/block` (owner) | `{ isBlocked, reason? }` (`reason` 1–300 chars, only with `isBlocked: true`) → `{ customer: CustomerBlockState }` (`id`, `isBlocked`, `blockedAt`, `blockReason` — nothing else about the customer) | `FORBIDDEN`, `CUSTOMER_NOT_FOUND` |
| `GET /reports/daily?storeId=&date=` (owner) | both required; `date` a real `YYYY-MM-DD` IST date, not after today (IST) → `{ report: DailyReport }`: `store`, `date`, `created { total, byStatus }` (every status), `delivered { count, expectedCashPaise, collectedCashPaise, differencePaise }`, `cashMismatchCount`, `cashMismatches` (≤ 100, oldest delivery first). Any store, inactive included | `FORBIDDEN`, `STORE_NOT_FOUND` |

Admin order search (`q`): always an order-number prefix (uppercased, so the index applies — store codes may be all digits); also a phone when it looks like one: a complete number in any accepted customer format matches exactly, 1–9 digits (optionally after `+91`) match the start of the 10-digit number. Every admin order action returns `{ order: AdminOrder }` — the detail without image URLs.

Plus `GET /health` (no auth). Each transition has its own action endpoint with its own Zod schema; there is no generic "set status" endpoint. `DELETE` endpoints that take a body are called only by our own apps, never through a browser or CDN.

## 8. Database (MongoDB / Mongoose)

### Data model

All schemas use `timestamps: true`. Money fields are integer paise. Locations are GeoJSON `Point` `{ type: "Point", coordinates: [lng, lat] }`.

```text
users          email (lowercase), emailVerified, passwordHash (select: false; null for Google-only),
               googleId?, name, phone (+91XXXXXXXXXX), dob? (UTC midnight), gender? (MALE | FEMALE | OTHER),
               onboardingCompleted, consentAcceptedAt, consentVersion, isBlocked,
               blockedAt?, blockedBy? (admin id), blockReason? (all null unless blocked),
               pushTokens[{ token, createdAt }], orderCreateSeq (written inside the order-creation
               transaction so concurrent creates conflict — root 3.4 check 6),
               addressWriteSeq (select: false; $inc'd first in every address-write transaction so
               one customer's address writes run one at a time — cap and single default stay exact),
               uploadIssueSeq (select: false; $inc'd first when issuing an upload URL — limits stay exact)
addresses      userId, label, line1 (house/flat), line2?, landmark?, city, pincode, location, isDefault
stores         code (immutable), name, address { line1, line2?, city, pincode }, phone, location, deliveryRadiusKm,
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
uploads        userId, path, contentType, sizeBytes (as declared), attachedAt (null until first used by an
               order; set inside the creation transaction)
refreshTokens  tokenHash, subjectKind (CUSTOMER | ADMIN), subjectId, expiresAt, revokedAt?, rotatedAt?
otpCodes       userId, purpose (VERIFY_EMAIL | RESET_PASSWORD), codeHash (HMAC), attempts, expiresAt
codeSends      email, purpose — one per code-send request, kept 1 hour (per-email send limits)
codeSendLocks  _id (email), seq — bumped first in every code-send reservation; kept 1 hour after last use
counters       _id (store code), seq — never reset
```

### Rules

- `toJSON` strips `__v`, `passwordHash` and other secrets. Customers never receive `statusHistory[].by.id`.
- **Index every field you query, sort or keep unique.** Required indexes:
  - `users`: `email` unique; `googleId` unique sparse; `pushTokens.token` (moving a token between accounts); `updatedAt` partial on `emailVerified: false` (unverified-accounts job)
  - `admins`: `username` unique; `pushTokens.token`
  - `stores`: `code` unique; `location` 2dsphere
  - `addresses`: `{ userId, createdAt: -1 }`; `userId` unique with `partialFilterExpression: { isDefault: true }` (at most one default, enforced by the database)
  - `orders`: `orderNumber` unique; `{ storeId, status, createdAt }`; `{ userId, status, createdAt }`; `{ userId, idempotencyKey }` unique; `{ status, billExpiresAt }` (expiry job); `{ storeId, "items.nameKey" }` (suggestions); `{ storeId, customerPhone }` (search); `{ storeId, deliveredAt }` (report); `images.path` (reference checks).
  - `uploads`: `path` unique; `{ userId, createdAt }`; `{ attachedAt, createdAt }` (cleanup job — added with it)
  - `refreshTokens`: `tokenHash` unique; `{ subjectKind, subjectId }`; TTL on `expiresAt`
  - `otpCodes`: `{ userId, purpose }` unique; TTL on `expiresAt`
  - `codeSends`: `{ email, createdAt }`; TTL of 1 hour on `createdAt`
  - `codeSendLocks`: TTL of 1 hour on `updatedAt`
- **Every unbounded list endpoint is paginated** (default 20, max 100). Bounded lists (addresses ≤ 10, stores) are not. Never `Model.find()` without a limit.
- Reads use `.lean()` and projections. No N+1 loops — use `$in` or aggregation.
- Keep a state change inside **one document** where possible (order status, history and bill live on the order), so single-document atomicity is enough. Use a transaction (`mongoose.connection.transaction`, which retries transient conflicts) when several documents must change together: onboarding (profile + first address), address writes (user lock + count / default switch + write), order creation/reorder (user lock + upload records re-checked + count + insert + marking uploads attached), code-send reservations (email lock + limit counts + insert), push-token registration (claim on the caller + removal from every other account) and account deletion. Local and test Mongo run as a single-node replica set.
- Idempotency: look up `(userId, idempotencyKey)` before anything else, and again inside the creation transaction right after `$inc orderCreateSeq`. That write serialises one customer's creates, so a concurrent request with the same key finds the winner's order there and returns it (even at 2 open orders, where it would otherwise fail check 6). The unique index stays as the database-level guarantee.
- Daily report (`reports/report.service.js`): the IST day comes from `istDayBounds(date)` (`utils/time.js`; start inclusive, end exclusive). Two aggregations run in parallel: created orders grouped by status (`{ storeId, status, createdAt }` index), and delivered orders by `deliveredAt` (`{ storeId, deliveredAt }` index) with a `$facet` for totals, the mismatch count and the limited mismatch list.
- Order numbers: `counter.model.js` `nextOrderNumber(storeCode)` — an atomic `$inc` upsert run just **before** the creation transaction (a failed create leaves a gap; inside the transaction, concurrent first upserts could fail with a non-transient duplicate key).
- Transitions (`transitionOrder`): check the table and actor, read the order's status within `scope`, then one `findOneAndUpdate` on that exact status (+ `billVersion`, + `billExpiresAt > now` for CONFIRM) that sets the new status and `set` fields and pushes the history entry. A miss is classified by re-reading: `ORDER_STATUS_CHANGED`, then `BILL_CHANGED`, then `BILL_EXPIRED`. Single-document, so no transaction. After a successful update it calls `notifyTransition(order, action)` (`notifications/orderNotifications.js`), so every status change — customer, staff or system, including the bill-expiry job — sends its root 3.6 notification without the caller doing anything. Order creation and reorder call `notifyOrderPlaced` after the creation transaction commits, only when that call created the order (not for an idempotent replay).
- Never read-modify-write counters or statuses; use atomic operators and conditional filters.
- Geo: store locations and address pins are GeoJSON `Point` with `[lng, lat]`. Distance/eligibility uses `$geoNear` (`spherical: true`) from the address point. `deliversToAddress` compares the **exact** distance in metres with the radius; only the displayed `distanceKm` is rounded.
- Store hours are edited as a pair (`openingMinutes` + `closingMinutes` together), so opening < closing is checked on the request alone, never against stored values.

## 9. Integrations

- **Storage** (`services/storage.js`) — Supabase Storage through `@supabase/supabase-js`, used for storage only:
  - Create one server-side client with the **secret key** (`sb_secret_…`, enforced by `env.js`; never the publishable/anon key) and `auth: { persistSession: false, autoRefreshToken: false }`, plus a `global.fetch` with a 10 s timeout. It lives only in `services/storage.js`.
  - Every Supabase failure (returned `error` or thrown) becomes `503 SERVICE_UNAVAILABLE`; the log carries the operation, provider status and message — never the key, a signed URL or a token.
  - Bucket setup is code, not dashboard clicks: `npm run storage:setup` creates or updates the `SUPABASE_BUCKET` bucket as **private**, with a 5 MB file size limit and allowed MIME types `image/jpeg` and `image/png`. It is safe to run repeatedly. It finds the bucket with `listBuckets({ search })` + an exact id match (search is a substring match), calls `createBucket` or `updateBucket`, then reads it back with `getBucket` and exits non-zero naming any setting that didn't apply. It prints the project host and bucket and asks no confirmation (it only ever applies the same settings).
  - Upload: validate the requested content type and byte size, build the path `` `${userId}/${crypto.randomUUID()}.${ext}` `` on the server (a template string — never `node:path`; never accept a path from the client), record it in `uploads`, then return `createSignedUploadUrl(path)`.
    - The blocked check, both limit counts (last hour; since IST midnight) and the insert run in one transaction that first bumps `users.uploadIssueSeq`. Signing runs after the commit (no lock held across a network call); if it fails, the record is deleted so the attempt doesn't count.
    - Signed upload URLs are valid for **2 hours** (fixed by Supabase) and allow one upload to that path: no `upsert`, so an object is never overwritten.
  - Order creation: each path must match the exact pattern `^{userId}/{uuid}\.(jpg|png)$`, exist in `uploads` for this customer, and exist in storage with an allowed type and size.
    - Verified against the real bucket: it checks only the uploader's `Content-Type` **header**, never the bytes (a text file sent as `image/jpeg` is stored), and the header may disagree with the path's extension (a `.jpg` path can be stored as `image/png`). So the stored object's content type must equal the one recorded in `uploads` for that path.
    - **Signature check (decided by the user):** the object's first bytes must match its type: JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`; otherwise `INVALID_UPLOAD`. Read only those bytes, never the whole image: a short-lived signed view URL fetched with `Range: bytes=0-7` returns `206` with just those bytes (verified against the real bucket). This runs for new orders and for reorders (check 5). Image bytes are never logged. Never `list()` over the whole folder (it is paginated, so it breaks for customers with many uploads).
    - `verifyImageObject(path, contentType)` (storage-js 2.117): `info(path)` returns camelised `{ size, contentType, … }`; a missing object is an error with `status` 404 **or** a 400 whose `statusCode` is `"404"` → `false` (`INVALID_UPLOAD`), any other error → 503. Then `createSignedUrl(path, 60)` + `fetch` with `Range: bytes=0-7`; anything but `206` → 503.
    - `orderImages.js` checks the path pattern and the `uploads` records (one `$in` query) before calling storage, then verifies all images in parallel.
  - Viewing: `createSignedViewUrls(paths)` — `createSignedUrls` for all of an order's images in one call, `SIGNED_VIEW_URL_TTL_SECONDS` (600); an item that can't be signed → 503.
  - No Storage RLS policies: nothing reaches the bucket except this service and the signed URLs it issues. Never make the bucket public.
  - Tests mock `services/storage.js`; they never call Supabase.
- **Push** (`services/push.js`): `expo-server-sdk` with `accessToken: EXPO_ACCESS_TOKEN` (enhanced push security; optional in `env.js`).
  - `isPushToken(token)` wraps `Expo.isExpoPushToken`; `notifications/pushToken.validation.js` uses it, so no module imports the SDK.
  - `sendPushNotifications(messages)` — one message per token (`{ to, title, body, data }`; it adds `sound: "default"`, `priority: "high"`), sent in `chunkPushNotifications` chunks. It never throws: a failed request is logged (error name and code, message count) and the next chunk is still sent. It returns `{ unregisteredTokens }` from tickets whose `details.error` is `DeviceNotRegistered` (tickets come back in message order). It has no database access.
  - `notifications/orderNotifications.js` looks up recipients (root 3.6), builds the texts (`notificationTexts.js`), sends, and deletes the unregistered tokens from users and admins. It runs in the background (`void`, never awaited by the request); every failure is caught and logged with `orderId` and `event` only. Nothing is sent when no recipient has a token.
  - **Push receipts** (decided by the user): only push tickets are checked now. Receipts (which also report `DeviceNotRegistered`, about 15 minutes later) are checked by a job added in the jobs session (§10).
  - Logs never contain tokens or notification text.
  - Texts (`{n}` = order number, amounts formatted from paise with `utils/money.js` `formatRupees`, times in IST with `utils/time.js` `istTimeString`):

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

Each job is an exported function taking `now`, so tests call it directly. `server.js` starts them and clears them on shutdown. `jobs/schedule.js` holds the shared pieces: `startJob(name, run, intervalMs)` (`setInterval`; a failed run is logged with the job name) and `skipWhileRunning(run)` (a tick that fires while the previous run is still going returns `null`). With one always-on instance (§15) that is enough; every job is safe to run twice.

- `jobs/expireUnconfirmedBills.js` — every 5 minutes (`startBillExpiryJob()`, which returns its stop function): cancels `AWAITING_CONFIRMATION` orders with `billExpiresAt <= now` using the same conditional transition as everything else (`EXPIRE_BILL`, `by.kind: SYSTEM`, cancellation `{ byKind: SYSTEM, code: BILL_EXPIRED }` — `SystemCancelReason` in `shared` — and the history note "Bill not confirmed in time"); `transitionOrder` sends the root 3.6 notifications itself.
  - Selection is by `billExpiresAt` (which already holds the timeout and the closing-time cap), never recomputed from `billSentAt`. At most 100 orders per run, earliest expiry first (`{ status, billExpiresAt }` index); the rest wait for the next tick.
  - Each update also matches the `billVersion` the job read, so a bill revised after the query (new expiry) is never cancelled.
  - An order confirmed, cancelled or revised meanwhile (`INVALID_ORDER_TRANSITION`, `ORDER_STATUS_CHANGED`, `BILL_CHANGED`) is counted as skipped, not an error. Any other failure is logged with the order id only, and the batch continues. `expireUnconfirmedBills(now)` returns `{ expired, skipped, failed }`.
  - `runScheduledBillExpiry` (`skipWhileRunning`) skips a tick (returns `null`) while the previous run is still going. Overlapping runs (e.g. two instances) are still safe: each order is cancelled once.
- Push receipts (not built yet) — checks Expo push receipts and deletes tokens they report as `DeviceNotRegistered` (§9). Needs the ticket ids stored when sending; designed in the jobs session.
- `jobs/deleteUnusedUploads.js` — hourly, at most 500 per run, oldest first: uploads with no `attachedAt` created more than 24 hours ago (signed upload URLs last 2 hours, so nothing can still arrive).
  - Skips any path an order references (and marks its record attached), so a shared image is never deleted.
  - Claims each record with a conditional delete (`attachedAt: null`) **before** deleting objects, then deletes the claimed objects in one `removeObjects` call. If that call fails, the records are inserted back unchanged so the next run retries.
  - Order creation re-counts the upload records inside its transaction (check 5 again). The job's conditional delete and the creation's `attachedAt` update conflict, so an order either attaches the upload first (the job leaves it) or finds it gone (`INVALID_UPLOAD`) — never an order pointing at a deleted object.
- `jobs/deleteUnverifiedAccounts.js` — hourly, at most 500 per run: deletes accounts with `emailVerified: false` whose `updatedAt` is more than 7 days old and that have no live code (their owner may be verifying right now). Registering again bumps `updatedAt`. Such accounts never had tokens, so they own no sessions, addresses or orders. `verify-email` answers `INVALID_OR_EXPIRED_CODE` if the account disappears while its code is checked.
- There is no retention job: orders and images attached to orders are kept (root D1).

## 11. Security, logging, lifecycle

- `helmet()`, `x-powered-by` disabled, 100 kb body limit (no files pass through the API), rate limiting.
- **CORS**: native apps are not subject to CORS, so no CORS middleware is installed. If a web client is added later, add an allow-list from a new env var — never bare `cors()`.
- Pino + `pino-http` (`quietReqLogger`/`quietResLogger`, so `req.log` is bound to `reqId` only) with a request id on every line. Request logs record method, **route pattern** (`req.baseUrl + req.route.path` captured by `recordRoutePattern` when the router matches — Express resets `baseUrl` before a failed request is logged — or `unmatched`), status and duration — never `req.url` or the query string. `redact` authorization headers, cookies, passwords, tokens, signed URLs, codes, email, phone, date of birth, address (and its `line1`, `line2`, `landmark`, `location`, `lat`, `lng`), patient name, notes, reasons, bill items, image paths and the search query `q` (top level and up to two levels deep). `code` and `name` are redacted **only** under `req.body` / `body` (OTP codes, customer names) — elsewhere they carry error codes and error names that logs must keep. No `console.*`.
- `GET /health` reports process + DB readiness as `{ status, db }` — no versions, hostnames or error details.
- Graceful shutdown on `SIGTERM`/`SIGINT`: stop accepting connections, clear jobs, finish in-flight requests, close Mongo, exit (with a hard timeout). Windows has no `SIGTERM` — test shutdown locally with Ctrl+C (`SIGINT`); `node --watch` restarts without running the handler.

## 12. Testing

- Vitest + Supertest + `mongodb-memory-server` (replica-set mode). The first run downloads a `mongod` binary (slow on Windows with antivirus) — `hookTimeout` is 120 s.
- `test/globalSetup.js` starts one memory replica set and shares its URI via `provide("mongoUri")`. `test/setup.js` connects each worker to its own database (`test-${VITEST_POOL_ID}`) and empties every collection `beforeEach`, so tests are repeatable and order-independent.
- Test env values live in `vitest.config.js` `test.env` (`LOG_LEVEL=silent`, a placeholder `MONGODB_URI` that is never connected to).
- Build apps with `createApp({ rateLimits })` to use low limits in tests; mock a module with `vi.mock` (e.g. `config/db.js`) rather than reaching into library internals.
- Every endpoint: at least one success test **and** a test for each domain error code listed for it in section 7.
- Tests that depend on an index (unique, 2dsphere for `$geoNear`) `await Model.init()` first (e.g. `ensureStoreIndexes` in `test/helpers/store.js`); indexes are built in the background otherwise.
- The order transition table is tested exhaustively: every allowed transition succeeds, every other pair returns `INVALID_ORDER_TRANSITION`, and concurrent transitions produce exactly one winner and one `ORDER_STATUS_CHANGED`. Race tests use `holdOrderUpdatesUntil(n)` (`test/helpers/order.js`), which holds `Order.findOneAndUpdate` until all `n` requests have read the order, so the outcome doesn't depend on timing.
- Order tests may seed orders in any status with `seedOrder` / `seedStoreOrder` (`test/helpers/adminOrder.js`, which also holds a valid request for every staff action). Bill expiry is tested by backdating `billSentAt`, not by moving the clock past the 15-minute access token.
- Concurrency: two simultaneous order creations at 2 open orders produce exactly one success and one `TOO_MANY_OPEN_ORDERS`; two simultaneous requests with the same `Idempotency-Key` produce one order, returned to both.
- Time and distance logic (`isStoreOpen`, `nextOpensAt`, `billExpiresAt`, radius checks) is tested with injected `now` values around opening and closing boundaries. Where a service reads the clock, use `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime` — faking all timers hangs the Mongo driver.
- Jobs are tested by calling the exported function with a `now`, never by waiting for the interval.
- Notification tests mock only `sendPushNotifications` (`vi.mock` with `importOriginal`, so the real `isPushToken` still validates) and wait for the background send with `vi.waitFor`. `test/services/push.test.js` mocks `expo-server-sdk` itself. Other tests leave `push.js` real: their accounts have no push tokens, so nothing is sent.
- Authorization tests: a customer token on admin routes, an admin token on customer routes, staff accessing another store's order or `storeId`, a customer accessing another customer's order, staff on owner-only routes, a disabled admin with a still-valid access token — all rejected.
- Security tests: Google linking to an unverified account removes its password; a rotated refresh token reused revokes all sessions; regex metacharacters in `q` are matched literally.

## 13. Environment variables

```text
NODE_ENV  PORT  LOG_LEVEL  TRUST_PROXY  MONGODB_URI
JWT_CUSTOMER_ACCESS_SECRET  JWT_ADMIN_ACCESS_SECRET  OTP_HMAC_SECRET
GOOGLE_WEB_CLIENT_ID
SUPABASE_URL  SUPABASE_SECRET_KEY  SUPABASE_BUCKET
EMAIL_API_KEY  EMAIL_FROM
EXPO_ACCESS_TOKEN
BILL_CONFIRMATION_TIMEOUT_MINUTES     # 60 in .env.example
```

All validated by Zod in `config/env.js` (`parseEnv(source)`, exported for tests); the app refuses to start and lists every missing or malformed variable by **name** (never the value). `TRUST_PROXY` is the number of proxy hops in front of the app (`0` locally; at least `1` when `NODE_ENV=production`, since Render is a proxy and `0` would put every client in one rate-limit bucket). `LOG_LEVEL` is one of `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`.

**Only these exist so far:** `NODE_ENV`, `PORT`, `MONGODB_URI`, `LOG_LEVEL`, `TRUST_PROXY`, `JWT_CUSTOMER_ACCESS_SECRET`, `JWT_ADMIN_ACCESS_SECRET`, `OTP_HMAC_SECRET`, `GOOGLE_WEB_CLIENT_ID`, `EMAIL_API_KEY` (a Resend key, `re_…`), `EMAIL_FROM` (`address@domain` or `Name <address@domain>`; the domain must be verified in Resend), `SUPABASE_URL` (the bare https project URL — no `/rest/v1` or other path), `SUPABASE_SECRET_KEY` (must start with `sb_secret_`), `SUPABASE_BUCKET` (lowercase bucket name; `prescriptions`), `BILL_CONFIRMATION_TIMEOUT_MINUTES` (1–1440), `EXPO_ACCESS_TOKEN` (optional; empty counts as absent; required once enhanced push security is on in the Expo project). Each other variable above is added — to `env.js` and `.env.example` — by the feature that first uses it. `CORS_ORIGINS` is added only if a web client ever exists.

Local development uses a separate Atlas dev cluster (or Docker `mongo` started with `--replSet rs0`). A MongoDB installed as a Windows service starts standalone; it needs `replication.replSetName` in `mongod.cfg` and a one-time `rs.initiate()` before transactions work.

## 14. Commands (from `backend/`)

```bash
npm run dev                   # node --watch --env-file=.env src/server.js
npm start                     # node src/server.js (env comes from the host)
npm test
npm run admin:create          # node --env-file=.env scripts/admin-create.js
npm run admin:reset-password
npm run admin:disable
npm run admin:enable
npm run admin:set-stores
npm run admin:list
npm run storage:setup         # create/update the private prescriptions bucket
npm run seed:dev -- --lat <lat> --lng <lng>   # development only: stores DEV1–DEV5 around the pin
```

From the repo root: `npm run dev -w backend`, `npm test -w backend`. Lint, knip and typecheck run from the root only.

Run the admin scripts from PowerShell, Windows Terminal or the VS Code terminal (they need a TTY for the hidden password prompt).

`seed:dev` (`scripts/seed-dev.js`, logic in `scripts/lib/seedDevStores.js`) refuses unless `NODE_ENV` is `development`. It creates or resets, by code, five test stores around the given pin (copy it from Google Maps), each parsed with `createStoreSchema` and written with `createStore` / `updateStore`, so every store rule applies: DEV1 always open (1 km N, 10 km radius), DEV2 10:00–22:00 (2 km E, 5 km), DEV3 03:00–03:30 (2 km S, 5 km), DEV4 paused (1.5 km W, 10 km), DEV5 out of range (3 km NE, 0.5 km radius). "Always open" is 00:00–23:59, since 24-hour stores aren't supported (root 3.3). It touches no other collection, deletes nothing and needs no TTY. Assign the codes to test staff with `admin:create` / `admin:set-stores`.

## 15. Deployment (Render)

- One **web service**, one instance, autoscaling off (rate limits and jobs are in-process). The instance must be **always on**: Render's free instances spin down when idle, which stops the bill-expiry and cleanup jobs and makes the first request after a pause slow. Plan and region are open decisions (root D4) — ask before the first deployment.
- The backend depends on the `shared` workspace, so Render builds from the **repo root** — never set the service's root directory to `backend/`. Build command: `npm ci --include=dev` (the root `postinstall` builds `shared`, which needs TypeScript, a dev dependency). Start command: `npm start -w backend`. Pin Node through `engines` / `.nvmrc`, and check how Render picks the Node version when setting it up.
- Environment variables are set in the Render dashboard (never committed); `PORT` is provided by Render and `env.js` reads it like any other value.
- Health check path: `/health`.
- Render stops the old instance with `SIGTERM` on each deploy, so graceful shutdown (§11) must finish within Render's shutdown grace period.
- `TRUST_PROXY`: Render sits in front of the app as a proxy. Don't guess the hop count — at first deployment, verify that `req.ip` is the real client IP (e.g. temporarily log it for your own request, or follow express-rate-limit's trust-proxy troubleshooting) and set the value from that.
- Admin CLI scripts run from a developer machine against the production `MONGODB_URI` (they confirm the target first, §6), not on Render.
