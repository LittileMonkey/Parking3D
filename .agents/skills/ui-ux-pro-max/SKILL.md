---
name: ui-ux-pro-max
description: "UI/UX design intelligence and engineering excellence for web, mobile, and desktop. Use when designing, building, reviewing, or fixing interfaces, components, design systems, accessibility (WCAG 2.2), responsive layouts, typography, color palettes, animations, and stack-specific UI implementation. Integrates 79 UI styles, 192 product reasoning profiles, 74 font pairings, 119 UX guidelines, 25 chart types, and 22 technology stacks."
risk: low
source: local
version: 2.0.0
---

# UI/UX Pro Max Intelligence Skill

Kỹ năng chuyên sâu về **UI/UX Design & Frontend Engineering**, tổng hợp toàn diện tri thức từ bộ công cụ `ui-ux-pro-max-skill` (192 quy tắc suy luận thiết kế, 79 phong cách UI, 192 bảng màu, 74 cặp font Google Fonts, 119 hướng dẫn UX, 17 bộ preset GSAP, 25 loại biểu đồ và 22 tech stacks).

---

## 1. Công cụ tìm kiếm CLI (Search CLI Integration)

Kỹ năng này tích hợp trực tiếp bộ máy tìm kiếm cục bộ không cần internet qua lệnh Python:

```bash
python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "<query>" [options]
```

### Các cờ lệnh chính:
- **Tạo Design System hoàn chỉnh:**
  ```bash
  python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "<mô tả sản phẩm/dự án>" --design-system -p "<Tên Dự Án>" -f markdown
  ```
- **Tùy chỉnh độ biến thiên (Design Dials 1-10):**
  - `--variance <1-10>`: Mức độ phá cách (1: Tối giản/cân đối -> 10: Táo bạo/Bento/Brutalism)
  - `--motion <1-10>`: Mức độ chuyển động (1: Tinh tế/micro -> 10: Hoạt ảnh phức tạp GSAP)
  - `--density <1-10>`: Mật độ hiển thị (1: Thoáng đãng -> 10: Dày đặc/Dashboard)
- **Lưu trữ Design System có cấu trúc:**
  ```bash
  python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "<query>" --design-system --persist -p "<Tên>" --output-dir "<project-root>" [--page "<tên-trang>"]
  ```
- **Tìm kiếm theo Domain chuyên biệt:**
  ```bash
  python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "<từ khóa>" --domain <tên-domain>
  ```
  *Danh sách domains:* `product`, `style`, `color`, `typography`, `landing`, `chart`, `ux`, `gsap`, `react`, `web`, `icons`, `google-fonts`.
- **Tìm kiếm theo Stack công nghệ cụ thể:**
  ```bash
  python "D:/OJT/Skill_FE/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py" "<từ khóa>" --stack <tên-stack>
  ```
  *Danh sách stacks:* `react`, `nextjs`, `vue`, `svelte`, `astro`, `nuxtjs`, `nuxt-ui`, `html-tailwind`, `shadcn`, `swiftui`, `react-native`, `flutter`, `threejs`, `angular`, `laravel`, `wpf`, `winui`, `avalonia`, `uno`.

---

## 2. Quy trình thiết kế & triển khai 4 bước (Standard 4-Step Workflow)

Khi nhận bất kỳ yêu cầu UI/UX nào (tạo trang mới, làm component, audit giao diện, sửa lỗi layout):

### Bước 1: Phân tích bối cảnh sản phẩm (Context Analysis)
- **Loại sản phẩm:** B2B SaaS, Công cụ điều hành (Operations/Dashboard), E-commerce, Mạng xã hội, Y tế/Fintech,...
- **Đối tượng người dùng:** Chuyên viên kỹ thuật (cần mật độ thông tin cao, thao tác nhanh) hay Khách hàng đại chúng (cần tối giản, dễ hiểu).
- **Nền tảng & Stack:** Web desktop, Mobile web, Responsive, React + Tailwind / Vanilla CSS.
- **Tone & Mood:** Đẳng cấp (Luxury/High-tech), Thân thiện, Tối giản (Minimal), Công nghệ tương lai (Cyber/Glassmorphism).

