# SMART PARKING MANAGEMENT SYSTEM — BASELINE V4

**Project:** Parking OJT FA26 / SWP391  
**Document type:** Business + Functional + Technical Baseline  
**Status:** **PROPOSED BASELINE — READY FOR ERD / USE CASE / API / UI DESIGN**  
**Date:** 2026-09-27

---

## 0. Mục đích tài liệu

Tài liệu này hợp nhất và hiệu chỉnh bốn nguồn:

1. **`context.md` của mentor** — định hướng nghiệp vụ tổng quát, đa bãi đỗ, GIS/GPS, tìm kiếm bãi, thanh toán, IoT và vận hành.
2. **`SRS-Parking-System.md` của mentor** — nguồn yêu cầu chính về chức năng, actor, search, reservation, payment, dashboard, reporting, NFR và ranh giới AI.
3. **`Du_an_Parking_OJT_FA26_Hoan_chinh.md` của nhóm** — tài liệu AI-generated hữu ích cho 3D, QR, EV, camera simulator, real-time, slot allocation nhưng đang sai ở giả định chỉ có một bãi ba tầng.
4. **`Pasted markdown.md` / hệ thống SWP391 cũ** — nguồn logic đã từng triển khai trong Spring Boot: Booking, ParkingSession, PricingRule, VNPay, MonthlyPass, ParkingException, AuditLog, RBAC, Floor/Zone/Slot.

### 0.1 Nguyên tắc hợp nhất

Thứ tự ưu tiên khi có xung đột:

```text
Yêu cầu cốt lõi của mentor
        ↓
Mục tiêu thực tế của dự án hiện tại
        ↓
Nghiệp vụ đã chứng minh hữu ích từ dự án cũ
        ↓
Ý tưởng bổ sung trong tài liệu AI-generated
```

Không giữ một rule chỉ vì rule đó đã có code nếu rule làm sai phạm vi dự án mới.

Không biến các ý tưởng AI-generated thành yêu cầu bắt buộc nếu không có căn cứ từ mentor hoặc không hợp lý trong vận hành thực tế.

---

# 1. Tầm nhìn sản phẩm

Hệ thống là một **nền tảng quản lý nhiều bãi đỗ xe tại nhiều địa điểm**, cho phép:

- Người dùng tìm bãi đỗ gần vị trí hiện tại hoặc vị trí đích.
- So sánh bãi theo khoảng cách, giá dự kiến và tình trạng còn chỗ.
- Xem sơ đồ 2D/3D của từng bãi.
- Đặt chỗ trước theo khoảng thời gian.
- Chọn slot trực tiếp hoặc để hệ thống tự động phân bổ.
- Check-in/check-out bằng QR, biển số hoặc Staff.
- Thanh toán điện tử hoặc tiền mặt tùy cấu hình bãi.
- Theo dõi trạng thái bãi theo thời gian thực.
- Mỗi bãi có cấu trúc, số tầng, zone, loại slot, giờ hoạt động và biểu giá khác nhau.
- Staff/Manager chỉ quản lý các bãi được phân công.
- Admin theo dõi toàn hệ thống.

## 1.1 Điểm nổi bật bắt buộc của đồ án

### A. Multi-Parking-Lot

Không giới hạn một tòa nhà hay ba tầng.

Ví dụ:

```text
Parking Lot A
├── Basement B2
├── Basement B1
└── Ground

Parking Lot B
└── Outdoor Ground

Parking Lot C
├── Floor 1
├── Floor 2
├── EV Area
└── VIP Area
```

### B. Smart Parking Search

Tối thiểu hỗ trợ:

- `NEAREST` — bãi gần nhất.
- `CHEAPEST` — bãi có chi phí dự kiến thấp nhất.
- Filter theo loại xe, tiện ích, còn chỗ, giờ hoạt động.

### C. 3D Parking Map

Mỗi bãi có layout riêng. 3D không hard-code theo một tòa nhà ba tầng.

### D. Real-time

Thay đổi quan trọng về occupancy/booking được cập nhật đến client mà không cần refresh.

---

# 2. Phạm vi hệ thống

## 2.1 In Scope — Core

1. Authentication và RBAC.
2. Quản lý Customer và Vehicle.
3. Quản lý nhiều Parking Lot.
4. Quản lý cấu trúc Level/Floor → Zone → ParkingSlot.
5. Tìm kiếm bãi theo GPS/địa chỉ.
6. Thuật toán tìm bãi gần nhất.
7. Thuật toán tìm bãi rẻ nhất.
8. Hiển thị availability và giá dự kiến.
9. 2D/3D parking map.
10. Booking/Reservation theo khoảng thời gian.
11. Exact Slot hoặc Auto Allocation.
12. QR check-in.
13. Staff-assisted check-in/check-out.
14. Parking Session.
15. Pricing riêng theo từng bãi.
16. VNPay sandbox/simulation và Cash.
17. WebSocket real-time.
18. Staff/Manager scope theo Parking Lot.
19. Dashboard và reporting cơ bản.
20. Audit Log.
21. Camera/IoT event simulation ở mức demo.

## 2.2 Extended Scope

Các chức năng tốt nhưng không nên làm chặn Core:

- EV charging.
- Accessible parking.
- Priority/emergency slot.
- Monthly/30-day subscription.
- Violation/Parking Exception nâng cao.
- Review.
- Email/SMS thật.
- Refund workflow đầy đủ.
- Navigation graph trong nội bộ bãi.
- Camera ANPR thật.

## 2.3 Out of Scope cho OJT baseline

- Microservices production-grade.
- Kafka/RabbitMQ bắt buộc.
- Kubernetes production.
- IoT sensor vật lý.
- AI model training.
- AI dynamic pricing.
- AI chatbot production.
- Kết nối thật với CSGT.
- MoMo/Stripe nếu nhóm đã chọn VNPay.
- Hệ thống autonomous parking.
- Full offline mode.
- National digital map integration.

---

# 3. Actor và phân quyền

## 3.1 Business Actors

| Actor | Vai trò |
|---|---|
| `GUEST` | Tìm bãi, xem giá/chỗ trống, có thể tạo reservation một lần nếu business cho phép |
| `CUSTOMER` | Quản lý xe, booking, QR, payment, history |
| `PARKING_STAFF` | Vận hành tại các bãi được gán |
| `PARKING_MANAGER` | Quản lý giá, slot, booking, staff và báo cáo trong phạm vi bãi được gán |
| `ADMIN` | Quản lý toàn nền tảng |
| `PAYMENT_GATEWAY` | Hệ thống ngoài xử lý giao dịch |
| `MAP_SERVICE` | Hệ thống ngoài cung cấp geocoding/routing nếu tích hợp |
| `CAMERA_IOT_SIMULATOR` | Actor hệ thống gửi event mô phỏng |

