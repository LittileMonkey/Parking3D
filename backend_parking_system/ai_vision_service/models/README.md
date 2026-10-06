# Hướng dẫn nạp mô hình Weights YOLOv8 Biển Số Xe

Thư mục này chứa trọng số mô hình phát hiện biển số xe Việt Nam:
- File khuyến nghị: `license_plate_yolov8.pt` hoặc `yolov8n.pt`.

### Tùy chọn 1: Sử dụng trọng số tùy biến huấn luyện riêng
1. Đặt file checkpoint `license_plate_yolov8.pt` đã train vào thư mục này:
   `ai_vision_service/models/license_plate_yolov8.pt`

### Tùy chọn 2: Tự động tải hoặc dùng fallback mặc định
Nếu chưa có file trọng số `license_plate_yolov8.pt`, module `detector.py` sẽ tự động:
1. Tải mô hình nhỏ `yolov8n.pt` từ Ultralytics hoặc
2. Sử dụng thuật toán Haar Cascade / Morphological filtering để nhận diện và crop vùng biển số cho mục đích development & testing.
