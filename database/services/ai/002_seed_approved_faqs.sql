-- ============================================================================
-- ParkMatrix AI Service - Seed Data: Approved Public FAQ Documents
-- Seed tài liệu tri thức công khai đã duyệt cho toàn hệ thống (lot_id IS NULL)
-- ============================================================================

INSERT INTO public.assistant_documents (
    id,
    lot_id,
    document_key,
    revision,
    title,
    language,
    visibility,
    status,
    source_reference,
    approved_by,
    published_at,
    effective_from,
    effective_until,
    created_at,
    updated_at,
    version
) VALUES
(
    'a0000001-0000-0000-0000-000000000001'::uuid,
    NULL,
    'DOC-FAQ-BOOKING-01',
    1,
    'Hướng dẫn quy trình đặt chỗ đỗ xe trực tuyến qua Sơ đồ số 3D (Digital Twin)',
    'vi',
    'PUBLIC',
    'PUBLISHED',
    'Quy chế Vận hành Nền tảng Đa bãi đỗ ParkMatrix (Baseline V4)',
    '00000000-0000-0000-0000-000000000001'::uuid,
    now() - interval '30 days',
    now() - interval '30 days',
    NULL,
    now() - interval '30 days',
    now() - interval '30 days',
    1
),
(
    'a0000002-0000-0000-0000-000000000002'::uuid,
    NULL,
    'DOC-FAQ-HOLD-02',
    1,
    'Chính sách giữ chỗ tạm thời (Hold) và thời hạn thanh toán',
    'vi',
    'PUBLIC',
    'PUBLISHED',
    'Quy tắc Nghiệp vụ Chống Overbooking & Hold Slot SCRUM-100',
    '00000000-0000-0000-0000-000000000001'::uuid,
    now() - interval '30 days',
    now() - interval '30 days',
    NULL,
    now() - interval '30 days',
    now() - interval '30 days',
    1
),
(
    'a0000003-0000-0000-0000-000000000003'::uuid,
    NULL,
    'DOC-FAQ-PAYMENT-03',
    1,
    'Quy định các phương thức thanh toán VNPay và tiền mặt tại bãi',
    'vi',
    'PUBLIC',
    'PUBLISHED',
    'Chính sách Cổng Thanh toán Đa kênh ParkMatrix Payment Service',
    '00000000-0000-0000-0000-000000000001'::uuid,
    now() - interval '30 days',
    now() - interval '30 days',
    NULL,
    now() - interval '30 days',
    now() - interval '30 days',
    1
)
ON CONFLICT (lot_id, document_key, revision) DO UPDATE SET
    title = EXCLUDED.title,
    status = EXCLUDED.status,
    updated_at = now();

-- Chunks cho DOC-FAQ-BOOKING-01
INSERT INTO public.assistant_document_chunks (
    id,
    document_id,
    chunk_index,
    section_title,
    content,
    created_at,
    updated_at,
    version
) VALUES
(
    'b0000001-0000-0000-0000-000000000001'::uuid,
    'a0000001-0000-0000-0000-000000000001'::uuid,
    0,
    'Quy trình đặt chỗ đỗ xe 3 bước thông minh',
    'Khách hàng đặt chỗ đỗ xe trên ParkMatrix qua 3 bước: 1. Tìm kiếm bãi đỗ thông minh theo vị trí Gần nhất (NEAREST GPS Haversine) hoặc Tiết kiệm nhất (CHEAPEST). 2. Chọn vị trí đỗ trực quan trên Sơ đồ số 3D Digital Twin theo tầng (B1, B2, B3, Ngoài trời) và khu vực (Zone A, B, C, Trụ sạc EV). Hỗ trợ chọn chính xác ô đỗ (EXACT_SLOT) hoặc tự động gán vị trí tối ưu (AUTO_SLOT). 3. Nhập biển số xe và bấm Xác nhận đặt chỗ. Hệ thống kích hoạt khóa độc quyền Time-Window Overlap Guard chống trùng lịch.',
    now() - interval '30 days',
    now() - interval '30 days',
    1
)
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now();

-- Chunks cho DOC-FAQ-HOLD-02
INSERT INTO public.assistant_document_chunks (
    id,
    document_id,
    chunk_index,
    section_title,
    content,
    created_at,
    updated_at,
    version
) VALUES
(
    'b0000002-0000-0000-0000-000000000002'::uuid,
    'a0000002-0000-0000-0000-000000000002'::uuid,
    0,
    'Thời gian giữ chỗ tạm thời (Hold Period)',
    'Khi bấm xác nhận đặt chỗ, vị trí đỗ được tạm giữ (trạng thái HELD) trong 5 phút mặc định (theo cấu hình chính sách bãi đỗ SCRUM-100). Màn hình hiển thị đồng hồ đếm ngược trực tiếp. Nếu quá 5 phút mà chưa hoàn tất thanh toán, hệ thống tự động giải phóng ô đỗ về trạng thái AVAILABLE. Sau khi thanh toán thành công, chỗ đỗ được bảo lưu an toàn 100% cho toàn bộ khung giờ bạn đã đăng ký.',
    now() - interval '30 days',
    now() - interval '30 days',
    1
)
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now();

-- Chunks cho DOC-FAQ-PAYMENT-03
INSERT INTO public.assistant_document_chunks (
    id,
    document_id,
    chunk_index,
    section_title,
    content,
    created_at,
    updated_at,
    version
) VALUES
(
    'b0000003-0000-0000-0000-000000000003'::uuid,
    'a0000003-0000-0000-0000-000000000003'::uuid,
    0,
    'Các phương thức thanh toán được hỗ trợ',
    'ParkMatrix hỗ trợ các phương thức thanh toán: 1. Cổng thanh toán trực tuyến VNPay / QR Code (Mobile Banking, VNPay, MoMo, ZaloPay, Viettel Money). 2. Thanh toán tiền mặt (CASH) trực tiếp cho nhân viên kiểm soát tại bốt an ninh cổng vào/cổng ra. 3. Thẻ thành viên / Vé tháng trả trước tự động nhận diện biển số qua camera AI LPR (ANPR) 4K tại barrier không cần dừng xe.',
    now() - interval '30 days',
    now() - interval '30 days',
    1
)
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
    content = EXCLUDED.content,
    updated_at = now();