`CAMERA_IOT_SIMULATOR`, `PAYMENT_GATEWAY`, `MAP_SERVICE` là **external/system actor**, không phải user role đăng nhập thông thường.

## 3.2 Facility-scoped RBAC

Bổ sung quan hệ:

```text
User
  │
  └── FacilityStaffAssignment
          ├── parkingLotId
          ├── role
          ├── activeFrom
          └── activeTo
```

Rule:

```text
PARKING_MANAGER của Lot A
≠
quyền quản lý Lot B
```

Admin có thể xem toàn hệ thống.

---

# 4. Mô hình Parking Lot đa cấu trúc

## 4.1 ParkingLot

Thông tin tối thiểu:

```text
ParkingLot
├── id
├── code
├── name
├── description
├── address
├── latitude
├── longitude
├── searchRadiusMeters
├── timezone
├── status
│   ├── ACTIVE
│   ├── TEMPORARILY_CLOSED
│   └── INACTIVE
├── openTime / closeTime hoặc OperatingHours
├── vehicleTypesSupported
├── totalCapacity (derived hoặc cached)
├── mapThumbnail
└── version
```

`totalCapacity` không phải nguồn sự thật độc lập nếu có thể tính từ slot; nếu cache thì phải đồng bộ.

## 4.2 ParkingLevel

Thay vì giả định bãi nào cũng có Floor:

```text
ParkingLot
    └── ParkingLevel
            └── Zone
                    └── ParkingSlot
```

`ParkingLevel` hỗ trợ:

```text
BASEMENT
GROUND
FLOOR
OUTDOOR
ROOFTOP
OTHER
```

Bãi ngoài trời có thể có một level logic `GROUND/OUTDOOR`, nhưng UI không cần hiển thị khái niệm “tầng” nếu không phù hợp.

Cách này giữ được phần lớn thiết kế `Floor → Zone → Slot` của dự án cũ mà vẫn hỗ trợ nhiều loại bãi.

## 4.3 Zone

```text
Zone
├── id
├── parkingLotId
├── levelId
├── code
├── name
├── vehicleType
├── status
└── allocationPriority
```

Zone có thể dùng để:

- Phân loại xe.
- Chia khu vực vật lý.
- Áp biểu giá.
- Tối ưu slot allocation.
- Quản lý khu EV/Accessible nếu cần.

## 4.4 ParkingSlot

```text
ParkingSlot
├── id
├── zoneId
├── code
├── supportedVehicleTypes
├── operationalStatus
├── width / length (optional)
├── mapObjectId
├── version
└── active
```

### Operational Status

```text
ACTIVE
MAINTENANCE
DISABLED
```

Không dùng một cột `RESERVED` như trạng thái vật lý dài hạn.

### Occupancy

Occupancy tại thời điểm hiện tại được xác định bởi active ParkingSession hoặc event sensor/camera:

```text
EMPTY
OCCUPIED
UNKNOWN
```

### Display State trên 2D/3D

Frontend có thể hiển thị:

```text
AVAILABLE
RESERVED
OCCUPIED
MAINTENANCE
DISABLED
```

nhưng đây là **trạng thái tổng hợp**:

```text
DisplayState =
operationalStatus
+ current occupancy
+ reservation tại thời điểm đang xét
```

Điều này tránh lỗi: slot được đặt lúc 18:00 nhưng bị khóa từ 10:00.

---

# 5. Slot Feature

Không nên chỉ có một `slotType` duy nhất nếu một slot có nhiều đặc tính.

Thiết kế:

```text
SlotFeature
├── EV_CHARGING
├── ACCESSIBLE
├── PRIORITY
├── COVERED
├── NEAR_ELEVATOR
└── OVERSIZED
```

Quan hệ:

```text
ParkingSlot N ─── M SlotFeature
```

Hoặc dùng bảng mapping / enum collection tùy JPA design.

Rule:

- EV vehicle có thể ưu tiên EV slot.
- Xe không sạc không nên chiếm EV slot khi chính sách bãi không cho phép.
- Accessible phải được hệ thống kiểm tra permission nếu nhóm triển khai tính năng này.
- Priority không được dùng như quyền tùy ý của Customer.

---

# 6. Vehicle

```text
Vehicle
├── id
├── ownerUserId (nullable cho guest)
├── licensePlate
├── vehicleType
│   ├── MOTORBIKE
│   ├── CAR
│   └── optional OTHER
├── fuelType
│   ├── GASOLINE
│   ├── ELECTRIC
│   ├── HYBRID
│   └── UNKNOWN
├── active
├── primary
└── metadata
```

Có thể tái sử dụng:

- Validate format biển số.
- Fuzzy matching biển số cho camera simulator.
- `isPrimary`.
- Giới hạn số xe/tài khoản dưới dạng **SystemConfig**, không hard-code.

Không giữ mặc định “tối đa 4 xe” như yêu cầu chung nếu mentor không yêu cầu. Có thể cấu hình default = 4 để tái sử dụng code.

---

# 7. Parking Search & Recommendation

## 7.1 Input

```text
origin:
  latitude
  longitude

vehicleType
startTime
expectedDuration
filters:
  EV_CHARGING?
  ACCESSIBLE?
  covered?
radiusKm
sortBy:
  NEAREST
  CHEAPEST
```

Nếu người dùng từ chối GPS:

- Cho nhập địa chỉ thủ công.
- Geocode địa chỉ nếu có Map Service.
- Hoặc cho chọn vị trí giả lập trong demo.

## 7.2 Candidate Filtering

Chỉ xét ParkingLot:

```text
status == ACTIVE
AND hỗ trợ vehicleType
AND đang mở / có thể phục vụ trong time window
AND nằm trong search radius
AND có capacity phù hợp
```

## 7.3 Thuật toán NEAREST

### Baseline theo mentor: Haversine

```text
dLat = lat2 - lat1
dLon = lon2 - lon1

a =
sin²(dLat/2)
+ cos(lat1) * cos(lat2) * sin²(dLon/2)

c = 2 * atan2(sqrt(a), sqrt(1-a))

distance = EarthRadius * c
```

Flow:

```text
User Location
   ↓
Filter Parking Lots within radius
   ↓
Calculate Haversine distance
   ↓
Sort ASC distance
```

Haversine là khoảng cách đường chim bay, không phải quãng đường chạy xe.

### Enhancement

Nếu dùng Google Maps/Mapbox/OSRM:

- Haversine để pre-filter.
- Routing API để lấy:
  - drivingDistance
  - estimatedTravelTime

