import React, { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  X,
  Hash,
} from "lucide-react";
import {
  api,
  ApiError,
  type CheckOutQuoteDto,
  type CheckoutRequest,
  type Payment,
  type StaffSessionRow,
} from "../../services/api";
import { staffApi } from "../../services/staff/staffApi";
import type {
  CheckInResult,
  VehicleType,
  PlateRecognitionResult,
  CheckInPayload,
} from "../../types/staff";

export default function VehicleOperations() {
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
        const results = await Promise.allSettled(lots.filter(lot => assigned.has(lot.id)).map(async lot =>
          (await api.getEntryGates(lot.id)).map(gate => ({ ...gate, label: `${lot.name} · ${gate.code}` })),
        ));
        if (!active) return;
        const gates = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
        setEntryGates(gates);
        setCheckInGate(gates[0]?.id ?? "");
        const exitResults = await Promise.allSettled(lots.filter(lot => assigned.has(lot.id)).map(async lot =>
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
  }, []);

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
  const [authorizeKey, setAuthorizeKey] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [mismatchQuote, setMismatchQuote] = useState<CheckOutQuoteDto | null>(null);
  const [issuedExitQr, setIssuedExitQr] = useState<{ sessionId: string; qrPayload: string; expiresAt?: string } | null>(null);

  const [feeInfo, setFeeInfo] = useState<(CheckOutQuoteDto & { gateId: string; detectedPlate: string }) | null>(null);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [checkOutProcessing, setCheckOutProcessing] = useState(false);
  const [checkOutSuccess, setCheckOutSuccess] = useState<{ message: string; paymentId?: string } | null>(null);
  const [eReceipt, setEReceipt] = useState<any | null>(null);
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

      if (recognizedPlate && !result.isFallback && result.confidence >= 0.85) {
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
    const lots = [...new Set([...entryGates, ...exitGates].map(gate => gate.lotId))];
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
            <span>Điều phối Xe Vào &amp; Xe Ra</span>
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
                        Tham chiếu chứng cứ (`evidence.reference`) <span className="pm-required">*</span>:
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

                  {checkInError && <p role="alert" style={{ color: "#f87171", margin: 0 }}>{checkInError}</p>}

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
                      <div>Vị trí gán (BE cấp): <strong className="pm-slot-highlight">{checkInSuccess.slotCode}</strong></div>
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
                <span className="pm-badge-success">Cổng Ra G3 Online</span>
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
                {checkoutError && <p role="alert" style={{ color: "#f87171" }}>{checkoutError}</p>}

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
                                <a href={vnpayInfo.paymentUrl} target="_blank" rel="noreferrer" style={{ color: "#22d3ee" }}>
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
                        style={{ background: "rgba(34, 211, 238, 0.15)", border: "1px solid #22d3ee", color: "#22d3ee" }}
                      >
                        <FileText size={15} />
                        <span>{loadingReceipt ? "Đang tải biên lai..." : "Xem E-Receipt (SCRUM-72)"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="pm-print-btn"
                      >
                        <Printer size={15} />
                        <span>In Hoá đơn GTGT</span>
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
            {cameraError && <p role="alert" style={{ color: "#f87171", marginBottom: 10 }}>{cameraError}</p>}
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
                        [ {cameraStates["moto-cam2"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div className="pm-anpr-confidence">
                        {cameraStates["moto-cam2"]?.confidence || "Tải ảnh để AI đọc biển số"}
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
                        [ {cameraStates["car-cam1"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div className="pm-anpr-confidence">
                        {cameraStates["car-cam1"]?.confidence || "Tải ảnh để AI đọc biển số"}
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
                        [ {cameraStates["car-cam2"]?.plateText || "Chờ ảnh / nhận diện"} ]
                      </div>
                      <div className="pm-anpr-confidence">
                        {cameraStates["car-cam2"]?.confidence || "Tải ảnh để AI đọc biển số"}
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
      {eReceipt && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setEReceipt(null)}
        >
          <div
            style={{
              background: "#0f172a",
              border: "1px solid rgba(34, 211, 238, 0.3)",
              borderRadius: 16,
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(34, 211, 238, 0.15)",
              color: "#f8fafc",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(16, 185, 129, 0.2)", padding: 8, borderRadius: 8 }}>
                  <ShieldCheck size={20} color="#10b981" />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#fff" }}>Hóa Đơn / Biên Lai Điện Tử</h3>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>Hệ thống Smart 3D Parking Baseline V4</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEReceipt(null)}
                style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Mã hóa đơn (Receipt No):</span>
                <strong style={{ color: "#38bdf8", fontFamily: "monospace" }}>{eReceipt.receiptNumber}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Cơ sở bãi đỗ:</span>
                <span>{eReceipt.lotName || "Bãi đỗ xe Trung tâm Quận 1"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Biển số xe:</span>
                <strong style={{ color: "#facc15" }}>{eReceipt.plateNumber}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Phương thức:</span>
                <span>{eReceipt.paymentMethod}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Thời gian thanh toán:</span>
                <span>{new Date(eReceipt.paidAt).toLocaleString("vi-VN")}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                <span style={{ color: "#94a3b8" }}>Nhân viên thu ngân:</span>
                <span>{eReceipt.collectedByStaff || "Nguyễn Văn Hùng"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px dashed rgba(255,255,255,0.15)", fontSize: 15 }}>
                <span style={{ fontWeight: 600 }}>Tổng tiền thanh toán:</span>
                <strong style={{ color: "#10b981", fontSize: 18 }}>
                  {Number(eReceipt.totalAmount).toLocaleString("vi-VN")} {eReceipt.currency || "VND"}
                </strong>
              </div>
            </div>

            {/* Verification Hash Badge */}
            <div style={{ background: "rgba(34, 211, 238, 0.08)", border: "1px solid rgba(34, 211, 238, 0.2)", borderRadius: 10, padding: 12, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#22d3ee", fontWeight: 600, marginBottom: 4 }}>
                <Hash size={13} />
                <span>CHỮ KÝ BẢO MẬT &amp; MÃ BĂM XÁC THỰC SỐ (VERIFICATION HASH)</span>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8", wordBreak: "break-all" }}>
                {eReceipt.verificationHash}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setEReceipt(null)}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 16px",
                  color: "#cbd5e1",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                style={{
                  background: "linear-gradient(135deg, #087f8c 0%, #14afbe 100%)",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 18px",
                  color: "#fff",
                  cursor: "pointer",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Printer size={15} />
                <span>In Biên lai</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── CHECK-IN PLATE_MISMATCH OVERRIDE MODAL (SCRUM-111) ───────────────── */}
      {showOverrideModal && (
        <div className="staff-modal-backdrop" onClick={() => setShowOverrideModal(false)}>
          <div className="staff-modal pm-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header pm-dark-modal-header">
              <h3 className="staff-modal-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "#ffffff" }}>
                <ShieldCheck size={20} color="#fbbf24" />
                <span>Xác nhận ngoại lệ lệch biển số (PLATE_MISMATCH)</span>
              </h3>
              <button
                type="button"
                className="staff-btn-secondary pm-modal-close-btn"
                onClick={() => setShowOverrideModal(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="staff-modal-body pm-dark-modal-body" style={{ display: "grid", gap: 12 }}>
              <p style={{ margin: 0, color: "#fbbf24" }}>
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
                Tham chiếu chứng cứ (`evidence.reference`):
                <input
                  type="text"
                  maxLength={2048}
                  className="pm-form-input"
                  value={evidenceReference}
                  onChange={(e) => { setEvidenceReference(e.target.value); renewCheckInKey(); }}
                />
              </label>
              {checkInError && <p role="alert" style={{ color: "#f87171", margin: 0 }}>{checkInError}</p>}
            </div>
            <div className="staff-modal-footer pm-dark-modal-footer">
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
          </div>
        </div>
      )}

      {/* ─── ISSUED CHECK-OUT QR MODAL (SCRUM-49/69) ──────────────────────────── */}
      {issuedExitQr && (
        <div className="staff-modal-backdrop" onClick={() => setIssuedExitQr(null)}>
          <div className="staff-modal pm-dark-modal" onClick={(e) => e.stopPropagation()}>
            <div className="staff-modal-header pm-dark-modal-header">
              <h3 className="staff-modal-title" style={{ color: "#ffffff" }}>Mã QR Chiều Ra (Check-out QR)</h3>
              <button type="button" className="staff-btn-secondary pm-modal-close-btn" onClick={() => setIssuedExitQr(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="staff-modal-body pm-dark-modal-body" style={{ display: "grid", gap: 10 }}>
              <div>Phiên: <strong>{issuedExitQr.sessionId}</strong></div>
              <textarea readOnly className="pm-form-input" style={{ minHeight: 80 }} value={issuedExitQr.qrPayload} />
              {issuedExitQr.expiresAt && (
                <small>Hết hạn: {new Date(issuedExitQr.expiresAt).toLocaleString("vi-VN")}</small>
              )}
            </div>
            <div className="staff-modal-footer pm-dark-modal-footer">
              <button type="button" className="staff-btn-secondary" onClick={() => setIssuedExitQr(null)}>Đóng</button>
              <button
                type="button"
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
                Dùng QR này để Check-out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
