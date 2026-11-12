# 04 - THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE SCHEMA — BASELINE V4)

## 1. Hệ Quản trị Cơ sở Dữ liệu & Quy ước Chung
- **Hệ quản trị CSDL:** PostgreSQL 17
- **Múi giờ lưu trữ:** UTC toàn diện (`timestamp with time zone` - `timestamptz`).
- **Khóa chính:** `UUID` (`uuid_generate_v4()` hoặc EF Core `Guid.NewGuid()`).
- **Audit Columns:** Toàn bộ bảng thực thể đều kế thừa:
  - `CreatedAt` (`timestamptz NOT NULL DEFAULT now()`)
  - `UpdatedAt` (`timestamptz NULL`)
- **Version Tracking:** Cột `Version` (`int` hoặc PostgreSQL `xmin`) hỗ trợ Optimistic Concurrency Control.

---

## 2. Sơ đồ Thực thể Quan hệ Toàn diện (Baseline V4 ERD)

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
 ├──< PricingPlan
 │      └──< PricingRule
 │
 ├──< MapVersion
 │      └──< MapObject
 │
 ├──< PenaltyRule
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

AuditLog (Append-Only)
CameraEvent (Simulator Stream)
```

---

## 3. Chi tiết Các Bảng Thực thể Cốt lõi

### 3.1. Bảng `ParkingLots` (Bãi đỗ xe)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `Id` | `uuid` | PK | Mã định danh bãi xe |
| `Code` | `varchar(50)` | UNIQUE, NOT NULL | Mã bãi viết tắt (`LOT-Q1-01`) |
| `Name` | `varchar(200)` | NOT NULL | Tên đầy đủ bãi đỗ |
| `Description` | `text` | NULL | Giới thiệu, lưu ý vào/ra |
| `Address` | `text` | NOT NULL | Địa chỉ thực tế |
| `Latitude` | `double precision`| NOT NULL | Tọa độ Vĩ độ GPS phục vụ Haversine |
| `Longitude` | `double precision`| NOT NULL | Tọa độ Kinh độ GPS phục vụ Haversine |
| `SearchRadiusMeters`| `int` | NOT NULL DEFAULT 5000 | Bán kính quét tìm kiếm mặc định |
| `Status` | `smallint` | NOT NULL | `0: Inactive, 1: Active, 2: TemporarilyClosed` |
| `TotalCapacity` | `int` | NOT NULL DEFAULT 0 | Tổng số lượng slot (cached/derived) |

### 3.2. Bảng `FacilityStaffAssignments` (Phân quyền Quản lý Bãi)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `Id` | `uuid` | PK | Mã bản ghi |
| `UserId` | `uuid` | FK -> Users(Id) | Nhân sự được gán |
| `ParkingLotId`| `uuid` | FK -> ParkingLots(Id) | Bãi đỗ được phân công |
| `Role` | `smallint` | NOT NULL | `0: Staff, 1: Manager` |
| `ActiveFrom` | `timestamptz` | NOT NULL | Thời gian bắt đầu hiệu lực |
| `ActiveTo` | `timestamptz` | NULL | Thời gian kết thúc (nếu có hạn) |

### 3.3. Bảng `ParkingLevels` (Tầng / Mặt bằng Bãi xe)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `Id` | `uuid` | PK | Mã tầng |
| `ParkingLotId`| `uuid` | FK -> ParkingLots(Id) | Bãi xe trực thuộc |
| `LevelCode` | `varchar(30)` | NOT NULL | Mã tầng (`B2`, `B1`, `G`, `F01`, `OUTDOOR`)|
| `Name` | `varchar(100)` | NOT NULL | Tên hiển thị ("Tầng hầm B1", "Bãi ngoài trời")|
| `LevelType` | `smallint` | NOT NULL | `0: Ground, 1: Basement, 2: Floor, 3: Outdoor, 4: Rooftop, 5: Other`|
| `SortOrder` | `int` | NOT NULL DEFAULT 0 | Thứ tự hiển thị trên danh mục tầng |

### 3.4. Bảng `Zones` (Phân khu trong Tầng)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `Id` | `uuid` | PK | Mã phân khu |
| `ParkingLevelId`| `uuid` | FK -> ParkingLevels(Id)| Tầng trực thuộc |
| `Code` | `varchar(30)` | NOT NULL | Mã khu (`Zone-A`, `Zone-B`) |
| `Name` | `varchar(100)` | NOT NULL | Tên khu ("Khu xe máy", "Khu ô tô VIP") |
| `VehicleType` | `smallint` | NOT NULL | `0: Motorbike, 1: Car, 2: Other` |
| `AllocationPriority`| `int` | NOT NULL DEFAULT 0 | Mức độ ưu tiên khi hệ thống Auto cấp slot |

### 3.5. Bảng `ParkingSlots` (Vị trí đỗ xe)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `Id` | `uuid` | PK | Mã vị trí |
| `ZoneId` | `uuid` | FK -> Zones(Id) | Khu vực trực thuộc |
| `SlotCode` | `varchar(30)` | NOT NULL | Mã hiển thị (`B1-A01`, `F02-B12`) |
| `OperationalStatus`| `smallint` | NOT NULL | `0: Active, 1: Maintenance, 2: Disabled` |
| `ExitOrder` | `int` | NOT NULL DEFAULT 999 | Khoảng cách tương đối đến cửa thoát |
| `MapObjectId` | `uuid` | NULL | Liên kết tới đối tượng trên bản đồ 3D |

### 3.6. Bảng `Bookings` (Đơn đặt chỗ)
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `Id` | `uuid` | PK | Mã booking |
| `BookingCode` | `varchar(32)` | UNIQUE, NOT NULL | Mã tra cứu (`BK20261002-8X7A`) |
| `ParkingLotId`| `uuid` | FK -> ParkingLots(Id) | Bãi xe đặt chỗ |
| `ParkingSlotId`| `uuid` | FK -> ParkingSlots(Id), NULL | Vị trí đặt (NULL nếu bãi cấp lúc đến)|
| `UserId` | `uuid` | FK -> Users(Id), NULL | Tài khoản đặt (NULL nếu Guest) |
| `NormalizedPlate`| `varchar(20)` | NOT NULL | Biển số chuẩn hóa (`29A12345`) |
| `PhoneNumber` | `varchar(20)` | NOT NULL | Số điện thoại liên lạc |
| `BookingMode` | `smallint` | NOT NULL | `0: ExactSlot, 1: AutoSlot, 2: LotOnly` |
| `Status` | `smallint` | NOT NULL | `0: PendingPayment, 1: Confirmed, 2: CheckedIn, 3: Completed, 4: Cancelled, 5: Expired, 6: NoShow` |
| `StartAt` | `timestamptz` | NOT NULL | Thời gian bắt đầu đỗ dự kiến |
| `EndAt` | `timestamptz` | NOT NULL | Thời gian kết thúc đỗ dự kiến |
| `HoldExpiresAt` | `timestamptz` | NOT NULL | Thời điểm hết hạn giữ slot tạm thời |
| `AccessToken` | `varchar(64)` | NOT NULL | Khóa bảo mật tra cứu/hủy booking |

### 3.7. Bảng `PricingPlans` & `PricingRules` (Biểu giá theo Bãi)
- **`PricingPlans`:** Thuộc về từng `ParkingLotId`, có `EffectiveFrom`, `EffectiveTo`, `Status` (`Draft`, `Active`, `Archived`).
- **`PricingRules`:** Thuộc về `PricingPlanId`, hỗ trợ:
  - `RuleType`: `0: Hourly, 1: PerMinute, 2: BillingUnit, 3: FlatRate, 4: Tiered, 5: DayNight, 6: Overnight, 7: DailyCap, 8: PeakMultiplier, 9: ZoneSurcharge, 10: EvCharging`.
  - `BillingUnitMinutes`: Block thời gian (default 15 phút theo SRS mentor).
  - `Rate`: Đơn giá.
  - `Multiplier`: Hệ số nhân giờ cao điểm (ví dụ: 1.2x hoặc 1.5x cap).
  - `MaximumDailyFee`: Trần giá tối đa trong ngày (Daily Cap).

### 3.8. Bảng `MapVersions` & `MapObjects` (Bản đồ 3D Hướng Dữ liệu)
- **`MapVersions`:** Lưu phiên bản bản đồ của bãi (`Draft`, `Published`, `Archived`).
- **`MapObjects`:**
  - `ObjectType`: `0: ParkingSlot, 1: Road, 2: Wall, 3: Entrance, 4: Exit, 5: Ramp, 6: Elevator, 7: Stair, 8: Charger, 9: Label, 10: Other`.
  - `RefEntityId`: ID của `ParkingSlot` hoặc thực thể tương ứng.
  - Tọa độ: `PositionX`, `PositionY`, `PositionZ`.
  - Góc xoay: `RotationX`, `RotationY`, `RotationZ`.
  - Tỉ lệ: `ScaleX`, `ScaleY`, `ScaleZ`.
  - `MetadataJson`: Thuộc tính tùy biến cho Three.js shader / materials.

---

## 4. Các Ràng buộc Nâng cao trên PostgreSQL (Guards & Triggers)

### 4.1. Chống Đặt trùng Slot theo Dải Thời gian (Slot Exclusion Constraint)
```sql
ALTER TABLE "SlotReservations"
ADD CONSTRAINT "EX_Reservations_SlotTime" EXCLUDE USING gist
("ParkingSlotId" WITH =, tstzrange("ReservedFrom", "ReservedUntil", '[)') WITH &&)
WHERE ("Status" IN (0, 1));
```

### 4.2. Chống Một Biển số Đặt Chồng lấn Thời gian (Vehicle Overlap Guard)
```sql
ALTER TABLE "Bookings"
ADD CONSTRAINT "EX_Bookings_PlateTime" EXCLUDE USING gist
("NormalizedPlate" WITH =, tstzrange("StartAt", "EndAt", '[)') WITH &&)
WHERE ("Status" IN (0, 1, 2));
```

### 4.3. Chống Trùng lặp Biểu giá Hiệu lực trên cùng một Bãi xe
```sql
ALTER TABLE "PricingPlans"
ADD CONSTRAINT "EX_Plans_LotTime" EXCLUDE USING gist
("ParkingLotId" WITH =, tstzrange("EffectiveFrom", "EffectiveTo", '[)') WITH &&)
WHERE ("Status" = 1);
```

### 4.4. Trigger Bảo vệ Nhật ký Kiểm toán Không thể Sửa/Xóa (Append-Only)
```sql
CREATE OR REPLACE FUNCTION parking_reject_audit_mutation() 
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bảng AuditLogs là Append-Only, nghiêm cấm mọi hành vi UPDATE hoặc DELETE!' 
    USING ERRCODE = '23514';
END;
$$;

CREATE TRIGGER "TR_AuditLogs_AppendOnly" 
BEFORE UPDATE OR DELETE ON "AuditLogs"
FOR EACH ROW EXECUTE FUNCTION parking_reject_audit_mutation();
```