Không bắt buộc trong MVP.

## 7.4 Thuật toán CHEAPEST

Không được chỉ so `ratePerHour`.

Vì mỗi bãi có thể:

- giá theo 15 phút,
- giá theo giờ,
- giá theo lượt,
- giá ngày/đêm,
- peak multiplier,
- daily cap,
- zone surcharge.

Do đó cần:

```text
EstimatedPriceService
```

Input:

```text
parkingLotId
vehicleType
expectedEntry
expectedExit
requiredFeatures
```

Output:

```text
estimatedBaseFee
estimatedSurcharge
estimatedTotal
pricingExplanation
```

Algorithm:

```text
Candidate Parking Lots
      ↓
Resolve active PricingPlan of each lot
      ↓
Estimate fee for requested time window
      ↓
Sort ASC estimatedTotal
```

Nếu người dùng chưa nhập thời lượng:

- Không tuyên bố một bãi là “rẻ nhất cho toàn bộ lượt gửi”.
- Có thể hiển thị “giá khởi điểm” hoặc yêu cầu chọn thời gian dự kiến.

## 7.5 Search Result

```text
ParkingLot name
Address
Distance
Estimated travel time (nếu có)
Available slots
Vehicle compatibility
Estimated price
Operating status
Features
```

---

# 8. 3D Parking Map

## 8.1 Mục tiêu

3D là presentation layer.

**Database là source of truth.**

Không để object Three.js tự quyết định trạng thái nghiệp vụ.

## 8.2 Data-driven Layout

```text
ParkingLot
  └── MapVersion
       └── MapObject
```

### MapVersion

```text
id
parkingLotId
version
status: DRAFT / PUBLISHED / ARCHIVED
createdAt
publishedAt
```

### MapObject

```text
id
mapVersionId
levelId
objectType
refEntityId
positionX
positionY
positionZ
rotationX
rotationY
rotationZ
scaleX
scaleY
scaleZ
metadataJson
```

`objectType`:

```text
PARKING_SLOT
ROAD
WALL
ENTRANCE
EXIT
RAMP
ELEVATOR
STAIR
CHARGER
LABEL
OTHER
```

Một object `PARKING_SLOT` map 1-1 với `ParkingSlot`.

## 8.3 3D Interaction

- Rotate.
- Pan.
- Zoom.
- Chuyển level.
- Hover.
- Click slot.
- Filter.
- Search slot code.
- Exact Slot booking.
- Auto Select.
- Hiển thị legend.

## 8.4 Performance

Không render tất cả bãi cùng lúc.

Flow:

```text
Search page
→ chọn ParkingLot
→ load Published MapVersion của lot
→ load level đang xem
→ subscribe real-time event của lot đó
```

Có thể:

- InstancedMesh cho nhiều slot.
- Lazy load per level.
- Không reload full model khi một slot đổi trạng thái.

---

# 9. Booking / Reservation

## 9.1 Booking Mode

```text
EXACT_SLOT
AUTO_SLOT
LOT_ONLY
```

### EXACT_SLOT

Customer chọn slot cụ thể.

### AUTO_SLOT

Hệ thống chọn slot ngay khi booking hoặc gần thời điểm check-in.

### LOT_ONLY

Đặt capacity tại ParkingLot nhưng chưa cố định slot; slot được assign sau.

MVP có thể chỉ hỗ trợ `EXACT_SLOT` + `AUTO_SLOT`.

## 9.2 Booking Entity

```text
Booking
├── id
├── bookingCode
├── userId nullable
├── guestContact nullable
├── vehicleId
├── parkingLotId
├── slotId nullable
├── bookingMode
├── startTime
├── endTime
├── status
├── paymentStatus
├── holdExpiresAt
├── pricingSnapshotId
├── createdAt
└── version
```

## 9.3 Booking Status

```text
PENDING_PAYMENT
CONFIRMED
CHECKED_IN
COMPLETED
CANCELLED
EXPIRED
NO_SHOW
```

Semantics:

- `PENDING_PAYMENT`: tài nguyên đang được hold chờ thanh toán nếu booking yêu cầu trả trước.
- `CONFIRMED`: reservation hợp lệ.
- `CHECKED_IN`: xe đã vào bãi.
- `COMPLETED`: session kết thúc và nghĩa vụ thanh toán đã xử lý.
- `CANCELLED`: chủ động hủy.
- `EXPIRED`: hold chưa trở thành confirmed.
- `NO_SHOW`: booking đã confirmed nhưng khách không đến trong arrival window.

Không dùng `EXPIRED` và `NO_SHOW` thay nhau.

## 9.4 Rule chống trùng

Không dùng:

```text
1 Vehicle = chỉ 1 active booking toàn thời gian
```

Rule đúng hơn:

```text
Một Vehicle không được có booking CONFIRMED/PENDING
có time window chồng lấn bất hợp lệ.
```

Tương tự với exact slot:

```text
Một ParkingSlot không được có hai booking
có reservation window chồng lấn.
```

## 9.5 Concurrency

Tối thiểu:

- Transaction.
- `@Version` optimistic locking hoặc row locking ở critical path.
- Re-check availability trong transaction trước khi confirm.
- Unique/exclusion strategy ở DB nếu triển khai được.

Frontend “slot đang xanh” không phải bằng chứng slot vẫn còn trống.

---

# 10. Reservation Hold & Cancellation

Baseline theo SRS mentor:

```text
Hold pending payment: 15 phút
Minimum reservation: 30 phút
Maximum reservation: 24 giờ
```

Cancellation baseline:

```text
> 1 giờ trước startTime
→ eligible full refund

≤ 1 giờ
→ no refund
```

Các rule này nên đưa vào `SystemConfig/ParkingPolicy`, không hard-code service.

Ý tưởng trong tài liệu nhóm:

```text
5 phút free
+ 5.000/10 phút
max 30 phút
```

được chuyển thành **Optional Paid Hold Extension**, không phải baseline bắt buộc vì mâu thuẫn SRS mentor.

---

# 11. Availability & Capacity

## 11.1 Current Occupancy

```text
occupied =
count(active ParkingSession)
```

## 11.2 Available Now

```text
availableNow =
operationallyActiveSlots
- occupied
- hardReservationsWithinProtectionWindow
```

## 11.3 Future Availability

Booking tương lai phải kiểm tra overlap theo thời gian.

Không dùng một `slot.status=RESERVED` để khóa slot từ lúc tạo booking đến tận lúc xe đến.

## 11.4 Capacity Threshold

Không hard-code:

```text
> 90% => block all new vehicles
```

Thiết kế:

```text
warningOccupancyPercent
admissionStopPercent
reservedCapacity
```

