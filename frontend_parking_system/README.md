# Parking System Frontend

React, TypeScript and Vite customer-facing frontend.

## Run locally

```powershell
npm install
npm run dev
npm run build
```

The Vite development server proxies `/api`, `/health` and SignalR WebSocket requests under `/hubs` to `http://localhost:8080`. Set `VITE_API_BASE_URL` to use another Gateway origin and `VITE_PARKING_HUB_URL` to override the default `/hubs/parking` endpoint.

## Customer routes

- `/` — customer landing page and parking search.
- `/login`, `/register`, `/forgot-password` — authentication UI.
- `/booking` — NEAREST/CHEAPEST search and estimated total prices for the requested parking duration.
- `/booking/:lotId` — dedicated floor/slot selection and booking summary, account vehicle selection, ExactSlot/AutoSlot hold and payment handoff. “Chọn bãi” opens this route, rather than expanding the search page.
- `/search` — compatibility redirect to `/booking`; there is one customer search-and-book journey.
- `/bookings/:bookingId` — owner-scoped booking detail, payment selection, hold countdown, automatic success/processing/expired states, receipt and server-issued entry QR.
- `/payment-return` — validates the signed VNPay result through the backend, then reopens the matching owner-scoped booking and waits for real confirmation.
- `/faq` — public answers retrieved from approved FAQ documents.

## Shared customer presentation

The landing page uses the authentication palette (navy `#072D59`, blue `#0D4685`, ice `#DBF2FC`, white) and an SVG illustration of a parking layout in its hero. The illustration is labelled and is not a live, bookable map. It leads from search to API-backed parking locations, booking steps, customer benefits and approved-source FAQ. It does not show fabricated coverage, performance figures, prices or live availability. Catalog loading, empty and unavailable states are explicit; FAQ answers are requested for the selected lot, never supplied by client fixtures.

Search passes the selected lot, vehicle and exact duration in minutes to `/booking`. Nearest search requests GPS only on submission; validated latitude and longitude are passed to the booking page and its search API. Denied GPS shows a recoverable message without substituting coordinates. Homepage lot links open a specific lot through the existing booking flow; current estimates and availability are obtained there.

The booking flow shares the navy/ice palette and shows three steps: search, choose a space, payment. The selected lot, local start time, exact duration and nearest-search coordinates travel in the URL. Search submission replaces the search URL so browser Back preserves the trip. A local, allowlisted `returnTo` on login restores the selection page; its requested slot is restored only after availability confirms it is still compatible and available. No hold exists merely because a slot is highlighted. The selection summary includes the time range and API estimate, the slot list can be collapsed, and mobile has a fixed shortcut to review the summary. Selected slots use navy with a checkmark, separate from occupied red.

The customer landing page, booking search, booking status and FAQ use the shared `CustomerLayout` for the public header and footer. It keeps the customer theme light, provides a keyboard-operable mobile navigation menu and displays the learning-only notice: “Đây là sản phẩm phục vụ học tập, không dùng cho hoạt động thực tế.”

## Integration boundaries

### Authentication configuration

