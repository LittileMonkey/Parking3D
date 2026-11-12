# HƯỚNG DẪN DÀNH CHO AI AGENTS & LẬP TRÌNH VIÊN (AGENTS.MD)

Chào mừng bạn (hoặc AI Assistant) tham gia phát triển dự án **Smart 3D Parking Management System (Baseline V4 - Multi-Parking Platform)**. Đây là tài liệu quy định nguyên tắc làm việc, kiến trúc, quy chuẩn thiết kế API và quy trình quản lý mã nguồn Git.

---

## 1. Nguồn Chân lý & Tra cứu Tài liệu (Single Source of Truth)
Mọi quy tắc nghiệp vụ, quyết định kiến trúc và quy chuẩn phát triển đã được biên soạn đầy đủ trong thư mục `docs/`. Khi tiếp nhận bất kỳ yêu cầu nào, bạn **BẮT BUỘC** phải tra cứu các tài liệu liên quan trước khi sinh mã:
- **Baseline V4 chuẩn:** [Parking_OJT_FA26_Baseline_V4_Multi_Parking.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/Parking_OJT_FA26_Baseline_V4_Multi_Parking.md)
- **Quy chuẩn Thiết kế API:** [APIDesignTemplate.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/APIDesignTemplate.md)
- **Quy trình Git & Pull Request:** [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/GitlabGuide.md)
- Tổng quan hệ thống & Multi-Lot: [00-PROJECT-OVERVIEW.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/00-PROJECT-OVERVIEW.md)
- Yêu cầu chức năng & phi chức năng: [01-REQUIREMENTS.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/01-REQUIREMENTS.md)
- Quy tắc nghiệp vụ (Time overlap, Hold, Multi-lot, Pricing): [02-BUSINESS-RULES.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/02-BUSINESS-RULES.md)
- Sơ đồ kiến trúc & Concurrency design: [03-ARCHITECTURE.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/03-ARCHITECTURE.md)
- CSDL PostgreSQL, DDL & Triggers: [04-DATABASE.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/04-DATABASE.md)
- Đặc tả API contracts & status codes: [05-API.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/05-API.md)
- Tiêu chuẩn code C# 13, .NET 9 & DTOs: [06-CODING-STANDARDS.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/06-CODING-STANDARDS.md)
- Hướng dẫn chạy và cấu hình môi trường: [07-DEVELOPMENT.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/07-DEVELOPMENT.md)
- Các quyết định kiến trúc quan trọng (ADRs): [08-DECISIONS.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/08-DECISIONS.md)
- Danh mục công việc & Roadmap phát triển: [09-TODO.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/09-TODO.md)

---

## 2. Nguyên tắc Bất biến (Core Invariants)

1. **Multi-Parking Lot First (Không Hard-code một bãi 3 tầng):**
   - Hệ thống là nền tảng quản lý **nhiều bãi đỗ xe** (`ParkingLot`), mỗi bãi có cấu trúc tầng (`ParkingLevel`), khu vực (`Zone`), vị trí (`ParkingSlot`), biểu giá (`PricingPlan`) và giờ vận hành riêng biệt.
2. **Quy chuẩn Phản hồi API Chuẩn hóa (Standard Envelope theo APIDesignTemplate):**
   - Mọi response API bắt buộc phải bọc trong cấu trúc chuẩn:
     `{ "result": ..., "isSuccess": true/false, "statusCode": 200/400, "message": "..." }`.
   - Mỗi endpoint mới phải có đầy đủ: Request/Response samples, Activity Diagram, và Sequence Diagram.
3. **Chiến lược Song song Dual-Remote Nhóm (GitHub Team Sync -> GitLab Team Official):**
   - Cả **GitHub** và **GitLab** đều là repository dùng chung cho **TOÀN BỘ TEAM**, trong đó:
     - **GitHub Team Repo:** Nơi cả nhóm đồng bộ hàng ngày, lưu vết phát triển và tích hợp liên tục giữa các thành viên.
     - **GitLab FPT Academy Repo (`team-02`):** Nơi chốt, confirm mã nguồn chính thức để Mentor đánh giá và nghiệm thu.
   - Trên cả 2 nền tảng, hệ thống nhánh đã được phân tách rõ ràng và độc lập tuyệt đối theo từng chức năng và User Story (`features/Design_...` và `features/Implementation_...`).
   - **Quy tắc đẩy mã nguồn:**
     1. Mọi thành viên làm việc trên nhánh tính năng riêng, commit và push lên GitHub Team Repo trước để cập nhật tiến độ nhóm.
     2. Trước khi đưa lên GitLab, bắt buộc phải fetch/pull từ nhánh `develop` của GitLab về local để rebase, giải quyết triệt để mọi conflict và chạy toàn bộ unit tests.
     3. Đảm bảo mã nguồn chạy ổn định rồi mới push lên GitLab để tạo Pull Request chính thức.