theo `ParkingLot` hoặc `vehicleType`.

Ví dụ:

```text
warning = 90%
stop = 100%
emergencyReserve = 2 slots
```

Nếu nghiệp vụ yêu cầu reserve capacity, Manager cấu hình rõ lý do.

Logic “Buffer Capacity Check 6 giờ” từ hệ thống cũ có thể tái sử dụng ý tưởng, nhưng phải đổi thành dự báo theo **time window thực tế**, không cố định 6 giờ cho mọi bãi.

---

# 12. Auto Slot Allocation

## 12.1 Hard Constraints

Loại trước các slot:

```text
operationalStatus != ACTIVE
occupied
conflict reservation
vehicle incompatible
required feature missing
```

## 12.2 Candidate Score

MVP rule-based:

```text
score =
w1 * distanceScore
+ w2 * zonePreference
+ w3 * featurePreference
+ w4 * priceScore
```

Hoặc deterministic ordering:

```text
1. Compatibility
2. Required Features
3. Same/preferred Zone
4. Distance to target
5. Price
6. Slot code as tie-breaker
```

## 12.3 Distance trong nội bộ bãi

`distanceToExit` có thể dùng cho demo đơn giản.

Nếu bãi có nhiều entrance/exit/ramp:

```text
NavigationNode
NavigationEdge
```

và dùng Dijkstra/A*.

Đây là enhancement tốt để thể hiện “algorithm” thứ hai ngoài Haversine.

---

# 13. Check-in

Hỗ trợ:

1. QR.
2. Camera plate event.
3. Staff manual verification.

Flow:

```text
Arrival
→ Resolve ParkingLot
→ Identify Vehicle/Booking
→ Validate reservation/arrival window
→ Validate slot/capacity
→ Assign/reassign slot if needed
→ Create ParkingSession
→ Mark Booking CHECKED_IN
→ Publish real-time event
→ Open barrier simulator
```

Nếu plate không khớp:

```text
Do not auto-open
→ notify Staff
→ manual verification
```

---

# 14. QR Security

Không nhất thiết tạo bảng QRCode chứa raw secret.

Khuyến nghị:

```text
QR payload:
bookingId
nonce
expiresAt
signature
```

Ký HMAC hoặc token server-signed.

Backend verify:

- signature.
- expiry.
- booking state.
- one-time use.
- parkingLot.
- vehicle/guest context nếu áp dụng.

`QRToken` chỉ lưu hash/nonce/status nếu cần revoke và chống reuse.

---

# 15. Parking Session

Giữ thiết kế tốt từ dự án cũ: Booking và ParkingSession là hai entity khác nhau.

```text
ParkingSession
├── id
├── parkingLotId
├── bookingId nullable
├── vehicleId
├── slotId
├── entryTime
├── exitTime
├── status
├── pricingSnapshotId
├── finalFee
└── version
```

Status:

```text
ACTIVE
COMPLETED
CANCELLED_BY_STAFF (optional)
```

Không “giải phóng slot khi payment thành công” nếu xe vật lý vẫn còn trong slot.

Slot chỉ trở về empty khi:

- exit event hợp lệ; hoặc
- Staff xác nhận xe đã rời.

---

# 16. Check-out

```text
Identify active session
→ Record exit candidate
→ Calculate final fee
→ Apply penalties/surcharges if any
→ Check payment obligation
→ Process payment
→ Confirm physical exit
→ Complete session
→ Publish slot availability
→ Open barrier
```

Nếu unpaid:

- Barrier simulator đóng.
- Cho user payment retry hoặc Staff xử lý theo policy.

---

# 17. Pricing Architecture

## 17.1 Nguyên tắc

**Mỗi Parking Lot có pricing riêng.**

Không dùng một công thức toàn hệ thống.

## 17.2 PricingPlan

```text
PricingPlan
├── id
├── parkingLotId
├── name
├── version
├── effectiveFrom
├── effectiveTo
├── status
└── currency
```

## 17.3 PricingRule

Có thể hỗ trợ:

```text
HOURLY
PER_MINUTE
BILLING_UNIT
FLAT_RATE
TIERED
DAY_NIGHT
OVERNIGHT
DAILY_CAP
PEAK_MULTIPLIER
ZONE_SURCHARGE
EV_CHARGING
```

Fields tiêu biểu:

```text
vehicleType
zoneId nullable
dayOfWeek nullable
timeStart
timeEnd
billingUnitMinutes
baseAmount
rate
minimumFee
maximumDailyFee
multiplier
priority
```

## 17.4 Mentor-compatible default

SRS mentor dùng:

- parking fee theo thời gian;
- round up theo 15 phút;
- overnight fee;
- dynamic pricing với cap 150%.

Do đó default engine:

```text
billingUnitMinutes = 15
```

nhưng để cấu hình được theo Parking Lot.

Rule-based peak multiplier có thể triển khai mà không cần AI.

## 17.5 Pricing Snapshot

Khi booking được confirm hoặc session bắt đầu, lưu snapshot:

```text
PricingSnapshot
├── parkingLotId
├── pricingPlanVersion
├── resolvedRules
├── currency
└── createdAt
```

Mục đích:

Manager đổi giá giữa lúc xe đang đỗ không làm thay đổi hồi tố giá đã cam kết nếu policy không cho phép.

## 17.6 Reuse từ hệ thống cũ

Có thể tái sử dụng:

- zone-specific rule ưu tiên hơn global rule;
- minimum fee;
- daily cap;
- peak multiplier;
- penalty integration;
- VNPay flow.

Cần sửa:

- rule phải scope theo `parkingLotId`;
- billing unit không cố định ceiling 1 giờ;
- peak phải tính theo phần thời gian thuộc peak window nếu biểu giá yêu cầu, không nhân toàn session chỉ vì có giao nhau.

---

# 18. Cheapest Parking Calculation

Ví dụ:

```text
Expected parking:
18:00 → 21:30
Vehicle: CAR
```

Lot A:

```text
15.000 / giờ
```

Lot B:

```text
10.000 / 30 phút đầu
5.000 / 30 phút tiếp theo
daily cap 50.000
```

Lot C:

```text
flat 40.000 / lượt
```

`EstimatedPriceService` phải chạy pricing engine riêng từng lot.

Output:

```json
{
  "parkingLotId": 12,
  "estimatedTotal": 40000,
  "currency": "VND",
  "assumptions": [
    "Expected duration 210 minutes",
    "No EV charging",
    "No penalty"
  ]
}
```

`CHEAPEST` = sort theo `estimatedTotal ASC`.

---

# 19. Payment

## 19.1 Entity