### Bước 2: Sinh Design System & Bảng mã Token chuẩn
- Chạy `--design-system` để lấy:
  - Bố cục trang (Layout Pattern).
  - Phong cách chủ đạo (Style - ví dụ Glassmorphism, Flat Clean, Dark High-Tech).
  - Bảng màu ngữ nghĩa (Semantic Tokens: Primary, Secondary, Background, Card, Border, Status Colors).
  - Cặp Typography (Google Fonts chuẩn cho Heading & Body).
  - Anti-patterns cần tuyệt đối tránh theo ngành.

### Bước 3: Tra cứu sâu các yêu cầu chi tiết (Domain Deep Dives)
- Cần bảng màu chuyên sâu: `--domain color`
- Cần hiệu ứng chuyển động mượt: `--domain gsap`
- Cần bố cục trang đích / Hero: `--domain landing`
- Cần biểu đồ trực quan hóa dữ liệu: `--domain chart`
- Cần quy chuẩn UX / tương tác bàn phím: `--domain ux`

### Bước 4: Triển khai theo Stack & Kiểm chứng với Checklist
- Tận dụng hướng dẫn theo stack (`--stack html-tailwind` hoặc `--stack react`).
- Áp dụng các quy tắc kiểm tra nghiêm ngặt trước khi bàn giao.

---

## 3. Bộ quy tắc vàng UI/UX (Golden UX Reference)

### 1. Khả năng tiếp cận (Accessibility - CRITICAL)
- **Tương phản văn bản (Contrast Ratio):** Văn bản thông thường phải đạt tối thiểu **4.5:1** (WCAG 2.2 AA) trên cả Light Mode và Dark Mode. Văn bản lớn hoặc icon chức năng đạt tối thiểu **3:1**.
- **Không chỉ dùng màu sắc (Color Independence):** Trạng thái lỗi/cảnh báo/thành công bắt buộc phải kèm icon hoặc nhãn chữ; không để người mù màu mất thông tin.
- **Trạng thái Focus (Visible Focus Rings):** Mọi phần tử tương tác (button, input, link) phải có vòng viền focus rõ ràng (2-4px) khi điều hướng bằng phím `Tab`.
- **Nhãn biểu mẫu (Form Labels):** Luôn có thẻ `<label>` liên kết `htmlFor` hoặc `aria-label` cho nút chỉ có icon.
- **Phím Escape & Lối thoát:** Modal, Drawer, Dropdown bắt buộc đóng được bằng phím `Esc` hoặc bấm ra ngoài scrim.
- **Tôn trọng Reduced Motion:** Kiểm tra `prefers-reduced-motion` để giảm hoặc tắt chuyển động cho người dùng nhạy cảm.

### 2. Tương tác & Chạm (Touch & Interaction - CRITICAL)
- **Kích thước vùng chạm tối thiểu (Touch Target Size):** Web/Mobile tối thiểu **44x44px** (iOS HIG) hoặc **48x48dp** (Material Design). Nếu icon nhỏ (ví dụ 16px), phải mở rộng padding/hitbox xung quanh.
- **Khoảng cách phím bấm (Touch Spacing):** Cách nhau tối thiểu **8px** để tránh chạm nhầm.
- **Phản hồi tức thì (Immediate Press Feedback):** Mọi thao tác nhấn phải có phản hồi thị giác (đổi màu, hạ độ mờ, ripple, lún nhẹ) trong vòng **100ms**.
- **Trỏ chuột (Cursor Pointer):** Bắt buộc thêm `cursor: pointer` cho toàn bộ các phần tử có thể nhấp được trên Web.
- **Tránh giật layout khi tương tác:** Trạng thái hover/active không được làm nhảy chiều rộng hay kích thước các phần tử xung quanh.

