import RefundQueue from "../../components/manager/RefundQueue";
import { useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router-dom";
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
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Không đọc được nội dung file ảnh."));
    reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
    reader.readAsDataURL(file);
  });
  const imageBase64 = dataUrl.includes(",") ? dataUrl.split(",", 2)[1] : dataUrl;
  const uploaded = await api.uploadLotEvidence(
    lotId,
    { contentType: normalizedType, imageBase64 },
    crypto.randomUUID(),
  );
  return uploaded.reference;
}

export default function IncidentsApprovalsPage() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
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
  }, [selectedLotId, revision]);

  async function choose(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setSelected(await api.getIncidentById(selectedLotId, id));
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
      setError("Nhập lý do xử lý.");
      return;
    }
    const camRef = cameraReference.trim();
    const docRef = vehicleDocReference.trim();
    if (decision === "Approved" && (!camRef || !docRef)) {
      setError("Phê duyệt (Approved) bắt buộc có đủ ảnh/tham chiếu camera và ảnh/tham chiếu giấy tờ xe.");
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
        decisionKeysRef.current[opKey],
      );
      delete decisionKeysRef.current[opKey];
      setNotice(`Đã lưu quyết định ${decision === "Approved" ? "Phê duyệt" : "Từ chối"}.`);
      setRevision((value) => value + 1);
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

  return (
    <section className="pm-module-page">
      <h1>Sự cố và phê duyệt ngoại lệ</h1>
      <p>
        Chọn bãi cụ thể. Quyết định được lưu cùng lý do, bằng chứng và người duyệt; không tự thu phí hoặc xác nhận xe đã
        rời bãi.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <table>
        <thead>
          <tr>
            <th>Sự cố</th>
            <th>Mức độ</th>
            <th>Trạng thái</th>
            <th>Phiên bản</th>
            <th>Chi tiết</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.incidentId}>
              <td>{item.title}</td>
              <td>{item.severity}</td>
              <td>{item.status}</td>
              <td>v{item.version}</td>
              <td>
                <button disabled={busy} onClick={() => choose(item.incidentId)}>
                  Xem và xử lý
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <RefundQueue key={selectedLotId} lotId={selectedLotId} />
      <h2>Đặt chỗ đã hủy — cần đối soát hoàn tiền</h2>
      <p>
        Khoản thu dưới đây là thông báo Parking đã nhận, có thể cập nhật trễ. Cần đối chiếu sổ Payment và chứng từ thực
        tế trước khi hoàn tiền. Tối đa 200 đơn gần nhất.
      </p>
      <table>
        <thead>
          <tr>
            <th>Mã booking</th>
            <th>Lý do</th>
            <th>Đã ghi nhận thu</th>
            <th>Điều kiện hoàn</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {cancellations.map((row) => (
            <tr key={row.bookingId}>
              <td>{row.bookingCode}</td>
              <td>{row.reason}</td>
              <td>{row.recordedPaidAmount.toLocaleString("vi-VN")} VND</td>
              <td>{row.refundEligible ? "Đủ điều kiện" : "Không đủ điều kiện"}</td>
              <td>{row.refundStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <article className="pm-glass-card">
          <h2>
            {selected.title} (v{selected.version} · {selected.status})
          </h2>
          <p>{selected.description}</p>
          <p>Biển số liên quan: {selected.relatedPlate ?? "—"}</p>
          {selected.exitDecision && (
            <p>
              Quyết định gần nhất: {selected.exitDecision.decision} · {selected.exitDecision.reason}
            </p>
          )}
          <label>
            Lý do <textarea maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Ảnh camera cổng (`CAMERA` — PNG/JPEG tối đa 4 MiB){" "}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                disabled={uploadingField !== null || busy}
                onChange={(e) => { void handleEvidenceUpload("camera", e.target.files?.[0]); }}
              />
              {uploadingField === "camera" && <small>Đang upload ảnh camera...</small>}
              <input
                placeholder="Reference ảnh camera (parking-evidence:...)"
                value={cameraReference}
                onChange={(e) => {
                  setCameraReference(e.target.value);
                  if (!cameraCapturedAt) setCameraCapturedAt(new Date().toISOString());
                }}
              />
            </label>
            <label>
              Ảnh giấy tờ xe (`VEHICLE_REGISTRATION` — PNG/JPEG tối đa 4 MiB){" "}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                disabled={uploadingField !== null || busy}
                onChange={(e) => { void handleEvidenceUpload("doc", e.target.files?.[0]); }}
              />
              {uploadingField === "doc" && <small>Đang upload ảnh giấy tờ xe...</small>}
              <input
                placeholder="Reference giấy tờ xe (parking-evidence:...)"
                value={vehicleDocReference}
                onChange={(e) => setVehicleDocReference(e.target.value)}
              />
            </label>
          </div>
          <button disabled={busy || uploadingField !== null} onClick={() => decide("Approved")}>
            Phê duyệt
          </button>
          <button disabled={busy || uploadingField !== null} onClick={() => decide("Rejected")}>
            Từ chối
          </button>
        </article>
      )}
    </section>
  );
}
