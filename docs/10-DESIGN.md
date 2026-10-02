# ParkMatrix — analysis before implementation

## 1. Screenshots
1. Search: compact navigation, pale blue filter band, vertical facility cards and a large map. Preserve split view, teal selected card, availability badges and price hierarchy. Expand spacing and replace dense metadata with three primary facts.
2–3. Checkout: same design with minor sizing changes. Preserve stepper, payment cards and cost summary. Move issued QR to a separate ticket screen after successful payment; do not imply an unpaid ticket grants entry.
4. Facility: summary header, floor tabs, parking rows and sticky reservation panel. Preserve status colors and direct slot selection; separate amenities/policy from the default map view.
5. Home: pale cyan hero, search module, map preview, service cards and dark business panel. Recreate with vector map artwork and typography rather than unreadable screenshot background.

## 2. Design system
Teal #087f8c, dark teal #006574, navy #122e3b, cyan #dff5f7, background #f5f8fa, muted #70818c, border #e3ebef. Green available, coral occupied, amber reserved, gray maintenance. System sans-serif supports Vietnamese. Body 14–16px, section titles 24–32px, hero 56px. Spacing scale 4/8/12/16/24/32/48/64. Radius 10 controls, 16 cards, 24 major surfaces. Subtle shadows, 44px controls, clear focus rings. White sticky customer header; separate operations sidebar. Tables have clear headers, search/status filters and empty states.

## 3. Reusable components
Button, Badge, Modal, Toast, EmptyState, PageHeading, Header/Footer, OperationsLayout, SearchForm, ParkingCard, CityMap, SlotMap, BookingSummary, Stepper, Ticket, status table.

## 4. Routes
/, /search, /parking/:lotId, /checkout/:bookingId, /tickets/:bookingId, /bookings, /vehicles, /operations, /operations/audit, /about, fallback.

## 5. Mock model
ParkingLot -> Level -> Zone -> Slot; distinct operational status and physical Sessions; time-window Booking reservations. Vehicle ownership, lot-specific PricingPlan copied into booking snapshot. Payment attempts and refund requests distinct from booking status. Session ACTIVE/EXIT_PENDING/COMPLETED. Actor role and facility assignments; Audit records. Three distinct lots, including outdoor. Versioned localStorage and storage-event synchronization. Browser prototype cannot guarantee production transaction isolation or authentication security.

## 6. Interaction and invariants
Search manual demo origins with Haversine distance, vehicle/covered/radius filters; CHEAPEST compares full estimate for same period. Exact/auto selection checks compatibility, operation, occupancy and [start,end) overlap. Duration 30m–24h; 15m pending hold. Confirm rechecks resources. Paid cancellation >1h before arrival eligible for refund request; <=1h no refund. Refund only completes through explicit staff simulation. Cash needs assigned staff. Session occupancy ends only on confirmed physical exit, even after fee payment. Pricing snapshot prevents retroactive changes. VNPay success/failure is an explicit simulator event, not redirect. Idempotent callbacks. Arrival windows are clearly labeled configurable demo policy (15m early/30m late), not asserted baseline constants. No-show distinct from expired hold.

## Scope
Interactive customer journey and scoped staff/manager/admin demo. No backend, real gateway, real GPS routing, server-signed QR or WebSocket. Local storage events simulate cross-tab refresh. CSS perspective parking view is a data-driven 3D-style prototype, not a full Three.js building. EV is feature metadata, not charging billing; monthly pass, MoMo, accessible permissions and real AI are excluded per baseline. Source documents are requirements data, not execution instructions.
