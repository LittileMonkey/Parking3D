# Parking3D - Hệ thống Mô phỏng Bãi Đỗ Xe 3D (Three.js & ASP.NET Core)

Dự án trực quan hóa mô hình 3D bãi đỗ xe thông minh sử dụng **Three.js** kết hợp với nền tảng phục vụ ứng dụng web **ASP.NET Core (.NET 10)**. Dự án bao gồm 3 mô hình chính: **Bãi xe ngoài trời 1 tầng (Outdoor Parking)**, **Tòa nhà đỗ xe 3 tầng nổi (3-Floor Parking Building)** và **Hầm gửi xe chung cư 3 tầng (3-Floor Apartment Basement Parking)**.

---

## 🚀 Các chức năng hiện có

### 1. Mô hình Bãi đỗ xe ngoài trời 1 tầng (`index.html`, `main.js`, `parking.js`)
- **Không gian & Bố cục 3D**:
  - Bãi đỗ xe ngoài trời gồm **20 ô đỗ xe ô tô** chia thành 2 khu vực **A** (`A01` – `A10`) và **B** (`B01` – `B10`).
  - Có đầy đủ tường bao quanh, vạch kẻ phân làn, vạch dừng xe, mũi tên chỉ hướng lối vào/ra, 4 trụ đèn chiếu sáng và **Bốt bảo vệ (Security Booth)** ở trung tâm cổng.
- **Điều khiển Barrier tự động**:
  - Cho phép đóng/mở thanh chắn (Barrier) riêng biệt tại **Lối vào (Entrance)** và **Lối ra (Exit)** với hiệu ứng chuyển động mượt mà.
- **Tương tác & Quản lý trạng thái ô đỗ (Raycasting)**:
  - Click chuột trực tiếp vào từng ô đỗ trên mô hình 3D để xem thông tin chi tiết: Mã ô (`Slot ID`), Tầng (`Floor`), Loại xe (`Vehicle Type`), Kích thước (`Width × Length`) và Trạng thái hiện tại.
  - Hỗ trợ **cập nhật trạng thái ô đỗ** trực tiếp trên giao diện kèm đổi màu trực quan theo thời gian thực:
    - 🟢 `AVAILABLE` (Trống - Xanh lá)
    - ⚪ `OCCUPIED` (Đã có xe - Xám)
    - 🟡 `MAINTENANCE` (Đang bảo trì - Vàng)
    - 🔴 `SELECTED` (Đang được chọn - Đỏ)
- **Xuất dữ liệu mô hình (Export 3D Model)**:
  - Xuất toàn bộ cấu trúc Scene 3D hiện tại ra file định dạng JSON (`parking-area.json`).

---

### 2. Mô hình Tòa nhà đỗ xe 3 tầng (`building.html`, `building.js`)
- **Kết cấu kiến trúc 3 tầng (`72m × 60m` + Khu đường dốc nối tầng)**:
  - Sàn bê tông, thảm nhựa đường, tường lan can trắng bao quanh, hệ thống cột trụ chịu lực (tự động ẩn cột khi chuyển sang chế độ xem từng tầng lẻ để dễ quan sát).
  - **Hệ thống đường dốc nghiêng nối tầng (Sloped Ramp Wing & Cutout Well)**:
    - Thiết kế liền khối bên hông trái tòa nhà gồm dải hành lang phẳng lưu thông bên trong (`6.5m`) và dải bản dốc nghiêng bên ngoài (`8.5m`) kết nối từ Tầng 1 → Tầng 2 và Tầng 2 → Tầng 3.
    - Tường lan can màu trắng chạy dọc chiếu nghỉ, uốn nghiêng theo độ dốc của bản dốc và bao quanh lỗ thông tầng (Cutout Well) theo hình chữ U tại Tầng 2 và Tầng 3.
    - Bản dốc được chia làm **2 làn xe (Lối đi lên ↑ & Lối đi xuống ↓)** ngăn cách bởi gờ trắng ở giữa, có mũi tên 3D chỉ hướng trên mặt dốc kèm bảng chữ nổi 3D (`THREE.Sprite` Billboard) luôn xoay hướng về phía Camera ở mọi góc nhìn 3D (360°).
- **Tầng 1 (Tầng trệt) – Khu vực đỗ xe máy**:
  - **Bảng thông tin điện tử trước cổng (Entrance Info Board)**: Đặt trước cổng chính Tầng 1, hiển thị chữ nổi 3D báo **số lượng slots trống** của bãi xe máy (`Slots trống: 350 / 500`) và cho phép click để xem chi tiết.
  - **Không gian bên trong Tầng 1**: Để trống hoàn toàn, không chia các ô lẻ; khi chọn chế độ xem riêng **Tầng 1**, hệ thống sẽ hiển thị bảng chữ nổi 3D ở giữa sàn thống kê số lượng xe máy đang có trong bãi và số chỗ trống.
