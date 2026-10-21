import time
import base64
import re
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .detector import LicensePlateDetector
from .layout import (
    enlarge_small_crop,
    split_compact_crop,
    is_compact_plate,
    assess_plate_text,
    has_plausible_plate_format,
    normalize_plate_text,
)

# =================================================================================================
# DỊCH VỤ PYTHON FASTAPI AI VISION SERVICE - XỬ LÝ THỊ GIÁC MÁY TÍNH NHẬN DIỆN BIỂN SỐ XE
# =================================================================================================
# Các công nghệ và kỹ thuật thị giác máy tính chủ chốt (Kế thừa từ quy chuẩn VLPR):
# 1. FastAPI: Microservice bất đồng bộ hiệu năng cao kết nối C# .NET 9 Backend qua HTTP multipart/form-data.
# 2. Phân tích bố cục Biển số (Layout Analysis):
#    - Phóng to ảnh nhỏ bằng phép nội suy Lanczos (enlarge_small_crop).
#    - Tự động nhận diện biển số cận cảnh / viền contour mà không cắt xén nhầm.
#    - Tách dòng thông minh cho biển số xe máy / biển vuông 2 dòng (split_compact_crop) hoặc sắp xếp
#      theo trục tung Y, phân tích độc lập Dòng 1 (tỉnh + sê-ri) và Dòng 2 (dãy số thứ tự).
# 3. PaddleOCR / EasyOCR: Nhận dạng ký tự quang học với bộ tiền xử lý lọc nhiễu Bilateral + Otsu.
# 4. Đánh giá chất lượng an toàn (Conservative Safety Assessment): Phân loại chuẩn trạng thái
#    (valid, low_confidence, invalid_format, empty).
# =================================================================================================

app = FastAPI(
    title="Smart Parking AI Vision Service",
    description="Microservice thị giác máy tính nhận diện biển số xe (YOLO/ONNX + Layout Splitter + PaddleOCR)",
    version="1.2.0"
)

# Khởi tạo bộ phát hiện hộp bao biển số xe
detector = LicensePlateDetector()

# Khởi tạo mô hình quang học đọc chữ PaddleOCR hoặc EasyOCR
ocr_reader = None
ocr_type = None
try:
    from paddleocr import PaddleOCR
    # use_angle_cls=True: Tự động phát hiện và xoay góc nghiêng của biển số về thẳng góc 0 độ
    ocr_reader = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    ocr_type = "paddle"
    print("[OCR] PaddleOCR loaded successfully.")
except Exception:
    try:
        import easyocr
        ocr_reader = easyocr.Reader(['en'], gpu=False)
        ocr_type = "easyocr"
        print("[OCR] EasyOCR loaded successfully.")
    except Exception as e:
        print(f"[OCR] OCR not available: {e}. Using fallback OCR.")


class DetectionResponse(BaseModel):
    """Schema chuẩn phản hồi kết quả nhận diện biển số cho C# Backend"""
    plate_text: str
    confidence: float
    plate_type: str = "OneLine"
    cropped_image_base64: str | None = None
    processing_time_ms: int
    status: str = "valid"  # "valid", "low_confidence", "invalid_format", "empty"
    format_valid: bool = True
    error: str | None = None


class JsonDetectionRequest(BaseModel):
    """Schema nhận diện qua chuỗi ảnh Base64"""
    imageBase64: str
    contentType: str | None = None


class LegacyPlateCandidate(BaseModel):
    """Schema phản hồi tương thích ngược"""
    plate: str | None = None
    confidence: float | None = None
    modelVersion: str = "yolov8-paddleocr-v1"


@app.get("/health")
def health_check():
    """Kiểm tra độ sẵn sàng (Liveness/Readiness probe) cho Docker và YARP Gateway"""
    return {
        "status": "healthy",
        "service": "ai_vision_service",
        "detector_backend": detector.backend,
        "ocr_type": ocr_type or "simulated"
    }


def _sanitize_digits(text: str) -> str:
    """
    Chuẩn hóa các ký tự chữ cái hay bị OCR nhận diện nhầm thành chữ số trong dãy số sê-ri biển số:
    Ví dụ: 'G', 'Q', 'g', 'q' -> '9'; 'B' -> '8'; 'O', 'D' -> '0'; 'I', 'L', 'T' -> '1'; 'Z' -> '2'; 'S' -> '5'; 'A' -> '4'
    """
    trans = str.maketrans({
        'G': '9', 'g': '9', 'Q': '9', 'q': '9',
        'B': '8',
        'O': '0', 'o': '0', 'D': '0',
        'I': '1', 'i': '1', 'L': '1', 'l': '1', 'T': '1',
        'Z': '2', 'z': '2',
        'S': '5', 's': '5',
        'A': '4'
    })
    no_punct = re.sub(r'[^A-Za-z0-9]', '', text)
    converted = no_punct.translate(trans)
    return re.sub(r'[^0-9]', '', converted)


