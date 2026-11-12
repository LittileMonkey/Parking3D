# HƯỚNG DẪN QUẢN LÝ MÃ NGUỒN GITLAB & PULL REQUEST (GITLAB GUIDE)

**Tài liệu:** Git Lab & Pull Request Guide  
**Phiên bản:** 1.0  
**Tác giả:** HauNK  
**Mục đích:** Quy định quy trình quản lý task trên GitLab/GitHub Issue Board, chiến lược phân nhánh Git (Branching Strategy), tiêu chuẩn Commit và mẫu chuẩn tạo Pull Request (PR) cho dự án.

---

## 1. Giới Thiệu (Introduction)
Tài liệu này hướng dẫn cách sử dụng GitLab/GitHub Issue Board, quy chuẩn đặt tên nhánh, viết commit chất lượng và sử dụng mẫu (template) chuẩn khi tạo Pull Request nhằm đảm bảo chất lượng mã nguồn và tính minh bạch trong quá trình phát triển.

---

## 2. Quản Lý Công Việc trên Issue Board (GitLab / GitHub Issue Board)

### 2.1. Đặt Điểm Effort (Labels)
- Labels được sử dụng để ước tính điểm nỗ lực (Story Points theo chuỗi Fibonacci): **1, 2, 3, 5, 8, 13 points**.
- Điểm càng cao, mức độ phức tạp và thời gian cần để hoàn thành task càng lớn.
- **Thao tác:** *Manage -> Labels -> New label -> Điền số điểm vào ô Title -> Create label*.

### 2.2. Tạo Milestones (Sprints)
- Mỗi Milestone đại diện cho một **Sprint** trong dự án, có ngày bắt đầu (`Start Date`) và ngày kết thúc (`End Date`).
- **Thao tác:** *Plan -> Milestones -> New milestone -> Điền tên Sprint, Start Date, End Date -> Create milestone*.

### 2.3. Tạo User Story / Issue
- Mỗi Issue là một User Story cần hoàn thành trong Sprint. Để hoàn thành một Issue, lập trình viên cần hoàn tất tất cả các Sub-tasks liên quan.
- **Các trường bắt buộc:**
  - **Title:** Tên của User Story / Tính năng.
  - **Assignee:** Người chịu trách nhiệm chính.
  - **Labels:** Gán một nhãn điểm effort đã tạo (1, 2, 3, 5, 8, 13).
  - **Milestone:** Chọn đúng Sprint đang thực thi.
- **Thao tác:** *Plan -> Issues -> New issue -> Điền thông tin -> Create issue*.

### 2.4. Tạo Child Tasks (Sub-tasks)
- Chọn Issue cần phân tách công việc.
- Bấm **Add Task**, điền thông tin chi tiết công việc kỹ thuật cần làm và bấm **Create Task**.

---

## 3. Chiến Lược Quản Lý Nhánh (Git Branching Strategy)

### 3.1. Các Nhánh Chính và Vai Trò
- **`main` / `master` Branch:** Nhánh sản phẩm chính thức. Chỉ merge các tính năng đã qua kiểm thử nghiệm thu hoàn chỉnh, thường được merge từ `release` branch.
- **`develop` Branch:** Nhánh phát triển chung của toàn đội ngũ. Nhận mã nguồn được merge từ các nhánh `features` và `hotfix`.
- **`features` Branch:** Nhánh phát triển tính năng mới. Sau khi hoàn thành và vượt qua review, nhánh này được merge vào `develop`.
- **`hotfix` Branch:** Nhánh dùng để sửa các lỗi nghiêm trọng (Critical Bugs) phát sinh. Sau khi test local thành công, merge đồng thời vào cả `main` và `develop`.
- **`release` Branch:** Nhánh đóng gói tính năng chuẩn bị demo/bàn giao sau mỗi Sprint, được tạo từ `develop` (bắt buộc kèm theo Release Notes).

### 3.2. Quy Tắc Đặt Tên Nhánh (Branch Naming Rule)

#### 3.2.1. Feature Branch (Phân Tách Thành 2 Nhánh Bắt Buộc)
Khi phát triển một User Story mới, lập trình viên **BẮT BUỘC** tạo 2 nhánh riêng biệt:
1. **Nhánh Thiết kế (Design Branch):**
   - Tên nhánh: `features/Design_<UserStoryName>`
   - **Front-End:** Phải chứa thiết kế Figma hoặc Prototype UI.
   - **Back-End:** Phải chứa tài liệu Thiết kế API (theo chuẩn `APIDesignTemplate.md`, gồm Request/Response, Activity Diagram, Sequence Diagram).
2. **Nhánh Triển khai (Implementation Branch):**
   - Tên nhánh: `features/Implementation_<UserStoryName>`
   - Dùng để viết mã nguồn thực thi chức năng, unit tests và integration tests.

#### 3.2.2. Hotfix Branch
- Tên nhánh: `hotfix/Bug_<UserStoryName>`
- Dùng để khắc phục lỗi và kiểm thử cục bộ trước khi merge.

