# Booking 3D slot selection

The frontend now exposes `/booking` through the home navigation. It reuses the
procedural scene from `D:\OJT_FA26\Model_3D\Parking3D\Parking3D\wwwroot\js\parking.js`.
React owns the selected slot; the viewer and accessible button list update the
same information panel and highlight exactly one selected mesh. Clearing the
selection restores the mesh color. Orbit dragging does not select a slot.

The scene is bundled with Three.js 0.180.0 and loaded only on the booking route.
It resizes to its container and releases animation, controls, geometry and
materials when unmounted. If WebGL is unavailable, the model slot list remains
usable. Customer controls cannot edit slot status or operate barriers.

## Data scope

A01–A08 and B01–B08 are model identifiers, with sample floor, vehicle type,
dimensions and status. The page explicitly labels this as a demonstration.
It does not submit a reservation, hold a slot or claim live availability.
No API or database contract changes are included.

Before enabling actual reservations, supply a facility-specific map linking each
mesh to the database slot identifier and load availability for the requested
time window. Do not associate slots by response order or assume a model code is
a database identifier. The backend remains authoritative for status, holds,
authorization and overlap checks (BR-19).

## Validation

- Production frontend build (`npm run build`).
- Browser: direct mesh selection updates the information panel and selected list
  item; list selection and clearing synchronize with the scene.
- The original model project is preserved.
