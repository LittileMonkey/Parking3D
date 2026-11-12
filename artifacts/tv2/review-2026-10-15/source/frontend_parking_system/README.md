# Parking System Frontend

React, TypeScript and Vite customer-facing frontend.

## Run locally

```powershell
npm install
npm run dev
npm run build
```

The Vite development server proxies `/api` and `/health` to `http://localhost:5237` by default. Set `VITE_API_BASE_URL` to use another Gateway origin.

## Customer routes

- `/login`, `/register`, `/forgot-password` — authentication UI.
- `/search` — NEAREST/CHEAPEST search, duration estimate, availability lookup and ExactSlot booking.
- `/bookings/:bookingId` — owner-scoped booking detail, hold countdown, CASH request and server-issued QR.
- `/faq` — public answers retrieved from approved FAQ documents.

## Integration boundaries

- API requests use the Gateway and the shared `result` / `isSuccess` / `statusCode` / `message` response envelope.
- Parking search currently returns backend fixture lots/prices. The UI labels these results as demo data; availability and booking are separately checked by Parking.
- Vehicle list APIs are not implemented. The vehicle selector uses clearly marked demo IDs; a real booking requires a JWT and a backend-verified vehicle, and the UI does not report a successful booking when the server rejects a demo vehicle.
- CASH requests are created through the Payment API. Only an authorized staff member can confirm collection. The frontend does not expose staff confirmation or treat browser callbacks as payment confirmation.
- Booking status is refreshed from the owner-authorized Booking API. A QR is rendered locally only when the backend reports `CONFIRMED` and supplies its QR token. No QR or booking/payment status is fabricated.
- The current API surface has no customer payment-status lookup endpoint. The UI identifies the returned payment status as the initial create-payment response and uses Booking status for server-side progress.
- FAQ content is never hard-coded in the client; the public assistant endpoint returns approved-source answers or its explicit fallback.

Some API dependencies are not yet exposed by the backend (notably customer vehicle listing and payment-status lookup). Authentication Gateway paths also need to be aligned with the current Identity controller routes before login/register can be end-to-end verified against the checked-in backend.
