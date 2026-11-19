-- Explicit Development fixture; repeatable.
-- DEMO-BT: Bãi xe ngoài trời 1 tầng Landmark 81 - Central Park (20 ô tô A01..A10, B01..B10 + 20 xe máy M01..M20)
-- DEMO-Q1 & DEMO-Q7: Tòa nhà đỗ xe 3 tầng Vincom Đồng Khởi & Crescent Mall (Tầng 1: Xe máy, Tầng 2: 100 ô tô F2-A01..E20, Tầng 3: 100 ô tô F3-A01..E20)
BEGIN;

INSERT INTO vehicle_types(code,name) VALUES('CAR','Ô tô'),('MOTORBIKE','Xe máy') ON CONFLICT DO NOTHING;

INSERT INTO parking_lots(id,code,name,address,latitude,longitude,timezone,status,created_at,updated_at) VALUES
 ('11111111-1111-4111-8111-111111111111','DEMO-Q1','Tòa nhà đỗ xe Vincom Center Đồng Khởi','72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',10.7781,106.7018,'Asia/Ho_Chi_Minh','ACTIVE',now(),now()),
 ('22222222-2222-4222-8222-222222222222','DEMO-BT','Bãi đỗ xe Landmark 81 - Central Park','720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM',10.7952,106.7219,'Asia/Ho_Chi_Minh','ACTIVE',now(),now()),
 ('33333333-3333-4333-8333-111111111111','DEMO-Q7','Bãi xe Crescent Mall & SECC Phú Mỹ Hưng','101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM',10.7292,106.7196,'Asia/Ho_Chi_Minh','ACTIVE',now(),now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  updated_at = now();

INSERT INTO lot_vehicle_policies(lot_id,vehicle_type,guest_booking_enabled,dynamic_multiplier_cap,hold_minutes,min_booking_minutes,max_booking_minutes,
 early_arrival_minutes,late_arrival_minutes,warning_percent,admission_percent,reserved_capacity,cancellation_refund_cutoff_minutes)
SELECT l.id,t.code,false,2,5,30,1440,15,30,80,100,0,120 FROM parking_lots l CROSS JOIN vehicle_types t
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') AND t.code IN ('CAR','MOTORBIKE') ON CONFLICT DO NOTHING;

INSERT INTO lot_opening_intervals(id,lot_id,start_minute,end_minute)
SELECT md5('demo-opening:'||id)::uuid,id,0,10080 FROM parking_lots l WHERE code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
AND NOT EXISTS(SELECT 1 FROM lot_opening_intervals o WHERE o.lot_id=l.id) ON CONFLICT DO NOTHING;

-- Dọn các slot/zone/level mẫu cũ chưa có đặt chỗ của DEMO-Q1, DEMO-BT, DEMO-Q7 để nạp đúng cấu trúc mới
DELETE FROM map_objects mo USING parking_lots l
WHERE mo.lot_id = l.id AND l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7')
  AND (mo.slot_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM slot_reservations sr WHERE sr.slot_id = mo.slot_id
    UNION ALL
    SELECT 1 FROM session_slot_assignments sa WHERE sa.slot_id = mo.slot_id
  ));

DELETE FROM slot_vehicle_types svt USING parking_slots s, parking_lots l
WHERE svt.slot_id = s.id AND s.lot_id = l.id AND l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7')
  AND NOT EXISTS (SELECT 1 FROM slot_reservations sr WHERE sr.slot_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM session_slot_assignments sa WHERE sa.slot_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM map_objects mo WHERE mo.slot_id = s.id);

DELETE FROM parking_slots s USING parking_lots l
WHERE s.lot_id = l.id AND l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7')
  AND NOT EXISTS (SELECT 1 FROM slot_reservations sr WHERE sr.slot_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM session_slot_assignments sa WHERE sa.slot_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM slot_vehicle_types svt WHERE svt.slot_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM map_objects mo WHERE mo.slot_id = s.id);

