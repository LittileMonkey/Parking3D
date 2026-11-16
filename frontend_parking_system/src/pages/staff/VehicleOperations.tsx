import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { StaffDialog, staffDate } from "../../components/staff/StaffUi";
import { Link, useSearchParams, useOutletContext } from "react-router-dom";
import type { StaffContext } from "../../components/staff/StaffLayout";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  Bike,
  Search,
  CheckCircle2,
  Printer,
  RotateCcw,
  Layers,
  Camera,
  ShieldCheck,
  Upload,
  FileText,
  Hash,
  Pencil,
} from "lucide-react";
import {
  api,
  ApiError,
  type CheckOutQuoteDto,
  type CheckoutRequest,
  type Payment,
  type PaymentReceiptDto,
  type StaffSessionRow,
} from "../../services/api";
import { staffApi } from "../../services/staff/staffApi";
import type {
  CheckInResult,
  VehicleType,
  PlateRecognitionResult,
  CheckInPayload,
} from "../../types/staff";

interface WebcamCaptureModalProps {
  camId: string;
  camTitle: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}

function WebcamCaptureModal({ camId, camTitle, onCapture, onClose }: WebcamCaptureModalProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isStarting, setIsStarting] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);

  // Smart Plate Clarity & Auto-Scan State
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [captured, setCaptured] = useState(false);
  const [isPlateClear, setIsPlateClear] = useState(false);
  const [clarityStatus, setClarityStatus] = useState<string>("Đang tìm biển số trong khung...");
  const [clarityScore, setClarityScore] = useState<number>(0);
  const [glareRatio, setGlareRatio] = useState<number>(0);
  const [alertLevel, setAlertLevel] = useState<"ok" | "warn" | "glare" | "dark">("warn");

  const analyzerCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const prevLumaRef = React.useRef<number>(0);
  const steadyCountRef = React.useRef<number>(0);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startStream = async (deviceId?: string) => {
    setIsStarting(true);
    setError("");
    setCaptured(false);
    setIsPlateClear(false);
    steadyCountRef.current = 0;
    setClarityStatus("Đang tìm biển số trong khung...");
    stopStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
        audio: false,
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = newStream;

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        await videoRef.current.play().catch(() => {});
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === "videoinput");
      setDevices(videoInputs);
      if (!deviceId && videoInputs.length > 0) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (err: unknown) {
      console.error("Camera access error:", err);
      if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setError(
          "Trình duyệt chưa được cấp quyền truy cập Camera. Vui lòng bấm vào biểu tượng ổ khóa/camera trên thanh địa chỉ trình duyệt để Cho phép (Allow), sau đó bấm Thử lại."
        );
      } else if (err instanceof Error && err.name === "NotFoundError") {
        setError(
          "Không tìm thấy thiết bị camera hoặc webcam nào trên máy tính. Bạn có thể sử dụng tính năng 'Tải ảnh' để tải ảnh biển số."
        );
      } else {
        setError("Không thể khởi động camera máy tính: " + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    void startStream();
    return () => {
      stopStream();
    };
  }, []);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    void startStream(newId);
  };

  const handleCapture = () => {
    if (captured) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setCaptured(true);
    // Hiệu ứng flash khi chụp
    setIsFlashing(true);
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        setIsFlashing(false);
        if (!blob) {
          setError("Không thể xuất ảnh từ camera.");
          setCaptured(false);
          return;
        }
        const capturedFile = new File([blob], `scan-${camId}-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopStream();
        onCapture(capturedFile);
      },
      "image/jpeg",
      0.95
    );
  };

  // Smart Plate Clarity & Sharpness Analyzer: Tích hợp bộ lọc chống lóa sáng (Anti-Glare) + Phương sai Laplace
  useEffect(() => {
    if (isStarting || error || captured || !autoScanEnabled) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0) return;

      if (!analyzerCanvasRef.current) {
        analyzerCanvasRef.current = document.createElement("canvas");
        analyzerCanvasRef.current.width = 240;
        analyzerCanvasRef.current.height = 135;
      }
      const canvas = analyzerCanvasRef.current;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, 240, 135);

      // Phân tích vùng ROI ở giữa tương ứng khung ngắm reticle (168 x 60 pixel)
      const rx = 36;
      const ry = 38;
      const rw = 168;
      const rh = 60;

      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const data = imgData.data;
      const pixelCount = rw * rh;

      let glarePixels = 0;
      let darkPixels = 0;
      let brightPixels = 0;
      let totalLuma = 0;

      const lumaGrid = new Uint8Array(pixelCount);
      for (let i = 0; i < pixelCount; i++) {
        const idx = i * 4;
        const luma = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        lumaGrid[i] = luma;
        totalLuma += luma;
        if (luma > 235) glarePixels++;
        if (luma < 95) darkPixels++;
        if (luma > 140) brightPixels++;
      }

      const avgLuma = totalLuma / pixelCount;
      const glarePct = Math.round((glarePixels / pixelCount) * 100);
      const darkPct = Math.round((darkPixels / pixelCount) * 100);
      const brightPct = Math.round((brightPixels / pixelCount) * 100);
      const motionDelta = Math.abs(avgLuma - prevLumaRef.current);
      prevLumaRef.current = avgLuma;

      setGlareRatio(glarePct);

      // 1. Phân tích phương sai Laplace (Laplacian Variance - thước đo độ nét chuẩn xác cao)
      let sumLap = 0;
      let sumSqLap = 0;
      let innerCount = 0;

      for (let y = 1; y < rh - 1; y++) {
        const rowOffset = y * rw;
        for (let x = 1; x < rw - 1; x++) {
          const c = lumaGrid[rowOffset + x];
          const lap = 4 * c - lumaGrid[rowOffset + x - 1] - lumaGrid[rowOffset + x + 1] - lumaGrid[(y - 1) * rw + x] - lumaGrid[(y + 1) * rw + x];
          sumLap += lap;
          sumSqLap += lap * lap;
          innerCount++;
        }
      }

      const meanLap = sumLap / innerCount;
      const lapVariance = Math.max(0, (sumSqLap / innerCount) - (meanLap * meanLap));

      // 2. Kiểm tra các điều kiện chất lượng ảnh:
      // A. Màn hình bị lóa sáng / cháy sáng (glarePct >= 18%)
      if (glarePct >= 18) {
        steadyCountRef.current = 0;
        setIsPlateClear(false);
        setAlertLevel("glare");
        setClarityScore(Math.max(5, Math.round(25 - glarePct * 0.2)));
        setClarityStatus(`⚠️ Màn hình bị lóa sáng (${glarePct}%) - Giảm độ sáng hoặc nghiêng góc máy`);
        return;
      }

      // B. Khung hình quá tối (avgLuma < 35)
      if (avgLuma < 35) {
        steadyCountRef.current = 0;
        setIsPlateClear(false);
        setAlertLevel("dark");
        setClarityScore(Math.max(0, Math.round(avgLuma * 0.6)));
        setClarityStatus("⚠️ Quá tối - Cần thêm ánh sáng để camera nhìn rõ");
        return;
      }

      // C. Rung lắc mạnh khi đang lia máy (motionDelta > 6.0)
      if (motionDelta > 6.0) {
        steadyCountRef.current = 0;
        setIsPlateClear(false);
        setAlertLevel("warn");
        setClarityStatus("Đang chuyển động: Vui lòng giữ yên camera...");
        return;
      }

      // D. Tính điểm độ sắc nét chuẩn (0..100%)
      const rawScore = Math.min(100, Math.max(0, Math.round(((lapVariance - 20) / 70) * 100)));
      // Yêu cầu có phân bố chữ và nền (ít nhất 5% chữ đen và 18% nền sáng)
      const hasPlateCharacters = darkPct >= 5 && brightPct >= 18;
      const finalScore = hasPlateCharacters ? rawScore : Math.min(45, rawScore);
      setClarityScore(finalScore);

      // E. Đạt ngưỡng nét chuẩn (>= 75%) và ổn định (motionDelta <= 4.0)
      if (finalScore >= 75 && motionDelta <= 4.0) {
        steadyCountRef.current += 1;
        setIsPlateClear(true);
        setAlertLevel("ok");
        setClarityStatus(`✓ Độ nét đạt ${finalScore}% - Giữ yên...`);

        if (steadyCountRef.current >= 3) {
          clearInterval(interval);
          setClarityStatus(`🎯 ĐANG CHỤP BIỂN SỐ (${finalScore}%)...`);
          setTimeout(() => {
            handleCapture();
          }, 100);
        }
      } else {
        steadyCountRef.current = 0;
        setIsPlateClear(false);
        setAlertLevel("warn");
        if (!hasPlateCharacters) {
          setClarityStatus(`Đang căn nét: Căn biển số có chữ số vào giữa khung (Nét: ${finalScore}%)`);
        } else {
          setClarityStatus(`Độ nét: ${finalScore}% (Cần ≥ 75%) - Giữ yên và tiến gần hơn`);
        }
      }
    }, 180);

    return () => clearInterval(interval);
  }, [isStarting, error, captured, autoScanEnabled]);

  // Phím tắt Space hoặc Enter để chụp ngay lập tức chủ động
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleCapture();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isStarting, error, captured]);

  const handleClose = () => {
    stopStream();
    onClose();
  };

  return (
    <StaffDialog title={`Quét trực tiếp qua Camera - ${camTitle}`} onClose={handleClose}>
      <div className="staff-modal-body" style={{ display: "grid", gap: 14 }}>
        {error ? (
          <div style={{ display: "grid", gap: 12, padding: "16px 0" }}>
            <div className="staff-alert error" style={{ margin: 0 }}>
              {error}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="staff-btn-secondary" onClick={handleClose}>
                Đóng
              </button>
              <button
                type="button"
                className="pm-cta-btn pm-btn-teal"
                style={{ width: "auto" }}
                onClick={() => void startStream(selectedDeviceId)}
              >
                <RotateCcw size={14} /> Thử lại
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              {devices.length > 1 ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Nguồn Camera:</label>
                  <select
                    className="pm-form-input"
                    style={{ flex: 1, padding: "5px 10px", fontSize: 13 }}
                    value={selectedDeviceId}
                    onChange={handleDeviceChange}
                  >
                    {devices.map((d, index) => (
                      <option key={d.deviceId || index} value={d.deviceId}>
                        {d.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : <div />}

              {/* Toggle Auto-Scan */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#0f766e" }}>
                <input
                  type="checkbox"
                  checked={autoScanEnabled}
                  onChange={(e) => {
                    setAutoScanEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setIsPlateClear(false);
                      setClarityStatus("Chế độ chụp thủ công");
                    }
                  }}
                  style={{ accentColor: "#0d9488", width: 16, height: 16 }}
                />
                <span>Tự động chụp khi biển số rõ nét</span>
              </label>
            </div>

            {/* Live Camera Viewport */}
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: "16 / 9",
                background: "#090d16",
                borderRadius: 12,
                overflow: "hidden",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />

              {/* Flash effect overlay */}
              {isFlashing && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "#ffffff",
                    zIndex: 25,
                    opacity: 0.85,
                    pointerEvents: "none",
                  }}
                />
              )}

              {/* Auto-Scan Status Pill Banner */}
              {autoScanEnabled && !isStarting && !error && !isFlashing && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: alertLevel === "glare"
                      ? "rgba(127, 29, 29, 0.94)"
                      : isPlateClear
                      ? "rgba(6, 78, 59, 0.94)"
                      : "rgba(15, 23, 42, 0.88)",
                    backdropFilter: "blur(6px)",
                    border: alertLevel === "glare"
                      ? "1px solid #ef4444"
                      : isPlateClear
                      ? "1px solid #10b981"
                      : "1px solid rgba(45, 212, 191, 0.5)",
                    color: alertLevel === "glare"
                      ? "#fca5a5"
                      : isPlateClear
                      ? "#34d399"
                      : "#2dd4bf",
                    padding: "6px 16px",
                    borderRadius: 20,
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    zIndex: 20,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                    letterSpacing: 0.3,
                    transition: "all 0.2s ease",
                  }}
                >
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: alertLevel === "glare" ? "#ef4444" : isPlateClear ? "#10b981" : "#f59e0b",
                      boxShadow: `0 0 10px ${alertLevel === "glare" ? "#ef4444" : isPlateClear ? "#10b981" : "#f59e0b"}`,
                    }}
                  />
                  {clarityStatus}
                </div>
              )}

              {/* Laser Scanning Line Animation */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                  overflow: "hidden",
                  zIndex: 8,
                }}
              >
                <div className="pm-cam-laser-scanner" />
              </div>

              {/* Viewfinder Target Reticle (Đã căn chuẩn 100% chính giữa trung tâm) */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "72%",
                  maxWidth: 440,
                  height: "46%",
                  border: isFlashing
                    ? "3px solid #ffffff"
                    : alertLevel === "glare"
                    ? "3px solid #ef4444"
                    : isPlateClear
                    ? "3px solid #10b981"
                    : "2px dashed #2dd4bf",
                  borderRadius: 12,
                  boxShadow: alertLevel === "glare"
                    ? "0 0 25px rgba(239, 68, 68, 0.7)"
                    : isPlateClear
                    ? "0 0 25px rgba(16, 185, 129, 0.7)"
                    : "0 0 16px rgba(45, 212, 191, 0.35)",
                  pointerEvents: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 10,
                  transition: "all 0.18s ease",
                }}
              >
                {/* 4 corner accents */}
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    left: -2,
                    width: 16,
                    height: 16,
                    borderTop: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                    borderLeft: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 16,
                    height: 16,
                    borderTop: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                    borderRight: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: -2,
                    left: -2,
                    width: 16,
                    height: 16,
                    borderBottom: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                    borderLeft: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 16,
                    height: 16,
                    borderBottom: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                    borderRight: alertLevel === "glare" ? "3px solid #ef4444" : isPlateClear ? "3px solid #10b981" : "3px solid #2dd4bf",
                  }}
                />

                <span
                  style={{
                    background: alertLevel === "glare"
                      ? "rgba(127, 29, 29, 0.9)"
                      : isPlateClear
                      ? "rgba(6, 78, 59, 0.9)"
                      : "rgba(15, 23, 42, 0.8)",
                    color: alertLevel === "glare"
                      ? "#fca5a5"
                      : isPlateClear
                      ? "#34d399"
                      : "#2dd4bf",
                    border: alertLevel === "glare"
                      ? "1px solid #ef4444"
                      : isPlateClear
                      ? "1px solid #10b981"
                      : "1px solid rgba(45, 212, 191, 0.3)",
                    padding: "4px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    backdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    transition: "all 0.2s ease",
                  }}
                >
                  {alertLevel === "glare"
                    ? "⚠️ BỊ LÓA SÁNG - GIẢM ĐỘ SÁNG MÀN HÌNH"
                    : isPlateClear
                    ? "✓ BIỂN SỐ RÕ NÉT - GIỮ YÊN"
                    : "CĂN BIỂN SỐ VÀO KHUNG NÀY"}
                </span>
              </div>

              {isStarting && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.85)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#2dd4bf",
                    fontSize: 14,
                    fontWeight: 600,
                    gap: 8,
                    zIndex: 30,
                  }}
                >
                  <RotateCcw size={18} /> Đang khởi động camera...
                </div>
              )}
            </div>

            {/* Live Clarity & Quality HUD Meter (Hiển thị điểm phần trăm độ nét & lóa sáng trực quan) */}
            {autoScanEnabled && !isStarting && !error && (
              <div
                style={{
                  background: "#0f172a",
                  border: alertLevel === "glare"
                    ? "1px solid #ef4444"
                    : isPlateClear
                    ? "1px solid #10b981"
                    : "1px solid #334155",
                  borderRadius: 10,
                  padding: "10px 14px",
                  display: "grid",
                  gap: 6,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: alertLevel === "glare" ? "#ef4444" : isPlateClear ? "#10b981" : "#f59e0b",
                        boxShadow: `0 0 8px ${alertLevel === "glare" ? "#ef4444" : isPlateClear ? "#10b981" : "#f59e0b"}`,
                      }}
                    />
                    <span style={{ color: alertLevel === "glare" ? "#fca5a5" : isPlateClear ? "#6ee7b7" : "#cbd5e1" }}>
                      {clarityStatus}
                    </span>
                  </div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: alertLevel === "glare" ? "#ef4444" : isPlateClear ? "#10b981" : "#f59e0b",
                    }}
                  >
                    {alertLevel === "glare" ? `Lóa: ${glareRatio}%` : `Độ nét: ${clarityScore}%`}
                  </div>
                </div>

                {/* Meter Progress Bar */}
                <div style={{ position: "relative", width: "100%", height: 8, background: "#1e293b", borderRadius: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.max(0, clarityScore))}%`,
                      background: alertLevel === "glare"
                        ? "#ef4444"
                        : isPlateClear
                        ? "#10b981"
                        : clarityScore > 50
                        ? "#f59e0b"
                        : "#64748b",
                      borderRadius: 4,
                      transition: "width 0.15s ease, background-color 0.2s ease",
                    }}
                  />
                  {/* 75% target threshold marker */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: "75%",
                      width: 2,
                      background: "rgba(255, 255, 255, 0.7)",
                      boxShadow: "0 0 4px #ffffff",
                    }}
                    title="Ngưỡng tự động chụp (75%)"
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
                  <span>0%</span>
                  <span style={{ color: "#94a3b8" }}>Ngưỡng tự động chụp: ≥ 75%</span>
                  <span>100%</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: 0 }}>
              <p style={{ margin: 0, fontSize: 12.5, color: "#64748b" }}>
                Giữ yên biển số trong khung để tự động chụp, hoặc nhấn phím <strong>Space / Enter</strong> để chụp ngay.
              </p>
            </div>

            <div className="staff-modal-footer" style={{ marginTop: 6 }}>
              <button type="button" className="staff-btn-secondary" onClick={handleClose}>
                Hủy bỏ
              </button>
              <button
                type="button"
                className="pm-cta-btn pm-btn-teal"
                style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px" }}
                disabled={isStarting || captured}
                onClick={handleCapture}
              >
                <Camera size={16} /> Chụp ngay (Phím Space)
              </button>
            </div>
          </>
        )}
      </div>
    </StaffDialog>
  );
}