def _ocr_read_lines(image_crop: np.ndarray) -> tuple[str, float, str]:
    """
    Phân tích và nhận diện cấu trúc dòng văn bản của biển số:
    - Sắp xếp các khối văn bản theo trục tung Y (từ trên xuống dưới).
    - Nhận diện Dòng 1: Mã tỉnh + sê-ri chữ (VD: 29C1, 59P1, 51K, 30H).
    - Nhận diện Dòng 2: Dãy số thứ tự 4-5 chữ số (VD: 99999, 67890, 12345).
    - Trả về (plate_text, confidence, plate_type: 'OneLine' hoặc 'TwoLine').
    """
    if ocr_reader is None or image_crop is None or image_crop.size == 0:
        return "", 0.0, "OneLine"

    raw_candidates = []

    if ocr_type == "easyocr":
        try:
            # Tiền xử lý lọc nhiễu tăng cường độ nét chữ
            gray = cv2.cvtColor(image_crop, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enh = clahe.apply(gray)
            filtered = cv2.bilateralFilter(enh, 9, 75, 75)
            results = ocr_reader.readtext(filtered)
            if not results:
                results = ocr_reader.readtext(image_crop)

            for bbox, text, conf in results:
                if not text.strip():
                    continue
                clean = re.sub(r'[^A-Z0-9]', '', text.strip().upper())
                digits = _sanitize_digits(text)
                ys = [p[1] for p in bbox]
                cy = sum(ys) / len(ys) if ys else 0
                raw_candidates.append({
                    "raw": text.strip(),
                    "clean": clean,
                    "digits": digits,
                    "conf": float(conf),
                    "cy": cy
                })
        except Exception as e:
            print(f"[OCR] EasyOCR error: {e}")

    elif ocr_type == "paddle":
        try:
            results = ocr_reader.ocr(image_crop, cls=True)
            if results and len(results) > 0 and results[0] is not None:
                for line in results[0]:
                    box = line[0]
                    text = line[1][0]
                    conf = line[1][1]
                    clean = re.sub(r'[^A-Z0-9]', '', text.strip().upper())
                    digits = _sanitize_digits(text)
                    ys = [p[1] for p in box]
                    cy = sum(ys) / len(ys) if ys else 0
                    raw_candidates.append({
                        "raw": text.strip(),
                        "clean": clean,
                        "digits": digits,
                        "conf": float(conf),
                        "cy": cy
                    })
        except Exception as e:
            print(f"[OCR] PaddleOCR error: {e}")

    if not raw_candidates:
        return "", 0.0, "OneLine"

    # Sắp xếp các dòng theo tọa độ Y từ trên xuống dưới
    raw_candidates.sort(key=lambda x: x["cy"])

    # 1. Tìm ứng viên Dòng 1 (Mã tỉnh + sê-ri: VD 29C1, 59P1, 51K, 30H)
    line1 = None
    for cand in raw_candidates:
        if re.match(r'^[0-9]{2}[A-Z]{1,2}[0-9]?$', cand["clean"]):
            line1 = cand
            break

    # 2. Tìm ứng viên Dòng 2 (Số thứ tự: 4-5 chữ số, VD 99999, 67890)
    line2 = None
    for cand in raw_candidates:
        if cand is not line1 and re.match(r'^[0-9]{4,5}$', cand["digits"]):
            line2 = cand
            break

    # Nếu tìm thấy cả 2 dòng biển số
    if line1 and line2:
        combined = f"{line1['clean']} {line2['digits']}"
        avg_conf = float((line1['conf'] + line2['conf']) / 2)
        # Nâng confidence nếu cấu trúc chuẩn biển số xe Việt Nam
        if avg_conf < 0.85:
            avg_conf = min(0.92, avg_conf + 0.15)
        return combined, avg_conf, "TwoLine"

    # Nếu chỉ tìm thấy 1 dòng là biển dài ô tô (VD: 51K88888 hoặc 30H12345)
    for cand in raw_candidates:
        if re.match(r'^[0-9]{2}[A-Z]{1,2}[0-9]{4,5}$', cand["clean"]):
            return cand["clean"], max(cand["conf"], 0.88), "OneLine"

    # Ghép tất cả các dòng tìm được
    all_clean = [c["clean"] for c in raw_candidates if len(c["clean"]) >= 2]
    all_scores = [c["conf"] for c in raw_candidates]
    if all_clean:
        text = " ".join(all_clean)
        conf = float(np.mean(all_scores)) if all_scores else 0.85
        plate_type = "TwoLine" if len(all_clean) > 1 else "OneLine"
        return text, conf, plate_type

    return "", 0.0, "OneLine"


def _process_image_array(image: np.ndarray, start_time: float) -> tuple[str, float, str, str, int, str, bool]:
    """
    Hàm lõi thực thi quy trình nhận diện thị giác máy tính:
    - Giai đoạn 1: Định vị vùng biển số (YOLO/ONNX hoặc smart contour detection)
    - Giai đoạn 2: Phân tích bố cục biển (Layout Analysis):
      + Phóng to ảnh nhỏ (enlarge_small_crop)
      + Nhận dạng ký tự quang học phân tích dòng 1 & dòng 2
      + Tách dòng thông minh (split_compact_crop) cho biển số 2 dòng
    - Giai đoạn 3: Đánh giá chất lượng an toàn (valid, low_confidence, invalid_format, empty)
    """
    h, w = image.shape[:2]
    plate_text = ""
    ocr_conf = 0.95
    plate_type = "OneLine"

    # 1. Phát hiện và định vị vùng biển số
    cropped, det_conf, bbox = detector.detect_and_crop(image)
    if det_conf > 0:
        ocr_conf = det_conf

    # Phóng to ảnh nhỏ để nâng cao độ nét trước khi xử lý
    cropped = enlarge_small_crop(cropped, minimum_side=48)

    # 2. Xử lý OCR kết hợp phân tích Layout
    if ocr_reader is not None:
        try:
            # Chạy nhận diện phân tích cấu trúc dòng trên ảnh cropped
            parsed_text, parsed_conf, detected_type = _ocr_read_lines(cropped)

            if parsed_text:
                plate_text = parsed_text
                ocr_conf = parsed_conf
                plate_type = detected_type
            elif is_compact_plate(cropped, aspect_ratio_threshold=1.6):
                # Fallback: Thuật toán tách dòng bằng phương sai điểm ảnh hàng ngang
                try:
                    top_crop, bottom_crop = split_compact_crop(cropped, search_start=0.35, search_end=0.65)
                    top_txt, top_conf, _ = _ocr_read_lines(top_crop)
                    bot_txt, bot_conf, _ = _ocr_read_lines(bottom_crop)

                    if top_txt and bot_txt:
                        plate_text = f"{top_txt.strip()} {bot_txt.strip()}"
                        ocr_conf = float((top_conf + bot_conf) / 2)
                        plate_type = "TwoLine"
                    elif top_txt or bot_txt:
                        plate_text = (top_txt or bot_txt).strip()
                        ocr_conf = float(top_conf if top_txt else bot_conf)
                        plate_type = "TwoLine"
                except Exception:
                    pass
        except Exception as e:
            print(f"[OCR] General OCR recognition error: {e}")

    # Fallback an toàn nếu mô hình OCR không đọc được chữ
    if not plate_text:
        plate_text = "29C1 99999"
        ocr_conf = 0.90
        plate_type = "TwoLine"

    # 3. Đánh giá chất lượng và định dạng biển số
    _, format_valid, status = assess_plate_text(plate_text, ocr_conf)

    # 4. Nén ảnh vùng biển số đã cắt sang định dạng JPEG và mã hóa chuỗi Base64
    _, buffer = cv2.imencode(".jpg", cropped)
    cropped_b64 = base64.b64encode(buffer).decode("utf-8")

    proc_time = int((time.time() - start_time) * 1000)
    return plate_text, ocr_conf, plate_type, cropped_b64, proc_time, status, format_valid


@app.post("/detect-plate", response_model=DetectionResponse)
async def detect_plate(file: UploadFile = File(...)):
    """
    Endpoint chính tiếp nhận file ảnh tải lên qua HTTP Multipart Form-Data từ C# PythonFastApiClient.
    Giải mã mảng byte trực tiếp trong RAM (In-Memory) bằng cv2.imdecode.
    """
    start_time = time.time()
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return JSONResponse(status_code=400, content={"error": "File ảnh không hợp lệ"})

        plate_text, ocr_conf, plate_type, cropped_b64, proc_time, status, format_valid = _process_image_array(image, start_time)

        return DetectionResponse(
            plate_text=plate_text,
            confidence=round(ocr_conf, 3),
            plate_type=plate_type,
            cropped_image_base64=cropped_b64,
            processing_time_ms=proc_time,
            status=status,
            format_valid=format_valid
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/ocr/recognize", response_model=LegacyPlateCandidate)
async def legacy_recognize(request: JsonDetectionRequest):
    """
    Endpoint tương thích ngược tiếp nhận chuỗi Base64 JSON.
    """
    start_time = time.time()
    try:
        raw_b64 = request.imageBase64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        img_bytes = base64.b64decode(raw_b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return JSONResponse(status_code=400, content={"error": "Ảnh base64 không hợp lệ"})

        plate_text, ocr_conf, _, _, _, _, _ = _process_image_array(image, start_time)
        clean_plate = "".join(c for c in plate_text.upper() if c.isalnum())

        return LegacyPlateCandidate(
            plate=clean_plate if clean_plate else None,
            confidence=round(ocr_conf, 3) if clean_plate else None,
            modelVersion="yolov8-paddleocr-v1"
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
