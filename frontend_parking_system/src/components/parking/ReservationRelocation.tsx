import { useEffect, useState } from "react";
import { ArrowRightLeft, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { operations, type OperationalSlot } from "../../services/operations";

export default function ReservationRelocation({ lotId, onMoved }: { lotId: string; onMoved?: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof operations.reservations>>>([]);
  const [slots, setSlots] = useState<OperationalSlot[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setRows([]);
    setSlots([]);
    setBookingId("");
    setTarget("");
    setReason("");
    setError("");
    if (!lotId || lotId === "all") return;
    Promise.all([operations.reservations(lotId), operations.slots(lotId)])
      .then(([bookings, data]) => {
        if (current) {
          setRows(bookings);
          setSlots(data);
        }
      })
      .catch((err) => {
        if (current) setError(err.message);
      });
    return () => {
      current = false;
    };
  }, [lotId, revision]);

  const selected = rows.find((row) => row.bookingId === bookingId);

  async function move() {
    if (!selected) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await operations.reallocate(lotId, selected.bookingId, target, selected.version, reason);
      setMessage("Đã chuyển đặt chỗ sang ô mới thành công (giữ nguyên biểu giá và khung giờ).");
      setRevision((value) => value + 1);
      onMoved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chuyển được ô.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pm-card staff-relocation" style={{ marginBottom: 20 }}>
      <div className="pm-card-header">
        <div className="pm-card-title-group">
          <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
            <ArrowRightLeft size={18} />
          </div>
          <div>
            <h3 className="pm-card-h3">Chuyển Ô Cho Đặt Chỗ Bị Ảnh Hưởng</h3>
            <span className="pm-card-sub">
              Chuyển từng đặt chỗ trước khi khóa ô để bảo trì. Hệ thống kiểm tra ô tương đương và trống trong toàn bộ khung giờ.
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          alignItems: "flex-end",
        }}
      >
        <div className="pm-form-group" style={{ marginBottom: 0 }}>
          <label className="pm-label">Đặt chỗ cần chuyển:</label>
          <select
            className="pm-select-light"
            style={{ width: "100%", height: 42 }}
            disabled={busy}
            value={bookingId}
            onChange={(e) => {
              setBookingId(e.target.value);
              setTarget("");
            }}
          >
            <option value="">-- Chọn đặt chỗ ({rows.length} đơn) --</option>
            {rows.map((row) => (
              <option key={row.bookingId} value={row.bookingId}>
                {row.code} · {row.slotCode} · {new Date(row.startsAt).toLocaleString("vi-VN")}
              </option>
            ))}
          </select>
        </div>

        <div className="pm-form-group" style={{ marginBottom: 0 }}>
          <label className="pm-label">Ô đỗ thay thế:</label>
          <select
            className="pm-select-light"
            style={{ width: "100%", height: 42 }}
            disabled={busy || !selected}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">-- Chọn ô thay thế --</option>
            {slots
              .filter(
                (slot) =>
                  slot.id !== selected?.slotId &&
                  slot.operationalStatus === "ACTIVE" &&
                  slot.status !== "OCCUPIED" &&
                  slot.vehicleTypes.includes(selected?.vehicleType ?? "")
              )
              .map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.levelName} · {slot.slotCode}
                </option>
              ))}
          </select>
        </div>

        <div className="pm-form-group" style={{ marginBottom: 0 }}>
          <label className="pm-label">Lý do chuyển ô:</label>
          <input
            type="text"
            className="pm-input-text"
            style={{ height: 42 }}
            placeholder="VD: Khóa bảo trì cảm biến tầng B1..."
            disabled={busy}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="pm-btn pm-btn-primary"
            style={{ flex: 1, height: 42 }}
            disabled={busy || !selected || !target || !reason.trim()}
            onClick={() => void move()}
          >
            <ArrowRightLeft size={15} />
            <span>Chuyển Đặt Chỗ</span>
          </button>

          <button
            type="button"
            className="pm-btn pm-btn-secondary"
            style={{ height: 42 }}
            disabled={busy}
            onClick={() => setRevision((value) => value + 1)}
            title="Tải lại danh sách đặt chỗ"
          >
            <RefreshCw size={14} className={busy ? "spin-animation" : ""} />
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#fee2e2",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#991b1b",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle size={16} /> <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#d1fae5",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#065f46",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> <span>{message}</span>
        </div>
      )}
    </section>
  );
}