export default function VehicleOperations() {
  const { selectedLotId } = useOutletContext<StaffContext>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "checkout" ? "checkout" : "checkin";
  const initialPlate = searchParams.get("plate") || "";

  const [activeTab, setActiveTab] = useState<"checkin" | "checkout">(initialTab);
  const [sessions, setSessions] = useState<StaffSessionRow[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  // Vehicle Category for Dynamic Camera Layout: "Motorcycle" | "Car"
  const [cameraVehicleCategory, setCameraVehicleCategory] = useState<"Car" | "Motorcycle">("Car");

  // Check-In Form State
  const [cashBookingId, setCashBookingId] = useState("");
  const [bookingCash, setBookingCash] = useState<Payment | null>(null);
  const [bookingCashReason, setBookingCashReason] = useState("");
  const [bookingCashBusy, setBookingCashBusy] = useState(false);
  const [bookingCashError, setBookingCashError] = useState("");

  const [checkInPlate, setCheckInPlate] = useState(initialPlate);
  const [checkInBooking, setCheckInBooking] = useState("");
  const [checkInGate, setCheckInGate] = useState("");
  const [entryGates, setEntryGates] = useState<{ id: string; lotId: string; label: string }[]>([]);
  const [exitGates, setExitGates] = useState<typeof entryGates>([]);
  const [exitGate, setExitGate] = useState("");
  const [gateError, setGateError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadGates() {
      try {
        const [lots, assignments] = await Promise.all([api.getParkingLots(), api.getStaffAssignmentsMe()]);
        const assigned = new Set(assignments.map(assignment => assignment.lotId));
        const results = await Promise.allSettled(lots.filter(lot => assigned.has(lot.id) && lot.id === selectedLotId).map(async lot =>
          (await api.getEntryGates(lot.id)).map(gate => ({ ...gate, label: `${lot.name} · ${gate.code}` })),
        ));
        if (!active) return;
        const gates = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
        setEntryGates(gates);
        setCheckInGate(gates[0]?.id ?? "");
        const exitResults = await Promise.allSettled(lots.filter(lot => assigned.has(lot.id) && lot.id === selectedLotId).map(async lot =>
          (await api.getExitGates(lot.id)).map(gate => ({ ...gate, label: `${lot.name} · ${gate.code}` })),
        ));
        if (!active) return;
        const exits = exitResults.flatMap(result => result.status === "fulfilled" ? result.value : []);
        setExitGates(exits);
        setExitGate(exits[0]?.id ?? "");

        if (!gates.length) setGateError("Không có cổng vào khả dụng cho tài khoản này.");
      } catch {
        if (active) setGateError("Không tải được danh sách cổng vào. Hãy thử tải lại trang.");
      }
    }
    void loadGates();
    return () => { active = false; };
  }, [selectedLotId]);

  const [checkInVehicleType, setCheckInVehicleType] = useState<VehicleType>("Car");
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkInSuccess, setCheckInSuccess] = useState<CheckInResult | null>(null);
  const [checkInError, setCheckInError] = useState("");
  const checkInAttemptRef = React.useRef<{ signature: string; payload: CheckInPayload; expiresAt: number } | null>(null);
  const checkInInFlight = React.useRef(false);
  const renewCheckInKey = () => { checkInAttemptRef.current = null; };
  const [allowMismatchOverride, setAllowMismatchOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [evidenceKind, setEvidenceKind] = useState("CAMERA_SNAPSHOT");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [evidenceFileName, setEvidenceFileName] = useState("");
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // Check-Out Form State
  const [checkOutQuery, setCheckOutQuery] = useState(initialPlate);
  const [checkOutQrPayload, setCheckOutQrPayload] = useState("");
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"CASH" | "VNPAY_QR">("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [cashNotes, setCashNotes] = useState("");
  const [vnpayInfo, setVnpayInfo] = useState<{ paymentId: string; amount: number; paymentUrl: string } | null>(null);
  const [vnpayBusy, setVnpayBusy] = useState(false);
  const [exitPermit, setExitPermit] = useState<{ payload: CheckoutRequest; token: string; confirmKey: string } | null>(null);
  const [issuedExitQr, setIssuedExitQr] = useState<{ sessionId: string; qrPayload: string; expiresAt?: string } | null>(null);
  const [qrNow, setQrNow] = useState(Date.now());
  useEffect(() => {
    if (!issuedExitQr) return;
    setQrNow(Date.now());
    const timer = setInterval(() => setQrNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [issuedExitQr]);
  const exitQrExpired = Boolean(issuedExitQr?.expiresAt && (!Number.isFinite(Date.parse(issuedExitQr.expiresAt)) || Date.parse(issuedExitQr.expiresAt) <= qrNow));
  const [authorizeKey, setAuthorizeKey] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [mismatchQuote, setMismatchQuote] = useState<CheckOutQuoteDto | null>(null);

  const [feeInfo, setFeeInfo] = useState<(CheckOutQuoteDto & { gateId: string; detectedPlate: string }) | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [checkOutProcessing, setCheckOutProcessing] = useState(false);
  const [checkOutSuccess, setCheckOutSuccess] = useState<{ message: string; paymentId?: string } | null>(null);
  const [eReceipt, setEReceipt] = useState<PaymentReceiptDto | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Camera ANPR Boxes State (Bắt đầu trống, chỉ hiển thị biển số sau khi quét AI thật)
  interface CamBoxState {
    fileUrl?: string;
    result?: PlateRecognitionResult;
    scanning?: boolean;
    plateText?: string;
    confidence?: string;
  }

  const [cameraStates, setCameraStates] = useState<Record<string, CamBoxState>>({
    "moto-cam1": {},
    "moto-cam2": {},
    "car-cam1": {},
    "car-cam2": {},
    "car-cam3": {},
    "car-cam4": {},
  });
  const [activeTargetCam, setActiveTargetCam] = useState<string>("car-cam1");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Review OCR modal state (POST /api/v1/parking-lots/{lotId}/plate-recognitions/{id}/review)
  const [reviewCamId, setReviewCamId] = useState<string | null>(null);
  const [reviewPlateInput, setReviewPlateInput] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState("");

  // Live Webcam Scanner state
  const [webcamTargetCam, setWebcamTargetCam] = useState<string | null>(null);

  const getCamLabel = (camId: string) => {
    switch (camId) {
      case "car-cam1":
        return "Cam 1: Mặt trước (Front Plate)";
      case "car-cam2":
        return "Cam 2: Mặt sau (Rear Plate)";
      case "car-cam3":
        return "Cam 3: Sườn trái (Left Side)";
      case "car-cam4":
        return "Cam 4: Sườn phải (Right Side)";
      case "moto-cam1":
        return "Cam 1: Mặt trước (Toàn cảnh & Người lái)";
      case "moto-cam2":
        return "Cam 2: Mặt sau (ANPR Biển số xe máy)";
      default:
        return "Camera Quét Biển Số";
    }
  };

  const handleOpenReviewOcr = (camId: string) => {
    const cam = cameraStates[camId];
    if (!cam) return;
    setReviewCamId(camId);
    setReviewPlateInput(cam.plateText && cam.plateText !== "Không nhận diện được" ? cam.plateText : "");
    setReviewNotes("Nhân viên kiểm tra và đính chính biển số");
    setReviewMsg("");
  };

  const handleConfirmReviewOcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewCamId || !reviewPlateInput.trim()) return;
    const cam = cameraStates[reviewCamId];
    const recId = (cam?.result as { id?: string; recognitionId?: string })?.id || (cam?.result as { id?: string; recognitionId?: string })?.recognitionId || crypto.randomUUID();
    const currentGateId = activeTab === "checkin" ? checkInGate : exitGate;
    const currentGate = entryGates.find(g => g.id === currentGateId) || exitGates.find(g => g.id === currentGateId) || entryGates[0] || exitGates[0];
    const lotId = currentGate?.lotId || selectedLotId || "";
    if (!lotId) return;

    setReviewSubmitting(true);
    setReviewMsg("");
    try {
      await api.reviewPlateRecognition(lotId, recId, reviewPlateInput.trim().toUpperCase(), reviewNotes.trim());
      setCameraStates((prev) => ({
        ...prev,
        [reviewCamId]: {
          ...prev[reviewCamId],
          plateText: reviewPlateInput.trim().toUpperCase(),
          confidence: "AI Đã Đính Chính (Staff Reviewed)",
        },
      }));
      if (activeTab === "checkin") setCheckInPlate(reviewPlateInput.trim().toUpperCase());
      else {
        setCheckOutQuery(reviewPlateInput.trim().toUpperCase());
        handleLookupFee(reviewPlateInput.trim().toUpperCase());
      }
      setReviewCamId(null);
    } catch (err) {
      setReviewMsg(err instanceof Error ? err.message : "Không thể gửi đính chính biển số.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleTriggerUploadForCam = (camId: string) => {
    setActiveTargetCam(camId);
    fileInputRef.current?.click();
  };

  const processPlateFile = async (file: File, camId: string) => {
    if (file.size > 5 * 1024 * 1024) {
      setCameraError("Dung lượng ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setCameraError("Chỉ chấp nhận file ảnh JPG hoặc PNG hợp lệ.");
      return;
    }
    setCameraError("");

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
      const gate = activeTab === "checkin"
        ? entryGates.find(item => item.id === checkInGate)
        : exitGates.find(item => item.id === exitGate);
      if (!gate) throw new Error("Chọn cổng trước khi nhận diện biển số.");
      const direction = activeTab === "checkin" ? "IN" : "OUT";
      const result = await staffApi.scanLicensePlate(file, gate.id, direction, gate.lotId);

      // Đồng thời kích hoạt sự kiện thiết bị barrier gửi dữ liệu lên Parking Service (POST /api/v1/parking-lots/{lotId}/plate-recognitions)
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const raw = String(reader.result || "");
          const base64 = raw.split(",")[1] || "";
          if (base64) {
            await api.uploadLotPlateRecognition(gate.lotId, {
              imageBase64: base64,
              contentType: file.type || "image/jpeg",
            });
          }
        } catch (lotRecErr) {
          console.warn("Could not dispatch barrier plate recognition event to Parking Service:", lotRecErr);
        }
      };
      reader.readAsDataURL(file);

      const rawPlate = result.displayPlate || result.plateNumber;
      const isUnrecognized = !rawPlate || rawPlate === "NO_PLATE" || result.confidence < 0.60;

      const confPct = (result.confidence * 100).toFixed(1);
      const confLabel = isUnrecognized
        ? "Độ tin cậy: 0.0% (Ảnh mờ/lóa - Không đọc được)"
        : `Độ tin cậy AI: ${confPct}%${result.isFallback ? " (Cần soát xét)" : ""}`;

      setCameraStates((prev) => ({
        ...prev,
        [camId]: {
          fileUrl: previewUrl,
          result: result,
          scanning: false,
          plateText: isUnrecognized ? "Không nhận diện được" : rawPlate,
          confidence: confLabel,
        },
      }));

      // QUY TẮC AN TOÀN: CHỈ TỰ ĐỘNG ĐIỀN KHI AI THỰC SỰ ĐỌC ĐƯỢC BIỂN SỐ VỚI ĐỘ TIN CẬY CAO (>= 75% VÀ KHÔNG PHẢI FALLBACK MỜ)
      if (!isUnrecognized && result.confidence >= 0.75 && !result.isFallback) {
        if (activeTab === "checkin") {
          setCheckInPlate(rawPlate);

          const isMoto =
            result.vehicleTypeSuggestion === "Motorcycle" ||
            String(result.vehicleTypeSuggestion) === "1" ||
            result.plateType === "TwoLine" ||
            rawPlate.includes("-P") ||
            rawPlate.includes("-V");

          if (isMoto) {
            setCheckInVehicleType("Motorcycle");
            setCameraVehicleCategory("Motorcycle");
          } else {
            setCheckInVehicleType("Car");
            setCameraVehicleCategory("Car");
          }
        } else {
          setCheckOutQuery(rawPlate);
          handleLookupFee(rawPlate);
        }
      } else if (isUnrecognized) {
        setCameraError("Ảnh chụp không nhận diện được biển số (do bị lóa sáng hoặc nhòe). Vui lòng chụp lại hoặc bấm 'Sửa OCR' để nhập thủ công.");
      }
    } catch (err: unknown) {
      console.error("AI Plate Recognition error for cam:", camId, err);
      setCameraError("Lỗi nhận diện biển số: " + (err instanceof Error ? err.message : "Máy chủ OCR không phản hồi"));
      setCameraStates((prev) => ({
        ...prev,
        [camId]: {
          ...prev[camId],
          scanning: false,
        },
      }));
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = "";
    await processPlateFile(file, activeTargetCam);
  };

  const handleResetCam = (camId: string) => {
    setCameraError("");
    setCameraStates((prev) => ({
      ...prev,
      [camId]: {
        fileUrl: undefined,
        result: undefined,
        scanning: false,
        plateText: undefined,
        confidence: undefined,
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
    setCheckInVehicleType(category === "Motorcycle" ? "Motorcycle" : "Car");
  };

  const loadSessions = async () => {
    setSessionError("");
    const lots = selectedLotId ? [selectedLotId] : [];
    const results = await Promise.allSettled(lots.map(lotId => api.getStaffSessions(lotId)));
    setSessions(results.flatMap(result => result.status === "fulfilled" ? result.value : []));
    if (results.some(result => result.status === "rejected")) {
      setSessionError("Không tải được phiên đỗ của một số bãi.");
    }
  };

  useEffect(() => {
    void loadSessions();
  }, [entryGates, exitGates]);

  const searchPlate = filterQuery.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const visibleSessions = sessions.filter(session =>
    (statusFilter === "All" || (statusFilter === "Active" ? session.status !== "COMPLETED" : session.status === "COMPLETED"))
    && session.licensePlate.replace(/[^A-Z0-9]/g, "").includes(searchPlate),
  );

  const lookupBookingCash = async () => {
    setBookingCashBusy(true);
    setBookingCashError("");
    setBookingCash(null);
    try {
      const booking = await api.getBooking(cashBookingId.trim());
      if (booking.lotId !== selectedLotId) throw new Error("Đặt chỗ thuộc bãi khác. Chọn đúng bãi trực trước khi thu tiền.");
      setBookingCash(await api.getBookingCashRequest(booking.bookingId, booking.lotId));
    } catch (err) {
      setBookingCashError(err instanceof Error ? err.message : "Không tìm được yêu cầu thu tiền.");
    } finally {
      setBookingCashBusy(false);
    }
  };

  const confirmBookingCash = async () => {
    if (bookingCash?.status !== "PENDING" || !bookingCashReason.trim()) return;
    setBookingCashBusy(true);
    setBookingCashError("");
    try {
      setBookingCash(await api.confirmBookingCash(bookingCash, bookingCashReason.trim()));
    } catch (err) {
      setBookingCashError(err instanceof Error ? err.message : "Không xác nhận được khoản thu.");
    } finally {
      setBookingCashBusy(false);
    }
  };

  const handleCheckInEvidenceFile = async (file?: File) => {
    if (!file) return;
    const selectedLotId = entryGates.find(gate => gate.id === checkInGate)?.lotId;
    if (!selectedLotId) {
      setCheckInError("Vui lòng chọn cổng vào trước khi tải ảnh chứng cứ.");
      return;
    }
    const normalizedType = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (normalizedType !== "image/png" && normalizedType !== "image/jpeg") {
      setCheckInError("Chỉ hỗ trợ ảnh định dạng PNG hoặc JPEG.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setCheckInError("Ảnh chứng cứ vượt quá giới hạn 4 MiB.");
      return;
    }
    setCheckInError("");
    setEvidenceFileName(file.name);
    setEvidenceUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Không đọc được nội dung file ảnh."));
        reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.includes(",") ? dataUrl.split(",", 2)[1] : dataUrl;
      const uploaded = await api.uploadLotEvidence(
        selectedLotId,
        { contentType: normalizedType, imageBase64: base64 },
        crypto.randomUUID(),
      );
      setEvidenceReference(uploaded.reference);
      renewCheckInKey();
    } catch (uploadErr) {
      setCheckInError(uploadErr instanceof Error ? uploadErr.message : "Upload ảnh chứng cứ thất bại.");
    } finally {
      setEvidenceUploading(false);
    }
  };

  // Check-In Submit
  const handleCheckIn = async (e?: React.FormEvent, forceOverride?: boolean) => {
    e?.preventDefault();
    if (checkInInFlight.current || evidenceUploading) return;
    setCheckInError("");
    setCheckInSuccess(null);
    const isOverride = forceOverride ?? allowMismatchOverride;

    if (isOverride) {
      const reasonTrimmed = overrideReason.trim();
      if (reasonTrimmed.length < 10 || reasonTrimmed.length > 500) {
        setCheckInError("Lý do override lệch biển số phải từ 10 đến 500 ký tự.");
        return;
      }
      if (!evidenceReference.trim()) {
        setCheckInError("Vui lòng upload ảnh chứng cứ hoặc nhập tham chiếu bằng chứng camera.");
        return;
      }
    }

    checkInInFlight.current = true;
    setCheckInLoading(true);
    try {
      const draft: CheckInPayload = {
        licensePlate: checkInPlate.trim(),
        qrToken: checkInBooking.trim() || undefined,
        lotId: entryGates.find(gate => gate.id === checkInGate)?.lotId,
        vehicleType: checkInVehicleType,
        gateId: checkInGate,
        allowMismatchOverride: isOverride,
        overrideReason: isOverride ? overrideReason.trim() : undefined,
        evidence: isOverride
          ? [{ kind: evidenceKind, reference: evidenceReference.trim() }]
          : undefined,
      };
      const signature = JSON.stringify(draft);
      let attempt = checkInAttemptRef.current;
      if (!attempt || attempt.signature !== signature) {
        attempt = {
          signature,
          expiresAt: Date.now() + 30 * 60_000,
          payload: {
            ...draft,
            evidence: draft.evidence?.map(item => ({ ...item, capturedAt: new Date().toISOString() })),
            idempotencyKey: `checkin-${crypto.randomUUID()}`,
          },
        };
        checkInAttemptRef.current = attempt;
      }
      if (attempt.expiresAt <= Date.now()) throw new Error("Yêu cầu check-in trước đã quá thời gian thử lại. Kiểm tra danh sách phiên và bắt đầu lại thao tác sau khi đối chiếu.");
      // Preserve the complete request on a retry, including evidence time. A
      // changed camera plate/type is detected here even without an input event.
      const res = await staffApi.checkInVehicle(attempt.payload);
      setCheckInSuccess(res);
      setCheckInPlate("");
      setCheckInBooking("");
      setAllowMismatchOverride(false);
      setShowOverrideModal(false);
      setOverrideReason("");
      setEvidenceReference("");
      setEvidenceFileName("");
      renewCheckInKey();
      loadSessions();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể check-in phương tiện.";
      const lower = msg.toLowerCase();
      if (err instanceof ApiError && err.status === 409 && (err.errorCode === "PLATE_MISMATCH" || (!err.errorCode && /plate.*(?:does not match|mismatch)|biển số.*(?:không khớp|sai lệch)/i.test(msg)))) {
        setAllowMismatchOverride(true);
        setShowOverrideModal(true);
        renewCheckInKey();
        setCheckInError(`${msg} — Vui lòng nhập lý do (10–500 ký tự) và upload ảnh chứng cứ để xác nhận ngoại lệ.`);
      } else if (lower.includes("full") || lower.includes("no available") || lower.includes("hết") || lower.includes("đầy")) {
        setCheckInError(`Bãi hiện đã đầy cho loại xe ${checkInVehicleType}: ${msg}`);
      } else if (lower.includes("active session") || lower.includes("already") || lower.includes("phiên")) {
        setCheckInError(`Xe đang có phiên gửi hoạt động: ${msg}`);
      } else {
        setCheckInError(msg);
      }
    } finally {
      checkInInFlight.current = false;
      setCheckInLoading(false);
    }
  };

  // Lookup Fee for Check-Out
  const handleLookupFee = async (overrideQ?: string, gateId = exitGate, qrOverride?: string) => {
    const plate = (overrideQ ?? checkOutQuery).trim();
    const qr = (qrOverride ?? checkOutQrPayload).trim();
    const gate = exitGates.find(item => item.id === gateId);
    if ((!plate && !qr) || !gate || exitPermit) return;
    setCalculatingFee(true);
    setCheckoutError("");
    setMismatchQuote(null);
    setFeeInfo(null);
    setVnpayInfo(null);
    setCheckOutSuccess(null);
    try {
      const quote = await api.getCheckoutQuote(gate.lotId, gate.id, plate, qr || undefined);
      if (!quote.isPlateMatched || !quote.quoteToken) {
        setMismatchQuote(quote);
        throw new Error(
          `Lệch biển số khi đối soát: Biển lúc vào "${quote.entryPlate}" ≠ biển tại cổng ra "${quote.exitPlate || plate}"${quote.incidentCode ? ` (Mã sự cố: ${quote.incidentCode})` : ""}.`,
        );
      }
      setFeeInfo({ ...quote, gateId: gate.id, detectedPlate: quote.exitPlate || plate });
      setCheckoutPaymentMethod("CASH");
      setCashReceived("");
      setCashNotes("");
      setAuthorizeKey(crypto.randomUUID());
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Không lấy được phí xuất bãi.");
    } finally {
      setCalculatingFee(false);
    }
  };

  const handlePrepareVnPay = async () => {
    if (!feeInfo?.quoteToken) return;
    setVnpayBusy(true);
    setCheckoutError("");
    try {
      const prep = await api.prepareCheckoutVnPay(feeInfo.quoteToken);
      setVnpayInfo({ paymentId: prep.paymentId, amount: prep.amount, paymentUrl: prep.paymentUrl });
      setAuthorizeKey(crypto.randomUUID());
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Không khởi tạo được giao dịch VNPay check-out.");
    } finally {
      setVnpayBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!feeInfo?.quoteToken) return;
    setCheckOutProcessing(true);
    setCheckoutError("");
    try {
      if (!exitPermit) {
        const method: CheckoutRequest["paymentMethod"] = !feeInfo.paymentRequired
          ? "NONE"
          : checkoutPaymentMethod;
        const payload: CheckoutRequest = {
          sessionId: feeInfo.sessionId,
          gateId: feeInfo.gateId,
          detectedPlate: feeInfo.detectedPlate,
          quoteToken: feeInfo.quoteToken,
          paymentMethod: method,
          cashReceived: method === "CASH" ? Number(cashReceived) : 0,
          paymentReference: method === "VNPAY_QR" ? vnpayInfo?.paymentId : undefined,
          staffNotes: method === "CASH" ? cashNotes.trim() : undefined,
        };
        const authorization = await api.authorizeCheckout(payload, authorizeKey);
        setExitPermit({ payload, token: authorization.exitPermitToken, confirmKey: crypto.randomUUID() });
        return;
      }
      const result = await api.confirmCheckout(exitPermit.payload, exitPermit.token, exitPermit.confirmKey);
      setCheckOutSuccess({
        message: "Đã ghi nhận xe rời bãi và giải phóng ô đỗ.",
        paymentId: result.paymentId,
      });
      setExitPermit(null);
      setFeeInfo(null);
      setVnpayInfo(null);
      setCheckOutQuery("");
      setCheckOutQrPayload("");
      loadSessions();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Không ghi nhận được lượt xe ra.");
    } finally {
      setCheckOutProcessing(false);
    }
  };

  const handleIssueExitQr = async (sessionId: string) => {
    setCheckoutError("");
    try {
      const qr = await api.issueCheckOutQr(sessionId);
      const token = qr.qrPayload || qr.qrToken || qr.token || "";
      if (!token) throw new Error("Máy chủ chưa cấp mã QR. Hãy thử lại.");
      setIssuedExitQr({ sessionId, qrPayload: token, expiresAt: qr.expiresAt });
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Không phát hành được QR chiều ra.");
    }
  };

  const handleViewReceipt = async (paymentId?: string) => {
    if (!paymentId) return;
    setLoadingReceipt(true);
    try {
      setEReceipt(await staffApi.getPaymentReceipt(paymentId));
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Không tải được biên lai.");
    } finally {
      setLoadingReceipt(false);
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
            <span>Điều phối vào / ra xe</span>
          </h1>
          <p className="pm-section-subtitle">
            Xử lý tiếp nhận tại cổng vào, kiểm tra mã đặt chỗ QR, tính phí xuất bến và xác nhận xe rời cổng
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
                <span className="pm-badge-success">Cổng vào</span>
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
                      onChange={(e) => { setCheckInPlate(e.target.value); renewCheckInKey(); }}
                    />
                  </div>

                  <div className="pm-form-row">
                    <div className="pm-form-field">
                      <label className="pm-form-label">Token QR đặt chỗ (nếu có):</label>
                      <input
                        type="text"
                        className="pm-form-input"
                        placeholder="Dán token QR"
                        value={checkInBooking}
                        onChange={(e) => { setCheckInBooking(e.target.value); renewCheckInKey(); }}
                      />
                    </div>

                    <div className="pm-form-field">
                      <label className="pm-form-label">Loại xe:</label>
                      <select
                        className="pm-form-select"
                        value={checkInVehicleType}
                        onChange={(e) => { handleVehicleTypeChange(e.target.value as VehicleType); renewCheckInKey(); }}
                      >
                        <option value="Car">Ô tô (4-7 chỗ)</option>
                        <option value="Motorcycle">Xe máy</option>
                        <option value="EV">Xe điện (EV → CAR)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pm-form-field">
                    <label className="pm-form-label">Cổng vào chỉ định:</label>
                    {gateError && <p role="alert">{gateError}</p>}
                    <select
                      className="pm-form-select"
                      value={checkInGate}
                      onChange={(e) => { setCheckInGate(e.target.value); renewCheckInKey(); }}
                    >
                      <option value="" disabled>Chọn cổng vào</option>
                      {entryGates.map(gate => <option key={gate.id} value={gate.id}>{gate.label}</option>)}
                    </select>
                  </div>

                  <div className="pm-form-field">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={allowMismatchOverride}
                        onChange={(e) => { setAllowMismatchOverride(e.target.checked); renewCheckInKey(); }}
                      />
                      <span>Xác nhận ngoại lệ lệch biển số (Override)</span>
                    </label>
                  </div>

                  {allowMismatchOverride && (
                    <div style={{ border: "1px solid rgba(251, 191, 36, 0.45)", borderRadius: 12, padding: 12, display: "grid", gap: 10 }}>
                      <label className="pm-form-label">
                        Lý do override (10–500 ký tự) <span className="pm-required">*</span>:
                        <textarea
                          required
                          minLength={10}
                          maxLength={500}
                          className="pm-form-input"
                          style={{ minHeight: 72, paddingTop: 8 }}
                          placeholder="Ví dụ: Đã đối chiếu giấy đăng ký xe và xác nhận đúng chủ đặt chỗ..."
                          value={overrideReason}
                          onChange={(e) => { setOverrideReason(e.target.value); renewCheckInKey(); }}
                        />
                        <small>{overrideReason.trim().length} / 500 ký tự</small>
                      </label>

                      <div className="pm-form-row">
                        <label className="pm-form-label">
                          Loại chứng cứ:
                          <select
                            className="pm-form-select"
                            value={evidenceKind}
                            onChange={(e) => { setEvidenceKind(e.target.value); renewCheckInKey(); }}
                          >
                            <option value="CAMERA_SNAPSHOT">Ảnh chụp camera cổng</option>
                            <option value="GATE_CAMERA">Camera làn vào</option>
                            <option value="VEHICLE_DOCUMENT">Giấy tờ xe đối chiếu</option>
                          </select>
                        </label>
                        <label className="pm-form-label">
                          Ảnh chứng cứ PNG/JPEG (tối đa 4 MiB, tự upload lên bãi):
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg"
                            disabled={evidenceUploading}
                            onChange={(e) => { void handleCheckInEvidenceFile(e.target.files?.[0]); }}
                          />
                          {evidenceUploading && <small>Đang tải ảnh chứng cứ lên máy chủ...</small>}
                          {!evidenceUploading && evidenceFileName && <small>Đã upload ảnh: {evidenceFileName}</small>}
                        </label>
                      </div>

                      <label className="pm-form-label">
                        Mã hoặc đường dẫn chứng cứ <span className="pm-required">*</span>:
                        <input
                          type="text"
                          required
                          maxLength={2048}
                          className="pm-form-input"
                          placeholder="VD: gate-evidence://entry/cam-g1-20261112.jpg"
                          value={evidenceReference}
                          onChange={(e) => { setEvidenceReference(e.target.value); renewCheckInKey(); }}
                        />
                      </label>
                    </div>
                  )}

                  {checkInError && <p role="alert" style={{ color: "#b42337", margin: 0 }}>{checkInError}</p>}

                  <button
                    type="submit"
                    disabled={checkInLoading || evidenceUploading || !checkInGate}
                    className="pm-cta-btn pm-btn-teal"
                  >
                    <CheckCircle2 size={18} />
                    <span>{checkInLoading ? "Đang xử lý..." : allowMismatchOverride ? "Xác nhận Override & Cho xe vào" : "Xác nhận xe vào"}</span>
                  </button>
                </form>

                <section className="pm-fee-card" aria-label="Thu tiền mặt booking">
                  <h3>Thu tiền mặt booking</h3>
                  <label className="pm-form-label">ID đặt chỗ
                    <input className="pm-form-input" value={cashBookingId} disabled={bookingCashBusy}
                      onChange={event => { setCashBookingId(event.target.value); setBookingCash(null); }} />
                  </label>
                  <button type="button" onClick={() => void lookupBookingCash()} disabled={!cashBookingId.trim() || bookingCashBusy}>
                    Tra cứu yêu cầu thu tiền
                  </button>
                  {bookingCash && (
                    <>
                      <p>{bookingCash.amount?.toLocaleString("vi-VN")} {bookingCash.currency} · {bookingCash.status === "SUCCESS" ? "Đã thu tiền" : bookingCash.status}</p>
                      {bookingCash.status === "PENDING" && (
                        <>
                          <label className="pm-form-label">Ghi chú thu tiền booking
                            <input className="pm-form-input" value={bookingCashReason} maxLength={500}
                              onChange={event => setBookingCashReason(event.target.value)} />
                          </label>
                          <button type="button" onClick={() => void confirmBookingCash()}
                            disabled={!bookingCashReason.trim() || bookingCashBusy}>Xác nhận đã thu tiền booking</button>
                        </>
                      )}
                    </>
                  )}
                  {bookingCashError && <p role="alert">{bookingCashError}</p>}
                </section>

                {/* Check-In Success Box */}
                {checkInSuccess && (
                  <div className="pm-success-box">
                    <div className="pm-success-header">
                      <CheckCircle2 size={20} color="#10b981" />
                      <span>Đã ghi nhận xe vào bãi</span>
                    </div>
                    <div className="pm-success-details">
                      <div>Biển số: <strong>{checkInSuccess.licensePlate}</strong></div>
                      <div>Vị trí đỗ được cấp: <strong className="pm-slot-highlight">{checkInSuccess.slotCode}</strong></div>
                      <div>Hình thức vào: <strong>{checkInSuccess.entryMethod || (checkInSuccess.bookingId ? "PRE_BOOKING" : "AUTO_SLOT")}</strong></div>
                      <div>Booking: <strong>{checkInSuccess.bookingId ?? "Walk-in (Không đặt trước)"}</strong></div>
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
                <span className="pm-badge-success">Cổng ra</span>
              </div>

              <div className="pm-op-card-body">
                <div className="pm-lookup-row" style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    className="pm-form-input pm-plate-input"
                    style={{ flex: 1 }}
                    placeholder="Nhập biển số xe"
                    value={checkOutQuery}
                    onChange={(e) => setCheckOutQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleLookupFee()}
                  />
                  <button
                    type="button"
                    onClick={() => handleLookupFee()}
                    disabled={calculatingFee || !exitGate || !!exitPermit || checkOutProcessing}
                    className="pm-search-action-btn"
                  >
                    <Search size={16} />
                    <span>{calculatingFee ? "Đang tìm..." : "Tra cứu"}</span>
                  </button>
                </div>

                <label className="pm-form-label" style={{ marginBottom: 10 }}>
                  Mã QR chiều ra (tùy chọn)
                  <input
                    type="text"
                    className="pm-form-input"
                    placeholder="Dán payload QR chiều ra để đối soát..."
                    value={checkOutQrPayload}
                    disabled={!!exitPermit || checkOutProcessing}
                    onChange={(e) => setCheckOutQrPayload(e.target.value)}
                  />
                </label>

                <label className="pm-form-label">
                  Cổng ra
                  <select className="pm-form-select" value={exitGate} disabled={!!exitPermit || checkOutProcessing}
                    onChange={event => { setExitGate(event.target.value); setFeeInfo(null); setVnpayInfo(null); }}>
                    <option value="" disabled>Chọn cổng ra</option>
                    {exitGates.map(gate => <option key={gate.id} value={gate.id}>{gate.label}</option>)}
                  </select>
                </label>
                {checkoutError && <p role="alert" style={{ color: "#b42337" }}>{checkoutError}</p>}

                {mismatchQuote && !mismatchQuote.isPlateMatched && (
                  <div style={{ border: "1px solid #ef4444", borderRadius: 10, padding: 12, marginTop: 10, background: "rgba(239,68,68,0.12)" }}>
                    <strong>Cảnh báo lệch biển số vào / ra</strong>
                    <div>Biển số vào: <strong>{mismatchQuote.entryPlate}</strong> · Biển số ra: <strong>{mismatchQuote.exitPlate}</strong></div>
                    {mismatchQuote.incidentCode && <div>Mã sự cố phát sinh: <strong>{mismatchQuote.incidentCode}</strong></div>}
                    <div style={{ marginTop: 8 }}>
                      <Link
                        to={`/staff/incidents?plate=${encodeURIComponent(mismatchQuote.entryPlate)}`}
                        className="pm-cta-btn-sm red"
                      >
                        Mở xử lý sự cố lệch biển số
                      </Link>
                    </div>
                  </div>
                )}

                {/* Fee Information Breakdown */}
                {feeInfo && (
                  <div className="pm-fee-card">
                    <h3 className="pm-fee-title">Bảng kê Chi tiết Thu phí Xuất bến</h3>
                    <div className="pm-fee-lines">
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Biển số xe (vào / ra):</span>
                        <strong className="pm-text-white">{feeInfo.entryPlate} / {feeInfo.exitPlate}</strong>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Vị trí đã đỗ:</span>
                        <strong className="pm-text-teal">{feeInfo.slotCode}</strong>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Thời gian vào:</span>
                        <span>{new Date(feeInfo.entryAt).toLocaleTimeString("vi-VN")}</span>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Tổng thời lượng:</span>
                        <strong>{Math.floor(feeInfo.totalDurationMinutes / 60)} giờ {feeInfo.totalDurationMinutes % 60} phút</strong>
                      </div>
                      <div className="pm-fee-line">
                        <span className="pm-text-muted">Đã trả trước / Trễ giờ:</span>
                        <span>{feeInfo.prepaidAmount.toLocaleString("vi-VN")} VND / {feeInfo.overdueMinutes} phút</span>
                      </div>
                      <div className="pm-fee-total-row">
                        <span>TỔNG TIỀN PHẢI THU:</span>
                        <strong className="pm-fee-total-amount">
                          {feeInfo.totalAmountDue.toLocaleString("vi-VN")} VND
                        </strong>
                      </div>
                    </div>

                    {feeInfo.paymentRequired && !exitPermit && (
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        <label className="pm-form-label">
                          Phương thức thanh toán xuất bãi:
                          <select
                            className="pm-form-select"
                            value={checkoutPaymentMethod}
                            onChange={(e) => {
                              setCheckoutPaymentMethod(e.target.value as "CASH" | "VNPAY_QR");
                              setAuthorizeKey(crypto.randomUUID());
                            }}
                          >
                            <option value="CASH">Tiền mặt tại cổng (CASH)</option>
                            <option value="VNPAY_QR">Chuyển khoản / QR VNPay (VNPAY_QR)</option>
                          </select>
                        </label>

                        {checkoutPaymentMethod === "CASH" ? (
                          <>
                            <label className="pm-form-label">Số tiền mặt đã nhận
                              <input
                                className="pm-form-input"
                                type="number"
                                min={feeInfo.totalAmountDue}
                                value={cashReceived}
                                onChange={event => {
                                  setCashReceived(event.target.value);
                                  setAuthorizeKey(crypto.randomUUID());
                                }}
                              />
                            </label>
                            <label className="pm-form-label">Ghi chú thu tiền
                              <input
                                className="pm-form-input"
                                value={cashNotes}
                                onChange={event => {
                                  setCashNotes(event.target.value);
                                  setAuthorizeKey(crypto.randomUUID());
                                }}
                              />
                            </label>
                          </>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
                            <button
                              type="button"
                              className="pm-search-action-btn"
                              disabled={vnpayBusy}
                              onClick={() => void handlePrepareVnPay()}
                            >
                              {vnpayBusy ? "Đang tạo link VNPay..." : "Tạo link thanh toán VNPay"}
                            </button>
                            {vnpayInfo && (
                              <div style={{ fontSize: 13 }}>
                                <div>Payment ID: <code>{vnpayInfo.paymentId}</code></div>
                                <div>Số tiền: <strong>{vnpayInfo.amount.toLocaleString("vi-VN")} VND</strong></div>
                                <a href={vnpayInfo.paymentUrl} target="_blank" rel="noreferrer" style={{ color: "#0d4685" }}>
                                  Mở cổng thanh toán VNPay
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {exitPermit && <p>Đã được phép cho xe ra. Chỉ xác nhận khi xe đã rời cổng.</p>}

                    <button
                      type="button"
                      onClick={handleCheckOut}
                      disabled={
                        checkOutProcessing ||
                        (!exitPermit &&
                          feeInfo.paymentRequired &&
                          (checkoutPaymentMethod === "CASH"
                            ? Number(cashReceived) < feeInfo.totalAmountDue || !cashNotes.trim()
                            : !vnpayInfo?.paymentId))
                      }
                      className="pm-cta-btn pm-btn-teal"
                      style={{ marginTop: 18 }}
                    >
                      <CheckCircle2 size={18} />
                      <span>
                        {checkOutProcessing
                          ? "Đang ghi nhận..."
                          : exitPermit
                          ? "Xác nhận xe đã rời cổng"
                          : !feeInfo.paymentRequired
                          ? "Xác nhận cho xe ra"
                          : checkoutPaymentMethod === "CASH"
                          ? "Xác nhận thu tiền mặt và cho xe ra"
                          : "Xác minh VNPay và cho phép mở cổng"}
                      </span>
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

                      <div>Barrier: <strong>Đã xác nhận xe rời cổng</strong></div>
                    </div>
                    <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(checkOutSuccess.paymentId)}
                        className="pm-print-btn"
                        style={{ background: "rgba(34, 211, 238, 0.15)", border: "1px solid #22d3ee", color: "#0d4685" }}
                      >
                        <FileText size={15} />
                        <span>{loadingReceipt ? "Đang tải biên lai..." : "Xem biên lai thanh toán"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="pm-print-btn"
                      >
                        <Printer size={15} />
                        <span>In thông tin giao dịch</span>
                      </button>
                    </div>
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
              <h2 className="pm-op-card-title">Ảnh camera & nhận diện biển số</h2>
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
            {cameraError && <p role="alert" style={{ color: "#b42337", marginBottom: 10 }}>{cameraError}</p>}
            {/* IF MOTORCYCLE: 2-Camera Grid Layout */}
            {cameraVehicleCategory === "Motorcycle" ? (
              <div className="pm-cam-grid-2">
                {/* Cam 1: Mặt trước (Front Plate / Face) */}
                <div className="pm-cam-stream-box">
                  <div className="pm-cam-top-bar">
                    <span className="pm-cam-badge live">
                      <span className="pm-cam-dot" /> ẢNH TẢI LÊN
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
                    <div className="pm-cam-anpr-bounding-box">
                      <div className="pm-anpr-plate">
                        [ {cameraStates["moto-cam1"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div
                        className="pm-anpr-confidence"
                        style={{
                          color: !cameraStates["moto-cam1"]?.plateText
                            ? "#94a3b8"
                            : cameraStates["moto-cam1"]?.plateText === "Không nhận diện được"
                            ? "#ef4444"
                            : "#10b981",
                          fontWeight: 600,
                        }}
                      >
                        {cameraStates["moto-cam1"]?.confidence || "Tải ảnh hoặc mở Webcam để đọc biển số"}
                      </div>
                    </div>
                    <div className="pm-cam-tag-box" style={{ bottom: 8, left: 10 }}>
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
                    <button
                      type="button"
                      className="pm-cam-upload-btn"
                      style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" }}
                      onClick={() => setWebcamTargetCam("moto-cam1")}
                      disabled={cameraStates["moto-cam1"]?.scanning}
                      title="Mở Webcam máy tính để chụp & quét trực tiếp"
                    >
                      <Camera size={12} />
                      <span>Mở Webcam</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn"
                      disabled={!cameraStates["moto-cam1"]?.plateText || cameraStates["moto-cam1"]?.plateText === "Không nhận diện được"}
                      onClick={() => {
                        const p = cameraStates["moto-cam1"]?.plateText;
                        if (!p || p === "Không nhận diện được") return;
                        if (activeTab === "checkin") setCheckInPlate(p);
                        else {
                          setCheckOutQuery(p);
                          handleLookupFee(p);
                        }
                      }}
                      title="Điền biển số nhận diện từ Cam 1 vào Form"
                    >
                      Điền Biển số vào Form
                    </button>
                    <button
                      type="button"
                      className="pm-cam-upload-btn"
                      style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}
                      disabled={!cameraStates["moto-cam1"]?.plateText}
                      onClick={() => handleOpenReviewOcr("moto-cam1")}
                      title="Soát xét & đính chính OCR"
                    >
                      <Pencil size={11} /> <span>Sửa OCR</span>
                    </button>
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
                      <span className="pm-cam-dot" /> ẢNH TẢI LÊN
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
                        [ {cameraStates["moto-cam2"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div
                        className="pm-anpr-confidence"
                        style={{
                          color: !cameraStates["moto-cam2"]?.plateText
                            ? "#94a3b8"
                            : cameraStates["moto-cam2"]?.plateText === "Không nhận diện được"
                            ? "#ef4444"
                            : "#10b981",
                          fontWeight: 600,
                        }}
                      >
                        {cameraStates["moto-cam2"]?.confidence || "Tải ảnh hoặc mở Webcam để đọc biển số"}
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
                      className="pm-cam-upload-btn"
                      style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" }}
                      onClick={() => setWebcamTargetCam("moto-cam2")}
                      disabled={cameraStates["moto-cam2"]?.scanning}
                      title="Mở Webcam máy tính để chụp & quét trực tiếp"
                    >
                      <Camera size={12} />
                      <span>Mở Webcam</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn"
                      disabled={!cameraStates["moto-cam2"]?.plateText}
                      onClick={() => {
                        const p = cameraStates["moto-cam2"]?.plateText;
                        if (!p) return;
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
                      className="pm-cam-upload-btn"
                      style={{ background: "#fef3c7", color: "#92400e" }}
                      disabled={!cameraStates["moto-cam2"]?.plateText}
                      onClick={() => handleOpenReviewOcr("moto-cam2")}
                      title="Soát xét & đính chính OCR"
                    >
                      <Pencil size={11} /> <span>Sửa OCR</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-retake-btn"
                      onClick={() => handleResetCam("moto-cam2")}
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
                      <span className="pm-cam-dot" /> ẢNH TẢI LÊN
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
                        [ {cameraStates["car-cam1"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div
                        className="pm-anpr-confidence"
                        style={{
                          color: !cameraStates["car-cam1"]?.plateText
                            ? "#94a3b8"
                            : cameraStates["car-cam1"]?.plateText === "Không nhận diện được"
                            ? "#ef4444"
                            : "#10b981",
                          fontWeight: 600,
                        }}
                      >
                        {cameraStates["car-cam1"]?.confidence || "Tải ảnh hoặc mở Webcam để đọc biển số"}
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
                      className="pm-cam-upload-btn compact"
                      style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" }}
                      onClick={() => setWebcamTargetCam("car-cam1")}
                      disabled={cameraStates["car-cam1"]?.scanning}
                      title="Mở Webcam máy tính để chụp & quét trực tiếp"
                    >
                      <Camera size={11} />
                      <span>Webcam</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn compact"
                      disabled={!cameraStates["car-cam1"]?.plateText}
                      onClick={() => {
                        const p = cameraStates["car-cam1"]?.plateText;
                        if (!p) return;
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
                      className="pm-cam-upload-btn compact"
                      style={{ background: "#fef3c7", color: "#92400e" }}
                      disabled={!cameraStates["car-cam1"]?.plateText}
                      onClick={() => handleOpenReviewOcr("car-cam1")}
                      title="Soát xét & đính chính OCR"
                    >
                      <Pencil size={11} /> <span>Sửa OCR</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-retake-btn compact"
                      onClick={() => handleResetCam("car-cam1")}
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
                      <span className="pm-cam-dot" /> ẢNH TẢI LÊN
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
                        [ {cameraStates["car-cam2"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div
                        className="pm-anpr-confidence"
                        style={{
                          color: !cameraStates["car-cam2"]?.plateText
                            ? "#94a3b8"
                            : cameraStates["car-cam2"]?.plateText === "Không nhận diện được"
                            ? "#ef4444"
                            : "#10b981",
                          fontWeight: 600,
                        }}
                      >
                        {cameraStates["car-cam2"]?.confidence || "Tải ảnh hoặc mở Webcam để đọc biển số"}
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
                      className="pm-cam-upload-btn compact"
                      style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" }}
                      onClick={() => setWebcamTargetCam("car-cam2")}
                      disabled={cameraStates["car-cam2"]?.scanning}
                      title="Mở Webcam máy tính để chụp & quét trực tiếp"
                    >
                      <Camera size={11} />
                      <span>Webcam</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-fill-btn compact"
                      disabled={!cameraStates["car-cam2"]?.plateText}
                      onClick={() => {
                        const p = cameraStates["car-cam2"]?.plateText;
                        if (!p) return;
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
                      className="pm-cam-upload-btn compact"
                      style={{ background: "#fef3c7", color: "#92400e" }}
                      disabled={!cameraStates["car-cam2"]?.plateText}
                      onClick={() => handleOpenReviewOcr("car-cam2")}
                      title="Soát xét & đính chính OCR"
                    >
                      <Pencil size={11} /> <span>Sửa OCR</span>
                    </button>
                    <button
                      type="button"
                      className="pm-cam-retake-btn compact"
                      onClick={() => handleResetCam("car-cam2")}
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
                      <span className="pm-cam-dot" /> ẢNH TẢI LÊN
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
                      <span>{cameraStates["car-cam3"]?.fileUrl ? "Ảnh bên trái · cần kiểm tra thủ công" : "Chưa có ảnh bên trái"}</span>
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
                    <button
                      type="button"
                      className="pm-cam-upload-btn compact"
                      style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" }}
                      onClick={() => setWebcamTargetCam("car-cam3")}
                      disabled={cameraStates["car-cam3"]?.scanning}
                      title="Mở Webcam máy tính để chụp ảnh sườn trái"
                    >
                      <Camera size={11} />
                      <span>Webcam</span>
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
                      <span className="pm-cam-dot" /> ẢNH TẢI LÊN
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
                      <span>{cameraStates["car-cam4"]?.fileUrl ? "Ảnh bên phải · cần kiểm tra thủ công" : "Chưa có ảnh bên phải"}</span>
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
                    <button
                      type="button"
                      className="pm-cam-upload-btn compact"
                      style={{ background: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.45)", color: "#3b82f6" }}
                      onClick={() => setWebcamTargetCam("car-cam4")}
                      disabled={cameraStates["car-cam4"]?.scanning}
                      title="Mở Webcam máy tính để chụp ảnh sườn phải"
                    >
                      <Camera size={11} />
                      <span>Webcam</span>
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
            {sessionError && <caption role="alert">{sessionError}</caption>}
            <tbody>
              {visibleSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="pm-table-empty">
                    Không có lượt xe nào phù hợp.
                  </td>
                </tr>
              ) : (
                visibleSessions.map((s) => (
                  <tr key={s.sessionId} className="pm-table-row">
                    <td>
                      <span className="pm-session-code">{s.sessionId}</span>
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
                    <td>{Math.max(0, Math.floor(((s.checkoutAt ? Date.parse(s.checkoutAt) : Date.now()) - Date.parse(s.checkinAt)) / 60000))} phút</td>
                    <td>
                      <span
                        className={`pm-status-tag ${
                          s.status !== "COMPLETED" ? "tag-active" : "tag-completed"
                        }`}
                      >
                        {s.status !== "COMPLETED" ? "Đang gửi" : "Đã ra"}
                      </span>
                    </td>
                    <td>
                      {s.status !== "COMPLETED" ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="pm-action-btn-cyan"
                            onClick={() => {
                              setActiveTab("checkout");
                              setCheckOutQuery(s.licensePlate);
                              const gate = exitGates.find(item => item.lotId === s.lotId);
                              if (gate) {
                                setExitGate(gate.id);
                                void handleLookupFee(s.licensePlate, gate.id);
                              }
                            }}
                          >
                            Thu phí ra bãi
                          </button>
                          <button
                            type="button"
                            className="pm-cam-retake-btn compact"
                            onClick={() => void handleIssueExitQr(s.sessionId)}
                          >
                            Phát QR ra
                          </button>
                        </div>
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

      {/* ─── E-RECEIPT MODAL (SCRUM-72 REAL BACKEND API) ────────────────────── */}
      {eReceipt && <StaffDialog title="Biên lai thanh toán" onClose={() => setEReceipt(null)}>
        <div className="staff-stack">
          <div className="staff-alert success">Giao dịch đã được ghi nhận trên hệ thống.</div>
          <dl className="staff-detail-grid">
            <div><dt>Mã biên lai</dt><dd>{eReceipt.receiptNumber}</dd></div>
            <div><dt>Bãi đỗ</dt><dd>{eReceipt.lotName || "Chưa có thông tin"}</dd></div>
            <div><dt>Biển số xe</dt><dd>{eReceipt.plateNumber || "—"}</dd></div>
            <div><dt>Phương thức</dt><dd>{eReceipt.paymentMethod === "CASH" ? "Tiền mặt" : eReceipt.paymentMethod}</dd></div>
            <div><dt>Thời gian thanh toán</dt><dd>{staffDate(eReceipt.paidAt)}</dd></div>
            <div><dt>Nhân viên thu tiền</dt><dd>{eReceipt.collectedByStaff || "Không áp dụng / chưa có thông tin"}</dd></div>
          </dl>
          <div className="staff-panel staff-row between"><strong>Tổng thanh toán</strong><strong>{Number(eReceipt.totalAmount).toLocaleString("vi-VN")} {eReceipt.currency || "VND"}</strong></div>
          {eReceipt.verificationHash && <details><summary className="staff-row"><Hash size={15} />Thông tin xác thực biên lai</summary><p className="staff-small" style={{ overflowWrap: "anywhere" }}>{eReceipt.verificationHash}</p></details>}
          <button className="staff-primary" onClick={() => window.print()}><Printer size={16} />In biên lai</button>
        </div>
      </StaffDialog>}
      {/* ─── CHECK-IN PLATE_MISMATCH OVERRIDE MODAL (SCRUM-111) ───────────────── */}
      {showOverrideModal && (
        <StaffDialog title={"Xác minh biển số không khớp"} onClose={() => { if (!checkInLoading && !evidenceUploading) setShowOverrideModal(false); }}>
            <div className="staff-modal-body" style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "#94620b" }}>
                Biển số thực tế <strong>{checkInPlate}</strong> không khớp với đặt chỗ QR. Nhập lý do đối chiếu (10–500 ký tự) và upload ảnh chứng cứ camera để tiếp tục check-in.
              </p>
              <label className="pm-form-label">
                Lý do override (10–500 ký tự) <span className="pm-required">*</span>:
                <textarea
                  minLength={10}
                  maxLength={500}
                  className="pm-form-input"
                  style={{ minHeight: 72, paddingTop: 8 }}
                  value={overrideReason}
                  onChange={(e) => { setOverrideReason(e.target.value); renewCheckInKey(); }}
                />
                <small>{overrideReason.trim().length} / 500 ký tự</small>
              </label>
              <label className="pm-form-label">
                Ảnh chứng cứ camera PNG/JPEG (tối đa 4 MiB):
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  disabled={evidenceUploading}
                  onChange={(e) => { void handleCheckInEvidenceFile(e.target.files?.[0]); }}
                />
                {evidenceUploading && <small>Đang tải ảnh chứng cứ lên máy chủ...</small>}
                {!evidenceUploading && evidenceFileName && <small>Đã upload ảnh: {evidenceFileName}</small>}
              </label>
              <label className="pm-form-label">
                Mã hoặc đường dẫn chứng cứ:
                <input
                  type="text"
                  maxLength={2048}
                  className="pm-form-input"
                  value={evidenceReference}
                  onChange={(e) => { setEvidenceReference(e.target.value); renewCheckInKey(); }}
                />
              </label>
              {checkInError && <p role="alert" style={{ color: "#b42337", margin: 0 }}>{checkInError}</p>}
            </div>
            <div className="staff-modal-footer">
              <button type="button" className="staff-btn-secondary" onClick={() => setShowOverrideModal(false)}>
                Đóng
              </button>
              <button
                type="button"
                disabled={checkInLoading || evidenceUploading}
                className="pm-cta-btn pm-btn-teal"
                style={{ width: "auto", padding: "8px 18px" }}
                onClick={() => void handleCheckIn(undefined, true)}
              >
                {checkInLoading ? "Đang xử lý..." : "Xác nhận Override & Cho xe vào"}
              </button>
            </div>
        </StaffDialog>
      )}

      {reviewCamId && (
        <StaffDialog title="Soát xét & Đính chính Biển số OCR (AI Plate Review)" onClose={() => setReviewCamId(null)}>
          <form onSubmit={handleConfirmReviewOcr} className="staff-modal-body" style={{ display: "grid", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--pm-navy-muted, #475569)" }}>
              Dành cho nhân viên bãi xe đính chính lại biển số khi camera OCR nhận diện mờ hoặc sai ký tự.
            </p>
            <div className="pm-form-field">
              <label className="pm-form-label">Biển số đính chính (Chuẩn hóa)</label>
              <input
                type="text"
                className="pm-form-input"
                style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1 }}
                value={reviewPlateInput}
                onChange={(e) => setReviewPlateInput(e.target.value.toUpperCase())}
                placeholder="VD: 51A-999.88"
                required
              />
            </div>
            <div className="pm-form-field">
              <label className="pm-form-label">Lý do / Ghi chú đính chính</label>
              <input
                type="text"
                className="pm-form-input"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="VD: Chữ D bị mờ đọc nhầm thành O"
                required
              />
            </div>
            {reviewMsg && <div className="staff-alert error">{reviewMsg}</div>}
            <div className="staff-modal-footer" style={{ marginTop: 10 }}>
              <button type="button" className="staff-btn-secondary" onClick={() => setReviewCamId(null)} disabled={reviewSubmitting}>
                Hủy
              </button>
              <button type="submit" className="pm-cta-btn pm-btn-teal" style={{ width: "auto" }} disabled={reviewSubmitting || !reviewPlateInput.trim()}>
                {reviewSubmitting ? "Đang lưu..." : "Xác nhận & Cập nhật"}
              </button>
            </div>
          </form>
        </StaffDialog>
      )}

      {/* ─── LIVE WEBCAM SCANNER MODAL ────────────────────────────────────────── */}
      {webcamTargetCam && (
        <WebcamCaptureModal
          camId={webcamTargetCam}
          camTitle={getCamLabel(webcamTargetCam)}
          onCapture={(file) => {
            const target = webcamTargetCam;
            setWebcamTargetCam(null);
            void processPlateFile(file, target);
          }}
          onClose={() => setWebcamTargetCam(null)}
        />
      )}



      {/* ─── ISSUED CHECK-OUT QR MODAL (SCRUM-49/69) ──────────────────────────── */}
      {issuedExitQr && (
        <StaffDialog title={"Mã QR ra bãi"} onClose={() => setIssuedExitQr(null)}>
            <div className="staff-modal-body" style={{ display: "grid", gap: 10 }}>
              <div>Phiên: <strong>{issuedExitQr.sessionId}</strong></div>
              {exitQrExpired ? <div className="staff-alert error" role="alert">Mã QR đã hết hạn. Đóng hộp thoại và phát hành mã mới.</div> : <div className="staff-qr"><QRCodeSVG value={issuedExitQr.qrPayload} size={210} marginSize={4} title="Mã QR ra bãi" /></div>}
              <details><summary>Xem nội dung mã</summary><textarea aria-label="Nội dung QR ra bãi" readOnly className="pm-form-input" style={{ minHeight: 80 }} value={issuedExitQr.qrPayload} /></details>
              {issuedExitQr.expiresAt && (
                <small>Hết hạn: {new Date(issuedExitQr.expiresAt).toLocaleString("vi-VN")}</small>
              )}
            </div>
            <div className="staff-modal-footer">
              <button type="button" className="staff-btn-secondary" onClick={() => setIssuedExitQr(null)}>Đóng</button>
              <button
                type="button"
                disabled={exitQrExpired}
                className="pm-cta-btn pm-btn-teal"
                style={{ width: "auto", padding: "8px 18px" }}
                onClick={() => {
                  const session = sessions.find(item => item.sessionId === issuedExitQr.sessionId);
                  setActiveTab("checkout");
                  setCheckOutQrPayload(issuedExitQr.qrPayload);
                  if (session) setCheckOutQuery(session.licensePlate);
                  setIssuedExitQr(null);
                }}
              >
                Dùng mã để kiểm tra xe ra
              </button>
            </div>
        </StaffDialog>
      )}


    </div>
  );
}
