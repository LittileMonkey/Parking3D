import { useEffect, useState } from 'react';
import { ArrowRightLeft, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { operations, type OperationalSlot } from '../../services/operations';

export default function ReservationRelocation({ lotId, onMoved }: { lotId: string; onMoved?: () => void }) {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof operations.reservations>>>([]);
  const [slots, setSlots] = useState<OperationalSlot[]>([]);
  const [bookingId, setBookingId] = useState('');
  const [target, setTarget] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setRows([]); setSlots([]); setBookingId(''); setTarget(''); setReason(''); setError('');
    if (!lotId || lotId === 'all') return;
    Promise.all([operations.reservations(lotId), operations.slots(lotId)])
      .then(([bookings, data]) => { if (current) { setRows(bookings); setSlots(data); } })
      .catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [lotId, revision]);

  const selected = rows.find(row => row.bookingId === bookingId);

  async function move() {
    if (!selected) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await operations.reallocate(lotId, selected.bookingId, target, selected.version, reason);
      setMessage('Đã chuyển đặt chỗ sang ô mới thành công (giữ nguyên biểu giá và khung giờ).');
      setRevision(value => value + 1); onMoved?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không chuyển được ô.'); }
    finally { setBusy(false); }
  }

  return (
    <section
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        padding: '20px 24px',
        marginBottom: 20,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(56, 189, 248, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowRightLeft size={18} color="#38bdf8" />
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.01em',
          }}
        >
          Chuyển ô cho đặt chỗ bị ảnh hưởng
        </h2>
      </div>

      <p
        style={{
          margin: '0 0 16px 0',
          fontSize: 13.5,
          color: '#cbd5e1',
          lineHeight: 1.5,
        }}
      >
        Chuyển từng đặt chỗ trước khi khóa ô để bảo trì. Máy chủ kiểm tra ô tương đương và trống trong toàn bộ khung giờ; không di chuyển xe đã check-in hoặc tự hủy đơn. Tối đa 500 đơn đang hiệu lực.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          alignItems: 'flex-end',
        }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: 6,
            }}
          >
            Đặt chỗ cần chuyển
          </label>
          <select
            disabled={busy}
            value={bookingId}
            onChange={e => { setBookingId(e.target.value); setTarget(''); }}
            style={{
              width: '100%',
              height: 40,
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: 10,
              padding: '0 12px',
              fontSize: 13,
              color: '#ffffff',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">-- Chọn đặt chỗ ({rows.length} đơn) --</option>
            {rows.map(row => (
              <option key={row.bookingId} value={row.bookingId}>
                {row.code} · {row.slotCode} · {new Date(row.startsAt).toLocaleString('vi-VN')}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: 6,
            }}
          >
            Ô đỗ thay thế
          </label>
          <select
            disabled={busy || !selected}
            value={target}
            onChange={e => setTarget(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: 10,
              padding: '0 12px',
              fontSize: 13,
              color: '#ffffff',
              outline: 'none',
              cursor: selected ? 'pointer' : 'not-allowed',
            }}
          >
            <option value="">-- Chọn ô thay thế --</option>
            {slots
              .filter(slot =>
                slot.id !== selected?.slotId &&
                slot.operationalStatus === 'ACTIVE' &&
                slot.status !== 'OCCUPIED' &&
                slot.vehicleTypes.includes(selected?.vehicleType ?? '')
              )
              .map(slot => (
                <option key={slot.id} value={slot.id}>
                  {slot.levelName} · {slot.slotCode}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12.5,
              fontWeight: 600,
              color: '#94a3b8',
              marginBottom: 6,
            }}
          >
            Lý do chuyển ô
          </label>
          <input
            type="text"
            placeholder="VD: Khóa bảo trì cảm biến tầng B1..."
            disabled={busy}
            maxLength={2000}
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{
              width: '100%',
              height: 40,
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              borderRadius: 10,
              padding: '0 12px',
              fontSize: 13,
              color: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            disabled={busy || !selected || !target || !reason.trim()}
            onClick={() => void move()}
            style={{
              flex: 1,
              height: 40,
              padding: '0 18px',
              borderRadius: 10,
              border: 'none',
              background: (!busy && selected && target && reason.trim())
                ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                : 'rgba(255, 255, 255, 0.1)',
              color: (!busy && selected && target && reason.trim()) ? '#ffffff' : '#64748b',
              fontWeight: 700,
              fontSize: 13,
              cursor: (!busy && selected && target && reason.trim()) ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: (!busy && selected && target && reason.trim())
                ? '0 4px 14px rgba(2, 132, 199, 0.35)'
                : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <ArrowRightLeft size={16} /> Chuyển đặt chỗ
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setRevision(value => value + 1)}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 10,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw size={15} /> Tải lại danh sách
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#86efac',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} /> {message}
        </div>
      )}
    </section>
  );
}
