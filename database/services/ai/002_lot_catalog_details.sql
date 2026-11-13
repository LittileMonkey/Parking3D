-- Migration 002: Thêm các thuộc tính chi tiết cho ai_lot_catalog (GPS, địa chỉ, đơn giá, tiện ích)
BEGIN;

ALTER TABLE public.ai_lot_catalog
    ADD COLUMN IF NOT EXISTS address text DEFAULT 'Khu vực bãi đỗ xe ParkMatrix',
    ADD COLUMN IF NOT EXISTS latitude numeric(9,6) DEFAULT 10.776000,
    ADD COLUMN IF NOT EXISTS longitude numeric(9,6) DEFAULT 106.700000,
    ADD COLUMN IF NOT EXISTS car_price_per_hour numeric(12,2) DEFAULT 20000,
    ADD COLUMN IF NOT EXISTS motorbike_price_per_hour numeric(12,2) DEFAULT 5000,
    ADD COLUMN IF NOT EXISTS has_ev_charging boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS has_roofed_shelter boolean DEFAULT true,
    ADD COLUMN IF NOT EXISTS total_slots integer DEFAULT 200;

COMMIT;

