import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  QrCode,
  Search,
  CheckCircle2,
  Printer,
  CreditCard,
  Banknote,
  RotateCcw,
  Sparkles,
  Layers,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type {
  ParkingSession,
  CheckInResult,
  CheckOutFeeInfo,
  VehicleType,
} from "../../types/staff";

export default function VehicleOperations() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "checkout" ? "checkout" : "checkin";
  const initialPlate = searchParams.get("plate") || "";

  const [activeTab, setActiveTab] = useState<"checkin" | "checkout">(initialTab);
  const [sessions, setSessions] = useState<ParkingSession[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

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
    <div>
      {/* Header */}
      <div className="staff-page-header">
        <div>
          <h1 className="staff-page-title">
            <Car size={24} color="var(--teal)" />
            Điều phối Xe Vào & Xe Ra
          </h1>
          <p className="staff-page-desc">
            Xử lý tiếp nhận tại cổng vào, kiểm tra mã đặt chỗ QR, tính phí xuất bến và mở Barrier
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", background: "#e2e8f0", padding: 3, borderRadius: 10 }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab("checkin");
              setCheckInSuccess(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "checkin" ? "var(--teal)" : "transparent",
              color: activeTab === "checkin" ? "white" : "var(--muted)",
              transition: "all 0.15s ease",
            }}
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
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "checkout" ? "var(--teal)" : "transparent",
              color: activeTab === "checkout" ? "white" : "var(--muted)",
              transition: "all 0.15s ease",
            }}
          >
            <ArrowUpRight size={16} />
            <span>CỔNG RA (CHECK-OUT)</span>
          </button>
        </div>
      </div>

      {/* Main Operations Split Panes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginBottom: 24 }}>
        {/* TAB 1: CỔNG VÀO (CHECK-IN) */}
        {activeTab === "checkin" && (
          <div className="staff-card" style={{ marginBottom: 0 }}>
            <div className="staff-card-header" style={{ background: "#f0fdf4" }}>
              <h2 className="staff-card-title" style={{ color: "#166534" }}>
                <ArrowDownLeft size={18} />
                Tiếp nhận Xe vào Cổng
              </h2>
              <span className="staff-badge badge-available">Barrier G1 Sẵn sàng</span>
            </div>
            <div className="staff-card-body">
              <form onSubmit={handleCheckIn} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="staff-form-group">
                  <label className="staff-label">Biển số xe nhận diện (hoặc nhập thủ công):</label>
                  <input
                    type="text"
                    required
                    className="staff-input"
                    style={{ fontSize: 16, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}
                    placeholder="VD: 51K-892.45"
                    value={checkInPlate}
                    onChange={(e) => setCheckInPlate(e.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="staff-form-group">
                    <label className="staff-label">Mã đặt chỗ (nếu có):</label>
                    <input
                      type="text"
                      className="staff-input"
                      placeholder="BK-2026..."
                      value={checkInBooking}
                      onChange={(e) => setCheckInBooking(e.target.value)}
                    />
                  </div>

                  <div className="staff-form-group">
                    <label className="staff-label">Loại xe:</label>
                    <select
                      className="staff-select"
                      value={checkInVehicleType}
                      onChange={(e) => setCheckInVehicleType(e.target.value as VehicleType)}
                    >
                      <option value="Car">Ô tô (4-7 chỗ)</option>
                      <option value="Motorcycle">Xe máy</option>
                      <option value="EV">Xe điện (EV)</option>
                      <option value="Truck">Xe tải nhẹ</option>
                    </select>
                  </div>
                </div>

                <div className="staff-form-group">
                  <label className="staff-label">Cổng vào chỉ định:</label>
                  <select
                    className="staff-select"
                    value={checkInGate}
                    onChange={(e) => setCheckInGate(e.target.value)}
                  >
                    <option value="Cổng Vào G1">Cổng Vào G1 (Mặt đường Lê Lợi)</option>
                    <option value="Cổng Vào G2">Cổng Vào G2 (Làn xe máy)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={checkInLoading}
                  className="staff-quick-btn staff-btn-primary"
                  style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: 14, marginTop: 4 }}
                >
                  {checkInLoading ? "Đang xử lý..." : "Xác nhận Check-in & Mở Barrier Cổng"}
                </button>
              </form>

              {/* Check-In Success Ticket */}
              {checkInSuccess && (
                <div
                  style={{
                    marginTop: 18,
                    padding: 16,
                    borderRadius: 10,
                    background: "#ecfdf5",
                    border: "1.5px dashed #34d399",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#065f46", fontWeight: 700 }}>
                    <CheckCircle2 size={20} />
                    <span>Check-in Thành công • Barrier Đã Mở</span>
                  </div>
                  <div style={{ fontSize: 13, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>Biển số: <strong>{checkInSuccess.licensePlate}</strong></div>
                    <div>Vị trí gán: <strong style={{ color: "var(--teal)", fontSize: 15 }}>{checkInSuccess.slotCode}</strong></div>
                    <div>Tầng: <strong>{checkInSuccess.levelName}</strong></div>
                    <div>Giờ vào: <strong>{new Date(checkInSuccess.checkinAt).toLocaleTimeString("vi-VN")}</strong></div>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="staff-quick-btn staff-btn-secondary"
                    style={{ alignSelf: "flex-start", fontSize: 12, padding: "6px 12px" }}
                  >
                    <Printer size={14} />
                    In Vé Giấy Cho Khách
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: CỔNG RA (CHECK-OUT) */}
        {activeTab === "checkout" && (
          <div className="staff-card" style={{ marginBottom: 0 }}>
            <div className="staff-card-header" style={{ background: "#f0f9ff" }}>
              <h2 className="staff-card-title" style={{ color: "#0369a1" }}>
                <ArrowUpRight size={18} />
                Tính phí & Xử lý Xe Ra
              </h2>
              <span className="staff-badge badge-available">Cổng Ra G3 Online</span>
            </div>
            <div className="staff-card-body">
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  type="text"
                  className="staff-input"
                  style={{ flex: 1, textTransform: "uppercase", fontWeight: 600 }}
                  placeholder="Nhập Biển số xe hoặc Mã phiên..."
                  value={checkOutQuery}
                  onChange={(e) => setCheckOutQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookupFee()}
                />
                <button
                  type="button"
                  onClick={() => handleLookupFee()}
                  disabled={calculatingFee}
                  className="staff-quick-btn staff-btn-primary"
                >
                  <Search size={16} />
                  <span>{calculatingFee ? "Đang tìm..." : "Tra cứu"}</span>
                </button>
              </div>

              {/* Fee Information Breakdown */}
              {feeInfo && (
                <div style={{ padding: 16, background: "#f8fafc", borderRadius: 10, border: "1px solid var(--line)" }}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                    Bảng kê Chi tiết Thu phí Xuất bến
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Biển số xe:</span>
                      <strong style={{ fontSize: 15 }}>{feeInfo.licensePlate}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Vị trí đã đỗ:</span>
                      <strong>{feeInfo.slotCode}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Thời gian vào:</span>
                      <span>{new Date(feeInfo.checkinAt).toLocaleTimeString("vi-VN")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Tổng thời lượng:</span>
                      <strong>{Math.floor(feeInfo.durationMinutes / 60)} giờ {feeInfo.durationMinutes % 60} phút</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>Gói cước áp dụng:</span>
                      <span>{feeInfo.pricingPlanName}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingTop: 10,
                        borderTop: "1px dashed var(--line)",
                        fontSize: 16,
                      }}
                    >
                      <strong style={{ color: "var(--ink)" }}>TỔNG TIỀN PHẢI THU:</strong>
                      <strong style={{ color: "var(--teal)", fontSize: 18 }}>
                        {feeInfo.estimatedFee.toLocaleString("vi-VN")} {feeInfo.currency}
                      </strong>
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div style={{ marginTop: 16 }}>
                    <label className="staff-label" style={{ marginBottom: 8, display: "block" }}>
                      Hình thức thanh toán:
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setCheckOutMethod("Cash")}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid",
                          borderColor: checkOutMethod === "Cash" ? "var(--teal)" : "var(--line)",
                          background: checkOutMethod === "Cash" ? "#eff9f7" : "white",
                          color: checkOutMethod === "Cash" ? "var(--teal)" : "var(--ink)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        <Banknote size={18} />
                        <span>Tiền mặt</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckOutMethod("Card")}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid",
                          borderColor: checkOutMethod === "Card" ? "var(--teal)" : "var(--line)",
                          background: checkOutMethod === "Card" ? "#eff9f7" : "white",
                          color: checkOutMethod === "Card" ? "var(--teal)" : "var(--ink)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        <CreditCard size={18} />
                        <span>Thẻ POS</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckOutMethod("Wallet")}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          border: "1px solid",
                          borderColor: checkOutMethod === "Wallet" ? "var(--teal)" : "var(--line)",
                          background: checkOutMethod === "Wallet" ? "#eff9f7" : "white",
                          color: checkOutMethod === "Wallet" ? "var(--teal)" : "var(--ink)",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: 12,
                        }}
                      >
                        <QrCode size={18} />
                        <span>VietQR</span>
                      </button>
                    </div>
                  </div>

                  {feeInfo.bookingId && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12, color: "var(--ink-light)" }}>Kiểm tra thanh toán online qua cổng:</span>
                        <button
                          type="button"
                          onClick={handleCheckOnlinePayment}
                          disabled={checkingOnlinePayment}
                          className="staff-quick-btn"
                          style={{ padding: "4px 8px", fontSize: 11 }}
                        >
                          {checkingOnlinePayment ? "Đang kiểm tra..." : "Tra cứu thanh toán"}
                        </button>
                      </div>
                      {onlinePaymentStatus && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "var(--teal)" }}>
                          {onlinePaymentStatus}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleCheckOut}
                    disabled={checkOutProcessing}
                    className="staff-quick-btn staff-btn-primary"
                    style={{ width: "100%", justifyContent: "center", padding: "12px", marginTop: 16, fontSize: 14 }}
                  >
                    {checkOutProcessing ? "Đang ghi nhận..." : "Xác nhận Đã Thu Tiền & Mở Barrier Ra"}
                  </button>
                </div>
              )}

              {/* Check-Out Success */}
              {checkOutSuccess && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    background: "#ecfdf5",
                    border: "1px solid #34d399",
                    color: "#065f46",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                    <CheckCircle2 size={18} />
                    <span>{checkOutSuccess.message}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>
                    Số biên lai: <strong>{checkOutSuccess.receiptNumber}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="staff-quick-btn staff-btn-secondary"
                    style={{ alignSelf: "flex-start", fontSize: 12, padding: "4px 10px" }}
                  >
                    <Printer size={14} />
                    In Hoá đơn GTGT
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Camera & Gate Sensor Preview Mock */}
        <div className="staff-card" style={{ marginBottom: 0 }}>
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <Sparkles size={16} color="var(--teal)" />
              Hình ảnh Camera ANPR Giám sát Làn xe
            </h2>
            <span className="live-indicator">
              <span className="live-dot" /> LIVE 30 FPS
            </span>
          </div>
          <div className="staff-card-body">
            <div
              style={{
                width: "100%",
                height: 200,
                background: "#0f172a",
                borderRadius: 8,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                overflow: "hidden",
                border: "1px solid #334155",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 12,
                  color: "#22c55e",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                CAM-IN-01 • 1080P • AI PLATE RECOGNITION OK
              </div>
              <div
                style={{
                  border: "2px dashed #06b6d4",
                  padding: "16px 28px",
                  borderRadius: 6,
                  textAlign: "center",
                }}
              >
                <div style={{ color: "#38bdf8", fontSize: 18, fontWeight: 700, fontFamily: "monospace" }}>
                  [ 51K - 892.45 ]
                </div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
                  Độ chính xác: 99.4% • Toyota Corolla Cross
                </div>
              </div>
              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 12,
                  color: "#cbd5e1",
                  fontSize: 10,
                  fontFamily: "monospace",
                }}
              >
                {new Date().toLocaleTimeString("vi-VN")}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button
                type="button"
                className="staff-quick-btn staff-btn-secondary"
                style={{ flex: 1, fontSize: 12 }}
                onClick={() => setCheckInPlate("51K-892.45")}
              >
                Điền Biển số từ Cam vào Form
              </button>
              <button
                type="button"
                className="staff-quick-btn staff-btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => alert("Đã gửi lệnh chụp lại ảnh từ camera ANPR")}
              >
                <RotateCcw size={14} /> Chụp lại
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Sessions Table */}
      <div className="staff-card">
        <div className="staff-card-header">
          <h2 className="staff-card-title">
            <Layers size={16} color="var(--teal)" />
            Danh sách Xe trong Bãi & Lịch sử trong Ca
          </h2>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="staff-input"
                style={{ paddingLeft: 30, fontSize: 12, height: 32 }}
                placeholder="Lọc theo biển số..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
              <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "var(--muted)" }} />
            </div>

            <select
              className="staff-select"
              style={{ fontSize: 12, height: 32, padding: "4px 8px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">Tất cả trạng thái</option>
              <option value="Active">Đang gửi trong bãi</option>
              <option value="Completed">Đã xuất bến</option>
            </select>
          </div>
        </div>

        <div className="staff-table-wrap">
          <table className="staff-table">
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
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>
                    Không có lượt xe nào phù hợp.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.sessionId}>
                    <td>
                      <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{s.sessionId}</span>
                      {s.bookingCode && (
                        <div style={{ fontSize: 10, color: "var(--teal)" }}>{s.bookingCode}</div>
                      )}
                    </td>
                    <td>
                      <strong style={{ fontSize: 14 }}>{s.licensePlate}</strong>
                    </td>
                    <td>{s.vehicleType}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--teal)" }}>{s.slotCode}</span>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.levelName}</div>
                    </td>
                    <td>{new Date(s.checkinAt).toLocaleTimeString("vi-VN")}</td>
                    <td>{s.durationMinutes} phút</td>
                    <td>
                      <span
                        className={`staff-badge ${
                          s.status === "Active" ? "badge-progress" : "badge-resolved"
                        }`}
                      >
                        {s.status === "Active" ? "Đang gửi" : "Đã ra"}
                      </span>
                    </td>
                    <td>
                      {s.status === "Active" ? (
                        <button
                          type="button"
                          className="staff-quick-btn staff-btn-primary"
                          style={{ fontSize: 11, padding: "4px 8px" }}
                          onClick={() => {
                            setActiveTab("checkout");
                            setCheckOutQuery(s.licensePlate);
                            handleLookupFee(s.licensePlate);
                          }}
                        >
                          Thu phí ra bãi
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--muted)" }}>Đã hoàn tất</span>
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
