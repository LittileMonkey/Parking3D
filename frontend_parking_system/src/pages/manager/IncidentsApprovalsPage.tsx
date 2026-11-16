import RefundQueue from "../../components/manager/RefundQueue";
import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  AlertTriangle,
  ShieldCheck,
  Camera,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { api, ApiError, type IncidentDto, type IncidentEvidenceDto, type IncidentSummaryDto } from "../../services/api";
import { operations } from "../../services/operations";

async function uploadImageToEvidence(lotId: string, file: File): Promise<string> {
  const normalizedType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (normalizedType !== "image/png" && normalizedType !== "image/jpeg") {
    throw new Error("Chỉ hỗ trợ ảnh chứng cứ định dạng PNG hoặc JPEG.");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Ảnh chứng cứ vượt quá giới hạn 4 MiB.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Không đọc được nội dung file ảnh."));
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.readAsDataURL(file);
  });
  const imageBase64 = dataUrl.includes(",") ? dataUrl.split(",", 2)[1] : dataUrl;
  const uploaded = await api.uploadLotEvidence(
    lotId,
    { contentType: normalizedType, imageBase64 },
    crypto.randomUUID()
  );
  return uploaded.reference;
}

interface OutletContextType {
  selectedLotId: string;
  refreshKey?: number;
}

