# FRONTEND PARKING SYSTEM (3D DIGITAL TWIN)

## 1. Giới thiệu
Thư mục chứa mã nguồn giao diện Web tương tác 3D cho Hệ thống Quản lý Bãi đỗ xe Thông minh. Ứng dụng mô phỏng trực quan không gian thực tế các tầng F01, F02, F03, cho phép khách hàng tương tác trực tiếp, theo dõi tình trạng chỗ đỗ theo thời gian thực và đặt chỗ trực tuyến.

---

## 2. Công nghệ Đề xuất
- **Nền tảng:** React 18 / 19 + TypeScript + Vite
- **Đồ họa 3D:** Three.js, `@react-three/fiber`, `@react-three/drei`
- **Tối ưu hóa hiệu năng render:** `InstancedMesh` để render 2.000 slots với hiệu năng 60 FPS
- **Giao tiếp Realtime:** `@microsoft/signalr` kết nối với Hub Backend
- **Giao diện & UI Component:** TailwindCSS / CSS Modules, Lucide React Icons

---

## 3. Bản đồ Trực quan hóa Màu sắc (Slot Color Coding)
- 🟢 **Xanh lục (`#22C55E`):** `Available` — Vị trí đang trống, có thể bấm vào để đặt chỗ.
- 🟡 **Vàng cam (`#F59E0B`):** `Reserved` — Vị trí đang được giữ chỗ (Hold 5 phút).
- 🔴 **Đỏ (`#EF4444`):** `Occupied` — Xe đang đỗ thực tế trong bãi.
- ⚫ **Xám (`#6B7280`):** `Maintenance` / `Disabled` — Vị trí đang bảo trì.

---

## 4. Hướng dẫn Khởi chạy (Dự kiến sau khi khởi tạo code)
```powershell
# Cài đặt dependencies
npm install

# Chạy server phát triển
npm run dev

# Truy cập trình duyệt
http://localhost:5173
```
