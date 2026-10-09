-- OPTIONAL DEVELOPMENT DATA ONLY. Not a production migration or approved pricing policy.
-- psql -v customer_id=<registered-customer-uuid> -v admin_id=<bootstrap-admin-uuid> -f ...
-- Apply once after 001_schema.sql; supplied IDs come from Identity API, not guessed accounts.
BEGIN;
INSERT INTO vehicle_types(code,name) VALUES('CAR','Ô tô'),('MOTORBIKE','Xe máy') ON CONFLICT DO NOTHING;
INSERT INTO parking_lots(id,code,name,address,latitude,longitude,timezone,status,created_at,updated_at) VALUES
 ('11111111-1111-4111-8111-111111111111','DEMO-A','Bãi demo A','Địa chỉ demo A',10.776,106.700,'Asia/Ho_Chi_Minh','ACTIVE',now(),now()),
 ('22222222-2222-4222-8222-222222222222','DEMO-B','Bãi demo B','Địa chỉ demo B',10.790,106.710,'Asia/Ho_Chi_Minh','ACTIVE',now(),now());
INSERT INTO lot_vehicle_policies(lot_id,vehicle_type,guest_booking_enabled,dynamic_multiplier_cap,hold_minutes,min_booking_minutes,max_booking_minutes,
 early_arrival_minutes,late_arrival_minutes,warning_percent,admission_percent,reserved_capacity,cancellation_refund_cutoff_minutes) VALUES
 ('11111111-1111-4111-8111-111111111111','CAR',false,2,15,30,1440,15,30,80,100,0,120),
 ('22222222-2222-4222-8222-222222222222','MOTORBIKE',false,2,15,30,1440,15,30,80,100,0,120);
INSERT INTO lot_opening_intervals(id,lot_id,start_minute,end_minute) VALUES
 (gen_random_uuid(),'11111111-1111-4111-8111-111111111111',0,10080),(gen_random_uuid(),'22222222-2222-4222-8222-222222222222',0,10080);
INSERT INTO parking_levels(id,lot_id,code,name,level_kind,elevation_m,display_order) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','F1','Tầng demo 1','INDOOR',0,1),
 ('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','G','Khu ngoài trời','OUTDOOR',0,1);
INSERT INTO zones(id,lot_id,level_id,code,name) VALUES
 ('55555555-5555-4555-8555-555555555555','11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','A','Khu A'),
 ('66666666-6666-4666-8666-666666666666','22222222-2222-4222-8222-222222222222','44444444-4444-4444-8444-444444444444','B','Khu B');
INSERT INTO parking_slots(id,lot_id,zone_id,level_id,code,operational_status,width_m,length_m) VALUES
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','A01','ACTIVE',2.5,5),
 ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','B01','ACTIVE',1,2);
INSERT INTO slot_vehicle_types(slot_id,lot_id,vehicle_type) VALUES
 ('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','CAR'),
 ('88888888-8888-4888-8888-888888888888','22222222-2222-4222-8222-222222222222','MOTORBIKE');
INSERT INTO vehicles(id,plate_country,plate_normalized,vehicle_type,fuel_type,is_active,created_at) VALUES
 ('99999999-9999-4999-8999-999999999999','VN','51A12345','CAR','PETROL',true,now());
INSERT INTO user_vehicle_access(user_id,vehicle_id,access_kind,verified_at,is_primary,created_at) VALUES
 (:'customer_id'::uuid,'99999999-9999-4999-8999-999999999999','OWNER',now(),true,now());
INSERT INTO pricing_plans(id,lot_id,vehicle_type,version_no,name,status,effective_from,currency,created_by,created_at) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','CAR',1,'Biểu giá demo CAR','PUBLISHED','2026-01-01T00:00:00Z','VND',:'admin_id'::uuid,now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','MOTORBIKE',1,'Biểu giá demo MOTORBIKE','PUBLISHED','2026-01-01T00:00:00Z','VND',:'admin_id'::uuid,now());
INSERT INTO pricing_rules(id,plan_id,lot_id,rule_type,priority,amount,billing_unit_minutes,multiplier,parameters) VALUES
 (gen_random_uuid(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','FLAT_BLOCK',1,7500,15,1,
  '{"blockMinutes":15,"rateVnd":7500,"dailyCapVnd":120000,"multiplier":1}'),
 (gen_random_uuid(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','FLAT_BLOCK',1,1000,15,1,
  '{"blockMinutes":15,"rateVnd":1000,"dailyCapVnd":20000,"multiplier":1}');
COMMIT;