Set `VITE_GOOGLE_CLIENT_ID` in `.env.local` to the same public OAuth Web Client ID as Identity's `Google:ClientId`, then restart Vite. Add the exact FE origin (for local development, `http://localhost:5173`) to the client's Authorized JavaScript origins in Google Cloud. Never put a Google client secret into a `VITE_` variable. Google sign-in/sign-up use the official GIS button and POST its ID token to `/api/v1/auth/google`; accounts with MFA complete the existing server challenge. See [Google's button integration guide](https://developers.google.com/identity/gsi/web/guides/display-button).

Remember me keeps the existing bearer/refresh-token session in browser storage for at most seven days; unchecked sign-in keeps it in the current tab only. Passwords and Google ID tokens are never persisted. Expired access tokens use the existing refresh endpoint, while logout and security changes clear the remembered session. The backend remains responsible for token validity and revocation.

Recovery requests an email code first, then submits the code and new password together to `/api/v1/auth/reset-password`. Code validity and expiry are checked by Identity; the UI only shows success after the server succeeds.

Run `npm run test:auth` for remembered-session storage checks. Google consent/origin configuration and actual email delivery require an integration check with the configured services.

- API requests use the Gateway and the shared `result` / `isSuccess` / `statusCode` / `message` response envelope.
- Search results and pricing come from the Parking Search API; availability, slot IDs and statuses come from the selected lot's Availability API. Missing estimates display as “Chưa có giá”, not zero.
- Authenticated vehicle choices come from `GET /api/v1/user-vehicles`; the UI sends the selected account vehicle ID and masks its plate in the selector.
- The 3D view renders all levels and zones from the selected lot's availability JSON, and shares slot selection/status with the accessible list. The level selector cross-sections the active floor, ghosts adjacent floors and animates the camera without rebuilding the scene. When availability includes `mapObjects` with `levelId`, `objectType` and 3D transform fields, slot objects are matched by `refEntityId` and other map objects are rendered by type; the current contract does not include them, so slots use a zone-grouped generated layout instead of claiming physical coordinates. Instanced meshes reduce draw calls, and scene geometries, materials, controls and animation are released on unmount or layout change. Availability is refreshed every 10 seconds; the server remains authoritative for status and booking holds.
- While current availability is open, the customer view listens for `SlotStatusChanged` from `ParkingHub`. The event payload must include string `slotId` and a supported string `status` (`AVAILABLE`, `HELD`, `RESERVED`, `OCCUPIED` or `MAINTENANCE`); `parkingLotId` is optional and filters out events for another lot when supplied. Event batches are merged per animation frame and filtered against loaded slot IDs and the active lot; a 10-second API refresh remains the fallback if SignalR is unavailable. The expected local endpoint is `/hubs/parking`; deployments can override it with `VITE_PARKING_HUB_URL`. Confirm the route and event contract with the backend hub owner before deployment.
- CASH requests are created through the Payment API. Only an authorized staff member can confirm collection. The frontend does not expose staff confirmation or treat browser callbacks as payment confirmation.
- Booking status is read first through the owner-authorized Booking API, then `GET /api/v1/payments/{bookingId}/status` supplies payment ID, method, actual amount and payment status. A successful payment can precede Parking confirmation; this displays a processing state and disables another payment. Booking status from the Booking API is authoritative for entry eligibility, rather than the payment DTO's derived booking status.
- Once a booking is `CONFIRMED`, `POST /api/v1/bookings/{bookingId}/qr` is called automatically. The QR is rendered only from the returned, unexpired `qrPayload`; issuance is deduplicated under React StrictMode. Manual refresh does not repeatedly invalidate the issued token. The QR disappears after terminal/check-in states or its deadline; an issuance failure has a separate retry. Customers can download the QR as SVG.
- `GET /api/v1/payments/{paymentId}/receipt` supplies the receipt number, paid time and bank transaction reference after verified payment success. A temporarily missing receipt does not erase a successful payment. Estimated booking prices are never labelled as the amount paid.
- Before redirecting to VNPay, the frontend retains only transaction-attempt/booking/payment IDs in sessionStorage, bounded to 10 entries with a 2-hour TTL. It never stores a successful status there. VNPay `vnp_TxnRef` is an attempt ID, so it must not be treated as a booking/payment ID. The signed return endpoint uses a raw business result, including legitimate `isSuccess: false` outcomes. Missing context leads to account history; it never selects the last unrelated booking. Use the same FE origin before/after redirect (for example `http://localhost:5173`) and match `Frontend:BaseUrl` in Payment configuration.
- FAQ content is never hard-coded in the client; the public assistant endpoint returns approved-source answers or its explicit fallback.

The frontend does not create backend APIs or simulate booking/payment success. A missing/expired authentication session, stale search criteria, unavailable slot, conflict, unavailable service and expired hold are surfaced to the customer.

Run the parking 3D and realtime unit tests with `npm run test:parking`.

Run payment return-correlation and staff API regressions with `npm run test:payment`. Staff check-in freezes each request, including evidence `capturedAt`, for identical-key retries. Camera-driven plate/type changes also create a new attempt. Stale attempts are blocked after 30 minutes until the operator checks sessions and restarts the action. Only `PLATE_MISMATCH` (or an unambiguous legacy mismatch message without an error code) opens the override dialog.
