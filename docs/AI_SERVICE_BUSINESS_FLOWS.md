# ĐẶC TẢ CÁC LUỒNG NGHIỆP VỤ PHÂN HỆ AI (AI SERVICE BUSINESS FLOWS)
## DỰ ÁN: SMART 3D PARKING MANAGEMENT SYSTEM (BASELINE V4)

> **Tài liệu tham chiếu:** [AGENTS.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/AGENTS.md), [02-BUSINESS-RULES.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/02-BUSINESS-RULES.md), [04-DATABASE.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/04-DATABASE.md)  
> **Ngôn ngữ & Nền tảng:** C# 13, .NET 9 Clean Architecture, Python FastAPI (YOLOv8 + PaddleOCR), PostgreSQL 17  
> **Kiến trúc:** Microservice độc lập (`Parking.AI`), giao tiếp Dual-Channel (RESTful API Envelope + gRPC Inter-service)

---

## MỤC LỤC
1. [Tổng quan Kiến trúc & Phạm vi Phân hệ AI](#1-tổng-quan-kiến-trúc--phạm-vi-phân-hệ-ai)
2. [Ma trận Tổng hợp Các Luồng Nghiệp vụ](#2-ma-trận-tổng-hợp-các-luồng-nghiệp-vụ)
3. [Chi tiết Luồng 1: Nhận diện Biển số xe Tự động (ANPR OCR)](#3-chi-tiết-luồng-1-nhận-diện-biển-số-xe-tự-động-anpr-ocr)
4. [Chi tiết Luồng 2: Soát xét Biển số Thủ công từ Nhân viên (Staff Review)](#4-chi-tiết-luồng-2-soát-xét-biển-số-thủ-công-từ-nhân-viên-staff-review)
5. [Chi tiết Luồng 3: Trợ lý ảo AI Đàm thoại Đa lượt (Contextual Chatbot)](#5-chi-tiết-luồng-3-trợ-lý-ảo-ai-đàm-thoại-đa-lượt-contextual-chatbot)
6. [Chi tiết Luồng 4: Tra cứu Quy chế / FAQ Nội bộ (Document Retrieval - No LLM)](#6-chi-tiết-luồng-4-tra-cứu-quy-chế--faq-nội-bộ-document-retrieval---no-llm)
7. [Chi tiết Luồng 5: Quản lý & Phê duyệt Tài liệu Tri thức (Knowledge Base)](#7-chi-tiết-luồng-5-quản-lý--phê-duyệt-tài-liệu-tri-thức-knowledge-base)
8. [Chi tiết Luồng 6: Tìm kiếm Bãi đỗ Thông minh (Smart Search & Rule 7)](#8-chi-tiết-luồng-6-tìm-kiếm-bãi-đỗ-thông-minh-smart-search--rule-7)
9. [Chi tiết Luồng 7: Thu thập Snapshot & Dự báo Công suất (Occupancy Forecast)](#9-chi-tiết-luồng-7-thu-thập-snapshot--dự-báo-công-suất-occupancy-forecast)
10. [Chi tiết Luồng 8: Phân quyền Phục vụ Cơ sở (Facility-Scoped RBAC Guard)](#10-chi-tiết-luồng-8-phân-quyền-phục-vụ-cơ-sở-facility-scoped-rbac-guard)

---

## 1. TỔNG QUAN KIẾN TRÚC & PHẠM VI PHÂN HỆ AI

Phân hệ **Parking.AI** chịu trách nhiệm cung cấp toàn bộ năng lực trí tuệ nhân tạo, thị giác máy tính và phân tích dự báo cho hệ thống quản lý bãi đỗ xe thông minh đa cơ sở (**Multi-Parking Lot Platform**).

```mermaid
flowchart TB
    subgraph Clients["Tác nhân / Giao diện"]
        BarrierCamera["Camera Barrier / Cổng"]
        StaffUser["Nhân viên Bãi (Staff/Manager)"]
        MobileGuest["Khách hàng (Web/Mobile App)"]
        AdminUser["Quản trị viên (Admin)"]
    end

    subgraph GatewayLayer["API Gateway (YARP Reverse Proxy)"]
        Gateway["Parking.Gateway (:8080)"]
    end

    subgraph AIService["AI Microservice (:8080 HTTP / :8081 gRPC)"]
        Program["Parking.AI.Api (Routing & Endpoints)"]
        OCRService["LicensePlateRecognitionService"]
        AssistantService["ParkingAssistantService (GenAI & Guardrails)"]
        SearchService["ParkingSearchAiService (NLP & Rule 7)"]
        ForecastService["AIReadService (Forecast Engine)"]
        GrpcEndpoints["PlateRecognitionGrpc & OccupancyIngestionGrpc"]
    end

    subgraph VisionService["Python Vision Microservice (:8000)"]
        FastAPI["ai_vision_service (FastAPI)"]
        YOLO["YOLOv8 Plate Detector"]
        OCR["PaddleOCR Text Recognizer"]
    end

    subgraph ExternalServices["Dịch vụ Liên kết / Bên ngoài"]
        GeminiAPI["Google Gemini API (1.5 Flash)"]
        IdentityService["Parking.Identity (gRPC :8081)"]
        ParkingService["Parking.Parking (Occupancy Worker :8081)"]
    end

    subgraph AIDatabase["PostgreSQL Database: parking_ai"]
        DBPlate["ai_plate_recognitions"]
        DBForecast["occupancy_snapshots & occupancy_forecasts"]
        DBDocs["assistant_documents & chunks"]
        DBAudit["audit_logs (Append-Only)"]
        DBCatalog["ai_lot_catalog"]
    end

    BarrierCamera -->|POST /api/v1/ai/license-plate/scan| Gateway
    StaffUser -->|POST /review| Gateway
    MobileGuest -->|POST /assistant/chat & smart-search| Gateway
    AdminUser -->|POST /documents & /publish| Gateway

    Gateway --> Program
    Program --> OCRService & AssistantService & SearchService & ForecastService
    Program --> GrpcEndpoints

    OCRService -->|HTTP Multipart| FastAPI
    FastAPI --> YOLO --> OCR

    AssistantService -->|HTTP REST| GeminiAPI
    Program -->|gRPC CheckAccess| IdentityService
    ParkingService -->|gRPC RecordSnapshot| GrpcEndpoints

    OCRService --> DBPlate
    ForecastService --> DBForecast
    Program --> DBDocs & DBAudit & DBCatalog
```

---

## 2. MA TRẬN TỔNG HỢP CÁC LUỒNG NGHIỆP VỤ

| Luồng | Tên Nghiệp vụ | Giao thức / Endpoint | Bảng CSDL Tác động | Tác nhân Chính |
|:---:|:---|:---|:---|:---|
| **WF-01** | Nhận diện Biển số xe ANPR | `POST /api/v1/ai/license-plate/scan`<br>gRPC `PlateRecognition.Recognize` | `ai_plate_recognitions` | Camera Barrier, Cổng vào/ra |
| **WF-02** | Soát xét Biển số Thủ công | `POST /api/v1/parking-lots/{lotId}/plate-recognitions/{id}/review` | `ai_plate_recognitions`<br>`audit_logs` | Staff bãi xe |
| **WF-03** | Trợ lý ảo AI Đàm thoại Đa lượt | `POST /api/v1/ai/assistant/chat`<br>`DELETE /session/{sessionId}` | In-Memory Session (TTL 45m) | Khách hàng |
| **WF-04** | Tra cứu Quy chế / FAQ (No-LLM) | `POST /api/v1/parking-lots/{lotId}/assistant` | `assistant_documents`<br>`assistant_document_chunks` | Khách hàng, Staff |
| **WF-05** | Quản lý Tài liệu Tri thức | `POST /api/v1/ai/documents`<br>`POST /api/v1/ai/documents/{id}/publish` | `assistant_documents`<br>`assistant_document_chunks`<br>`audit_logs` | Admin |
| **WF-06** | Tìm kiếm Bãi đỗ Thông minh | `POST /api/v1/ai/parking/smart-search`<br>`POST /api/v1/ai/parking/recommend` | `ai_lot_catalog`<br>`occupancy_snapshots` | Khách hàng |
| **WF-07** | Dự báo Công suất Bãi đỗ | gRPC `OccupancyIngestion.RecordSnapshot`<br>`GET /occupancy-forecasts` | `occupancy_snapshots`<br>`occupancy_forecasts` | Parking Worker, Khách hàng |
| **WF-08** | Phân quyền Phạm vi Bãi (RBAC) | Inter-service gRPC check | `audit_logs` | Toàn bộ Actor có định danh |

---

## 3. CHI TIẾT LUỒNG 1: NHẬN DIỆN BIỂN SỐ XE TỰ ĐỘNG (ANPR OCR)

### Mục tiêu nghiệp vụ
Tự động nhận diện biển số xe khi phương tiện tiến vào cổng check-in hoặc check-out tại barrier; phân loại phương tiện (Ô tô / Xe máy); tách biệt chuỗi chuẩn hóa CSDL và chuỗi hiển thị giao diện; lưu vết kiểm toán và hỗ trợ cơ chế phòng vệ khi dịch vụ AI ngoại tuyến.

```mermaid
sequenceDiagram
    autonumber
    actor Barrier as Camera Barrier / Mobile Client
    participant AI as Parking.AI.Api
    participant LPR as LicensePlateRecognitionService
    participant Python as ai_vision_service (YOLO + PaddleOCR)
    participant DB as PostgreSQL (ai_plate_recognitions)

    Barrier->>AI: POST /api/v1/ai/license-plate/scan (Form-data / Base64)
    AI->>AI: Kiểm tra Header Magic Bytes (PNG: 89 50 4E 47 / JPEG: FF D8 FF)
    alt Định dạng file không hợp lệ hoặc quá 4MB
        AI-->>Barrier: HTTP 400 Bad Request ("Định dạng file không được hỗ trợ")
    end

    AI->>LPR: RecognizePlateFromBytesAsync(imageBytes, gateId, direction, lotId)
    LPR->>LPR: Tính SHA-256 Digest của ảnh
    LPR->>Python: POST /detect-plate (Multipart file)
    
    alt Python Service phản hồi thành công
        Python-->>LPR: DetectionResponse (PlateText, Confidence, CroppedBase64)
    else Mất kết nối Python (Timeout / SocketException)
        LPR->>LPR: Kích hoạt Simulated Fallback Generator (isFallback = true)
    end

    LPR->>LPR: ToAlphanumericPlate: Loại bỏ ký tự đặc biệt -> "51K88888" (Cho DB)
    LPR->>LPR: FormatDisplayPlate: Định dạng chuẩn VN -> "51K-888.88" (Cho UI)
    LPR->>LPR: PredictVehicleType: Phán đoán loại xe (Car / Motorbike)
    LPR->>LPR: EvaluateRecognitionStatus: Đánh giá độ tin cậy

    LPR->>DB: INSERT INTO ai_plate_recognitions (lot_id, uploaded_by, candidate_plate, status='PENDING_REVIEW', expires_at=now()+24h)
    DB-->>LPR: Lưu thành công (hoặc ON CONFLICT DO NOTHING)

    LPR-->>AI: PlateRecognitionResultDto
    AI-->>Barrier: HTTP 200 OK (ApiResponse<PlateRecognitionResultDto>)
```

### Các quy tắc cốt lõi (Invariants):
1. **Tách biệt định dạng (DEF-01):**
   - `PlateNumber`: Chuỗi chữ và số liền mạch, chuẩn regex `^[A-Z0-9]{1,20}$` (thỏa mãn DB Check Constraint của bảng `ai_plate_recognitions`).
   - `DisplayPlate`: Chuỗi thân thiện người dùng (VD: `51K-888.88` hoặc `59-P1 678.90`).
2. **Kiểm tra nhị phân (DEF-08):** Bắt buộc kiểm tra Magic Bytes nhị phân, loại trừ các file mã độc giả mạo đuôi ảnh.
3. **Idempotency & Expiration:** Khóa duy nhất `(lot_id, uploaded_by, idempotency_key)` chống chụp lặp barrier; bản ghi hết hạn sau 24 giờ.

---

## 4. CHI TIẾT LUỒNG 2: SOÁT XÉT BIỂN SỐ THỦ CÔNG TỪ NHÂN VIÊN (STAFF REVIEW)

### Mục tiêu nghiệp vụ
Cho phép nhân viên chốt trực (`PARKING_STAFF`) tại cổng bãi xe chỉnh sửa lại biển số khi camera nhận diện sai hoặc mờ, ghi vết kiểm toán minh bạch phục vụ đối soát tài chính lúc xe ra.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Nhân viên Bãi xe (STAFF)
    participant AI as Parking.AI.Api
    participant Identity as Parking.Identity (gRPC)
    participant DB as PostgreSQL (parking_ai)

    Staff->>AI: POST /api/v1/parking-lots/{lotId}/plate-recognitions/{id}/review
    Note over Staff,AI: Body: { plate: "51K-888.88", version: 1, reason: "Ảnh mờ do trời mưa" }

    AI->>Identity: CheckAccessAsync(UserId, LotId, Capability="OCR")
    alt Không có quyền thao tác trên bãi xe này
        Identity-->>AI: Allowed = false
        AI-->>Staff: HTTP 403 Forbidden ("Current account/lot permission denied")
    end

    AI->>AI: Sanitize biển số: Xóa dấu gạch/chấm -> "51K88888"
    AI->>AI: Kiểm tra hợp lệ ImageRules.IsNormalizedPlate("51K88888")

    AI->>DB: BEGIN TRANSACTION
    AI->>DB: UPDATE ai_plate_recognitions SET status='REVIEWED', reviewed_plate=@plate, reviewed_by=@actor, reviewed_at=now(), version=version+1 WHERE id=@id AND lot_id=@lot AND status='PENDING_REVIEW' AND version=@version AND expires_at>now()

    alt Không tìm thấy bản ghi hoặc Version Conflict (Optimistic Lock)
        DB-->>AI: Rows affected = 0
        AI->>DB: ROLLBACK
        AI-->>Staff: HTTP 409 Conflict ("Recognition state/version/expiry conflict")
    else Cập nhật thành công
        AI->>DB: INSERT INTO audit_logs (actor, action='REVIEW_PLATE', entity_id, reason)
        AI->>DB: COMMIT TRANSACTION
        AI-->>Staff: HTTP 200 OK ({ id, status: "REVIEWED" })
    end
```

---

## 5. CHI TIẾT LUỒNG 3: TRỢ LÝ ẢO AI ĐÀM THOẠI ĐA LƯỢT (CONTEXTUAL CHATBOT)

### Mục tiêu nghiệp vụ
Cung cấp kênh tư vấn 24/7 cho khách hàng về giá vé, cách đặt chỗ, thủ tục khi mất thẻ xe, quy định PCCC và an toàn bãi xe; tích hợp bộ lọc Guardrails loại bỏ các câu hỏi lạc đề; kiểm soát bộ nhớ RAM nghiêm ngặt.

```mermaid
sequenceDiagram
    autonumber
    actor User as Khách hàng (App)
    participant AI as ParkingAssistantService
    participant Guard as Zero-Cost Guardrails
    participant Cache as In-Memory Concurrent Session
    participant Gemini as Google Gemini API (1.5 Flash)

    User->>AI: POST /api/v1/ai/assistant/chat (SessionId, Message)
    
    AI->>Cache: EvictExpiredSessions() (Dọn dẹp các session > 45 phút không hoạt động)
    AI->>Cache: Lấy hoặc tạo mới Session, lock (session)
    AI->>Cache: Bổ sung tin nhắn của User, cắt tỉa Sliding Window (Tối đa 20 tin)

    AI->>Guard: IsDefinitelyOutOfDomain(Message)
    alt Phát hiện câu hỏi lạc đề (Lập trình, chính trị, làm thơ, bóng đá...)
        Guard-->>AI: IsOutOfDomain = true
        AI->>Cache: Bổ sung câu trả lời từ chối lịch sự
        AI-->>User: Phản hồi từ chối tức thời (Tiết kiệm 100% token LLM, isFallback = false)
    end

    AI->>Cache: Trích xuất 6 tin nhắn hội thoại gần nhất làm ngữ cảnh
    AI->>Gemini: GenerateTextAsync(SystemKnowledgeBase, ContextPrompt)
    
    alt Gọi Gemini thành công
        Gemini-->>AI: Raw Text chứa nội dung và gợi ý [SUGGESTION: ...]
    else Không có API Key hoặc Gemini Timeout
        AI->>AI: Kích hoạt Local Heuristic Engine (Mô phỏng thông minh, isFallback = true)
    end

    AI->>AI: ParseReplyAndSuggestions (Bóc tách câu trả lời và 3 câu hỏi gợi ý kế tiếp)
    AI->>Cache: Bổ sung câu trả lời của Trợ lý vào lịch sử
    AI-->>User: HTTP 200 OK (AssistantChatResponseDto)
```

### Bộ lọc Zero-Cost Guardrails (DEF-04):
- **Cơ chế:** Kiểm tra trực tiếp trên chuỗi văn bản không tốn tài nguyên GPU/Token.
- **Quy tắc chặn:** Tự động chặn các chủ đề không liên quan (viết code, thơ ca, thời tiết, chính trị, công thức nấu ăn, đạo hàm toán học, phim ảnh) nếu câu hỏi dài trên 20 ký tự mà hoàn toàn không chứa từ khóa bãi xe (`xe`, `đỗ`, `gửi`, `giá`, `slot`, `barrier`, `camera`, `vào`, `ra`, `thẻ`, `vé`, v.v.).

---

## 6. CHI TIẾT LUỒNG 4: TRA CỨU QUY CHẾ / FAQ NỘI BỘ (DOCUMENT RETRIEVAL - NO LLM)

### Mục tiêu nghiệp vụ
Cung cấp cơ chế tra cứu cứu trích đoạn văn bản pháp lý chính xác 100% (RAG không dùng LLM) từ các tài liệu đã được Ban Quản lý bãi xe phê duyệt, loại bỏ hoàn toàn hiện tượng "ảo giác" (hallucination).

```mermaid
sequenceDiagram
    autonumber
    actor Client as Khách hàng / Nhân viên
    participant Service as AIReadService.AssistantAsync
    participant DB as PostgreSQL (assistant_documents)

    Client->>Service: POST /api/v1/parking-lots/{lotId}/assistant (Question)
    Service->>Service: Bóc tách tối đa 10 từ khóa chính trong câu hỏi
    
    Service->>DB: SELECT d.title, c.section_title, c.content, d.source_reference FROM assistant_documents d JOIN assistant_document_chunks c ON c.document_id = d.id WHERE d.status='PUBLISHED' AND d.visibility='PUBLIC' AND d.language='vi' AND d.approved_by IS NOT NULL AND d.effective_from <= now() AND (d.effective_until IS NULL OR now() < d.effective_until) AND (d.lot_id = @lot OR d.lot_id IS NULL) AND (content LIKE %term1% OR ...) ORDER BY (d.lot_id IS NOT NULL) DESC LIMIT 3

    DB-->>Service: Trả về danh sách trích đoạn tài liệu phù hợp
    Service-->>Client: HTTP 200 OK ({ mode: "RETRIEVAL_NO_LLM", answers: [...], message: "..." })
```

---

## 7. CHI TIẾT LUỒNG 5: QUẢN LÝ & PHÊ DUYỆT TÀI LIỆU TRI THỨC (KNOWLEDGE BASE)

### Mục tiêu nghiệp vụ
Cho phép Ban Quản trị (`ADMIN`) cập nhật và phê duyệt các quy định, biểu phí, hướng dẫn xử lý sự cố của từng bãi xe theo phiên bản (Versioning) có ghi vết kiểm toán.

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Tạo tài liệu (POST /api/v1/ai/documents)
    DRAFT --> PUBLISHED : Duyệt công khai (POST /api/v1/ai/documents/{id}/publish)
    PUBLISHED --> ARCHIVED : Hết hạn hiệu lực (effective_until < now)
    
    note right of DRAFT
        - Yêu cầu quyền ADMIN
        - Tạo chunk đầu tiên
        - Ghi audit log: CREATE_ASSISTANT_DOCUMENT
    end note

    note right of PUBLISHED
        - Yêu cầu confirmPublicContentReviewed = true
        - Gán approved_by và published_at
        - Tăng Version = Version + 1
        - Ghi audit log: PUBLISH_ASSISTANT_DOCUMENT
    end note
```

---

## 8. CHI TIẾT LUỒNG 6: TÌM KIẾM BÃI ĐỖ THÔNG MINH (SMART SEARCH & RULE 7)

### Mục tiêu nghiệp vụ
Cho phép người dùng nhập yêu cầu bằng ngôn ngữ tự nhiên (hoặc giọng nói); AI tự động phân tích ý định, áp dụng công thức tính khoảng cách GPS đường chim bay (**Haversine**) và tính toán biểu phí chính xác theo **Baseline Rule 7** (Block 15 phút, Daily Cap, Giờ cao điểm).

```mermaid
sequenceDiagram
    autonumber
    actor User as Khách hàng
    participant Search as ParkingSearchAiService
    participant Gemini as GeminiApiClient
    participant DB as PostgreSQL (ai_lot_catalog & snapshots)

    User->>Search: POST /api/v1/ai/parking/smart-search ("Tìm bãi đỗ ô tô gần Landmark 81 đỗ 3 tiếng, giá rẻ")
    Search->>Gemini: ParseSearchIntentAsync (Prompt NLP phân tích JSON)
    Gemini-->>Search: JSON Criteria: { destination: "Landmark 81", vehicleType: "Car", duration: 3.0, priority: "CHEAPEST" }

    Search->>DB: Truy vấn bãi xe từ ai_lot_catalog kết hợp occupancy_snapshots
    alt Bảng catalog trống (Môi trường mới)
        Search->>DB: Tự động Seed 4 bãi xe mặc định theo chuẩn Multi-Parking Lot
    end
    DB-->>Search: Danh sách bãi xe (Tọa độ GPS, Sức chứa, Chỗ trống)

    loop Với từng bãi xe
        Search->>Search: Tính khoảng cách Haversine: Distance(UserGPS, LotGPS)
        Search->>Search: Tính giá Rule 7: Duration 3h = 12 block (15 phút/block)
        Search->>Search: Áp dụng Daily Cap (Trần giá tối đa 8 giờ)
        Search->>Search: Chấm điểm MatchScore (Ưu tiên CHEAPEST hoặc NEAREST)
    end

    Search->>Search: Sắp xếp danh sách theo MatchScore giảm dần
    Search-->>User: HTTP 200 OK (ParkingRecommendationDto)
```

---

## 9. CHI TIẾT LUỒNG 7: THU THẬP SNAPSHOT & DỰ BÁO CÔNG SUẤT (OCCUPANCY FORECAST)

### Mục tiêu nghiệp vụ
Theo dõi tải thực tế của bãi xe theo thời gian thực và đưa ra cảnh báo/dự báo trước 30/60/120 phút giúp người dùng chọn thời điểm đỗ xe tối ưu.

```mermaid
sequenceDiagram
    autonumber
    participant Worker as OccupancyWorker (Parking Service)
    participant Grpc as OccupancyIngestionGrpc
    participant Read as AIReadService.ForecastAsync
    participant DB as PostgreSQL (occupancy_snapshots & forecasts)

    rect rgb(240, 248, 255)
        Note over Worker,DB: TIẾN TRÌNH THU THẬP NỀN (MỖI 60 GIÂY)
        Worker->>Worker: Quét số lượng slot ACTIVE, OCCUPIED, RESERVED
        Worker->>Grpc: RecordSnapshot(lotId, vehicleType, capacity, occupied, reserved)
        Grpc->>DB: INSERT INTO occupancy_snapshots (..., data_source='ACTUAL')
        DB-->>Grpc: SnapshotId
    end

    rect rgb(255, 250, 240)
        Note over Read,DB: TIẾN TRÌNH TRUY VẤN DỰ BÁO (IDEMPOTENT READ)
        actor User as Khách hàng / Staff
        User->>Read: GET /api/v1/parking-lots/{lotId}/occupancy-forecasts?horizonMinutes=60
        Read->>DB: Kiểm tra dự báo đã tính trong 15 phút gần nhất
        alt Đã có dự báo mới
            DB-->>Read: Trả về bản ghi dự báo có sẵn (Bảo toàn Idempotency)
        else Chưa có dự báo mới
            Read->>DB: SELECT 4 snapshot gần nhất
            alt Có snapshot thực tế
                Read->>Read: Tính Rolling Mean (Trung bình trượt), dataSource = 'ACTUAL'
            else Cold-Start (Chưa có snapshot nào)
                Read->>Read: Sinh baseline mô phỏng an toàn, dataSource = 'SIMULATED'
            end
            Read->>DB: INSERT INTO occupancy_forecasts (...)
            DB-->>Read: Lưu dự báo mới thành công
        end
        Read-->>User: HTTP 200 OK (Forecast Result)
    end
```

---

## 10. CHI TIẾT LUỒNG 8: PHÂN QUYỀN PHỤC VỤ CƠ SỞ (FACILITY-SCORED RBAC GUARD)

### Mục tiêu nghiệp vụ
Bảo đảm tính toàn vẹn của mô hình **Multi-Parking Lot**: Nhân viên của Bãi A tuyệt đối không được duyệt biển số hoặc can thiệp dữ liệu của Bãi B.

```mermaid
flowchart TD
    Request["Request từ Client kèm JWT Bearer"] --> ExtractClaims["Trích xuất Subject (UserId) từ JWT"]
    ExtractClaims --> TargetLot{"Endpoint có yêu cầu phạm vi bãi (LotId)?"}
    
    TargetLot -- Không (Quyền Global) --> CheckAdmin{"Yêu cầu quyền ADMIN?"}
    CheckAdmin -- Có --> CallIdentityGlobal["gRPC Identity: CheckAccess(UserId, LotId=Empty, Capability='ADMIN')"]
    
    TargetLot -- Có (Quyền bãi cụ thể) --> CallIdentityLot["gRPC Identity: CheckAccess(UserId, LotId, Capability='OCR')"]
    
    CallIdentityGlobal --> EvaluateReply{"Reply.Allowed == true?"}
    CallIdentityLot --> EvaluateReply
    
    EvaluateReply -- Yes --> ExecuteBusiness["Cho phép thực thi nghiệp vụ API"]
    EvaluateReply -- No --> Throw403["Ném ServiceException(403, 'Current account/lot permission denied')"]
```

---

## 11. BẢNG MÃ LỖI CHUẨN HÓA (PROBLEM DETAILS & STATUS CODES)

Mọi phản hồi lỗi từ Phân hệ AI đều tuân thủ chặt chẽ định dạng Envelope theo [APIDesignTemplate.md](file:///d:/FSOFT_FALL26_NET/Project.CleanArchitecture/ParkingSystemAI/docs/APIDesignTemplate.md):

```json
{
  "result": null,
  "isSuccess": false,
  "statusCode": 400,
  "message": "Định dạng file không được hỗ trợ. Chỉ chấp nhận ảnh PNG hoặc JPEG hợp lệ."
}
```

| Mã HTTP | Tình huống kích hoạt trong AI Service |
|:---:|:---|
| `400 Bad Request` | Base64 sai format, file upload không phải PNG/JPEG, câu hỏi quá 1000 ký tự, horizon không thuộc (30, 60, 120). |
| `401 Unauthorized` | Thiếu hoặc hết hạn token JWT Bearer trên các endpoint bảo mật. |
| `403 Forbidden` | Nhân viên cố tình duyệt biển số hoặc sửa tài liệu của bãi xe không được phân công quản lý. |
| `404 Not Found` | Bản ghi nhận diện biển số hoặc tài liệu tri thức không tồn tại. |
| `409 Conflict` | Xung đột phiên bản (Optimistic Lock Version Conflict) khi 2 nhân viên cùng duyệt 1 biển số hoặc tài liệu cùng lúc. |
| `503 Service Unavailable` | Không thể kết nối dịch vụ thiết yếu và không có cơ chế fallback khả dụng. |

---

*Tài liệu được biên soạn và chuẩn hóa theo kiến trúc Baseline V4.*