#### 3.2.3. Release Branch
- Tên nhánh: `release/sprint_<x>` (với `x` là số thứ tự của Sprint).
- Ví dụ Sprint 1: `release/sprint_1`.

---

## 4. Tiêu Chuẩn Commit Mã Nguồn (Commit Quality)

### 4.1. Tại sao Cần Commit Chất lượng?
- Dễ dàng tra cứu và hiểu rõ lịch sử thay đổi mã nguồn.
- Hỗ trợ quá trình Code Review và rà soát lỗi (Debugging) nhanh chóng.
- Tự động hóa quá trình sinh Changelog và Release Notes.
- Nâng cao tính chuyên nghiệp và sự phối hợp nhịp nhàng trong nhóm.

### 4.2. Quy Tắc Viết Commit
- Nội dung commit phải rõ ràng, ngắn gọn và mô tả chính xác nội dung thay đổi.
- **TUYỆT ĐỐI TRÁNH:** Commit nội dung mơ hồ như *"Update"*, *"Fix bug"*, *"Edit"* mà không nói rõ sửa gì.
- **Nguyên tắc Nguyên tử (Atomic Commit):** Mỗi commit chỉ tập trung vào một nội dung duy nhất: Add Feature, Fix Bug, Refactor, Document... Không gom nhiều việc không liên quan vào cùng một commit.

---

## 5. Mẫu Chuẩn Tạo Pull Request (Pull Request Templates)

Khi tạo Pull Request (PR) để merge vào `develop`, lập trình viên phải sao chép mẫu tương ứng dưới đây và điền đầy đủ thông tin:

### 5.1. Mẫu PR Triển Khai Code (Implementation Format)

```markdown
### **Definition of Done (DoD)**
- [ ] Tính năng hoạt động đúng như mong đợi và đã vượt qua kiểm thử thủ công (manual test)
- [ ] Mã nguồn tuân thủ coding conventions của dự án và không có cảnh báo linter
- [ ] Đã viết Unit Tests / Integration Tests và tất cả tests đều PASS
- [ ] Không chứa thông tin nhạy cảm, mật khẩu hoặc connection string hardcoded
- [ ] Tính năng đã được cập nhật tài liệu (README, API docs)
- [ ] Quy trình CI/CD build và test thành công
- [ ] Mã nguồn đã được review và phê duyệt bởi thành viên trong nhóm

---
### **Review Checklist**
- [ ] PR đã được liên kết với Task / Issue tương ứng trên Issue Board
- [ ] Tiêu đề PR tuân thủ quy ước: [Feature] / [Fix] / [Refactor] / [Docs]...
- [ ] Cấu trúc code dạng module và tuân thủ các nguyên tắc SOLID
- [ ] Xử lý ngoại lệ đầy đủ và bao quát các trường hợp biên (Edge Cases)
- [ ] Định dạng phản hồi API nhất quán và đúng tài liệu đặc tả
- [ ] Lịch sử Git sạch sẽ (không có commit debug tạm bợ, thông điệp rõ ràng)
- [ ] Đã dọn sạch code thừa, comment rác và `console.log` / `Debug.WriteLine`
- [ ] Tính năng mới tích hợp mượt mà và không làm phá vỡ các luồng hiện tại

---
### **Test Coverage**
- **Unit Tests:** (Ghi rõ số lượng test cases hoặc đính kèm báo cáo coverage)
- **Manual Test Results:** (Chèn ảnh chụp màn hình kiểm thử hoặc log minh chứng)

---
### **Change Description**
- **Liên kết nhánh Thiết kế (Design PR):** [Chèn link PR của nhánh Design tương ứng]
- **Mô tả chi tiết các thay đổi:**
  - ...
  - ...

---
### **Related Tasks / Issues**
- **Issue Link:** [Chèn link Issue trên GitLab/GitHub]
```

---

### 5.2. Mẫu PR Thiết Kế (Design Format)

```markdown
### **Definition of Done (DoD)**
- [ ] Thiết kế đáp ứng đầy đủ yêu cầu nghiệp vụ và kỹ thuật của User Story
- [ ] Đã bao quát toàn bộ màn hình / components / endpoints liên quan
- [ ] Cấu trúc và quy ước đặt tên nhất quán
- [ ] Thiết kế đã được review và thống nhất bởi các bên liên quan
- [ ] File Figma hoặc tài liệu đặc tả API đã được chia sẻ và cấp quyền truy cập
- [ ] Đã tiếp thu và điều chỉnh theo các phản hồi từ buổi review trước

---
### **Review Checklist**
- [ ] Đã liên kết hoặc nhúng đầy đủ tài nguyên thiết kế
- [ ] Thiết kế tuân thủ Brand Guidelines / Design System của dự án
- [ ] Luồng trải nghiệm người dùng (UX Flow) logic, trực quan
- [ ] Tài liệu API bao gồm đầy đủ ví dụ Request/Response và Error cases
- [ ] Không bỏ sót các trạng thái giao diện: Loading, Error, Empty State, Hover/Active
- [ ] Giao diện đã tính toán hiển thị Responsive (Mobile / Tablet / Desktop)

---
### **Change Description**
*PR này bao gồm các tài liệu bàn giao thiết kế cho tính năng:*
- [ ] Đặc tả API (OpenAPI / Swagger / Markdown theo APIDesignTemplate)
- [ ] Thiết kế giao diện UI Mockup / Wireframe trên Figma
- [ ] Sơ đồ luồng UX Flow / Activity Diagram / Sequence Diagram
- [ ] Bố cục Component và thiết kế tương tác

---
### **Attachments / Links**
- **Figma Design:** `https://www.figma.com/file/...`
- **API Docs / Markdown:** `[Link tài liệu thiết kế]`
- **Diagrams:** (Chèn link hoặc ảnh sơ đồ Sequence/Activity)

