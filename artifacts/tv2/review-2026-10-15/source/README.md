# Smart Multi-Parking — Microservices

Backend .NET 9 / C# 13, PostgreSQL và gRPC. Identity, Parking, Payment, AI chạy riêng, mỗi service sở hữu database riêng. Frontend gọi REST Gateway; service gọi nhau qua gRPC.

```text
src/
  Gateway/Parking.Gateway/
  Services/
    Identity/
    Parking/
    Payment/
    AI/
      # Mỗi service: Api / Application / Domain / Infrastructure
  Contracts/Parking.Contracts/        # .proto v1
  BuildingBlocks/                      # JWT, envelope, health, gRPC security
 database/services/                   # Schema riêng, fixture demo tùy chọn
 deploy/docker/
 scripts/microservices/
 tests/
 docs/microservices/
 legacy/                              # Template MyStore cũ để tham khảo
 frontend_parking_system/             # Hiện chỉ có tài liệu
 compose.microservices.yml
 Parking.Microservices.slnx
```

Xem [RUNBOOK](docs/microservices/RUNBOOK.md) để chạy, [kiến trúc](docs/microservices/ARCHITECTURE.md), [API contracts](docs/microservices/API-CONTRACTS.md), [kết quả kiểm thử](docs/microservices/VALIDATION.md) và [phần còn thiếu](docs/microservices/IMPLEMENTATION-STATUS.md).

Đã triển khai đăng nhập, quyền theo bãi, đặt chỗ chống trùng, xác nhận tiền mặt → outbox → gRPC → booking, OCR adapter, dự báo thống kê và FAQ đã duyệt. OCR kiểm thử dùng test double; chưa chứng minh độ chính xác thực tế.

QR/check-in/check-out, VNPay sandbox thực tế, giao diện 3D và đánh giá AI vẫn là backlog. Chưa xác nhận chạy Docker/pipeline trên môi trường đích. Khóa dùng chung chỉ dành cho Development; yêu cầu production nằm trong RUNBOOK.

Baseline nghiệp vụ nằm trong docs; thiết kế microservices bổ sung cách triển khai. Runtime mới sử dụng database/services. Không commit .env, mật khẩu, dữ liệu cá nhân hoặc docs/templates.
