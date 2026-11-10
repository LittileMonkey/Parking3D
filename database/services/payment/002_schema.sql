-- Migration 002: Bổ sung snapshot thông tin khách hàng, bãi xe và biển số xe vào billing_accounts
-- Áp dụng cho: Database của Payment Service
-- Nâng cấp version trong service_schema_versions từ 1 lên 2.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

-- 1. Bổ sung 3 cột mới vào bảng public.billing_accounts theo đúng sơ đồ ERD
ALTER TABLE public.billing_accounts
    ADD COLUMN IF NOT EXISTS customer_id uuid,
    ADD COLUMN IF NOT EXISTS lot_name varchar(255),
    ADD COLUMN IF NOT EXISTS plate_number varchar(30);

-- 2. Đánh chỉ mục (Index) hỗ trợ tra cứu nhanh lịch sử thanh toán theo khách hàng
CREATE INDEX IF NOT EXISTS ix_billing_accounts_customer_id 
    ON public.billing_accounts(customer_id) 
    WHERE customer_id IS NOT NULL;

-- 3. Ghi nhận phiên bản Schema Version 2 vào bảng service_schema_versions
DO $migration$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.service_schema_versions WHERE version = 2) THEN
        INSERT INTO public.service_schema_versions(version, applied_at) 
        VALUES (2, now());
    END IF;
END
$migration$;

COMMIT;

