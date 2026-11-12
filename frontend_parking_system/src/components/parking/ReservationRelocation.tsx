import { useEffect, useState } from 'react';
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
      setMessage('Đã chuyển đặt chỗ sang ô mới, giữ nguyên biểu giá và khung giờ.');
      setRevision(value => value + 1); onMoved?.();
    } catch (err) { setError(err instanceof Error ? err.message : 'Không chuyển được ô.'); }
    finally { setBusy(false); }
  }
  return <section className="pm-glass-card">
    <h2>Chuyển ô cho đặt chỗ bị ảnh hưởng</h2>
    <p>Chuyển từng đặt chỗ trước khi khóa ô để bảo trì. Máy chủ kiểm tra ô tương đương và trống trong toàn bộ khung giờ; không di chuyển xe đã check-in hoặc tự hủy đơn. Tối đa 500 đơn đang hiệu lực.</p>
    <label>Đặt chỗ <select disabled={busy} value={bookingId} onChange={e => { setBookingId(e.target.value); setTarget(''); }}><option value="">Chọn đặt chỗ</option>
      {rows.map(row => <option key={row.bookingId} value={row.bookingId}>{row.code} · {row.slotCode} · {new Date(row.startsAt).toLocaleString('vi-VN')}</option>)}
    </select></label>
    <label>Ô thay thế <select disabled={busy || !selected} value={target} onChange={e => setTarget(e.target.value)}><option value="">Chọn ô thay thế</option>
      {slots.filter(slot => slot.id !== selected?.slotId && slot.operationalStatus === 'ACTIVE' && slot.status !== 'OCCUPIED' && slot.vehicleTypes.includes(selected?.vehicleType ?? '')).map(slot => <option key={slot.id} value={slot.id}>{slot.levelName} · {slot.slotCode}</option>)}
    </select></label>
    <label>Lý do <textarea disabled={busy} maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <button type="button" disabled={busy || !selected || !target || !reason.trim()} onClick={() => void move()}>Chuyển đặt chỗ</button>
    <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Tải lại danh sách</button>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