### 3. Hiệu năng & Mượt mà (Performance & Fluidity - HIGH)
- **Tối ưu Layout Shift (CLS = 0):** Luôn khai báo `aspect-ratio` hoặc `width`/`height` cho ảnh và thẻ động để giao diện không bị giật nảy khi tải.
- **Chỉ biến đổi Transform & Opacity:** Hoạt ảnh hover/transition chỉ dùng `transform` và `opacity`; tuyệt đối không animate `width`, `height`, `top`, `left`, `margin`.
- **Skeleton Loading:** Thay thế vòng quay spinner xoay tít bằng Skeleton Placeholder để người dùng hình dung trước cấu trúc nội dung.
- **Tải phân trang / Danh sách lớn:** Dùng Virtualization cho danh sách từ 50 phần tử trở lên.

### 4. Bố cục, Phông chữ & Màu sắc (Layout, Typography & Tokens - HIGH)
- **Không dùng Emoji làm biểu tượng hệ thống:** Tuyệt đối dùng icon vector SVG chuẩn (Lucide Icons, Heroicons, Phosphor Icons).
- **Hệ thống khoảng cách 8dp/4dp (Spacing Scale):** Sử dụng bội số của 4/8px (4, 8, 12, 16, 24, 32, 48, 64px) cho mọi padding và margin.
- **Độ dài dòng đọc lý tưởng (Measure):** 45 - 75 ký tự mỗi dòng cho văn bản đoạn văn để mắt đọc thoải mái.
- **Chữ số dạng Tabular (Monospaced Numbers):** Sử dụng `font-variant-numeric: tabular-nums` cho các cột bảng, số tiền, đồng hồ đếm ngược, biển số xe để chữ số không bị rung lắc khi nhảy số.
- **Dark Mode không phải là đảo ngược màu thuần túy:** Dark Mode dùng các lớp bề mặt xám đậm/xanh than (ví dụ `#0F172A`, `#1E293B`) với văn bản trắng ngà/xám nhạt (`#F8FAFC`, `#94A3B8`), hạ độ rực của các màu thương hiệu để chống mỏi mắt.

### 5. Chuyển động & Hoạt cảnh (Motion & Micro-interactions - MEDIUM)
- **Tốc độ thoát nhanh hơn vào (Exit Faster than Enter):** Hoạt ảnh mở ra 250-300ms, hoạt ảnh đóng lại chỉ 150-200ms để tạo cảm giác phản hồi nhanh nhạy.
- **Đường cong Easing tự nhiên:** Dùng `ease-out` khi phần tử tiến vào màn hình, `ease-in` khi rời đi, hoặc dùng đường cong Spring Physics.
- **Ngắt được (Interruptible):** Người dùng có thể click ngay hoặc tương tác mà không bị khóa đơ trong lúc hoạt ảnh đang chạy.

### 6. Biểu mẫu & Báo lỗi (Forms & Error Handling - MEDIUM)
- **Lỗi hiển thị ngay bên dưới trường:** Thông báo lỗi cụ thể (nguyên nhân + cách khắc phục), có liên kết `aria-describedby`.
- **Trạng thái nút khi Submit:** Tự động disable nút submit và hiển thị spinner/loading để ngăn ngừa người dùng click liên tục nhiều lần (double submit).
- **Hỗ trợ Autofill:** Khai báo đúng `autoComplete="email"`, `autoComplete="current-password"`, `type="tel"`.

---

## 4. Bảng kiểm tra trước khi bàn giao (Pre-Delivery Checklist)

Trước khi bàn giao bất kỳ giao diện nào cho người dùng, đối chiếu toàn bộ các tiêu chí:

- [ ] **Biểu tượng:** Không dùng icon emoji (100% SVG: Lucide/Heroicons).
- [ ] **Con trỏ:** Đầy đủ `cursor: pointer` cho tất cả các nút, tab, thẻ nhấp được.
- [ ] **Màu sắc & Tương phản:** Văn bản đạt độ tương phản tối thiểu 4.5:1 ở cả Light và Dark mode.
- [ ] **Bàn phím & Focus:** Có viền focus nổi bật khi duyệt bằng phím `Tab`, đóng được modal bằng `Esc`.
- [ ] **Chạm an toàn:** Vùng bấm tối thiểu 44x44px, không dính sát viền màn hình (Safe Area).
- [ ] **Tương thích Responsive:** Kiểm tra hoàn hảo tại các mốc 375px (Mobile), 768px (Tablet), 1024px (Laptop), 1440px+ (Desktop).
- [ ] **Phản hồi chuyển trạng thái:** Hover, Active, Disabled, Loading hiển thị trực quan và mượt mà.
- [ ] **Không giật trang (No CLS):** Khung ảnh/dữ liệu có kích thước hoặc skeleton giữ chỗ trước khi tải.
- [ ] **Giảm chuyển động:** Tôn trọng cài đặt `prefers-reduced-motion` của hệ thống.

---

## 5. Mẫu Prompt chuẩn để áp dụng kỹ năng vào các tác vụ UI/UX

Người dùng có thể sao chép các mẫu câu lệnh dưới đây để yêu cầu AI sinh giao diện đẳng cấp nhất:

### Mẫu 1: Yêu cầu thiết kế toàn bộ trang / giao diện mới
```text
Áp dụng kỹ năng UI/UX Pro Max, hãy thiết kế giao diện [Tên Trang/Tính Năng, ví dụ: Dashboard Vận hành Bãi Đỗ Xe 3D]:
1. Phân tích đối tượng người dùng và chọn Layout Pattern phù hợp.
2. Sinh Design System chi tiết (Bảng màu Semantic Tokens, Cặp Google Fonts, Phong cách thị giác chủ đạo).
3. Thiết kế giao diện đầy đủ các trạng thái: Normal, Hover, Active, Loading (Skeleton), Empty State và Error.
4. Đảm bảo chuẩn Accessibility (WCAG 2.2 AA, tương phản 4.5:1, Focus ring, hỗ trợ Tab/Esc).
5. Áp dụng bảng kiểm tra Pre-Delivery Checklist trước khi bàn giao mã nguồn.
```

### Mẫu 2: Nâng cấp thẩm mỹ & Đổi mới giao diện hiện có (UI Polish / Redesign)
```text
Dựa trên tri thức UI/UX Pro Max, hãy đánh giá và nâng cấp lại giao diện file [Đường dẫn file]:
1. Khắc phục các Anti-patterns hiện tại (loại bỏ emoji, chuẩn hóa màu sắc, tinh chỉnh khoảng cách theo hệ 8px).
2. Tinh chỉnh Typography và phân cấp thị giác (Visual Hierarchy) rõ rệt.
3. Bổ sung các micro-interactions tinh tế và hiệu ứng chuyển đổi mượt mà (chỉ animate transform và opacity).
4. Kiểm tra và tối ưu Dark Mode cùng khả năng đáp ứng trên thiết bị di động (375px).
```

### Mẫu 3: Thiết kế Component phức tạp (Modal, Bảng dữ liệu, Biểu đồ)
```text
Hãy tạo component [Tên Component, ví dụ: Modal xác nhận thanh toán tiền mặt] theo chuẩn UI/UX Pro Max:
- Kích thước chạm tối thiểu 44px, vị trí nút Primary và Secondary chuẩn UX.
- Trạng thái Disabled, Loading, xử lý lỗi tại chỗ (Inline Validation).
- Bẫy tiêu điểm bàn phím (Focus Trap), hỗ trợ phím Escape và đóng khi click ngoài.
- Dùng SVG Lucide icons, số liệu dạng tabular-nums chống rung layout.
```