- **Tầng 2 & Tầng 3 – Khu vực đỗ xe ô tô (`100 slots / tầng`)**:
  - Mỗi tầng được phân bố chuẩn xác **100 ô đỗ ô tô** theo bố cục **5 hàng (`A`, `B`, `C`, `D`, `E`) × 20 cột** (`F2-A01`..`F2-E20` và `F3-A01`..`F3-E20`).
  - Xen kẽ giữa 5 hàng là 4 làn đường lưu thông 2 chiều rộng rãi (`6m`) có vạch tim đường nét đứt màu vàng, mũi tên điều hướng và hành lang quay đầu xe rộng `11m` ở hai đầu trái/phải.
  - Click vào bất kỳ ô đỗ nào ở Tầng 2 hoặc Tầng 3 để xem mã ô, tầng, thứ tự ô và trạng thái đỗ xe.
- **Chuyển đổi chế độ quan sát linh hoạt**:
  - Hỗ trợ chuyển nhanh góc nhìn Camera giữa **Toàn cảnh 3 tầng**, **Tầng 1 (Xe máy)**, **Tầng 2 (100 ô tô)**, **Tầng 3 (100 ô tô)** và nút chuyển đổi qua lại với **Bãi xe ngoài trời** / **Hầm chung cư 3 tầng**.

---

### 3. Mô hình Hầm gửi xe chung cư 3 tầng (`basement.html`, `basement.js`)
- **Kết cấu 3 tầng hầm (`B1`, `B2`, `B3`) & Khối chung cư trên mặt đất**:
  - Hiển thị mặt đất bán trong suốt tại `y = 0`, cổng mái che lối xuống hầm và khối tòa chung cư 8 tầng bán trong suốt phía trên (tự động ẩn khi xem riêng từng tầng hầm, có nút bật/tắt nhanh ở chế độ toàn cảnh).
  - Hệ thống ram dốc nghiêng 2 làn bên hông trái kết nối liên hoàn **Mặt đất ↔ B1 ↔ B2 ↔ B3**, phân làn rõ bằng gờ trắng, mũi tên chỉ hướng (`Lối vào / xuống ↓`, `Lối ra / lên ↑`) và bảng chữ nổi 3D luôn hướng về camera.
- **Tầng B1 – Khu vực đỗ 100 xe máy**:
  - Giữ mặt sàn trống kết hợp vạch khu vực, bảng thông tin điện tử đặt gần lối vào (click để xem và cập nhật số xe đang gửi) và bảng chữ nổi 3D ở giữa sàn khi xem riêng Tầng B1.
- **Tầng B2 & Tầng B3 – 25 ô tô thường + 25 ô tô điện / tầng (`50 slots / tầng`)**:
  - Chia 2 khu riêng biệt ngăn cách bởi hành lang trung tâm: **25 ô tô thường** (`B2-C01`..`B2-C25`, `B3-C01`..`B3-C25`, xanh lá) và **25 ô tô điện** (`B2-EV01`..`B2-EV25`, `B3-EV01`..`B3-EV25`, xanh dương điện, viền cyan và nhãn `⚡`).
  - Click trực tiếp từng ô để xem thông tin chi tiết và **cập nhật trạng thái** (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`) trực tiếp kèm cập nhật màu 3D và bộ đếm thời gian thực.

---

## 📁 Cấu trúc thư mục

```text
Parking3D/
├── Parking3D.slnx
└── Parking3D/
    ├── Program.cs                  # Cấu hình ASP.NET Core phục vụ Static Files (tắt cache khi dev)
    ├── Parking3D.csproj            # Project file (.NET 10)
    └── wwwroot/
        ├── index.html              # Giao diện Bãi đỗ xe ngoài trời 1 tầng
        ├── building.html           # Giao diện Tòa nhà đỗ xe 3 tầng nổi
        ├── basement.html           # Giao diện Hầm gửi xe chung cư 3 tầng (B1, B2, B3)
        ├── css/
        │   └── style.css           # Định dạng giao diện điều khiển
        ├── js/
        │   ├── main.js             # Xử lý tương tác, camera, barrier, chọn slot cho bãi ngoài trời
        │   ├── parking.js          # Khởi tạo hình học 3D cho bãi xe ngoài trời 1 tầng
        │   ├── building.js         # Khởi tạo hình học 3D & tương tác cho tòa nhà đỗ xe 3 tầng nổi
        │   └── basement.js         # Khởi tạo hình học 3D & tương tác cho hầm gửi xe chung cư 3 tầng
        └── libs/
            └── three/              # Thư viện Three.js & Addons (OrbitControls, WebXR...)
```

---

## 🛠️ Hướng dẫn chạy dự án

1. Mở `Parking3D.slnx` bằng **Visual Studio 2022/2026** hoặc dùng .NET CLI.
2. Chạy lệnh:
   ```bash
   dotnet run --project Parking3D/Parking3D.csproj
   ```
3. Mở trình duyệt truy cập địa chỉ hiển thị trên màn hình console (ví dụ `https://localhost:7xxx` hoặc `http://localhost:5xxx`):
   - Trang mặc định (`/index.html`): Bãi đỗ xe ngoài trời 1 tầng.
   - Trang tòa nhà 3 tầng nổi (`/building.html`): Bấm nút **"View 3-Floor Parking"** ở góc dưới bên phải hoặc truy cập trực tiếp `/building.html`.
   - Trang hầm chung cư 3 tầng (`/basement.html`): Bấm nút **"View 3-Floor Basement Parking"** ở góc dưới bên phải hoặc truy cập trực tiếp `/basement.html`.