4. **Quy trình Phân nhánh Git Kép (Branching Strategy theo GitlabGuide):**
   - Mỗi User Story bắt buộc triển khai qua **2 nhánh riêng biệt**:
     - `features/Design_<UserStoryName>`: Thiết kế Figma UI (FE) hoặc API Design & Diagram (BE).
     - `features/Implementation_<UserStoryName>`: Mã nguồn thực thi và Unit/Integration Tests.
   - Nhánh `main` chỉ nhận từ `release/sprint_<x>`. Nhánh `develop` nhận từ `features/` và `hotfix/Bug_<UserStoryName>`.
   - Mọi Pull Request phải tuân thủ nghiêm ngặt **Definition of Done (DoD)** và **Review Checklist**.
5. **Chống Overbooking & Đặt chỗ trùng dải thời gian (Time-Window Overlap Guard):**
   - Mọi thao tác ghi hoặc thay đổi trạng thái slot phải được bảo vệ bằng giao dịch database và **PostgreSQL Advisory Lock** (`pg_advisory_xact_lock`).
   - Kiểm tra chống trùng lịch dựa trên dải thời gian (`tstzrange` overlap). Ràng buộc GiST exclusion constraints là bất biến.
6. **Phân quyền theo phạm vi cơ sở (Facility-Scoped RBAC):**
   - `PARKING_STAFF` và `PARKING_MANAGER` chỉ có quyền thao tác trên các bãi đỗ được gán (`FacilityStaffAssignment`).
7. **Thuật toán Tìm bãi thông minh (Smart Search):**
   - `NEAREST`: Sử dụng công thức Haversine tính toán khoảng cách đường chim bay dựa trên GPS (lat/long).
   - `CHEAPEST`: Phải tính toán toàn bộ chi phí dự kiến (`EstimatedPriceService`) cho toàn bộ thời lượng khách dự kiến gửi (`expectedDuration`), áp dụng block tính phí (default 15 phút), daily cap, peak multiplier của từng bãi.
8. **Cơ chế Giữ chỗ & Giải phóng Slot thực tế:**
   - Hold time mặc định theo SRS mentor là 15 phút. Slot chỉ chuyển về `Available` khi xe vật lý thực sự rời bãi (xác nhận bởi barrier/camera hoặc Staff).
9. **Bảo vệ dữ liệu nhạy cảm & DTO Separation:**
   - Không được trả số điện thoại, biển số xe đầy đủ, hoặc `AuditLogs` qua các API công khai cho Guest. Không nhận hoặc trả trực tiếp Entity qua API.
10. **Git & Repository Hygiene:**
   - Thư mục `docs/templates/` là nơi chứa template tham khảo và **phải luôn nằm trong `.gitignore`**. Không commit secrets hay mật khẩu thật.

---

## 3. Quy trình Thực hiện Nhiệm vụ (Workflow for Agents & Developers)
1. **Thiết kế trước (Design Phase):**
   - Tạo nhánh `features/Design_<UserStoryName>` từ `develop`.
   - Lập tài liệu đặc tả API theo mẫu [APIDesignTemplate.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/APIDesignTemplate.md) (Request, Response, Error Codes, Activity Diagram, Sequence Diagram).
   - Commit & push lên GitHub Team Repo trước -> Đồng bộ / Rebase với GitLab -> Push lên GitLab và tạo Pull Request Design theo mẫu mục 5.2 trong [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/GitlabGuide.md).
2. **Triển khai Mã nguồn (Implementation Phase):**
   - Tạo nhánh `features/Implementation_<UserStoryName>` từ `develop`.
   - Viết code C# 13, async/await đầy đủ, xử lý lỗi chuẩn ProblemDetails bọc trong `ApiResponse<T>`.
   - Viết tests kiểm thử và kiểm tra API readiness `/health/ready`.
   - Commit & push lên GitHub Team Repo trước -> Pull `develop` từ GitLab về rebase giải quyết mọi conflict -> Push GitLab -> Tạo Pull Request Implementation kèm DoD và Test Coverage theo mẫu mục 5.1 trong [GitlabGuide.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/Project.CleanArchitecture/docs/GitlabGuide.md).
