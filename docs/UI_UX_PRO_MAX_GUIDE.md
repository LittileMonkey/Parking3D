# HƯỚNG DẪN ÁP DỤNG SKILL UI/UX PRO MAX VÀO CÁC PROMPT FRONTEND

Tài liệu này hướng dẫn cách áp dụng toàn diện tri thức thiết kế và kỹ thuật frontend từ bộ công cụ **UI/UX Pro Max** (`D:\OJT\Skill_FE\ui-ux-pro-max-skill`) vào quá trình lập trình thực tế cho dự án **Smart 3D Parking Management System** cũng như mọi dự án web/mobile khác.

---

## 1. Cơ chế hoạt động của Skill trong Antigravity / Gemini

File kỹ năng chính đã được cài đặt tự động tại:
👉 `d:\OJT\Parking3D\.agents\skills\ui-ux-pro-max\SKILL.md`

Hệ thống AI Assistant (Antigravity) sẽ **tự động kích hoạt skill này** mỗi khi bạn gửi prompt liên quan đến:
- Thiết kế mới trang (Page) hoặc màn hình (Screen).
- Tạo hoặc tái cấu trúc Component (Button, Modal, Card, Table, Drawer,...).
- Đánh giá giao diện (UI/UX Review / Audit).
- Tinh chỉnh bảng màu (Color Palette), kiểu chữ (Typography), hiệu ứng (Animations).
- Tối ưu khả năng tiếp cận (Accessibility WCAG 2.2 AA).
- Tối ưu giao diện Responsive (Mobile 375px -> Desktop 1440px).

---

## 2. Các mẫu Prompt mẫu (Copy & Paste)

### 📌 Mẫu 1: Thiết kế trang mới từ đầu (New Page / Feature)
```text
Áp dụng kỹ năng UI/UX Pro Max, hãy thiết kế màn hình [Tên màn hình, ví dụ: "Dashboard Giám sát Điều hành Bãi xe 3D"]:
1. Phân tích loại sản phẩm và đề xuất Style phù hợp (ví dụ: Glassmorphism / Dark Modern Tech).
2. Thiết lập hệ thống Color Tokens (Primary, Secondary, Accent, Background, Border) và Cặp Font chữ chuẩn từ Google Fonts.
3. Thiết kế đầy đủ các trạng thái giao diện: Default, Hover, Active, Loading (Skeleton), Empty State và Error.
4. Tuân thủ tiêu chuẩn Accessibility: độ tương phản tối thiểu 4.5:1, vòng viền Focus rõ ràng khi duyệt phím Tab, vùng bấm tối thiểu 44x44px.
5. Đối chiếu bảng kiểm tra Pre-Delivery Checklist trước khi trả về mã nguồn.
```

### 📌 Mẫu 2: Review và Nâng cấp thẩm mỹ giao diện có sẵn (UI Polish & Audit)
```text
Dựa trên tiêu chuẩn UI/UX Pro Max, hãy audit và nâng cấp file [Đường dẫn file, ví dụ: src/pages/staff/VehicleOperations.tsx]:
1. Phát hiện và loại bỏ các Anti-patterns (icon emoji, màu sắc không đồng bộ, khoảng cách lộn xộn).
2. Chuẩn hóa hệ thống khoảng cách theo Spacing Scale bội số 4/8px.
3. Thêm micro-interactions và hiệu ứng chuyển đổi mượt mà (chỉ animate transform và opacity, không gây layout shift CLS).
4. Kiểm tra độ tương thích trên thiết bị di động (375px) và Dark Mode.
```

### 📌 Mẫu 3: Xây dựng Component chất lượng cao
```text
Hãy xây dựng component [Tên component, ví dụ: "Modal Xác Nhận Thu Tiền Mặt"] theo chuẩn UI/UX Pro Max:
- Kích thước vùng bấm tối thiểu 44px, nút Hủy và Xác nhận phân cấp thị giác rõ rệt.
- Hỗ trợ đóng bằng phím Escape, click ra ngoài vùng nền (backdrop blur).
- Có bẫy tiêu điểm (Focus trap) và tự động focus vào nút hành động chính khi mở.
- Dùng SVG Lucide Icons (không dùng emoji), số tiền định dạng tabular-nums chống rung lắc.
```

---

## 3. Lệnh tra cứu trực tiếp qua CLI (Offline Search)

Bạn hoặc AI có thể chạy trực tiếp bộ máy tìm kiếm cục bộ bằng lệnh:

```bash
# 1. Sinh trọn bộ Design System cho một nghiệp vụ:
python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "parking operations real-time dashboard" --design-system -p "SmartParking" -f markdown

# 2. Tìm bảng màu phù hợp:
python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "dark tech analytics" --domain color

# 3. Tra cứu quy chuẩn UX cho một tình huống cụ thể:
python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "modal keyboard focus escape" --domain ux

# 4. Tra cứu tối ưu theo framework (React / Tailwind):
python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "virtualized table performance" --stack react
```

---

## 4. Bảng kiểm tra trước khi bàn giao (Pre-Delivery Checklist)

Mọi code giao diện khi hoàn thành đều cần đạt các tiêu chí sau:

| STT | Hạng mục kiểm tra | Tiêu chuẩn bắt buộc |
| :---: | :--- | :--- |
| 1 | **Biểu tượng (Icons)** | 100% SVG (Lucide / Heroicons). Tuyệt đối **không** dùng Emoji làm icon hệ thống. |
| 2 | **Con trỏ (Cursor)** | Luôn có `cursor: pointer` trên tất cả các phần tử click được (Web). |
| 3 | **Độ tương phản (Contrast)** | Tối thiểu **4.5:1** cho văn bản thường, **3:1** cho icon và văn bản lớn (đạt chuẩn WCAG 2.2 AA). |
| 4 | **Bàn phím (Keyboard/Focus)** | Điều hướng mượt mà bằng phím `Tab`, có viền `focus-visible` (2-4px), đóng modal bằng `Esc`. |
| 5 | **Vùng chạm (Hitbox)** | Tối thiểu **44x44px** (iOS) hoặc **48x48dp** (Android) trên màn hình cảm ứng. |
| 6 | **Responsive** | Hiển thị hoàn hảo không vỡ layout tại: 375px (Mobile), 768px (Tablet), 1024px (Laptop), 1440px (Desktop). |
| 7 | **Ổn định Layout (CLS = 0)** | Khung ảnh, video, dữ liệu tải chậm phải có `aspect-ratio` hoặc Skeleton Placeholder giữ chỗ trước. |
| 8 | **Hiệu năng hoạt ảnh** | Chỉ animate thuộc tính `transform` và `opacity`. Tôn trọng `prefers-reduced-motion`. |
