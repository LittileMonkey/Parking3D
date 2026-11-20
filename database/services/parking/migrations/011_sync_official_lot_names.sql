-- Migration 011: Đồng bộ hóa toàn diện tên chính thức và địa chỉ chuẩn của các cơ sở bãi đỗ xe
BEGIN;

UPDATE public.parking_lots
SET 
    name = 'Tòa nhà đỗ xe Vincom Center Đồng Khởi',
    address = '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',
    latitude = 10.778100,
    longitude = 106.701800,
    updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111111' OR code = 'DEMO-Q1';

UPDATE public.parking_lots
SET 
    name = 'Bãi đỗ xe Landmark 81 - Central Park',
    address = '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM',
    latitude = 10.795200,
    longitude = 106.721900,
    updated_at = now()
WHERE id = '22222222-2222-4222-8222-222222222222' OR code = 'DEMO-BT';

UPDATE public.parking_lots
SET 
    name = 'Bãi xe Crescent Mall & SECC Phú Mỹ Hưng',
    address = '101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM',
    latitude = 10.729200,
    longitude = 106.719600,
    updated_at = now()
WHERE id = '33333333-3333-4333-8333-111111111111' OR code = 'DEMO-Q7';

COMMIT;