DELETE FROM zones z USING parking_lots l
WHERE z.lot_id = l.id AND l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7')
  AND NOT EXISTS (SELECT 1 FROM parking_slots s WHERE s.zone_id = z.id)
  AND NOT EXISTS (SELECT 1 FROM pricing_rules pr WHERE pr.zone_id = z.id);

DELETE FROM parking_levels pl USING parking_lots l
WHERE pl.lot_id = l.id AND l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7')
  AND NOT EXISTS (SELECT 1 FROM zones z WHERE z.level_id = pl.id)
  AND NOT EXISTS (SELECT 1 FROM parking_slots s WHERE s.level_id = pl.id)
  AND NOT EXISTS (SELECT 1 FROM map_objects mo WHERE mo.level_id = pl.id);

-- 1. Bãi xe ngoài trời 1 tầng (DEMO-BT, DEMO-A, DEMO-B)
INSERT INTO parking_levels(id,lot_id,code,name,level_kind,elevation_m,display_order)
SELECT md5('demo-level-outdoor:'||l.id)::uuid,l.id,'G','Ngoài trời','OUTDOOR',0,1
FROM parking_lots l WHERE l.code IN ('DEMO-BT','DEMO-A','DEMO-B')
ON CONFLICT (lot_id, code) DO UPDATE SET name = EXCLUDED.name, level_kind = EXCLUDED.level_kind, elevation_m = EXCLUDED.elevation_m, display_order = EXCLUDED.display_order;

INSERT INTO zones(id,lot_id,level_id,code,name)
SELECT md5('demo-zone-outdoor:'||l.id||':'||z.code)::uuid,l.id,pl.id,z.code,z.name
FROM parking_lots l
JOIN parking_levels pl ON pl.lot_id = l.id AND pl.code = 'G'
CROSS JOIN (VALUES ('A','Khu A'),('B','Khu B'),('MOTO','Khu xe máy')) AS z(code,name)
WHERE l.code IN ('DEMO-BT','DEMO-A','DEMO-B')
ON CONFLICT (level_id, code) DO UPDATE SET name = EXCLUDED.name;

-- 20 ô tô ngoài trời (A01..A10, B01..B10) cho DEMO-BT
INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
SELECT md5('demo-slot-outdoor:'||z.id||':'||n)::uuid,z.lot_id,z.id,z.level_id,
  z.code||lpad(n::text,2,'0'),'ACTIVE',5.8,3.4
FROM zones z
JOIN parking_lots l ON l.id = z.lot_id
CROSS JOIN generate_series(1,10) n
WHERE l.code IN ('DEMO-BT','DEMO-A','DEMO-B') AND z.code IN ('A','B')
ON CONFLICT (zone_id, code) DO NOTHING;

-- 20 xe máy ngoài trời (M01..M20) cho DEMO-BT
INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
SELECT md5('demo-slot-outdoor-moto:'||z.id||':'||n)::uuid,z.lot_id,z.id,z.level_id,
  'M'||lpad(n::text,2,'0'),'ACTIVE',1.0,2.0
FROM zones z
JOIN parking_lots l ON l.id = z.lot_id
CROSS JOIN generate_series(1,20) n
WHERE l.code IN ('DEMO-BT','DEMO-A','DEMO-B') AND z.code = 'MOTO'
ON CONFLICT (zone_id, code) DO NOTHING;

-- 2. Tòa nhà đỗ xe 3 tầng (DEMO-Q1, DEMO-Q7)
INSERT INTO parking_levels(id,lot_id,code,name,level_kind,elevation_m,display_order)
SELECT md5('demo-level-bldg:'||l.id||':'||lv.code)::uuid,l.id,lv.code,lv.name,'INDOOR',lv.elev,lv.ord
FROM parking_lots l
CROSS JOIN (VALUES
  ('F1','Tầng 1 (Xe máy)',0.0,1),
  ('F2','Tầng 2 (100 ô tô)',5.2,2),
  ('F3','Tầng 3 (100 ô tô)',10.4,3)
) AS lv(code,name,elev,ord)
WHERE l.code IN ('DEMO-Q1','DEMO-Q7')
ON CONFLICT (lot_id, code) DO UPDATE SET name = EXCLUDED.name, elevation_m = EXCLUDED.elevation_m, display_order = EXCLUDED.display_order;