export default function IncidentsApprovalsPage() {
  const { selectedLotId, refreshKey } = useOutletContext<OutletContextType>();
  const [items, setItems] = useState<IncidentSummaryDto[]>([]);
  const [cancellations, setCancellations] = useState<Awaited<ReturnType<typeof operations.cancellations>>>([]);
  const [selected, setSelected] = useState<IncidentDto | null>(null);
  const [reason, setReason] = useState("");
  const [cameraReference, setCameraReference] = useState("");
  const [cameraCapturedAt, setCameraCapturedAt] = useState("");
  const [vehicleDocReference, setVehicleDocReference] = useState("");
  const [uploadingField, setUploadingField] = useState<"camera" | "doc" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const decisionKeysRef = useRef<Record<string, string>>({});

  useEffect(() => {
    let current = true;
    setCancellations([]);
    setItems([]);
    setSelected(null);
    setReason("");
    setCameraReference("");
    setCameraCapturedAt("");
    setVehicleDocReference("");
    setError("");
    setNotice("");

    if (!selectedLotId || selectedLotId === "all") return;

    operations
      .cancellations(selectedLotId)
      .then((rows) => {
        if (current) setCancellations(rows);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });

    api
      .getIncidents(selectedLotId)
      .then((result) => {
        if (current) setItems(result.items);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });

    return () => {
      current = false;
    };
  }, [selectedLotId, revision, refreshKey]);

  async function choose(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const inc = await api.getIncidentById(selectedLotId, id);
      setSelected(inc);
      setReason("");
      setCameraReference("");
      setCameraCapturedAt("");
      setVehicleDocReference("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sự cố.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEvidenceUpload(field: "camera" | "doc", file?: File) {
    if (!file || !selectedLotId) return;
    setUploadingField(field);
    setError("");
    try {
      const ref = await uploadImageToEvidence(selectedLotId, file);
      if (field === "camera") {
        setCameraReference(ref);
        setCameraCapturedAt(new Date().toISOString());
      } else {
        setVehicleDocReference(ref);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không upload được ảnh chứng cứ.");
    } finally {
      setUploadingField(null);
    }
  }

  async function decide(decision: "Approved" | "Rejected") {
    if (!selected || !reason.trim()) {
      setError("Vui lòng nhập lý do phê duyệt/từ chối can thiệp sự cố.");
      return;
    }
    const camRef = cameraReference.trim();
    const docRef = vehicleDocReference.trim();
    if (decision === "Approved" && (!camRef || !docRef)) {
      setError("Phê duyệt (Approved) bắt buộc có đủ ảnh/tham chiếu camera và ảnh/tham chiếu giấy tờ xe hợp lệ.");
      return;
    }
    const evidence: IncidentEvidenceDto[] = [];
    if (camRef) {
      evidence.push({
        kind: "CAMERA",
        reference: camRef,
        capturedAt: cameraCapturedAt || new Date().toISOString(),
      });
    }
    if (docRef) {
      evidence.push({
        kind: "VEHICLE_REGISTRATION",
        reference: docRef,
      });
    }

    const opKey = `${selected.incidentId}:${decision}:${selected.version}:${reason.trim()}:${camRef}:${docRef}`;
    if (!decisionKeysRef.current[opKey]) {
      decisionKeysRef.current[opKey] = crypto.randomUUID();
    }

    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createIncidentDecision(
        selectedLotId,
        selected.incidentId,
        {
          decision,
          reason: reason.trim(),
          evidence,
          expectedVersion: selected.version,
        },
        decisionKeysRef.current[opKey]
      );
      delete decisionKeysRef.current[opKey];
      setNotice(`Đã ban hành quyết định ${decision === "Approved" ? "Phê duyệt cho xe ra" : "Từ chối ngoại lệ"}.`);
      setRevision((value) => value + 1);
      setTimeout(() => setNotice(""), 6000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        try {
          const [latest, list] = await Promise.all([
            api.getIncidentById(selectedLotId, selected.incidentId),
            api.getIncidents(selectedLotId),
          ]);
          setSelected(latest);
          setItems(list.items);
          setError(
            `Xung đột phiên bản (409): Bản ghi đã được cập nhật lên v${latest.version} (${latest.status}). Nội dung và chứng cứ bạn nhập vẫn được giữ lại — vui lòng kiểm tra lại và xác nhận lại.`
          );
        } catch {
          setError("Xung đột phiên bản (409). Vui lòng tải lại bản ghi trước khi xác nhận lại.");
        }
      } else {
        setError(err instanceof Error ? err.message : "Không lưu được quyết định.");
      }
    } finally {
      setBusy(false);
    }
  }

  const getSeverityBadge = (sev: string) => {
    const s = sev?.toUpperCase() || "";
    if (s.includes("CRITICAL") || s.includes("HIGH")) return "pm-badge danger";
    if (s.includes("MEDIUM") || s.includes("WARNING")) return "pm-badge warning";
    return "pm-badge info";
  };

  const getStatusBadge = (st: string) => {
    const s = st?.toUpperCase() || "";
    if (s.includes("RESOLVED") || s.includes("APPROVED")) return "pm-badge success";
    if (s.includes("REJECTED")) return "pm-badge danger";
    if (s.includes("INPROGRESS")) return "pm-badge warning";
    return "pm-badge info";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* ── 1. Top Header Banner ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="pm-card-title-group">
            <div className="pm-card-icon" style={{ background: "#fee2e2", color: "#b91c1c" }}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="pm-card-h3">Xử Lý Sự Cố & Phê Duyệt Ngoại Lệ Cổng Barie</h3>
              <span className="pm-card-sub">
                Giải quyết xung đột mất thẻ, biển số không khớp OCR, và đối soát hàng đợi hoàn tiền theo quy chuẩn
              </span>
            </div>
          </div>
        </div>

        {(!selectedLotId || selectedLotId === "all") && (
          <div
            style={{
              padding: "12px 16px",
              background: "#edf7fd",
              border: "1px solid rgba(13, 70, 133, 0.2)",
              borderRadius: 12,
              color: "var(--pm-blue)",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>Vui lòng chọn một cơ sở bãi xe cụ thể ở thanh công cụ phía trên để xem các sự cố cần xử lý.</span>
          </div>
        )}

        {notice && (
          <div
            style={{
              padding: "12px 16px",
              background: "#d1fae5",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 12,
              color: "#065f46",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            role="status"
          >
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "#fee2e2",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 12,
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            role="alert"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── 2. Danh Sách Sự Cố Cần Xử Lý ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon">
                <AlertCircle size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">Danh Sách Sự Cố Được Báo Cáo ({items.length} sự cố)</h3>
                <span className="pm-card-sub">Các trường hợp cần Manager xem xét hình ảnh và chứng từ trước khi mở cổng</span>
              </div>
            </div>
          </div>

          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Tiêu Đề Sự Cố</th>
                  <th>Mức Độ Nghiêm Trọng</th>
                  <th>Trạng Thái</th>
                  <th>Phiên Bản</th>
                  <th style={{ textAlign: "right" }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px 20px", color: "var(--pm-muted)" }}>
                      Không có sự cố nào đang chờ xử lý tại cơ sở này.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.incidentId}>
                      <td style={{ fontWeight: 700, color: "var(--pm-navy)" }}>{item.title}</td>
                      <td>
                        <span className={getSeverityBadge(item.severity)}>{item.severity}</span>
                      </td>
                      <td>
                        <span className={getStatusBadge(item.status)}>{item.status}</span>
                      </td>
                      <td>v{item.version}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="pm-btn pm-btn-primary"
                          disabled={busy}
                          style={{ height: 32, padding: "0 14px", fontSize: 12 }}
                          onClick={() => void choose(item.incidentId)}
                        >
                          Xem & Xử Lý
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. Panel Chi Tiết & Phê Duyệt Ngoại Lệ (Khi chọn một sự cố) ── */}
      {selected && (
        <div className="pm-card" style={{ border: "2px solid var(--pm-blue)" }}>
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">
                  Xử Lý Ngoại Lệ: {selected.title} (v{selected.version})
                </h3>
                <span className="pm-card-sub">
                  Trạng thái hiện tại: <span className={getStatusBadge(selected.status)}>{selected.status}</span>
                  {selected.relatedPlate && ` • Biển số xe: ${selected.relatedPlate}`}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid var(--pm-border)" }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--pm-navy)", marginBottom: 4 }}>Mô tả sự cố từ nhân viên trực:</div>
              <div style={{ fontSize: 13, color: "var(--pm-muted)", lineHeight: 1.5 }}>{selected.description}</div>
              {selected.exitDecision && (
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--pm-blue)", fontWeight: 600 }}>
                  Quyết định gần nhất: {selected.exitDecision.decision} • Lý do: {selected.exitDecision.reason}
                </div>
              )}
            </div>

            {/* Justification note */}
            <div className="pm-form-group" style={{ marginBottom: 0 }}>
              <label className="pm-label" htmlFor="incident-decision-reason">
                Lý do xử lý phê duyệt / từ chối (Bắt buộc kiểm toán):
              </label>
              <textarea
                id="incident-decision-reason"
                className="pm-textarea"
                rows={3}
                required
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Đã đối chiếu camera cổng vào lúc 08:14 khớp với hình ảnh xe và giấy đăng ký mang tên chủ phương tiện."
              />
            </div>

            {/* Evidence Uploads */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {/* Evidence 1: Camera Snapshot */}
              <div style={{ padding: "14px", background: "#f8fafc", borderRadius: 14, border: "1px solid var(--pm-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "var(--pm-navy)", marginBottom: 8 }}>
                  <Camera size={16} style={{ color: "var(--pm-blue)" }} />
                  <span>Ảnh Camera Cổng (`CAMERA`)</span>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  disabled={uploadingField !== null || busy}
                  onChange={(e) => {
                    void handleEvidenceUpload("camera", e.target.files?.[0]);
                  }}
                  style={{ fontSize: 12, width: "100%", marginBottom: 8 }}
                />
                {uploadingField === "camera" && (
                  <div style={{ fontSize: 11, color: "var(--pm-blue)", fontWeight: 600, marginBottom: 6 }}>
                    Đang tải ảnh camera lên máy chủ…
                  </div>
                )}
                <input
                  type="text"
                  className="pm-input-text"
                  style={{ fontSize: 12, height: 36 }}
                  placeholder="Reference ảnh camera (parking-evidence:...)"
                  value={cameraReference}
                  onChange={(e) => {
                    setCameraReference(e.target.value);
                    if (!cameraCapturedAt) setCameraCapturedAt(new Date().toISOString());
                  }}
                />
              </div>

              {/* Evidence 2: Vehicle Registration Doc */}
              <div style={{ padding: "14px", background: "#f8fafc", borderRadius: 14, border: "1px solid var(--pm-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, color: "var(--pm-navy)", marginBottom: 8 }}>
                  <FileCheck size={16} style={{ color: "#065f46" }} />
                  <span>Ảnh Giấy Tờ Xe (`VEHICLE_REGISTRATION`)</span>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  disabled={uploadingField !== null || busy}
                  onChange={(e) => {
                    void handleEvidenceUpload("doc", e.target.files?.[0]);
                  }}
                  style={{ fontSize: 12, width: "100%", marginBottom: 8 }}
                />
                {uploadingField === "doc" && (
                  <div style={{ fontSize: 11, color: "var(--pm-blue)", fontWeight: 600, marginBottom: 6 }}>
                    Đang tải ảnh giấy tờ xe lên máy chủ…
                  </div>
                )}
                <input
                  type="text"
                  className="pm-input-text"
                  style={{ fontSize: 12, height: 36 }}
                  placeholder="Reference giấy tờ xe (parking-evidence:...)"
                  value={vehicleDocReference}
                  onChange={(e) => setVehicleDocReference(e.target.value)}
                />
              </div>
            </div>

            {/* Decision Action Buttons */}
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                className="pm-btn pm-btn-secondary"
                disabled={busy || uploadingField !== null}
                style={{ color: "#991b1b" }}
                onClick={() => decide("Rejected")}
              >
                <XCircle size={15} />
                <span>Từ Chối Ngoại Lệ</span>
              </button>

              <button
                type="button"
                className="pm-btn pm-btn-primary"
                disabled={busy || uploadingField !== null}
                onClick={() => decide("Approved")}
              >
                <CheckCircle2 size={15} />
                <span>Phê Duyệt Cho Phép Xe Ra</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Hàng Đợi Hoàn Tiền (RefundQueue) ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <RefundQueue key={selectedLotId} lotId={selectedLotId} />
      )}

      {/* ── 5. Đặt Chỗ Đã Hủy Cần Đối Soát Hoàn Tiền ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
                <DollarSign size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">Đặt Chỗ Đã Hủy — Cần Đối Soát Hoàn Tiền ({cancellations.length} đơn)</h3>
                <span className="pm-card-sub">
                  Đối chiếu số liệu cổng thanh toán và tiền mặt thực tế trước khi xác nhận hoàn tiền cho khách hàng
                </span>
              </div>
            </div>
          </div>

          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Mã Booking</th>
                  <th>Lý Do Hủy</th>
                  <th>Đã Ghi Nhận Thu</th>
                  <th>Điều Kiện Hoàn</th>
                  <th>Trạng Thái Hoàn</th>
                </tr>
              </thead>
              <tbody>
                {cancellations.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "36px 20px", color: "var(--pm-muted)" }}>
                      Không có đơn đặt chỗ nào bị hủy cần đối soát hoàn tiền.
                    </td>
                  </tr>
                ) : (
                  cancellations.map((row) => (
                    <tr key={row.bookingId}>
                      <td style={{ fontWeight: 700, fontFamily: "monospace" }}>{row.bookingCode}</td>
                      <td>{row.reason}</td>
                      <td style={{ fontWeight: 600 }}>{row.recordedPaidAmount.toLocaleString("vi-VN")} ₫</td>
                      <td>
                        <span className={`pm-badge ${row.refundEligible ? "success" : "danger"}`}>
                          {row.refundEligible ? "Đủ điều kiện hoàn" : "Không đủ điều kiện"}
                        </span>
                      </td>
                      <td>
                        <span className={`pm-badge ${row.refundStatus === "Refunded" ? "success" : "warning"}`}>
                          {row.refundStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