---
### **Related Tasks / Issues**
- **Issue Link:** [Chèn link Issue tương ứng]
```

---

## 6. Quy Trình Sử Dụng Song Song GitHub & GitLab Cho Cả Nhóm (Team Dual-Remote Workflow)

Dự án áp dụng mô hình phát triển song song giữa **GitHub Team Repository** (nơi cả nhóm phát triển, tích hợp liên tục và review nội bộ) và **GitLab FPT Academy Repository** (`https://git.fsoft-academy.edu.vn/hcm26_cpl_net_06/team-02/parking-system-group2.git` - nơi chốt, confirm mã nguồn chính thức để Mentor đánh giá).

Trên cả **GitHub** và **GitLab**, hệ thống nhánh đều đã được phân định rõ ràng, độc lập tuyệt đối theo từng chức năng (`features/Design_...` và `features/Implementation_...`) nhằm phục vụ việc kiểm soát tiến độ, cô lập lỗi và làm minh bạch luồng mã nguồn.

```text
               +------------------------------------------------+
               |        Local Working Copy (Thành viên nhóm)     |
               +-----------------------+------------------------+
                                       |
                   (1) Phát triển trên nhánh chức năng độc lập
                   -> Commit & Push thường xuyên lên GitHub Team
                                       v
               +------------------------------------------------+
               |             GitHub Team Repository             |
               |     (Nơi cả nhóm sync, test, review nội bộ)     |
               +-----------------------+------------------------+
                                       |
                   (2) Khi hoàn thiện tính năng & trước khi nộp
                   -> Fetch nhánh develop từ GitLab & Rebase
                                       v
               +------------------------------------------------+
               |          Giải quyết triệt để mọi xung đột      |
               |                (Conflicts) tại Local           |
               +-----------------------+------------------------+
                                       |
                   (3) Kiểm tra Build, Unit Tests PASS 100%
                   -> Push nhánh lên GitLab FPT Academy
                                       v
               +------------------------------------------------+
               |       GitLab Team Repository (team-02)         |
               |      (Confirm mã nguồn chính thức & Mở PR)     |
               +------------------------------------------------+
```

### 6.1. Thiết Lập 2 Remote Trên Máy Của Từng Thành Viên
```powershell
# 1. Remote GitLab chính thức của nhóm tại FPT Academy
git remote add gitlab https://git.fsoft-academy.edu.vn/hcm26_cpl_net_06/team-02/parking-system-group2.git

# 2. Remote GitHub chung của cả nhóm (dùng 'origin' hoặc 'github')
git remote add origin https://github.com/<team-repo>/<repo-name>.git

# Kiểm tra danh sách remote
git remote -v
```

### 6.2. Các Bước Làm Việc Chuẩn Cho Thành Viên Nhóm
1. **Làm việc trên nhánh chức năng độc lập & Lưu vết lên GitHub:**
   ```powershell
   # Tạo và chuyển sang nhánh chức năng riêng biệt (Design hoặc Implementation)
   git checkout -b features/Implementation_NearestSearch develop

   # Viết code và commit theo nguyên tắc nguyên tử (Atomic Commit)
   git commit -m "feat: implement Haversine distance calculator"

   # Đẩy lên GitHub Team Repo để đồng bộ với các thành viên khác
   git push origin features/Implementation_NearestSearch
   ```
2. **Đồng bộ và xử lý Conflict trước khi đưa lên GitLab:**
   ```powershell
   # Kéo mã nguồn mới nhất từ nhánh develop của GitLab
   git fetch gitlab develop
   git rebase gitlab/develop

   # Nếu phát sinh conflict:
   # - Mở các file bị conflict, thảo luận với thành viên liên quan và resolve
   # - git add <file-da-resolve>
   # - git rebase --continue
   ```
3. **Kiểm thử và đẩy lên GitLab để mở Pull Request chính thức:**
   ```powershell
   # Chạy test đảm bảo không làm gãy luồng hiện có
   dotnet test

   # Đẩy nhánh lên GitLab
   git push gitlab features/Implementation_NearestSearch

   # Truy cập giao diện GitLab tạo Pull Request vào nhánh develop theo đúng template mục 5
   ```