-- Khu xe máy ở Tầng 1 (F1)
INSERT INTO zones(id,lot_id,level_id,code,name)
SELECT md5('demo-zone-bldg-f1:'||pl.id)::uuid,pl.lot_id,pl.id,'MOTO','Khu xe máy Tầng 1'
FROM parking_levels pl
JOIN parking_lots l ON l.id = pl.lot_id
WHERE l.code IN ('DEMO-Q1','DEMO-Q7') AND pl.code = 'F1'
ON CONFLICT (level_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
SELECT md5('demo-slot-bldg-f1:'||z.id||':'||n)::uuid,z.lot_id,z.id,z.level_id,
  'F1-M'||lpad(n::text,2,'0'),'ACTIVE',1.0,2.0
FROM zones z
JOIN parking_levels pl ON pl.id = z.level_id
JOIN parking_lots l ON l.id = z.lot_id
CROSS JOIN generate_series(1,20) n
WHERE l.code IN ('DEMO-Q1','DEMO-Q7') AND pl.code = 'F1' AND z.code = 'MOTO'
ON CONFLICT (zone_id, code) DO NOTHING;

-- 5 Hàng A, B, C, D, E × 20 cột = 100 ô tô/tầng ở Tầng 2 (F2) và Tầng 3 (F3)
INSERT INTO zones(id,lot_id,level_id,code,name)
SELECT md5('demo-zone-bldg:'||pl.id||':'||r.code)::uuid,pl.lot_id,pl.id,r.code,'Hàng '||r.code
FROM parking_levels pl
JOIN parking_lots l ON l.id = pl.lot_id
CROSS JOIN (VALUES ('A'),('B'),('C'),('D'),('E')) AS r(code)
WHERE l.code IN ('DEMO-Q1','DEMO-Q7') AND pl.code IN ('F2','F3')
ON CONFLICT (level_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
SELECT md5('demo-slot-bldg:'||z.id||':'||n)::uuid,z.lot_id,z.id,z.level_id,
  pl.code||'-'||z.code||lpad(n::text,2,'0'),'ACTIVE',2.5,5.0
FROM zones z
JOIN parking_levels pl ON pl.id = z.level_id
JOIN parking_lots l ON l.id = z.lot_id
CROSS JOIN generate_series(1,20) n
WHERE l.code IN ('DEMO-Q1','DEMO-Q7') AND pl.code IN ('F2','F3') AND z.code IN ('A','B','C','D','E')
ON CONFLICT (zone_id, code) DO NOTHING;

-- Gán loại phương tiện cho toàn bộ slot
INSERT INTO slot_vehicle_types(slot_id,lot_id,vehicle_type)
SELECT s.id,s.lot_id,CASE WHEN z.code = 'MOTO' THEN 'MOTORBIKE' ELSE 'CAR' END
FROM parking_slots s
JOIN zones z ON z.id = s.zone_id
JOIN parking_lots l ON l.id = s.lot_id
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
ON CONFLICT DO NOTHING;

INSERT INTO lot_gates(id,lot_id,code,gate_kind)
SELECT md5('demo-gate:'||l.id||':'||kind)::uuid,l.id,kind,kind FROM parking_lots l CROSS JOIN (VALUES('ENTRY'),('EXIT')) t(kind)
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') ON CONFLICT DO NOTHING;

INSERT INTO pricing_plans(id,lot_id,vehicle_type,version_no,name,status,effective_from,currency,created_by,created_at)
SELECT md5('demo-price:'||p.lot_id||':'||p.vehicle_type)::uuid,p.lot_id,p.vehicle_type,1,'Giá demo '||p.vehicle_type,'PUBLISHED','2026-01-01T00:00:00Z','VND',:'admin_id'::uuid,now()
FROM lot_vehicle_policies p JOIN parking_lots l ON l.id=p.lot_id WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
AND NOT EXISTS(SELECT 1 FROM pricing_plans existing WHERE existing.lot_id=p.lot_id AND existing.vehicle_type=p.vehicle_type) ON CONFLICT DO NOTHING;

INSERT INTO pricing_rules(id,plan_id,lot_id,rule_type,priority,amount,billing_unit_minutes,multiplier,parameters)
SELECT md5('demo-rule:'||p.id)::uuid,p.id,p.lot_id,'FLAT_BLOCK',1,
CASE p.vehicle_type WHEN 'CAR' THEN 7500 ELSE 1000 END,15,1,
jsonb_build_object('blockMinutes',15,'rateVnd',CASE p.vehicle_type WHEN 'CAR' THEN 7500 ELSE 1000 END,
 'dailyCapVnd',CASE p.vehicle_type WHEN 'CAR' THEN 120000 ELSE 20000 END,'multiplier',1)
FROM pricing_plans p JOIN parking_lots l ON l.id=p.lot_id WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
AND NOT EXISTS(SELECT 1 FROM pricing_rules r WHERE r.plan_id=p.id) ON CONFLICT DO NOTHING;

INSERT INTO vehicles(id,plate_country,plate_normalized,vehicle_type,fuel_type,is_active,created_at)
VALUES('99999999-9999-4999-8999-999999999999','VN','51A12345','CAR','PETROL',true,now()) ON CONFLICT DO NOTHING;

INSERT INTO user_vehicle_access(user_id,vehicle_id,access_kind,verified_at,is_primary,created_at)
VALUES(:'customer_id'::uuid,'99999999-9999-4999-8999-999999999999','OWNER',now(),true,now()) ON CONFLICT DO NOTHING;

INSERT INTO map_versions(id,lot_id,version_no,status,coordinate_unit,created_by,published_at)
SELECT md5('demo-map:'||l.id)::uuid,l.id,
 (SELECT coalesce(max(v.version_no),0)+1 FROM map_versions v WHERE v.lot_id=l.id),
 'PUBLISHED','METERS',:'admin_id'::uuid,now()
FROM parking_lots l
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
AND NOT EXISTS(SELECT 1 FROM map_versions v WHERE v.lot_id=l.id AND v.status='PUBLISHED')
ON CONFLICT DO NOTHING;

WITH positioned_slots AS (
 SELECT s.*, row_number() OVER(PARTITION BY s.lot_id,s.level_id ORDER BY s.code)-1 AS ordinal
 FROM parking_slots s JOIN parking_lots l ON l.id=s.lot_id
 WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
)
INSERT INTO map_objects(id,lot_id,map_version_id,level_id,slot_id,object_type,x,y,z,rotation_y,size_x,size_y,size_z,metadata)
SELECT md5('demo-map-slot:'||s.id)::uuid,s.lot_id,v.id,s.level_id,s.id,'PARKING_SLOT',
 (s.ordinal%20)*2.5,level.elevation_m,(s.ordinal/20)*7,0,coalesce(s.width_m,2.5),0.1,coalesce(s.length_m,5),'{}'::jsonb
FROM positioned_slots s
JOIN parking_levels level ON level.id=s.level_id AND level.lot_id=s.lot_id
JOIN map_versions v ON v.id=md5('demo-map:'||s.lot_id)::uuid AND v.lot_id=s.lot_id
ON CONFLICT DO NOTHING;

INSERT INTO map_objects(id,lot_id,map_version_id,level_id,gate_id,object_type,x,y,z,rotation_y,size_x,size_y,size_z,metadata)
SELECT md5('demo-map-gate:'||g.id)::uuid,g.lot_id,v.id,level.id,g.id,'GATE',
 CASE WHEN g.gate_kind='EXIT' THEN 45 ELSE -5 END,level.elevation_m,-5,0,2,2,1,'{}'::jsonb
FROM lot_gates g
JOIN map_versions v ON v.id=md5('demo-map:'||g.lot_id)::uuid AND v.lot_id=g.lot_id
JOIN LATERAL (SELECT id,elevation_m FROM parking_levels WHERE lot_id=g.lot_id ORDER BY display_order,id LIMIT 1) level ON true
ON CONFLICT DO NOTHING;

COMMIT;
