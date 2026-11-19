-- Migration 003: Đồng bộ hóa toàn diện tên bãi đỗ xe chuẩn mực cho ai_lot_catalog
BEGIN;

INSERT INTO public.ai_lot_catalog (lot_id, name, address, latitude, longitude, car_price_per_hour, motorbike_price_per_hour, has_ev_charging, has_roofed_shelter, total_slots, updated_at)
VALUES 
    ('11111111-1111-4111-8111-111111111111', 'Tòa nhà đỗ xe Vincom Center Đồng Khởi', '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM', 10.778100, 106.701800, 30000, 5000, true, true, 200, now()),
    ('22222222-2222-4222-8222-222222222222', 'Bãi đỗ xe Landmark 81 - Central Park', '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM', 10.795200, 106.721900, 30000, 5000, true, false, 40, now()),
    ('33333333-3333-4333-8333-111111111111', 'Bãi xe Crescent Mall & SECC Phú Mỹ Hưng', '101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM', 10.729200, 106.719600, 30000, 5000, true, true, 200, now())
ON CONFLICT (lot_id) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    car_price_per_hour = EXCLUDED.car_price_per_hour,
    motorbike_price_per_hour = EXCLUDED.motorbike_price_per_hour,
    has_ev_charging = EXCLUDED.has_ev_charging,
    has_roofed_shelter = EXCLUDED.has_roofed_shelter,
    total_slots = EXCLUDED.total_slots,
    updated_at = now();

COMMIT;
