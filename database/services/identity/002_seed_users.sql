-- =============================================================================
-- SCRIPT TẠO DỮ LIỆU MẪU 3 NGƯỜI DÙNG CHO CƠ SỞ DỮ LIỆU IDENTITY (DATABASE: parking_identity)
-- =============================================================================
-- 1. Khách hàng (Customer)  : customer01@parking3d.com / Password@123
-- 2. Nhân viên bãi (Staff) : staff01@parking3d.com    / Password@123 (Gán vào Bãi DEMO-A)
-- 3. Quản trị viên (Admin) : admin01@parking3d.com    / Password@123
-- =============================================================================

BEGIN;

-- 1. XÓA DỮ LIỆU CŨ NẾU ĐÃ TỒN TẠI ĐỂ TRÁNH LỖI UNIQUE CONFLICT
DELETE FROM public.lot_staff_assignments 
WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111', 
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333333'
);

DELETE FROM public.platform_user_roles 
WHERE user_id IN (
    '11111111-1111-1111-1111-111111111111', 
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333333'
);

DELETE FROM public.app_users 
WHERE id IN (
    '11111111-1111-1111-1111-111111111111', 
    '22222222-2222-2222-2222-222222222222', 
    '33333333-3333-3333-3333-333333333333'
)
OR email_normalized IN (
    'customer01@parking3d.com', 
    'staff01@parking3d.com', 
    'admin01@parking3d.com'
);

-- 2. TẠO 3 NGƯỜI DÙNG VÀO BẢNG app_users
-- Mật khẩu hash tương ứng với chuỗi: Password@123
INSERT INTO public.app_users (
    id,
    email_normalized,
    phone_e164,
    full_name,
    password_hash,
    email_verified_at,
    phone_verified_at,
    status,
    created_at,
    updated_at
) VALUES
-- User 1: Khách hàng (Customer) dùng để đặt chỗ và thanh toán
(
    '11111111-1111-1111-1111-111111111111',
    'customer01@parking3d.com',
    '+84901234567',
    'Nguyen Van Khach',
    'AQAAAAIAAYagAAAAEO9lV9s179yP+r7YtBw2CqI3j1q4vLwP1Zg6V1r0vQyN3l+m8P1q2v3w4x5y6z7A8w==',
    now(),
    now(),
    'ACTIVE',
    now(),
    now()
),
-- User 2: Nhân viên trực bãi (Parking Staff) dùng để xác nhận thu tiền mặt CASH
(
    '22222222-2222-2222-2222-222222222222',
    'staff01@parking3d.com',
    '+84902345678',
    'Tran Thi Nhan Vien',
    'AQAAAAIAAYagAAAAEO9lV9s179yP+r7YtBw2CqI3j1q4vLwP1Zg6V1r0vQyN3l+m8P1q2v3w4x5y6z7A8w==',
    now(),
    now(),
    'ACTIVE',
    now(),
    now()
),
-- User 3: Quản trị viên (Admin)
(
    '33333333-3333-3333-3333-333333333333',
    'admin01@parking3d.com',
    '+84903456789',
    'Le Hoang Quan Tri',
    'AQAAAAIAAYagAAAAEO9lV9s179yP+r7YtBw2CqI3j1q4vLwP1Zg6V1r0vQyN3l+m8P1q2v3w4x5y6z7A8w==',
    now(),
    now(),
    'ACTIVE',
    now(),
    now()
);

-- 3. GÁN VAI TRÒ NỀN TẢNG (PLATFORM ROLES)
INSERT INTO public.platform_user_roles (user_id, role_code) VALUES
('11111111-1111-1111-1111-111111111111', 'CUSTOMER'),
('22222222-2222-2222-2222-222222222222', 'PARKING_STAFF'),
('33333333-3333-3333-3333-333333333333', 'ADMIN');

-- 4. PHÂN QUYỀN THEO BÃI ĐỖ (FACILITY-SCOPED RBAC) CHO NHÂN VIÊN
-- Gán nhân viên staff01 vào bãi DEMO-A (Lot ID: 11111111-1111-4111-8111-111111111111)
INSERT INTO public.lot_staff_assignments (
    id,
    lot_id,
    user_id,
    role_code,
    valid_from,
    valid_until,
    can_manage_staff_assignments
) VALUES (
    gen_random_uuid(),
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'PARKING_STAFF',
    now() - interval '1 day',
    now() + interval '365 days',
    false
);

COMMIT;

-- KIỂM TRA LẠI KẾT QUẢ VỪA INSERT:
SELECT u.id, u.email_normalized, u.full_name, u.status, r.role_code 
FROM public.app_users u
JOIN public.platform_user_roles r ON r.user_id = u.id
ORDER BY u.created_at;