```text
Payment
├── id
├── parkingLotId
├── bookingId nullable
├── sessionId nullable
├── userId nullable
├── amount
├── currency
├── type
├── method
├── status
├── idempotencyKey
├── createdAt
└── paidAt
```

`PaymentTransaction`:

```text
provider
providerTransactionId
requestRef
responseCode
rawReference / sanitized payload
status
createdAt
```

## 19.2 Method

MVP:

```text
VNPAY
CASH
```

## 19.3 Status

```text
PENDING
SUCCESS
FAILED
REFUNDED
PARTIALLY_REFUNDED
```

## 19.4 Payment Safety

- Webhook/callback idempotent.
- Không mark SUCCESS chỉ dựa vào browser redirect.
- Không log secret/signature/payment credential.
- Cash phải có Staff actor xác nhận.
- Audit financial state transitions.

---

# 20. Guest Flow

Guest có thể:

- Search Parking Lot.
- Xem availability.
- Xem pricing.
- Tạo one-time booking nếu policy lot cho phép.
- Nhập contact + vehicle info.
- Nhận QR trên web/email/SMS mock.

Không dùng:

```text
CUSTOMER > GUEST
```

như quy tắc mặc định để tranh slot.

Một booking đã confirmed là cam kết tài nguyên dù là Guest hay Customer.

Nếu cần ưu tiên subscription/VIP/emergency thì policy phải được định nghĩa rõ.

---

# 21. Monthly / 30-Day Pass

SRS mentor ghi Monthly Pass ngoài scope current release, nhưng dự án cũ có module MonthlyPass khá hoàn chỉnh.

Do đó:

**Status: EXTENDED / OPTIONAL PHASE**

Thiết kế multi-lot:

```text
SubscriptionPlan
├── id
├── name
├── validityDays
├── price
└── accessScope

MonthlyPass
├── userId
├── vehicleId
├── planId
├── startAt
├── endAt
└── status

PassFacilityAccess
├── passId
└── parkingLotId
```

Không tính giới hạn 70% trên tổng slot toàn platform.

Nếu cần quota:

```text
per ParkingLot
per VehicleType
per SubscriptionPlan
```

---

# 22. EV Charging

**Extended Scope**

Phân biệt:

```text
Parking slot có EV charger
≠
xe đang sử dụng charging service
```

Nếu không có hardware thật, demo:

```text
ChargingSession
├── parkingSessionId
├── startedAt
├── endedAt
├── pricingMode
├── simulatedKwh nullable
└── chargingFee
```

Không tự cộng charging fee chỉ vì xe đỗ ở EV slot.

---

# 23. Accessible & Priority

**Extended Scope**

Accessible:

- Có permission/approval.
- Staff manual approval được phép trong demo.
- Audit mọi thay đổi permission.

Priority/emergency:

- Không tự động tin claim của user.
- Có trạng thái verification.
- Không dùng để phá booking đã confirmed.
- Emergency override nếu có phải do Staff/Manager thực hiện và audit.

---

# 24. Camera / IoT Simulator

## 24.1 Event Types

Không dùng một JSON `vehicle + detectedSlot` cho tất cả ngữ cảnh.

```text
ENTRY_DETECTED
EXIT_DETECTED
SLOT_OCCUPANCY_DETECTED
PLATE_RECOGNIZED
BARRIER_EVENT
```

Event:

```json
{
  "eventId": "evt-001",
  "parkingLotId": 10,
  "cameraId": "CAM-ENTRY-01",
  "eventType": "ENTRY_DETECTED",
  "timestamp": "2026-09-27T10:00:00+07:00",
  "licensePlate": "59A1-12345",
  "confidence": 0.96
}
```

Slot detection:

```json
{
  "eventId": "evt-002",
  "parkingLotId": 10,
  "cameraId": "CAM-F2-03",
  "eventType": "SLOT_OCCUPANCY_DETECTED",
  "slotCode": "F02-A010",
  "licensePlate": "59A1-12345",
  "confidence": 0.91
}
```

## 24.2 Reliability Rule

Simulator/camera event:

- không được ghi đè booking confirmed một cách mù quáng;
- conflict → tạo Operational Alert;
- Staff verify nếu confidence thấp hoặc dữ liệu mâu thuẫn.

---

# 25. Parking Exception / Violation

Tái sử dụng ý tưởng tốt từ dự án cũ nhưng phân loại rõ.

```text
ParkingIssue
├── LOST_TICKET
├── WRONG_ZONE
├── WRONG_SLOT
├── UNPAID_EXIT
├── OVERSTAY
├── SLOT_CONFLICT
└── OTHER
```

Workflow:

```text
REPORTED
→ UNDER_REVIEW
→ CONFIRMED / REJECTED
→ RESOLVED
```

Fine không hard-code 100.000 cho mọi vi phạm.

Dùng:

```text
PenaltyRule
├── parkingLotId
├── vehicleType
├── issueType
├── amount
└── effectivePeriod
```

Camera chỉ **report suspicion**, không tự đưa ra quyết định phạt cuối cùng.

---

# 26. Notification

Channels:

```text
WEB
EMAIL
SMS
PUSH (future)
```

Events:

- booking confirmed;
- booking expiring;
- booking cancelled;
- slot reassigned;
- check-in;
- check-out;
- payment success/failure;
- refund;
- issue/violation;
- lot closed;
- subscription expiry nếu module được bật.

OJT có thể implement Web notification + mock Email/SMS.

---

# 27. Review

**Optional**

```text
Review
├── id
├── parkingLotId
├── parkingSessionId
├── userId nullable
├── rating 1..5
├── comment
└── createdAt
```

Rule:

- Chỉ session completed mới review.
- Một session tối đa một review.
- Rating thuộc ParkingLot tương ứng.

---

# 28. Audit Log

Audit tối thiểu:

```text
actorId
actorType
parkingLotId
action
entityType
entityId
oldValue
newValue
reason
requestId
timestamp
```

Bắt buộc audit:

- Role/permission.
- Staff assignment.
- Lot activation/deactivation.
- Slot maintenance.
- Pricing changes.
- Manual check-in/out.
- Cash payment confirmation.
- Refund.
- Exception resolution.
- Manual camera override.

Không xóa audit log theo scheduler ngắn hạn như dữ liệu rác.

---

# 29. Dashboard & Reporting

## 29.1 Parking Manager

Trong các bãi được gán:

- occupancy current.
- available/occupied/maintenance.
- booking today.
- arrivals/no-show.
- revenue.
- payment method.
- average duration.
- peak period.
- incident.
- EV usage nếu bật.

## 29.2 Admin

Cross-lot:

- total lots.
- lot status.
- occupancy by lot.
- revenue by lot.
- usage by lot.
- top demand periods.
- active users.
- payment failures.
- operational alerts.

---

# 30. 3D + Real-time Event Model

Topic gợi ý:

```text
/ws/parking-lots/{parkingLotId}/slots
/ws/parking-lots/{parkingLotId}/bookings
/ws/users/{userId}/notifications
```

Payload slot:

```json
{
  "parkingLotId": 1,
  "slotId": 102,
  "displayState": "OCCUPIED",
  "eventVersion": 18,
  "updatedAt": "2026-09-27T10:10:00+07:00"
}
```

Client:

- bỏ event cũ nếu version thấp hơn state hiện tại;
- fetch REST snapshot lại nếu mất đồng bộ.

WebSocket không phải source of truth.

---

# 31. API Modules

Giữ versioning:

```text
/api/v1
```

## Public/Search

```text
GET /parking-lots/search
GET /parking-lots/{id}
GET /parking-lots/{id}/availability
GET /parking-lots/{id}/pricing/estimate
GET /parking-lots/{id}/map
```

## Auth/User

```text
/api/v1/auth
/api/v1/users
/api/v1/vehicles
```

## Parking Structure

```text
/api/v1/parking-lots
/api/v1/parking-lots/{id}/levels
/api/v1/zones
/api/v1/slots
/api/v1/map-versions
```

## Booking/Session

```text
/api/v1/bookings
/api/v1/bookings/{id}/cancel
/api/v1/bookings/{id}/qr
/api/v1/sessions
/api/v1/check-in
/api/v1/check-out
```

## Payment

```text
/api/v1/payments
/api/v1/payment/vnpay
```

## Operations

```text
/api/v1/issues
/api/v1/camera-events
/api/v1/notifications
/api/v1/audit-logs
```

## Reporting

```text
/api/v1/dashboard
/api/v1/reports
```

## Optional

```text
/api/v1/subscriptions
/api/v1/reviews
/api/v1/charging-sessions
```

---

# 32. Data Model — ERD Baseline

```text
User
 ├──< Vehicle
 ├──< Booking
 └──< FacilityStaffAssignment >── ParkingLot

ParkingLot
 ├──< ParkingLevel
 │      └──< Zone
 │             └──< ParkingSlot >──< SlotFeature
 │
 ├──< EntranceExit
 ├──< PricingPlan
 │      └──< PricingRule
 │
 ├──< MapVersion
 │      └──< MapObject
 │
 └──< OperatingHours

Vehicle
 ├──< Booking
 ├──< ParkingSession
 └──< ParkingIssue

Booking
 ├── 0..1 ParkingSlot
 ├── 0..1 QRToken
 ├── 0..1 ParkingSession
 └──< Payment

ParkingSession
 ├── ParkingSlot
 ├── PricingSnapshot
 ├──< Payment
 ├──< ParkingIssue
 └── 0..1 Review

Payment
 └──< PaymentTransaction

Optional:
SubscriptionPlan
 └──< MonthlyPass
        └──< PassFacilityAccess
```

---

# 33. Architecture

## 33.1 Logical Architecture

Giữ ranh giới module giống tinh thần SRS:

```text
Auth
User
Parking
Search
Booking
Pricing
Payment
Notification
Operation/IoT
Reporting
```

## 33.2 Physical Architecture cho OJT

Không cần triển khai microservices thật.

```text
React / TypeScript
       │
 REST + WebSocket
       │
Spring Boot Modular Monolith
       │
PostgreSQL
       │
External/Simulated:
Map Service
VNPay
Camera/IoT Simulator
```

Lợi ích:

- đúng giới hạn nguồn lực nhóm;
- dễ transaction Booking/Slot/Payment;
- vẫn chia module rõ để có thể tách service sau này.

## 33.3 Reuse dự án cũ

Có thể tái sử dụng:

- Spring Security + JWT.
- User/Role/Privileges.
- Vehicle.
- Floor/Zone/Slot service.
- Booking.
- ParkingSession.
- PricingRule engine một phần.
- VNPay integration.
- Notification.
- Audit.
- ParkingException.

Refactor bắt buộc:

```text
Add ParkingLot
Add FacilityStaffAssignment
Scope query by parkingLotId
Generalize pricing
Fix time-window booking semantics
Add search/GIS
Add per-lot map configuration
Add real-time
```

---

# 34. Security

## Core

- Password hash bằng BCrypt/Argon2; không plaintext.
- Không log password, token, VNPay secret.
- JWT expiry + refresh policy rõ ràng.
- Backend authorization; frontend không phải security boundary.
- Facility-scoped authorization.
- QR signed + expiration + one-time use.
- Rate limiting cho auth/payment/camera endpoints.
- VNPay callback signature validation.
- Idempotency.
- Input validation.
- Audit administrative actions.
- HTTPS trong deployment thực tế.

## Personal Data

Thu thập tối thiểu dữ liệu cần thiết.

Nếu thu:

- vị trí người dùng;
- biển số;
- phone/email;
- ảnh camera;
- CCCD/GPLX;

phải khai báo mục đích xử lý, thời gian lưu và quyền truy cập phù hợp.

Trong OJT, **không cần thu CCCD/GPLX nếu không cần cho use case demo**. Nếu mentor yêu cầu identity verification, có thể implement trạng thái/manual verification hoặc mock thay vì tích hợp government system.

---

# 35. Legal / Compliance Notes

Đây là tài liệu kỹ thuật, không phải tư vấn pháp lý.

Tối thiểu cần lưu ý:

- Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân.
- Pháp luật giao thông và đăng ký xe hiện hành tại thời điểm triển khai.
- Chính sách của payment provider.
- Consent/privacy notice nếu xử lý location hoặc camera image.

Không nên ghi cứng “liên kết CSGT” như chức năng của MVP nếu không có integration thật.

Không tuyên bố một format validator nội bộ là “xác thực pháp lý biển số”.

---

# 36. NFR

## 36.1 Source-of-truth

PostgreSQL là source of truth cho transactional state.

WebSocket/cache/camera chỉ cung cấp event hoặc projection.

## 36.2 Performance — OJT Acceptance

Tách khỏi production target của SRS.

Mục tiêu demo hợp lý:

| Metric | OJT target |
|---|---:|
| Common API p95 | < 1 s |
| Parking search p95 | < 2 s, chưa tính external map latency |
| Booking transaction | < 2 s |
| Slot event propagation | < 1 s |
| Concurrent demo users | 100 |
| 3D initial level load | < 3 s trên máy demo |
| Double booking | 0 trong concurrency test |

Production-scale numbers của mentor có thể giữ ở mục **Future Production Target**, không dùng làm acceptance criterion nếu nhóm không có hạ tầng load-test tương ứng.

