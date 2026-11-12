import RefundQueue from "../../components/manager/RefundQueue";
import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { api, ApiError, type IncidentDto, type IncidentSummaryDto } from "../../services/api";
import { operations } from "../../services/operations";

export default function IncidentsApprovalsPage() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const [items, setItems] = useState<IncidentSummaryDto[]>([]);
  const [cancellations, setCancellations] = useState<Awaited<ReturnType<typeof operations.cancellations>>>([]);
  const [selected, setSelected] = useState<IncidentDto | null>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setCancellations([]);
    setItems([]);
    setSelected(null);
    setReason("");
    setReference("");
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
      setReference("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sự cố.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "Approved" | "Rejected") {
    if (!selected || !reason.trim()) {
      setError("Nhập lý do xử lý.");
      return;
    }
    if (decision === "Approved" && !reference.trim()) {
      setError("Phê duyệt cần tham chiếu bằng chứng đã đối chiếu.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.createIncidentDecision(selectedLotId, selected.incidentId, {
        decision,
        reason,
        evidence: reference.trim()
          ? [{ kind: "MANUAL_REVIEW", reference: reference.trim(), capturedAt: new Date().toISOString() }]
          : [],
        expectedVersion: selected.version,
      });
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
            `Xung đột phiên bản (409): Bản ghi đã được cập nhật lên v${latest.version} (${latest.status}). Nội dung bạn nhập vẫn được giữ lại — vui lòng kiểm tra lại và xác nhận lại.`
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
          <label>
            Tham chiếu bằng chứng (camera/biên bản đối chiếu){" "}
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <button disabled={busy} onClick={() => decide("Approved")}>
            Phê duyệt
          </button>
          <button disabled={busy} onClick={() => decide("Rejected")}>
            Từ chối
          </button>
        </article>
      )}
    </section>
  );
}
