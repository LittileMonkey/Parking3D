# Parking System Frontend

React, TypeScript and Vite customer-facing frontend.

## Run locally

```powershell
npm install
npm run dev
npm run build
```

The Vite development server proxies `/api`, `/health` and SignalR WebSocket requests under `/hubs` to `http://localhost:5237` by default. Set `VITE_API_BASE_URL` to use another Gateway origin and `VITE_PARKING_HUB_URL` to override the default `/hubs/parking` endpoint.

## Customer routes

- `/` — customer landing page and parking search preview.
- `/login`, `/register`, `/forgot-password` — authentication UI.
- `/booking` — unified NEAREST/CHEAPEST search, facility/floor/slot selection, account vehicle selection, real ExactSlot hold, payment handoff and booking tracking.
- `/search` — compatibility redirect to `/booking`; there is one customer search-and-book journey.
- `/bookings/:bookingId` — owner-scoped booking detail, hold countdown, CASH request and server-issued QR.
- `/faq` — public answers retrieved from approved FAQ documents.

## Shared customer presentation

The customer landing page, booking search, booking status and FAQ use the shared `CustomerLayout` for the public header and footer. It keeps the customer theme light, provides a keyboard-operable mobile navigation menu and displays the learning-only notice: “Đây là sản phẩm phục vụ học tập, không dùng cho hoạt động thực tế.”

## Integration boundaries

- API requests use the Gateway and the shared `result` / `isSuccess` / `statusCode` / `message` response envelope.
- Search results and pricing come from the Parking Search API; availability, slot IDs and statuses come from the selected lot's Availability API. Missing estimates display as “Chưa có giá”, not zero.
- Authenticated vehicle choices come from `GET /api/v1/user-vehicles`; the UI sends the selected account vehicle ID and masks its plate in the selector.
- The 3D view and accessible slot list use the same availability records and selection state. Availability is refreshed every 10 seconds; the server remains authoritative for status and booking holds. The current availability contract has no 3D coordinates, so the view lays out the real slot records in a generated grid rather than claiming physical coordinates.
- While current availability is open, the customer view listens for `SlotStatusChanged` from `ParkingHub`. The event payload must include string `slotId` and a supported string `status` (`AVAILABLE`, `HELD`, `RESERVED`, `OCCUPIED` or `MAINTENANCE`); `parkingLotId` is optional and filters out events for another lot when supplied. Event batches are merged per animation frame and filtered against loaded slot IDs and the active lot; a 10-second API refresh remains the fallback if SignalR is unavailable. The expected local endpoint is `/hubs/parking`; deployments can override it with `VITE_PARKING_HUB_URL`. Confirm the route and event contract with the backend hub owner before deployment.
- CASH requests are created through the Payment API. Only an authorized staff member can confirm collection. The frontend does not expose staff confirmation or treat browser callbacks as payment confirmation.
- Booking status is refreshed from the owner-authorized Booking API. A QR is rendered locally only when the backend reports `CONFIRMED` and supplies its QR token. No QR or booking/payment status is fabricated.
- The current API surface has no customer payment-status lookup endpoint. The UI identifies the returned payment status as the initial create-payment response and uses Booking status for server-side progress.
- FAQ content is never hard-coded in the client; the public assistant endpoint returns approved-source answers or its explicit fallback.

The frontend does not create backend APIs or simulate booking/payment success. A missing/expired authentication session, stale search criteria, unavailable slot, conflict, unavailable service and expired hold are surfaced to the customer.
