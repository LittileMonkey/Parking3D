# SMART 3D PARKING MANAGEMENT SYSTEM — BACKEND (CLEAN ARCHITECTURE)

Khu vực mã nguồn Backend cho dự án **Smart 3D Parking Management System (Baseline V4 - Multi-Parking Platform)**.

---

## 1. Cấu Trúc Thư Mục Chuẩn (Clean Architecture Structure)

Mã nguồn được phân tách rõ ràng theo các tầng kiến trúc tại thư mục `src/`:

```text
backend_parking_system/
├── src/
│   ├── Core/
│   │   ├── Domain/                 # Thực thể (Entities), Enums, Aggregates, Domain Exceptions
│   │   └── Application/            # Use Cases, CQRS/Services, Interfaces, DTOs, Mapping
│   ├── Infrastructure/
│   │   └── Persistence/            # EF Core DbContext, Migrations, Repositories, Advisory Lock
│   └── Presentation/
│       └── WebApi/                 # ASP.NET Core Web API Controllers, Filters, Middlewares, Hubs
├── .gitignore                      # Cấu hình bỏ qua bin/, obj/, user secrets...
└── README.md                       # Hướng dẫn kiến trúc & quy chuẩn backend
```

---

## 2. Quy Định Phát Triển Cho Thành Viên Nhóm

1. **Tuân thủ quy chuẩn tài liệu `docs/`:**
   - Tra cứu chi tiết tại:
     - [02-BUSINESS-RULES.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/02-BUSINESS-RULES.md) (Quy tắc nghiệp vụ: Hold, Overlap, Pricing)
     - [03-ARCHITECTURE.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/03-ARCHITECTURE.md) (Kiến trúc phân lớp & Concurrency)
     - [04-DATABASE.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/04-DATABASE.md) (PostgreSQL Schema & Triggers)
     - [05-API.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/05-API.md) (Chuẩn Envelope `ApiResponse<T>`)
     - [06-CODING-STANDARDS.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/06-CODING-STANDARDS.md) (Tiêu chuẩn C# 13, .NET, async/await)
2. **Quy chuẩn tạo nhánh & đẩy code:**
   - Khi làm chức năng mới, tạo nhánh từ `dev`:
     - Nhánh thiết kế: `features/Design_<UserStoryName>`
     - Nhánh code: `features/Implementation_<UserStoryName>`
   - Đẩy lên GitHub (`origin`) để lưu vết và test nội bộ -> Pull rebase từ `gitlab/dev` -> Tạo PR vào `dev` trên GitLab theo mẫu tại [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/GitlabGuide.md).
