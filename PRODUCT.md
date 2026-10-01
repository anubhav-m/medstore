# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
- **Customers** (MedStore app, Play Store): regulars of one local chemist who want their medicines delivered. They photograph a prescription or a medicine strip, choose a nearby store, and pay cash on delivery. They often order on a phone while unwell or caring for someone else.
- **Store staff** (MedStore Admin, internal APK): pharmacists and counter staff. They review prescription photos, reject the order or send a bill, then pack and deliver it. They work at a busy counter on phones or tablets and are alerted to new orders by push notification.
- **Owner** (MedStore Admin): everything staff can do, for every store. Also creates and edits stores, blocks customers and reads daily cash reports.

## Product Purpose
Lets a neighbourhood chemist take delivery orders from a prescription photo, with no catalog. A customer orders by uploading 1–5 photos. A pharmacist reviews them and either rejects the order with a reason or sends an itemised bill. The customer confirms or cancels that bill within a time limit, and the store delivers and collects cash. Success means orders move from photo to doorstep reliably, and staff can work through their queue quickly without mistakes over money or prescriptions.

## Positioning
This is the customer's own trusted local chemist, not a national e-pharmacy. A real pharmacist at a shop they already know reads the prescription, the order comes the same day from a store nearby, and they pay cash on delivery. There's no catalog to browse and no online payment.

## Operating Context
- Order flow: upload photos → staff review → bill (can be revised) → customer confirms before `billExpiresAt` → packed → out for delivery → delivered (cash recorded). Rejections, cancellations and failed deliveries carry fixed reason codes.
- Admin order tabs: New, Awaiting customer, Preparing, Out for delivery, Delivered, Closed. Staff search by order number or phone. The order list refreshes every 20 seconds.
- Store hours and the delivery radius gate only new orders. The server computes distance, open/closed status and the next opening time, and the apps only display them.
- Staff call customers with tap-to-call and navigate with a Google Maps directions link.

## Capabilities and Constraints
- No catalog, cart, chat, online payment or live tracking (fixed scope).
- Money is integer paise and is shown only through `formatCurrency`. Times are in IST.
- Prescription images are private. Signed URLs appear only on order detail screens, and the admin app never caches images to disk.
- Medicine names, patient names, notes, addresses and phone numbers are health or personal data: never in push text, logs or analytics.
- The only Google services are the Maps SDK for Android and Google Sign-In. The address picker uses a fixed centre pin with the phone's reverse geocoder.
- The full domain rules live in `CLAUDE.md` §3 and `mobile/CLAUDE.md`. Those files are authoritative.
- Open: the final app names (currently "MedStore" / "MedStore Admin"), the Android package prefix, the email sender, the support email, and where the terms, privacy policy and account-deletion page are hosted (D2/D3).

## Brand Commitments
- Working names: **MedStore** (customer) and **MedStore Admin**. Both are expected to change.
- No logo, brand colours or voice guide exist yet.

## Evidence on Hand
No customer count, testimonials, ratings or store photos exist yet. Never invent store counts, delivery times, discounts or reviews.

## Product Principles
1. **The pharmacist is the product.** Every flow puts a real person reviewing the prescription at the centre, not browsing or upselling.
2. **Money and status are never ambiguous.** Totals come from the server, the bill version is explicit, and the expiry time and the next step are always visible.
3. **Privacy by default.** Health data appears only where the role needs it and never leaks into notifications, lists or caches.
4. **Quick at the counter.** Admin screens are built for working through a queue under pressure: scannable tabs, clear actions, few taps.
5. **Plain, calm, local.** Customer-facing copy is simple English, as clear as talking to a friendly shopkeeper.

## Accessibility & Inclusion
English only in v1. Touch targets of at least 48×48 dp with 8 dp spacing, `accessibilityLabel`/`accessibilityRole` on every interactive element, and text that stays readable with the system font scaled up. Errors are always shown in plain language, never as codes.
