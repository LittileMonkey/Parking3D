import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  Bike,
  QrCode,
  Search,
  CheckCircle2,
  Printer,
  CreditCard,
  Banknote,
  RotateCcw,
  Layers,
  Camera,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type {
  ParkingSession,
  CheckInResult,
  CheckOutFeeInfo,
  VehicleType,
  PlateRecognitionResult,
} from "../../types/staff";

export default function VehicleOperations() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "checkout" ? "checkout" : "checkin";
  const initialPlate = searchParams.get("plate") || "";

  const [activeTab, setActiveTab] = useState<"checkin" | "checkout">(initialTab);
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Vehicle Category for Dynamic Camera Layout: "Motorcycle" | "Car"
  const [cameraVehicleCategory, setCameraVehicleCategory] = useState<"Car" | "Motorcycle">("Car");

  // Check-In Form State
  const [checkInPlate, setCheckInPlate] = useState(initialPlate);
  const [checkInBooking, setCheckInBooking] = useState("");
  const [checkInGate, setCheckInGate] = useState("Cổng Vào G1");
  const [checkInVehicleType, setCheckInVehicleType] = useState<VehicleType>("Car");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<CheckInResult | null>(null);

  // Check-Out Form State
  const [checkOutQuery, setCheckOutQuery] = useState(initialPlate);
  const [feeInfo, setFeeInfo] = useState<CheckOutFeeInfo | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [checkOutMethod, setCheckOutMethod] = useState<"Cash" | "Card" | "Wallet">("Cash");
  const [checkOutProcessing, setCheckOutProcessing] = useState(false);
  const [checkOutSuccess, setCheckOutSuccess] = useState<{ message: string; receiptNumber: string } | null>(null);
  const [onlinePaymentStatus, setOnlinePaymentStatus] = useState<string | null>(null);
  const [checkingOnlinePayment, setCheckingOnlinePayment] = useState(false);

  // Camera ANPR Boxes State (Quản lý trạng thái và ảnh tải lên riêng cho từng ô camera)
  interface CamBoxState {
    fileUrl?: string;
    result?: PlateRecognitionResult;
    scanning?: boolean;
    plateText?: string;
    confidence?: string;
  }

  const [cameraStates, setCameraStates] = useState<Record<string, CamBoxState>>({
    "moto-cam1": {},
    "moto-cam2": { plateText: "59-P1 982.14", confidence: "Độ chính xác: 99.2% • Honda AirBlade" },
    "car-cam1": { plateText: "51K - 892.45", confidence: "AI: 99.4% • Toyota Cross" },
    "car-cam2": { plateText: "51K - 892.45", confidence: "AI: 98.9% • Khớp biển trước" },
    "car-cam3": {},
    "car-cam4": {},
  });
  const [activeTargetCam, setActiveTargetCam] = useState<string>("car-cam1");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleTriggerUploadForCam = (camId: string) => {
    setActiveTargetCam(camId);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";
    const camId = activeTargetCam;

    if (file.size > 5 * 1024 * 1024) {
      alert("Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      alert("Chỉ chấp nhận file ảnh JPG hoặc PNG hợp lệ.");
      return;
    }

    const previewUrl = URL.createObjectURL(file);

    // Kích hoạt trạng thái quét riêng cho ô camera này
    setCameraStates((prev) => ({
      ...prev,
      [camId]: {
        ...prev[camId],
        fileUrl: previewUrl,
        scanning: true,
      },
    }));

    try {
      const gate = activeTab === "checkin" ? checkInGate : "Cổng Ra G3";
      const direction = activeTab === "checkin" ? "IN" : "OUT";
      const result = await staffApi.scanLicensePlate(file, gate, direction);

      const recognizedPlate = result.displayPlate || result.plateNumber;

      setCameraStates((prev) => ({
        ...prev,
        [camId]: {
          fileUrl: previewUrl,
          result: result,
          scanning: false,
          plateText: recognizedPlate || "Không nhận diện được",
          confidence: `AI: ${(result.confidence * 100).toFixed(1)}%${result.isFallback ? " (Giả lập)" : ""}`,
        },
      }));

      if (recognizedPlate) {
        if (activeTab === "checkin") {
          setCheckInPlate(recognizedPlate);

          const isMoto =
            result.vehicleTypeSuggestion === "Motorcycle" ||
            String(result.vehicleTypeSuggestion) === "1" ||
            result.plateType === "TwoLine" ||
            recognizedPlate.includes("-P") ||
            recognizedPlate.includes("-V");

          if (isMoto) {
            setCheckInVehicleType("Motorcycle");
            setCameraVehicleCategory("Motorcycle");
          } else {
            setCheckInVehicleType("Car");
            setCameraVehicleCategory("Car");
          }
        } else {
          setCheckOutQuery(recognizedPlate);
          handleLookupFee(recognizedPlate);
        }
      }
    } catch (err: any) {
      console.error("AI Plate Recognition error for cam:", camId, err);
      alert("Lỗi nhận diện biển số: " + (err.message || "Máy chủ OCR không phản hồi"));
      setCameraStates((prev) => ({
        ...prev,
        [camId]: {
          ...prev[camId],
          scanning: false,
        },
      }));
    }
  };

  const handleResetCam = (camId: string, defaultPlate?: string, defaultConf?: string) => {
    setCameraStates((prev) => ({
      ...prev,
      [camId]: {
        fileUrl: undefined,
        result: undefined,
        scanning: false,
        plateText: defaultPlate,
        confidence: defaultConf,
      },
    }));
  };

  // Sync category when user changes vehicle type in form
  const handleVehicleTypeChange = (vt: VehicleType) => {
    setCheckInVehicleType(vt);
    if (vt === "Motorcycle") {
      setCameraVehicleCategory("Motorcycle");
    } else {
      setCameraVehicleCategory("Car");
    }
  };

  const handleCameraCategoryToggle = (category: "Car" | "Motorcycle") => {
    setCameraVehicleCategory(category);
    if (category === "Motorcycle") {
      setCheckInVehicleType("Motorcycle");
      setCheckInPlate("59-P1 982.14");
    } else {
      setCheckInVehicleType("Car");
      setCheckInPlate("51K-892.45");
    }
  };

  const handleCheckOnlinePayment = async () => {
    if (!feeInfo?.bookingId) {
      alert("Lượt đỗ này không gắn với Booking ID trực tuyến!");
      return;
    }
    setCheckingOnlinePayment(true);
    try {
      const res = await staffApi.getPaymentStatus(feeInfo.bookingId);
      if (res && (res.status === "COMPLETED" || res.status === "SUCCESS")) {
        setOnlinePaymentStatus("Đã thanh toán thành công trực tuyến");
      } else if (res?.status) {
        setOnlinePaymentStatus(`Trạng thái: ${res.status}`);
      } else {
        setOnlinePaymentStatus("Chưa nhận được thanh toán trực tuyến");
      }
    } catch {
      setOnlinePaymentStatus("Chưa nhận được thanh toán trực tuyến");
    } finally {
      setCheckingOnlinePayment(false);
    }
  };

  // Load Sessions
  const loadSessions = async () => {
    try {
      const data = await staffApi.getSessions({ status: statusFilter, query: filterQuery });
      setSessions(data);
    } catch (err) {
      console.error("Load sessions error:", err);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [statusFilter, filterQuery]);

  // Handle Initial Query from URL
  useEffect(() => {
    if (initialPlate && initialTab === "checkout") {
      handleLookupFee(initialPlate);
    }
  }, [initialPlate, initialTab]);

  // Check-In Submit
  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckInLoading(true);
    setCheckInSuccess(null);
    try {
      const res = await staffApi.checkInVehicle({
        licensePlate: checkInPlate.trim(),
        bookingCode: checkInBooking.trim() || undefined,
        gateId: checkInGate,
      });
      setCheckInSuccess(res);
      setCheckInPlate("");
      setCheckInBooking("");
      loadSessions();
    } catch (err: any) {
      alert("Lỗi check-in: " + err.message);
    } finally {
      setCheckInLoading(false);
    }
  };

  // Lookup Fee for Check-Out
  const handleLookupFee = async (overrideQ?: string) => {
    const q = overrideQ ?? checkOutQuery;
    if (!q.trim()) return;
    setCalculatingFee(true);
    setCheckOutSuccess(null);
    try {
      const info = await staffApi.calculateCheckOutFee(q.trim());
      setFeeInfo(info);
      if (!info) {
        alert("Không tìm thấy xe đang gửi khớp với thông tin: " + q);
      }
    } catch (err: any) {
      alert("Lỗi tính phí: " + err.message);
    } finally {
      setCalculatingFee(false);
    }
  };

  // Check-Out Submit
  const handleCheckOut = async () => {
    if (!feeInfo) return;
    setCheckOutProcessing(true);
    try {
      const res = await staffApi.checkOutVehicle({
        sessionId: feeInfo.sessionId,
        paymentMethod: checkOutMethod,
        gateId: "Cổng Ra G3",
      });
      setCheckOutSuccess(res);
      setFeeInfo(null);
      setCheckOutQuery("");
      loadSessions();
    } catch (err: any) {
      alert("Lỗi check-out: " + err.message);
    } finally {
      setCheckOutProcessing(false);
    }
  };

  return (
    <div className="pm-operations-container">
      {/* Hidden File Input for AI License Plate OCR */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/jpeg,image/png,image/jpg"
        style={{ display: "none" }}
      />

      {/* ─── 1. Header Row ─────────────────────────────────────────────────── */}
      <div className="pm-header-row">
        <div>
          <h1 className="pm-section-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Car size={26} color="var(--pm-teal)" />
            <span>Điều phối Xe Vào &amp; Xe Ra</span>
          </h1>
          <p className="pm-section-subtitle">
            Xử lý tiếp nhận tại cổng vào, kiểm tra mã đặt chỗ QR, tính phí xuất bến và điều khiển Barrier tự động
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="pm-tab-switcher">
          <button
            type="button"
            onClick={() => {
              setActiveTab("checkin");
              setCheckInSuccess(null);
            }}
            className={`pm-tab-btn ${activeTab === "checkin" ? "active" : ""}`}
          >
            <ArrowDownLeft size={16} />
            <span>CỔNG VÀO (CHECK-IN)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("checkout");
              setCheckOutSuccess(null);
            }}
            className={`pm-tab-btn ${activeTab === "checkout" ? "active" : ""}`}
          >
            <ArrowUpRight size={16} />
            <span>CỔNG RA (CHECK-OUT)</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Main Two-Column Operations Layout ───────────────────────────── */}
      <div className="pm-operations-grid">
        {/* LEFT COLUMN: Check-In or Check-Out Form Card */}
        <div className="pm-op-card">
          {activeTab === "checkin" ? (
            <>
              <div className="pm-op-card-header checkin-accent">
                <div className="pm-card-title-group">
                  <ArrowDownLeft size={19} className="pm-icon-teal" />
                  <h2 className="pm-op-card-title">Tiếp nhận Xe vào Cổng</h2>
                </div>
                <span className="pm-badge-success">Barrier G1 Sẵn sàng</span>
              </div>

              <div className="pm-op-card-body">
                <form onSubmit={handleCheckIn} className="pm-form-stack">
                  <div className="pm-form-field">
                    <label className="pm-form-label">
                      Biển số xe nhận diện (hoặc nhập thủ công) <span className="pm-required">*</span>:
                    </label>
                    <input
                      type="text"
                      required
                      className="pm-form-input pm-plate-input"
                      placeholder="VD: 51K-892.45"
                      value={checkInPlate}
                      onChange={(e) => setCheckInPlate(e.target.value)}
                    />
                  </div>

                  <div className="pm-form-row">
                    <div className="pm-form-field">
                      <label className="pm-form-label">Mã đặt chỗ (nếu có):</label>
                      <input
                        type="text"
                        className="pm-form-input"
                        placeholder="BK-2026..."
                        value={checkInBooking}
                        onChange={(e) => setCheckInBooking(e.target.value)}
                      />
                    </div>

                    <div className="pm-form-field">
                      <label className="pm-form-label">Loại xe:</label>
                      <select
                        className="pm-form-select"
                        value={checkInVehicleType}
                        onChange={(e) => handleVehicleTypeChange(e.target.value as VehicleType)}
                      >
                        <option value="Car">Ô tô (4-7 chỗ)</option>
                        <option value="Motorcycle">Xe máy</option>
                        <option value="EV">Xe điện (EV)</option>
                        <option value="Truck">Xe tải nhẹ</option>
                      </select>
                    </div>
                  </div>

                  <div className="pm-form-field">
                    <label className="pm-form-label">Cổng vào chỉ định:</label>
                    <select
                      className="pm-form-select"
                      value={checkInGate}
                      onChange={(e) => setCheckInGate(e.target.value)}
                    >
                      <option value="Cổng Vào G1">Cổng Vào G1 (Mặt đường Lê Lợi - Ô tô &amp; EV)</option>
                      <option value="Cổng Vào G2">Cổng Vào G2 (Làn chuyên dụng Xe máy)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={checkInLoading}
                    className="pm-cta-btn pm-btn-teal"
                  >
                    <CheckCircle2 size={18} />
                    <span>{checkInLoading ? "Đang xử lý..." : "Xác nhận Check-in & Mở Barrier"}</span>
                  </button>
                </form>

                {/* Check-In Success Box */}
                {checkInSuccess && (
                  <div className="pm-success-box">
                    <div className="pm-success-header">
                      <CheckCircle2 size={20} color="#10b981" />
                      <span>Check-in Thành công • Barrier Đã Mở</span>
                    </div>
                    <div className="pm-success-details">
                      <div>Biển số: <strong>{checkInSuccess.licensePlate}</strong></div>
                      <div>Vị trí gán: <strong className="pm-slot-highlight">{checkInSuccess.slotCode}</strong></div>
                      <div>Tầng: <strong>{checkInSuccess.levelName}</strong></div>
                      <div>Giờ vào: <strong>{new Date(checkInSuccess.checkinAt).toLocaleTimeString("vi-VN")}</strong></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="pm-print-btn"
                    >
                      <Printer size={15} />
                      <span>In Vé Giấy Cho Khách</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* CHECK-OUT TAB */}
              <div className="pm-op-card-header checkout-accent">
                <div className="pm-card-title-group">
                  <ArrowUpRight size={19} className="pm-icon-blue" />
                  <h2 className="pm-op-card-title">Tính phí &amp; Xử lý Xe Ra</h2>
                </div>
                <span className="pm-badge-success">Cổng Ra G3 Online</span>
              </div>

              <div className="pm-op-card-body">
                <div className="pm-lookup-row">
                  <input
                    type="text"
                    className="pm-form-input pm-plate-input"
                    style={{ flex: 1 }}
                    placeholder="Nhập Biển số xe hoặc Mã phiên..."
                    value={checkOutQuery}
                    onChange={(e) => setCheckOutQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLookupFee()}
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupFee()}
                    disabled={calculatingFee}
                    className="pm-search-action-btn"
                  >
                    <Search size={16} />
                    <span>{calculatingFee ? "Đang tìm..." : "Tra cứu"}</span>
                  </button>
                </div>

                {/* Fee Information Breakdown */}
                {feeInfo && (
                  <div className="pm-fee-card">
                    <h3 className="pm-fee-title">Bảng kê Chi tiết Thu phí Xuất bến</h3>
                    <div className="pm-fee-lines">
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Biển số xe:</span>
                        <strong className="pm-text-white">{feeInfo.licensePlate}</strong>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Vị trí đã đỗ:</span>
                        <strong className="pm-text-teal">{feeInfo.slotCode}</strong>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Thời gian vào:</span>
                        <span>{new Date(feeInfo.checkinAt).toLocaleTimeString("vi-VN")}</span>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Tổng thời lượng:</span>
                        <strong>{Math.floor(feeInfo.durationMinutes / 60)} giờ {feeInfo.durationMinutes % 60} phút</strong>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Gói cước áp dụng:</span>
                        <span>{feeInfo.pricingPlanName}</span>
                      </div>
                      <div className="pm-fee-total-row">
                        <span>TỔNG TIỀN PHẢI THU:</span>
                        <strong className="pm-fee-total-amount">
                          {feeInfo.estimatedFee.toLocaleString("vi-VN")} {feeInfo.currency}
                        </strong>
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div className="pm-payment-section">
                      <label className="pm-form-label">Hình thức thanh toán:</label>
                      <div className="pm-payment-options">
                        <button
                          type="button"
                          onClick={() => setCheckOutMethod("Cash")}
                          className={`pm-pay-method-btn ${checkOutMethod === "Cash" ? "active" : ""}`}
                        >
                          <Banknote size={20} />
                          <span>Tiền mặt</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheckOutMethod("Card")}
                          className={`pm-pay-method-btn ${checkOutMethod === "Card" ? "active" : ""}`}
                        >
                          <CreditCard size={20} />
                          <span>Thẻ POS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheckOutMethod("Wallet")}
                          className={`pm-pay-method-btn ${checkOutMethod === "Wallet" ? "active" : ""}`}
                        >
                          <QrCode size={20} />
                          <span>VietQR</span>
                        </button>
                      </div>
                    </div>

                    {/* Online payment check */}
                    {feeInfo.bookingId && (
                      <div className="pm-online-check-box">
                        <div className="pm-online-row">
                          <span className="pm-text-muted">Kiểm tra thanh toán online qua cổng:</span>
                          <button
                            type="button"
                            onClick={handleCheckOnlinePayment}
                            disabled={checkingOnlinePayment}
                            className="pm-btn-secondary-sm"
                          >
                            {checkingOnlinePayment ? "Đang kiểm tra..." : "Tra cứu thanh toán"}
                          </button>
                        </div>
                        {onlinePaymentStatus && (
                          <div className="pm-online-status-text">{onlinePaymentStatus}</div>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleCheckOut}
                      disabled={checkOutProcessing}
                      className="pm-cta-btn pm-btn-teal"
                      style={{ marginTop: 18 }}
                    >
                      <CheckCircle2 size={18} />
                      <span>{checkOutProcessing ? "Đang ghi nhận..." : "Xác nhận Đã Thu Tiền & Mở Barrier Ra"}</span>
                    </button>
                  </div>
                )}

                {/* Check-Out Success Ticket */}
                {checkOutSuccess && (
                  <div className="pm-success-box">
                    <div className="pm-success-header">
                      <CheckCircle2 size={20} color="#10b981" />
                      <span>{checkOutSuccess.message}</span>
                    </div>
                    <div className="pm-success-details">
                      <div>Số biên lai: <strong>{checkOutSuccess.receiptNumber}</strong></div>
                      <div>Barrier: <strong>Đã tự động mở cho xe xuất bến</strong></div>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="pm-print-btn"
                    >
                      <Printer size={15} />
                      <span>In Hoá đơn GTGT</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: 2. DYNAMIC CAMERA & ANPR MONITORING PANEL */}
        <div className="pm-op-card">
          <div className="pm-op-card-header">
            <div className="pm-card-title-group">
              <Camera size={19} className="pm-icon-teal" />
              <h2 className="pm-op-card-title">Camera ANPR Giám sát Làn xe</h2>
            </div>

            {/* Vehicle Type Toggle: Motorcycle (2 Cams) vs Car (4 Cams) */}
            <div className="pm-cam-type-toggle">
              <button
                type="button"
                onClick={() => handleCameraCategoryToggle("Motorcycle")}
                className={`pm-cam-toggle-btn ${cameraVehicleCategory === "Motorcycle" ? "active" : ""}`}
                title="Giám sát 2 camera (Mặt trước & Mặt sau)"
              >
                <Bike size={14} />
                <span>Xe máy (2 Cam)</span>
              </button>
              <button
                type="button"
                onClick={() => handleCameraCategoryToggle("Car")}
                className={`pm-cam-toggle-btn ${cameraVehicleCategory === "Car" ? "active" : ""}`}
                title="Giám sát 4 camera đa góc (Trước, Sau, Sườn T/P)"
              >
                <Car size={14} />
                <span>Ô tô / Xe lớn (4 Cam)</span>
              </button>
            </div>
          </div>

          <div className="pm-op-card-body">
            {/* IF MOTORCYCLE: 2-Camera Grid Layout */}
            {cameraVehicleCategory === "Motorcycle" ? (
              <div className="pm-cam-grid-2">
                {/* Cam 1: Mặt trước (Front Plate / Face) */}
                <div className="pm-cam-stream-box">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> LIVE 30 FPS
                    </span>
                    <span className="pm-cam-name">Cam 1: Mặt trước (Toàn cảnh &amp; Người lái)</span>
                    <span className="pm-cam-res">1080P</span>
                  </div>
                  <div className="pm-cam-viewport">
                    {cameraStates["moto-cam1"]?.fileUrl ? (
                      <img
                        src={cameraStates["moto-cam1"]!.fileUrl}
                        alt="Ảnh Cam 1"
                        className="pm-cam-real-preview"
                      />
                    ) : (
                      <div className="pm-cam-crosshair" />
                    )}
                    {cameraStates["moto-cam1"]?.scanning && (
                      <div className="pm-cam-scan-overlay">
                        <div className="pm-cam-laser-scanner" />
                        <span className="pm-cam-scan-text">AI đang phân tích...</span>
                      </div>
                    )}
                    <div className="pm-cam-tag-box">
                      <ShieldCheck size={14} color="#10b981" />
                      <span>Mũ bảo hiểm OK • Người điều khiển rõ nét</span>
                    </div>
                    <div className="pm-cam-time">{new Date().toLocaleTimeString("vi-VN")}</div>
                  </div>
                  <div className="pm-cam-footer">
                    <button
                      type="button"
                      className="pm-cam-upload-btn"
                      onClick={() => handleTriggerUploadForCam("moto-cam1")}
                      disabled={cameraStates["moto-cam1"]?.scanning}
                      title="Tải ảnh riêng cho Cam 1 để AI nhận diện"
                    >
                      <Upload size={12} />
                      <span>{cameraStates["moto-cam1"]?.scanning ? "Đang quét..." : "Tải ảnh"}</span>
                    </button>
                    <span className="pm-cam-status-label">Làn xe máy G2</span>
                    <button
                      type="button"
                      className="pm-cam-retake-btn"
                      onClick={() => handleResetCam("moto-cam1")}
                      title="Chụp lại hoặc reset ảnh"
                    >
                      <RotateCcw size={12} /> Chụp lại
                    </button>
                  </div>
                </div>

                {/* Cam 2: Mặt sau (Rear Plate with ANPR Bounding Box) */}
                <div className="pm-cam-stream-box">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> LIVE 30 FPS
                    </span>
                    <span className="pm-cam-name">Cam 2: Mặt sau (ANPR Biển số xe máy)</span>
                    <span className="pm-cam-res">1080P</span>
                  </div>
                  <div className="pm-cam-viewport">
                    {cameraStates["moto-cam2"]?.fileUrl ? (
                      <img
                        src={cameraStates["moto-cam2"]!.fileUrl}
                        alt="Ảnh Cam 2"
                        className="pm-cam-real-preview"
                      />
                    ) : null}
                    {cameraStates["moto-cam2"]?.scanning && (
                      <div className="pm-cam-scan-overlay">
                        <div className="pm-cam-laser-scanner" />
                        <span className="pm-cam-scan-text">AI đang nhận diện biển số...</span>
                      </div>
                    )}
                    <div className="pm-cam-anpr-bounding-box">
                      <div className="pm-anpr-plate">
                        [ {cameraStates["moto-cam2"]?.plateText || "59-P1 982.14"} ]
                      </div>
                      <div className="pm-anpr-confidence">
                        {cameraStates["moto-cam2"]?.confidence || "Độ chính xác: 99.2% • Honda AirBlade"}
                      </div>
                    </div>
                    <div className="pm-cam-time">{new Date().toLocaleTimeString("vi-VN")}</div>
                  </div>
                  <div className="pm-cam-footer">
                    <button
                      type="button"
                      className="pm-cam-upload-btn"
                      onClick={() => handleTriggerUploadForCam("moto-cam2")}
                      disabled={cameraStates["moto-cam2"]?.scanning}
                      title="Tải ảnh riêng cho Cam 2 để AI nhận diện"
                    >
                      <Upload size={12} />
                      <span>{cameraStates["moto-cam2"]?.scanning ? "Đang quét..." : "Tải ảnh"}</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn"
                      onClick={() => {
                        const p = cameraStates["moto-cam2"]?.plateText || "59-P1 982.14";
                        if (activeTab === "checkin") setCheckInPlate(p);
                        else {
                          setCheckOutQuery(p);
                          handleLookupFee(p);
                        }
                      }}
                      title="Điền biển số nhận diện từ Cam 2 vào Form"
                    >
                      Điền Biển số vào Form
                    </button>
                    <button
                      type="button"
                      className="pm-cam-retake-btn"
                      onClick={() => handleResetCam("moto-cam2", "59-P1 982.14", "Độ chính xác: 99.2% • Honda AirBlade")}
                      title="Chụp lại hoặc reset ảnh"
                    >
                      <RotateCcw size={12} /> Chụp lại
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* IF CAR / TRUCK: 4-Camera Grid Layout (2x2 Grid) */
              <div className="pm-cam-grid-4">
                {/* Cam 1: Mặt trước (Front Plate) */}
                <div className="pm-cam-stream-box compact">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> LIVE
                    </span>
                    <span className="pm-cam-name">Cam 1: Mặt trước (Front Plate)</span>
                  </div>
                  <div className="pm-cam-viewport compact">
                    {cameraStates["car-cam1"]?.fileUrl ? (
                      <img
                        src={cameraStates["car-cam1"]!.fileUrl}
                        alt="Ảnh Cam 1"
                        className="pm-cam-real-preview"
                      />
                    ) : null}
                    {cameraStates["car-cam1"]?.scanning && (
                      <div className="pm-cam-scan-overlay">
                        <div className="pm-cam-laser-scanner" />
                        <span className="pm-cam-scan-text">AI đang quét...</span>
                      </div>
                    )}
                    <div className="pm-cam-anpr-bounding-box">
                      <div className="pm-anpr-plate">
                        [ {cameraStates["car-cam1"]?.plateText || "51K - 892.45"} ]
                      </div>
                      <div className="pm-anpr-confidence">
                        {cameraStates["car-cam1"]?.confidence || "AI: 99.4% • Toyota Cross"}
                      </div>
                    </div>
                  </div>
                  <div className="pm-cam-footer compact">
                    <button
                      type="button"
                      className="pm-cam-upload-btn compact"
                      onClick={() => handleTriggerUploadForCam("car-cam1")}
                      disabled={cameraStates["car-cam1"]?.scanning}
                      title="Tải ảnh riêng cho Cam 1 để AI nhận diện"
                    >
                      <Upload size={11} />
                      <span>{cameraStates["car-cam1"]?.scanning ? "..." : "Tải ảnh"}</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn compact"
                      onClick={() => {
                        const p = cameraStates["car-cam1"]?.plateText || "51K-892.45";
                        if (activeTab === "checkin") setCheckInPlate(p);
                        else {
                          setCheckOutQuery(p);
                          handleLookupFee(p);
                        }
                      }}
                      title="Điền biển số nhận diện từ Cam 1 vào Form"
                    >
                      Điền vào Form
                    </button>
                    <button
                      type="button"
                      className="pm-cam-retake-btn compact"
                      onClick={() => handleResetCam("car-cam1", "51K - 892.45", "AI: 99.4% • Toyota Cross")}
                      title="Chụp lại hoặc reset ảnh"
                    >
                      <RotateCcw size={11} /> Chụp lại
                    </button>
                  </div>
                </div>

                {/* Cam 2: Mặt sau (Rear Plate) */}
                <div className="pm-cam-stream-box compact">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> LIVE
                    </span>
                    <span className="pm-cam-name">Cam 2: Mặt sau (Rear Plate)</span>
                  </div>
                  <div className="pm-cam-viewport compact">
                    {cameraStates["car-cam2"]?.fileUrl ? (
                      <img
                        src={cameraStates["car-cam2"]!.fileUrl}
                        alt="Ảnh Cam 2"
                        className="pm-cam-real-preview"
                      />
                    ) : null}
                    {cameraStates["car-cam2"]?.scanning && (
                      <div className="pm-cam-scan-overlay">
                        <div className="pm-cam-laser-scanner" />
                        <span className="pm-cam-scan-text">AI đang quét...</span>
                      </div>
                    )}
                    <div className="pm-cam-anpr-bounding-box">
                      <div className="pm-anpr-plate">
                        [ {cameraStates["car-cam2"]?.plateText || "51K - 892.45"} ]
                      </div>
                      <div className="pm-anpr-confidence">
                        {cameraStates["car-cam2"]?.confidence || "AI: 98.9% • Khớp biển trước"}
                      </div>
                    </div>
                  </div>
                  <div className="pm-cam-footer compact">
                    <button
                      type="button"
                      className="pm-cam-upload-btn compact"
                      onClick={() => handleTriggerUploadForCam("car-cam2")}
                      disabled={cameraStates["car-cam2"]?.scanning}
                      title="Tải ảnh riêng cho Cam 2 để AI nhận diện"
                    >
                      <Upload size={11} />
                      <span>{cameraStates["car-cam2"]?.scanning ? "..." : "Tải ảnh"}</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn compact"
                      onClick={() => {
                        const p = cameraStates["car-cam2"]?.plateText || "51K-892.45";
                        if (activeTab === "checkin") setCheckInPlate(p);
                        else {
                          setCheckOutQuery(p);
                          handleLookupFee(p);
                        }
                      }}
                      title="Điền biển số nhận diện từ Cam 2 vào Form"
                    >
                      Điền vào Form
                    </button>
                    <button
                      type="button"
                      className="pm-cam-retake-btn compact"
                      onClick={() => handleResetCam("car-cam2", "51K - 892.45", "AI: 98.9% • Khớp biển trước")}
                      title="Chụp lại hoặc reset ảnh"
                    >
                      <RotateCcw size={11} /> Chụp lại
                    </button>
                  </div>
                </div>

                {/* Cam 3: Sườn trái (Left Side) */}
                <div className="pm-cam-stream-box compact">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> LIVE
                    </span>
                    <span className="pm-cam-name">Cam 3: Sườn trái (Left Side)</span>
                  </div>
                  <div className="pm-cam-viewport compact">
                    {cameraStates["car-cam3"]?.fileUrl ? (
                      <img
                        src={cameraStates["car-cam3"]!.fileUrl}
                        alt="Ảnh Cam 3"
                        className="pm-cam-real-preview"
                      />
                    ) : null}
                    {cameraStates["car-cam3"]?.scanning && (
                      <div className="pm-cam-scan-overlay">
                        <div className="pm-cam-laser-scanner" />
                        <span className="pm-cam-scan-text">AI đang quét...</span>
                      </div>
                    )}
                    <div className="pm-cam-tag-box">
                      <ShieldCheck size={14} color="#10b981" />
                      <span>Thân xe &amp; Gương trái OK</span>
                    </div>
                  </div>
                  <div className="pm-cam-footer compact">
                    <button
                      type="button"
                      className="pm-cam-upload-btn compact"
                      onClick={() => handleTriggerUploadForCam("car-cam3")}
                      disabled={cameraStates["car-cam3"]?.scanning}
                      title="Tải ảnh riêng cho Cam 3"
                    >
                      <Upload size={11} />
                      <span>{cameraStates["car-cam3"]?.scanning ? "..." : "Tải ảnh"}</span>
                    </button>
                    <span className="pm-cam-status-label">Thân xe trái</span>
                    <button
                      type="button"
                      className="pm-cam-retake-btn compact"
                      onClick={() => handleResetCam("car-cam3")}
                      title="Chụp lại hoặc reset ảnh"
                    >
                      <RotateCcw size={11} /> Chụp lại
                    </button>
                  </div>
                </div>

                {/* Cam 4: Sườn phải (Right Side) */}
                <div className="pm-cam-stream-box compact">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> LIVE
                    </span>
                    <span className="pm-cam-name">Cam 4: Sườn phải (Right Side)</span>
                  </div>
                  <div className="pm-cam-viewport compact">
                    {cameraStates["car-cam4"]?.fileUrl ? (
                      <img
                        src={cameraStates["car-cam4"]!.fileUrl}
                        alt="Ảnh Cam 4"
                        className="pm-cam-real-preview"
                      />
                    ) : null}
                    {cameraStates["car-cam4"]?.scanning && (
                      <div className="pm-cam-scan-overlay">
                        <div className="pm-cam-laser-scanner" />
                        <span className="pm-cam-scan-text">AI đang quét...</span>
                      </div>
                    )}
                    <div className="pm-cam-tag-box">
                      <ShieldCheck size={14} color="#10b981" />
                      <span>Thân xe &amp; Gương phải OK</span>
                    </div>
                  </div>
                  <div className="pm-cam-footer compact">
                    <button
                      type="button"
                      className="pm-cam-upload-btn compact"
                      onClick={() => handleTriggerUploadForCam("car-cam4")}
                      disabled={cameraStates["car-cam4"]?.scanning}
                      title="Tải ảnh riêng cho Cam 4"
                    >
                      <Upload size={11} />
                      <span>{cameraStates["car-cam4"]?.scanning ? "..." : "Tải ảnh"}</span>
                    </button>
                    <span className="pm-cam-status-label">Thân xe phải</span>
                    <button
                      type="button"
                      className="pm-cam-retake-btn compact"
                      onClick={() => handleResetCam("car-cam4")}
                      title="Chụp lại hoặc reset ảnh"
                    >
                      <RotateCcw size={11} /> Chụp lại
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 4. IN-LOT VEHICLE & SHIFT HISTORY TABLE (SLEEK DARK THEME) ────── */}
      <div className="pm-op-card">
        <div className="pm-op-card-header">
          <div className="pm-card-title-group">
            <Layers size={19} className="pm-icon-teal" />
            <h2 className="pm-op-card-title">Danh sách Xe trong Bãi &amp; Lịch sử trong Ca</h2>
          </div>

          <div className="pm-table-filters">
            <div className="pm-filter-search">
              <Search size={14} className="pm-filter-icon" />
              <input
                type="text"
                className="pm-filter-input"
                placeholder="Lọc theo biển số..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </div>

            <select
              className="pm-filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Active">Đang gửi trong bãi</option>
              <option value="Completed">Đã xuất bến</option>
            </select>
          </div>
        </div>

        <div className="pm-table-wrapper">
          <table className="pm-dark-table">
            <thead>
              <tr>
                <th>MÃ PHIÊN</th>
                <th>BIỂN SỐ XE</th>
                <th>LOẠI XE</th>
                <th>VỊ TRÍ ĐỖ</th>
                <th>GIỜ VÀO</th>
                <th>THỜI LƯỢNG</th>
                <th>TRẠNG THÁI</th>
                <th>THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pm-table-empty">
                    Không có lượt xe nào phù hợp.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.sessionId} className="pm-table-row">
                    <td>
                      <span className="pm-session-code">{s.sessionId}</span>
                      {s.bookingCode && (
                        <div className="pm-booking-sub">{s.bookingCode}</div>
                      )}
                    </td>
                    <td>
                      <span className="pm-plate-cell">{s.licensePlate}</span>
                    </td>
                    <td>
                      <span className="pm-vehicle-type-tag">{s.vehicleType}</span>
                    </td>
                    <td>
                      <span className="pm-slot-cell">{s.slotCode}</span>
                      <div className="pm-level-sub">{s.levelName}</div>
                    </td>
                    <td>{new Date(s.checkinAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{s.durationMinutes} phút</td>
                    <td>
                      <span
                        className={`pm-status-tag ${
                          s.status === "Active" ? "tag-active" : "tag-completed"
                        }`}
                      >
                        {s.status === "Active" ? "Đang gửi" : "Đã ra"}
                      </span>
                    </td>
                    <td>
                      {s.status === "Active" ? (
                        <button
                          type="button"
                          className="pm-action-btn-cyan"
                          onClick={() => {
                            setActiveTab("checkout");
                            setCheckOutQuery(s.licensePlate);
                            handleLookupFee(s.licensePlate);
                          }}
                        >
                          Thu phí ra bãi
                        </button>
                      ) : (
                        <span className="pm-text-muted">Đã hoàn tất</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
