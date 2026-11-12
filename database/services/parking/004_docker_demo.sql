-- Explicit Development fixture; repeatable, no delete/truncate, no existing business rows overwritten.
-- customer_id/admin_id parameters are UUIDs belonging to demo accounts in Identity.
BEGIN;
INSERT INTO vehicle_types(code,name) VALUES('CAR','Ô tô'),('MOTORBIKE','Xe máy') ON CONFLICT DO NOTHING;
INSERT INTO parking_lots(id,code,name,address,latitude,longitude,timezone,status,created_at,updated_at) VALUES
 ('11111111-1111-4111-8111-111111111111','DEMO-Q1','Demo Quận 1','Dữ liệu demo — Quận 1',10.776,106.700,'Asia/Ho_Chi_Minh','ACTIVE',now(),now()),
 ('22222222-2222-4222-8222-222222222222','DEMO-BT','Demo Bình Thạnh','Dữ liệu demo — Bình Thạnh',10.790,106.710,'Asia/Ho_Chi_Minh','ACTIVE',now(),now()),
 ('33333333-3333-4333-8333-111111111111','DEMO-Q7','Demo Quận 7','Dữ liệu demo — Quận 7',10.735,106.722,'Asia/Ho_Chi_Minh','ACTIVE',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO lot_vehicle_policies(lot_id,vehicle_type,guest_booking_enabled,dynamic_multiplier_cap,hold_minutes,min_booking_minutes,max_booking_minutes,
 early_arrival_minutes,late_arrival_minutes,warning_percent,admission_percent,reserved_capacity,cancellation_refund_cutoff_minutes)
SELECT l.id,t.code,false,2,5,30,1440,15,30,80,100,0,120 FROM parking_lots l CROSS JOIN vehicle_types t
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') AND t.code IN ('CAR','MOTORBIKE') ON CONFLICT DO NOTHING;
INSERT INTO lot_opening_intervals(id,lot_id,start_minute,end_minute)
SELECT md5('demo-opening:'||id)::uuid,id,0,10080 FROM parking_lots l WHERE code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')
AND NOT EXISTS(SELECT 1 FROM lot_opening_intervals o WHERE o.lot_id=l.id) ON CONFLICT DO NOTHING;
INSERT INTO parking_levels(id,lot_id,code,name,level_kind,elevation_m,display_order)
SELECT md5('demo-level:'||id)::uuid,id,CASE code WHEN 'DEMO-Q1' THEN 'B1' WHEN 'DEMO-BT' THEN 'G' ELSE 'F1' END,
 CASE code WHEN 'DEMO-Q1' THEN 'Tầng hầm B1' WHEN 'DEMO-BT' THEN 'Ngoài trời' ELSE 'Tầng nổi 1' END,
 CASE code WHEN 'DEMO-BT' THEN 'OUTDOOR' ELSE 'INDOOR' END,CASE code WHEN 'DEMO-Q1' THEN -3 WHEN 'DEMO-BT' THEN 0 ELSE 3 END,1
FROM parking_lots WHERE code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') ON CONFLICT DO NOTHING;
INSERT INTO zones(id,lot_id,level_id,code,name)
SELECT md5('demo-zone:'||l.id||':'||t.code)::uuid,l.id,md5('demo-level:'||l.id)::uuid,t.code,
 CASE t.code WHEN 'CAR' THEN 'Khu ô tô' ELSE 'Khu xe máy' END FROM parking_lots l CROSS JOIN vehicle_types t
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') AND t.code IN ('CAR','MOTORBIKE') ON CONFLICT DO NOTHING;
INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m)
SELECT md5('demo-slot:'||z.id||':'||n)::uuid,z.lot_id,z.id,z.level_id,z.code||'-'||lpad(n::text,2,'0'),'ACTIVE',
 CASE z.code WHEN 'CAR' THEN 2.5 ELSE 1 END,CASE z.code WHEN 'CAR' THEN 5 ELSE 2 END
FROM zones z JOIN parking_lots l ON l.id=z.lot_id CROSS JOIN generate_series(1,20) n
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') ON CONFLICT DO NOTHING;
INSERT INTO slot_vehicle_types(slot_id,lot_id,vehicle_type)
SELECT s.id,s.lot_id,z.code FROM parking_slots s JOIN zones z ON z.id=s.zone_id JOIN parking_lots l ON l.id=s.lot_id
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') ON CONFLICT DO NOTHING;
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
COMMIT;
