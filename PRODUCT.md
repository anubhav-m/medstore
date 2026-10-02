# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users
- **Customers** (MedStore app, Play Store): ordinary people in India who want their medicines delivered from a nearby store in the group. Many are older, and many order for parents or other family members, often while unwell or caring for someone. Many aren't confident with apps. They use cheap Android phones with small screens and large system font sizes, sometimes on weak mobile data. They must always know what is happening with their order and what, if anything, they need to do next.
- **Store staff** (MedStore Admin, internal APK): pharmacists and counter staff. They review prescription photos, reject the order or send a bill, then pack and deliver it. They work at a busy counter on phones or tablets and are alerted to new orders by push notification. They need speed and accuracy over delight: dense, scannable screens, few taps, and no ambiguity about status or money.
- **Owner** (MedStore Admin): everything staff can do, for every store. Also creates and edits stores, blocks customers and checks the day's cash in daily reports.

## Product Purpose
Lets a local group of 4–5 medical stores in one city take delivery orders from a prescription photo, with no catalog. A customer orders by uploading 1–5 photos. A pharmacist reviews them and either rejects the order with a reason or sends an itemised bill. The customer confirms or cancels that bill within a time limit, and the store packs, delivers and collects cash. Success means orders move from photo to doorstep reliably, customers are never unsure what happens next, and staff can work through their queue quickly without mistakes over money or prescriptions.

## Positioning
This is the customer's own trusted local chemist, not a national e-pharmacy: a small group of stores in their city. A real pharmacist at a shop they already know reads the prescription, the order comes the same day from a store nearby, and they pay cash on delivery. There's no catalog to browse, no cart, no chat and no online payment.

## Operating Context
- Order flow: upload photos → staff review → bill (can be revised) → customer confirms before `billExpiresAt` → packed → out for delivery → delivered (cash recorded). Rejections, cancellations and failed deliveries carry fixed reason codes.
- Admin order tabs: New, Awaiting customer, Preparing, Out for delivery, Delivered, Closed. Staff search by order number or phone. The order list refreshes every 20 seconds.
- Store hours and the delivery radius gate only new orders. The server computes distance, open/closed status and the next opening time, and the apps only display them.
- Staff call customers with tap-to-call and navigate with a Google Maps directions link.
- Customers use cheap Android phones with small screens, often with the largest system font size, and sometimes on weak mobile data. Screens must stay usable on slow connections.

## Capabilities and Constraints
- No catalog, cart, chat, online payment or live tracking (fixed scope).
- Money is integer paise and is shown only through `formatCurrency`, in Indian rupees (₹). Times are in IST.
- Prescription images are private. Signed URLs appear only on order detail screens, and the admin app never caches images to disk.
- Medicine names, patient names, notes, addresses and phone numbers are health or personal data: never in push text, logs or analytics.
- The only Google services are the Maps SDK for Android and Google Sign-In. The address picker uses a fixed centre pin with the phone's reverse geocoder.
- The full domain rules live in `CLAUDE.md` §3 and `mobile/CLAUDE.md`. Those files are authoritative.
- Android only for now. iOS stays enabled but isn't built or tested until asked.
- Package IDs are decided and permanent once published: `com.medico.medstore` (customer) and `com.medico.medstore.admin` (admin).
- Open: the final app names (currently "MedStore" / "MedStore Admin"), the email sender, the support email, and where the terms, privacy policy and account-deletion page are hosted (D2/D3).

## Brand Commitments
- Register: product (app UI), not brand or marketing. The apps should feel professional.
- Working names: **MedStore** (customer) and **MedStore Admin**. Both are expected to change.
- Logo: none yet. Use a simple placeholder or a temporary generated logo, built so it is easy to swap out when the real one arrives.
- Brand colours: none yet. Propose a palette.
- Voice: plain, warm and respectful. Short sentences, no jargon, no jokes about health, no exclamation-mark cheerfulness. Always say what happens next.
- Must avoid anything that looks like a generic AI-generated app: purple or blue gradients, glassmorphism, emoji as decoration, big hero illustrations, identical card grids, unlabeled icons. Also avoid cold hospital styling and pharmacy clichés such as a green cross on everything.

## Evidence on Hand
No customer count, testimonials, ratings or store photos exist yet. Never invent store counts, delivery times, discounts or reviews.

## Product Principles
1. **The pharmacist is the product.** Every flow puts a real person reviewing the prescription at the centre, not browsing or upselling.
2. **Money and status are never ambiguous.** Totals come from the server, the bill version is explicit, and the expiry time and the next step are always visible. Customers always know where their order is and whether they need to do anything.
3. **Privacy by default.** Health data appears only where the role needs it and never leaks into notifications, lists or caches.
4. **Quick at the counter.** Admin screens are built for working through a queue under pressure: dense, scannable tabs, clear actions, few taps. Speed and accuracy come before delight.
5. **Plain, calm, local.** Customer-facing copy is simple English, as clear as talking to a friendly shopkeeper.

## Accessibility & Inclusion
English only in v1. Hindi is planned, so fonts must already cover Devanagari. Touch targets of at least 48×48 dp with 8 dp spacing, `accessibilityLabel`/`accessibilityRole` on every interactive element. Text stays readable and layouts don't break at the largest system font size, on small screens. Prices in ₹ are large and clear enough to read and compare at a glance. Errors are always shown in plain language, never as codes.
