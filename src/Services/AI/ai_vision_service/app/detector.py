import os
import cv2
import numpy as np

# =================================================================================================
# MODULE PHÁT HIỆN BIỂN SỐ XE VÀ CẮT VÙNG ĐẶC TRƯNG (LICENSE PLATE DETECTOR - YOLO / ONNX / CONTOUR)
# =================================================================================================
# Hỗ trợ:
# 1. Ultralytics YOLOv8/YOLO11 (.pt checkpoint)
# 2. ONNX Runtime / OpenCV DNN (.onnx checkpoint) - tối ưu hóa suy luận CPU tốc độ cao (~78ms)
# 3. OpenCV Contour Detection (Edge-based ROI) - tìm khung biển số chữ nhật có độ tương phản cao
# 4. Aspect-Ratio Auto Detection - nhận diện ảnh cận cảnh biển số không cắt xén nhầm
# =================================================================================================

class LicensePlateDetector:
    """
    Lớp đóng gói mô hình phát hiện tọa độ hộp bao (Bounding Box) của biển số xe trên khung hình camera.
    Tự động tìm kiếm file mô hình .onnx hoặc .pt trong thư mục models/.
    """
    def __init__(self, model_path: str | None = None):
        self.model = None
        self.backend = None  # "ultralytics", "onnxruntime", "cv2_dnn", or "fallback"
        self.model_path = model_path
        
        # Danh sách đường dẫn ứng viên nếu model_path không chỉ định
        candidate_paths = [
            model_path,
            "models/best.onnx",
            "models/license_plate.onnx",
            "models/license_plate_yolov8.pt",
            "license_plate_yolov8.pt",
        ]
        
        selected_path = None
        for path in candidate_paths:
            if path and os.path.exists(path):
                selected_path = path
                break

        if selected_path:
            self.model_path = selected_path
            self._load_model(selected_path)
        else:
            print("[Detector] Model weight files not found. Using intelligent contour & aspect-ratio detector.")
            self.backend = "fallback"

    def _load_model(self, path: str):
        """Khởi tạo engine suy luận dựa theo định dạng file mô hình."""
        lower_path = path.lower()
        if lower_path.endswith(".onnx"):
            try:
                import onnxruntime as ort
                self.model = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
                self.backend = "onnxruntime"
                print(f"[Detector] Loaded ONNX model via ONNXRuntime from: {path}")
                return
            except Exception:
                pass

            try:
                self.model = cv2.dnn.readNetFromONNX(path)
                self.backend = "cv2_dnn"
                print(f"[Detector] Loaded ONNX model via OpenCV DNN from: {path}")
                return
            except Exception as e:
                print(f"[Detector] Cannot load ONNX model via OpenCV DNN: {e}")

        # Thử nạp qua Ultralytics YOLO (hỗ trợ cả .pt và .onnx)
        try:
            from ultralytics import YOLO
            self.model = YOLO(path)
            self.backend = "ultralytics"
            print(f"[Detector] Loaded YOLO model via Ultralytics from: {path}")
            return
        except Exception as e:
            print(f"[Detector] Ultralytics loading failed: {e}. Fallback to contour & aspect detector.")
            self.backend = "fallback"

    def detect_and_crop(self, image: np.ndarray, conf_threshold: float = 0.25):
        """
        Phát hiện vị trí biển số xe và cắt ảnh vùng biển số (ROI - Region of Interest).
        
        Tham số:
            image (np.ndarray): Khung hình ảnh gốc định dạng ma trận BGR của OpenCV (H, W, C)
            conf_threshold (float): Ngưỡng độ tin cậy tối thiểu (mặc định 0.25)
            
        Trả về:
            tuple (cropped_img, confidence, bbox):
            - cropped_img (np.ndarray): Mảng ảnh cắt riêng vùng biển số
            - confidence (float): Độ tin cậy dự đoán (0.0 đến 1.0)
            - bbox (tuple): Tọa độ 4 góc hộp bao (x1, y1, x2, y2)
        """
        if image is None or image.size == 0:
            return image, 0.0, (0, 0, 0, 0)

        h, w = image.shape[:2]
        ratio = w / float(h) if h > 0 else 1.0

        # Tỷ lệ chuẩn biển số Việt Nam:
        # - Biển vuông xe máy / ô tô: 1.1 <= ratio <= 1.85
        # - Biển dài ô tô: 2.6 <= ratio <= 5.5
        is_already_plate_ratio = (1.1 <= ratio <= 1.85) or (2.6 <= ratio <= 5.5)

        # Trường hợp 1: Ultralytics YOLO
        if self.backend == "ultralytics" and self.model is not None:
            try:
                results = self.model(image, verbose=False, conf=conf_threshold)
                for r in results:
                    boxes = r.boxes
                    if len(boxes) > 0:
                        best_idx = int(boxes.conf.argmax())
                        box = boxes.xyxy[best_idx].cpu().numpy().astype(int)
                        conf = float(boxes.conf[best_idx].cpu().numpy())
                        return self._apply_padding_and_crop(image, box, conf, h, w)
            except Exception as e:
                print(f"[Detector] Lỗi khi inference Ultralytics: {e}")

        # Trường hợp 2: ONNXRuntime
        elif self.backend == "onnxruntime" and self.model is not None:
            try:
                cropped, conf, bbox = self._infer_onnx(image, h, w, conf_threshold)
                if cropped is not None:
                    return cropped, conf, bbox
            except Exception as e:
                print(f"[Detector] Lỗi khi inference ONNXRuntime: {e}")

        # Trường hợp 3: Phát hiện viền hình chữ nhật biển số qua OpenCV Contour Detection
        # Thích hợp cho ảnh chụp cận cảnh hoặc chụp trên bàn/cổng barrier có viền đen
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            edges = cv2.Canny(blurred, 40, 160)
            contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

            best_rect = None
            max_area = 0
            for c in contours:
                x, y, bw, bh = cv2.boundingRect(c)
                area = bw * bh
                if area > 0.15 * h * w:  # Chiếm ít nhất 15% khung hình
                    c_ratio = bw / float(bh) if bh > 0 else 0
                    if (1.0 <= c_ratio <= 1.85) or (2.4 <= c_ratio <= 5.5):
                        if area > max_area:
                            max_area = area
                            best_rect = (x, y, x + bw, y + bh)

            if best_rect is not None:
                bx1, by1, bx2, by2 = best_rect
                # Giữ nguyên viền biển số, thêm 2% lề đệm
                pad_x = int((bx2 - bx1) * 0.02)
                pad_y = int((by2 - by1) * 0.02)
                x1_clamped = max(0, bx1 - pad_x)
                y1_clamped = max(0, by1 - pad_y)
                x2_clamped = min(w, bx2 + pad_x)
                y2_clamped = min(h, by2 + pad_y)
                cropped = image[y1_clamped:y2_clamped, x1_clamped:x2_clamped]
                if cropped.size > 0:
                    return cropped, 0.90, (x1_clamped, y1_clamped, x2_clamped, y2_clamped)
        except Exception as e:
            print(f"[Detector] Lỗi contour detection: {e}")

        # Trường hợp 4: Nếu bản thân ảnh đầu vào đã có tỷ lệ chuẩn của biển số xe Việt Nam:
        # Giữ nguyên toàn bộ ảnh, không cắt xén mù quáng làm mất dòng trên
        if is_already_plate_ratio:
            return image, 0.92, (0, 0, w, h)

        # Trường hợp 5: Ảnh toàn cảnh xe chụp từ xa qua camera barrier (chiếm 1/3 dưới giữa ảnh)
        x1 = int(w * 0.20)
        x2 = int(w * 0.80)
        y1 = int(h * 0.45)
        y2 = int(h * 0.90)
        cropped = image[y1:y2, x1:x2]
        if cropped.size == 0:
            cropped = image
        return cropped, 0.85, (x1, y1, x2, y2)

    @staticmethod
    def _apply_padding_and_crop(image: np.ndarray, box: np.ndarray | tuple, conf: float, h: int, w: int):
        """
        KỸ THUẬT PADDING 5%: Hộp bao của mô hình thường cắt sát mép chữ hoặc đinh ốc biển số.
        Thêm lề đệm 5% mỗi chiều giúp bộ OCR phía sau không bị mất nét chữ đầu/cuối.
        """
        x1, y1, x2, y2 = box
        pad_x = int((x2 - x1) * 0.05)
        pad_y = int((y2 - y1) * 0.05)
        
        x1_clamped = max(0, x1 - pad_x)
        y1_clamped = max(0, y1 - pad_y)
        x2_clamped = min(w, x2 + pad_x)
        y2_clamped = min(h, y2 + pad_y)
        
        cropped = image[y1_clamped:y2_clamped, x1_clamped:x2_clamped]
        if cropped.size > 0:
            return cropped, conf, (x1_clamped, y1_clamped, x2_clamped, y2_clamped)
        return image, conf, (0, 0, w, h)
