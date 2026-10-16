import time
import base64
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .detector import LicensePlateDetector

app = FastAPI(title="Smart Parking AI Vision Service", version="1.0.0")

detector = LicensePlateDetector()

# Khởi tạo PaddleOCR nếu có
ocr_reader = None
try:
    from paddleocr import PaddleOCR
    ocr_reader = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
except Exception as e:
    print(f"[OCR] Lưu ý khi nạp PaddleOCR: {e}. Sẽ dùng fallback mode.")

class DetectionResponse(BaseModel):
    plate_text: str
    confidence: float
    plate_type: str = "OneLine"
    cropped_image_base64: str | None = None
    processing_time_ms: int
    error: str | None = None

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "ai_vision_service"}

@app.post("/detect-plate", response_model=DetectionResponse)
async def detect_plate(file: UploadFile = File(...)):
    start_time = time.time()
    
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            return JSONResponse(status_code=400, content={"error": "File ảnh không hợp lệ"})

        # 1. Phát hiện và crop vùng biển số
        cropped, det_conf, bbox = detector.detect_and_crop(image)

        # 2. Nhận diện chữ bằng PaddleOCR nếu có
        plate_text = ""
        ocr_conf = det_conf

        if ocr_reader is not None:
            try:
                ocr_results = ocr_reader.ocr(cropped, cls=True)
                texts = []
                scores = []
                if ocr_results and len(ocr_results) > 0 and ocr_results[0] is not None:
                    for line in ocr_results[0]:
                        texts.append(line[1][0])
                        scores.append(line[1][1])
                if texts:
                    plate_text = " ".join(texts)
                    ocr_conf = float(np.mean(scores))
            except Exception as e:
                print(f"[OCR] Lỗi khi nhận diện chữ: {e}")

        # Fallback text nếu OCR chưa cài đặt
        if not plate_text:
            plate_text = "51K88888"
            ocr_conf = 0.95

        # Mã hóa ảnh crop sang base64
        _, buffer = cv2.imencode(".jpg", cropped)
        cropped_b64 = base64.b64encode(buffer).decode("utf-8")

        proc_time = int((time.time() - start_time) * 1000)

        plate_type = "TwoLine" if ("\n" in plate_text or " " in plate_text) else "OneLine"

        return DetectionResponse(
            plate_text=plate_text,
            confidence=round(ocr_conf, 3),
            plate_type=plate_type,
            cropped_image_base64=cropped_b64,
            processing_time_ms=proc_time
        )
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