## 36.3 Reliability

- booking transaction atomic;
- webhook idempotent;
- versioning/optimistic lock;
- manual fallback khi camera unavailable;
- no financial state based only on client callback;
- recovery path khi WebSocket disconnect.

## 36.4 Maintainability

- module separation;
- service business rules;
- central config;
- no pricing logic in UI;
- OpenAPI documentation;
- migration bằng Flyway;
- automated tests cho pricing/booking/search.

---

# 37. Algorithms cần trình bày với mentor

## Algorithm 1 — Nearest Parking Lot

```text
Haversine
```

Complexity:

```text
O(N)
```

với N candidate lots trong radius/index result.

Có thể tối ưu bằng spatial index/PostGIS sau này.

## Algorithm 2 — Cheapest Parking Lot

```text
For each candidate:
    estimate = PricingEngine(lot, vehicle, start, end)
Sort by estimate
```

Complexity:

```text
O(N * P + N log N)
```

P = số pricing rule cần evaluate.

## Algorithm 3 — Auto Slot Allocation

```text
filter compatible slots
remove conflicts
rank candidates
select best
```

## Optional Algorithm 4 — Internal Navigation

Dijkstra/A* trên navigation graph của từng ParkingLot.

---

# 38. Business Rules — Final Baseline

| ID | Rule |
|---|---|
| BR-01 | Staff/Manager chỉ thao tác trên ParkingLot được gán |
| BR-02 | ParkingLot phải ACTIVE để nhận booking mới |
| BR-03 | Booking phải có vehicle type tương thích lot |
| BR-04 | Exact slot phải tương thích vehicle/features |
| BR-05 | Không cho booking time-window overlap trên cùng exact slot |
| BR-06 | Không cho một vehicle có các active booking chồng thời gian |
| BR-07 | Booking confirmation phải re-check availability trong transaction |
| BR-08 | Pending-payment hold mặc định 15 phút, configurable |
| BR-09 | Reservation duration mặc định 30 phút–24 giờ theo mentor, configurable |
| BR-10 | Confirmed booking không bị user khác ghi đè |
| BR-11 | Check-in chỉ khi booking/lot/vehicle hợp lệ hoặc Staff override có audit |
| BR-12 | ParkingSession chỉ có một ACTIVE session cho một vehicle tại cùng thời điểm |
| BR-13 | Slot OCCUPIED khi có active physical session/event được xác nhận |
| BR-14 | Payment callback phải idempotent |
| BR-15 | Barrier exit chỉ mở khi exit policy được đáp ứng |
| BR-16 | Pricing phải resolve theo ParkingLot và effective time |
| BR-17 | Giá hiển thị “cheapest” phải là estimated price theo requested duration |
| BR-18 | Haversine dùng cho nearest baseline; không gọi đó là driving distance |
| BR-19 | 3D state không tự quyết định business state |
| BR-20 | Camera/AI simulator không tự đưa ra quyết định phạt tài chính |
| BR-21 | Pricing/slot manual change phải audit |
| BR-22 | Closed/Maintenance slot không nhận booking mới |
| BR-23 | Existing confirmed booking gặp slot failure phải được reallocate hoặc Staff xử lý, không silent cancel |
| BR-24 | Cash payment cần Staff confirmation |
| BR-25 | Guest confirmed booking có cùng tính toàn vẹn tài nguyên như customer booking |

---

# 39. Các rule từ V2/V3 không nên giữ làm baseline

## 39.1 “Chỉ có 01 bãi 3 tầng”

**BỎ.**

Thay bằng multi-lot configurable structure.

## 39.2 “Không còn tìm bãi tối ưu”

**BỎ.**

Nearest/Cheapest là core.

## 39.3 “Capacity >90% thì khóa”

**BỎ dạng hard-code.**

Chuyển thành configurable warning/admission policy.

## 39.4 “CUSTOMER > GUEST”

**BỎ làm global rule.**

Không ghi đè confirmed resource.

## 39.5 “1 vehicle chỉ có 1 active booking”

**SỬA.**

Cấm overlapping booking, không cấm booking tương lai không chồng nhau.

## 39.6 “RESERVED là status vật lý duy nhất của slot”

**SỬA.**

Reservation là time-dependent.

## 39.7 “Giải phóng slot ngay khi thanh toán”

**SỬA.**

Giải phóng khi vehicle exit được xác nhận.

## 39.8 “5 phút free + 5.000/10 phút”

**CHUYỂN OPTIONAL.**

Baseline theo SRS mentor là hold 15 phút pending payment.

## 39.9 “Violation = 100.000 mọi trường hợp”

**BỎ hard-code.**

Dùng PenaltyRule.

## 39.10 “Monthly pass 70% tổng hệ thống”

**BỎ.**

Nếu triển khai thì quota theo lot/type/plan.

---

# 40. Reuse Matrix từ dự án cũ

| Module cũ | Quyết định | Refactor chính |
|---|---|---|
| Security/JWT | KEEP | facility-scope authorization |
| User/Role | KEEP | thêm assignment theo lot |
| Vehicle | KEEP | bỏ hard-code giới hạn nếu cần |
| Floor/Zone/Slot | KEEP + REFACTOR | thêm ParkingLot, level flexible |
| Booking | KEEP CONCEPT | time overlap, multi-lot, hold policy |
| ParkingSession | KEEP | thêm parkingLotId, exit semantics |
| PricingRule | KEEP ENGINE PART | multi-strategy, lot scope, 15-min billing |
| VNPay | KEEP | Payment entity + idempotency |
| MonthlyPass | OPTIONAL | lot scope |
| ParkingException | KEEP CONCEPT | operational issue vs penalty rule |
| AuditLog | KEEP | tăng coverage, không xóa sớm |
| Natural slot sort | KEEP | tie-break/UI |
| Cross-zone fallback | KEEP | chỉ trong cùng lot & compatible |
| Buffer capacity | REWORK | future reservation time windows |
| Blacklist/debt | OPTIONAL | policy configurable, không phải core mentor requirement |

---

# 41. Traceability theo nguồn

## Mentor `context.md`

Giữ:

- multi parking lot information;
- GPS coordinates;
- Haversine;
- available spots + price + distance;
- 2D/3D map;
- payment;
- real-time/IoT concept;
- operational risks;
- WebSocket.

## Mentor SRS

Giữ Core:

- parking lot discovery;
- reservation;
- price/payment;
- search radius;
- Haversine baseline;
- real-time 2D/3D;
- staff;
- dashboard/report by parking lot;
- facility staff access;
- notification;
- audit/security;
- AI vs traditional-system boundary.

