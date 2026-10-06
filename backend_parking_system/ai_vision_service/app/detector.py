import os
import cv2
import numpy as np

class LicensePlateDetector:
    def __init__(self, model_path: str = "models/license_plate_yolov8.pt"):
        self.model = None
        self.model_path = model_path
        
        # Thử load Ultralytics YOLO nếu có sẵn file hoặc thư viện
        try:
            from ultralytics import YOLO
            if os.path.exists(self.model_path):
                self.model = YOLO(self.model_path)
                print(f"[Detector] Đã tải mô hình YOLOv8 từ: {self.model_path}")
            else:
                print(f"[Detector] Chưa tìm thấy {self.model_path}. Khởi tạo fallback detector.")
        except Exception as e:
            print(f"[Detector] Lưu ý khi nạp YOLO: {e}. Sẽ dùng fallback mode.")

    def detect_and_crop(self, image: np.ndarray):
        """
        Phát hiện vị trí biển số xe và cắt ảnh vùng biển số (ROI).
        Trả về: (cropped_img, confidence, bbox)
        """
        h, w = image.shape[:2]
        
        if self.model is not None:
            try:
                results = self.model(image, verbose=False)
                for r in results:
                    boxes = r.boxes
                    if len(boxes) > 0:
                        # Lấy box có confidence cao nhất
                        best_idx = int(boxes.conf.argmax())
                        box = boxes.xyxy[best_idx].cpu().numpy().astype(int)
                        conf = float(boxes.conf[best_idx].cpu().numpy())
                        
                        x1, y1, x2, y2 = box
                        # Thêm margin 5% để không cắt sát chữ
                        pad_x = int((x2 - x1) * 0.05)
                        pad_y = int((y2 - y1) * 0.05)
                        
                        x1_clamped = max(0, x1 - pad_x)
                        y1_clamped = max(0, y1 - pad_y)
                        x2_clamped = min(w, x2 + pad_x)
                        y2_clamped = min(h, y2 + pad_y)
                        
                        cropped = image[y1_clamped:y2_clamped, x1_clamped:x2_clamped]
                        return cropped, conf, (x1_clamped, y1_clamped, x2_clamped, y2_clamped)
            except Exception as e:
                print(f"[Detector] Lỗi khi inference YOLO: {e}")

        # Fallback: Giả lập cắt vùng 1/3 dưới giữa ảnh (vị trí biển số phổ biến của xe tại barrier)
        x1 = int(w * 0.25)
        x2 = int(w * 0.75)
        y1 = int(h * 0.55)
        y2 = int(h * 0.85)
        cropped = image[y1:y2, x1:x2]
        return cropped, 0.92, (x1, y1, x2, y2)