Scale lại cho OJT:

- microservices → modular monolith;
- production scale NFR → future target;
- IoT physical → simulator;
- multiple payment providers → VNPay;
- AI production features → future.

## OJT AI-generated V2

Giữ tốt:

- React Three Fiber;
- QR;
- WebSocket;
- slot auto allocation;
- EV/Accessible/Priority idea;
- camera simulator;
- barrier simulator;
- 3D ↔ DB mapping.

Sửa:

- single building;
- hard-coded F01/F02/F03;
- 90% lock;
- customer > guest;
- fixed violation fee;
- fixed hold extension;
- slot status model.

## Dự án SWP391 cũ

Giữ tốt:

- modular Spring Boot;
- Booking vs ParkingSession separation;
- Pricing rule;
- payment;
- cross-zone fallback;
- exception workflow;
- audit;
- VNPay;
- vehicle validation.

Refactor toàn bộ query/policy để hoạt động theo `ParkingLot`.

---

# 42. Phase Roadmap

## Phase 0 — Refactor Foundation

1. Add `ParkingLot`.
2. Add `FacilityStaffAssignment`.
3. Link Level/Floor to ParkingLot.
4. Scope Zone/Slot/Pricing/Booking/Session.
5. Migrate existing single-building data thành một ParkingLot seed.

## Phase 1 — Mentor Core

1. Multi-lot CRUD.
2. Search location.
3. Haversine nearest.
4. Pricing per lot.
5. Estimated cheapest.
6. Availability.
7. Booking time-window.
8. Exact/Auto slot.
9. Basic 3D map per lot.
10. QR.
11. Check-in/out.
12. VNPay sandbox/Cash.
13. RBAC per lot.

**Đây là phase phải demo được end-to-end.**

## Phase 2 — Real-time Operation

1. WebSocket.
2. Staff operation.
3. Manager dashboard.
4. Payment hardening.
5. Slot conflict replacement.
6. Camera/IoT simulator.
7. Barrier simulator.
8. Notification.
9. Audit completeness.

## Phase 3 — Extension

1. EV.
2. Accessible.
3. Priority.
4. Monthly pass.
5. Violation/Exception advanced.
6. Review.
7. Internal navigation Dijkstra/A*.
8. Route-distance integration.
9. Analytics nâng cao.

---

# 43. Demo Scenario chuẩn

## Scenario A — Nearest

```text
Customer opens Search
→ Browser shares location
→ Backend finds active lots within 5km
→ Haversine calculates distance
→ Sort NEAREST
→ Display distance, available slots, estimated price
```

## Scenario B — Cheapest

```text
Customer:
CAR
18:00
Expected 3 hours

→ Search active lots
→ PricingEngine estimates each lot
→ Sort CHEAPEST
→ Show explanation
```

## Scenario C — 3D Exact Slot

```text
Customer chooses Lot B
→ loads published 3D map
→ selects Level B1
→ clicks B1-A023
→ backend re-checks time availability
→ confirms booking
→ WebSocket updates viewers
```

## Scenario D — Auto Select

```text
Customer selects AUTO
→ hard constraint filter
→ rank compatible slots
→ allocate best candidate
→ confirm transaction
```

## Scenario E — Check-in/out

```text
QR
→ verify
→ ParkingSession ACTIVE
→ slot OCCUPIED

Exit
→ calculate final fee
→ VNPay/Cash
→ payment success
→ physical exit confirmed
→ session COMPLETED
→ slot AVAILABLE
```

---

# 44. Acceptance Criteria trọng tâm

### Multi-Lot

- Tạo được ít nhất 3 ParkingLot seed với cấu trúc khác nhau.
- Một lot outdoor không bị buộc hiển thị ba tầng.
- Pricing từng lot khác nhau.

### Search

- Nearest đúng theo Haversine test dataset.
- Cheapest đúng theo expected duration.
- Filter vehicle type.
- Không trả closed lot như available.

### Booking

- Hai request đồng thời cùng exact slot chỉ một request thành công.
- Booking tương lai không làm slot “occupied” ở hiện tại.
- Hai booking không overlap có thể cùng dùng một slot ở hai thời điểm khác nhau.

### RBAC

- Manager A không sửa Pricing Lot B.
- Staff A không check-in Lot B nếu không được assigned.

### 3D

- Object 3D map đúng slot DB.
- Slot state update không reload page.
- Bản đồ khác nhau theo lot.

### Payment

- Duplicate VNPay callback không duplicate payment.
- Cash có Staff audit.

---

# 45. Những quyết định nhóm cần khóa trong ERD/API

Các giá trị nên cấu hình, không hard-code:

```text
default search radius
booking hold minutes
arrival early window
arrival late/no-show window
minimum booking duration
maximum booking duration
cancellation/refund policy
billing unit
daily cap
peak multiplier cap
capacity warning
capacity admission stop
vehicle/account limit
camera confidence threshold
QR expiry
```

---

# 46. Definition of Done cho Baseline

Baseline chỉ được xem là “ready” khi:

- [ ] Multi-parking scope đã được chấp nhận.
- [ ] ParkingLot entity xuất hiện trong ERD.
- [ ] Staff/Manager scope theo ParkingLot.
- [ ] Search nearest được đặc tả bằng Haversine.
- [ ] Cheapest dùng estimated full cost, không chỉ hourly rate.
- [ ] 3D layout là data-driven per ParkingLot.
- [ ] Booking kiểm tra time-window overlap.
- [ ] Pricing scope theo lot.
- [ ] Payment callback idempotent.
- [ ] Camera/AI không có quyền final financial/legal decision.
- [ ] NFR OJT tách khỏi production aspiration.
- [ ] Optional features không chặn Phase 1.

---

# 47. Kết luận baseline

Bản dự án mới **không phải hệ thống quản lý một tòa nhà được mở rộng thêm GPS**.

Nó phải được xem là:

> **A multi-parking smart management and reservation platform with configurable parking structures, parking-specific pricing, location-based nearest/cheapest search, data-driven 3D visualization, reservation, real-time operation and payment.**

Dự án cũ cung cấp một nền tảng nghiệp vụ tốt cho phần **inside-a-parking-lot operations**.

`context.md` và SRS mentor cung cấp phần còn thiếu quan trọng nhất: **multi-lot discovery, GIS/search, cross-lot management và platform-level architecture**.

Hướng triển khai đúng là:

```text
Reuse proven core
        +
Add ParkingLot as aggregate boundary
        +
Generalize Pricing/Booking
        +
Implement Search Algorithms
        +
Make 3D layout configurable per lot
```

thay vì tiếp tục phát triển trên giả định “01 bãi ba tầng”.
