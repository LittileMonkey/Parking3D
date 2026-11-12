import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { operations } from '../../services/operations';

type Shift = { id: string; lotId: string; staffUserId: string; startedAt: string };
export default function ShiftManagement() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [receiver, setReceiver] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ completedTasks: '', unresolvedIssues: '', pendingTransactions: '', equipmentStatus: '', notesForNext: '' });
  const mine = shifts.find(shift => shift.staffUserId === user?.userId);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let current = true; setShifts([]); setHandovers([]); setReceiver(''); setError('');
    if (!selectedLotId) return;
    Promise.all([operations.shifts(selectedLotId), api.getShiftHandovers(selectedLotId)])
      .then(async ([active, list]) => {
        const details = await Promise.all(list.items.map(item => api.getShiftHandoverById(selectedLotId, item.handoverId)));
        if (current) { setShifts(active); setHandovers(details); }
      }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [selectedLotId, revision]);
  async function action(task: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await task(); setRevision(value => value + 1); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được bàn giao.'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = shifts.find(shift => shift.id === receiver);
    if (!mine || !next) { setError('Cả người giao và nhận phải bắt đầu ca tại bãi này.'); return; }
    await action(() => api.createShiftHandover(selectedLotId, { ...form, senderShiftId: mine.id, receiverShiftId: next.id, receiverUserId: next.staffUserId }, crypto.randomUUID()));
  }
  return <section className="pm-module-page"><h1>Ca trực và bàn giao</h1>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy || !selectedLotId} onClick={() => setRevision(value => value + 1)}>Tải lại</button>
    {mine ? <p>Ca của bạn bắt đầu: {new Date(mine.startedAt).toLocaleString('vi-VN')}</p> : <button disabled={busy || !selectedLotId} onClick={() => action(() => operations.startShift(selectedLotId))}>Bắt đầu ca</button>}
    <p>Người nhận phải đăng nhập và bắt đầu ca tại cùng bãi. Ca gửi chỉ kết thúc khi người nhận xác nhận biên bản.</p>
    <form className="pm-glass-card" onSubmit={submit}><fieldset disabled={busy || !mine} style={{ display: 'grid', gap: 12 }}>
      <label>Nhân viên nhận ca <select required value={receiver} onChange={e => setReceiver(e.target.value)}><option value="">Chọn nhân viên đang có ca</option>{shifts.filter(shift => shift.staffUserId !== user?.userId).map(shift => <option key={shift.id} value={shift.id}>{shift.staffUserId} · {new Date(shift.startedAt).toLocaleString('vi-VN')}</option>)}</select></label>
      {([['completedTasks','Công việc đã hoàn thành'],['unresolvedIssues','Sự cố chưa xử lý'],['pendingTransactions','Giao dịch còn chờ'],['equipmentStatus','Tình trạng thiết bị'],['notesForNext','Lưu ý cho ca sau']] as const).map(([field,label]) => <label key={field}>{label}<textarea required maxLength={2000} value={form[field]} onChange={e => setForm({ ...form, [field]: e.target.value })} /></label>)}
      <button type="submit">Gửi biên bản bàn giao</button>
    </fieldset></form>
    <h2>Biên bản liên quan đến bạn</h2>
    {handovers.map(item => <article className="pm-glass-card" key={item.handoverId}>
      <p>{new Date(item.createdAt).toLocaleString('vi-VN')} · {item.status}</p><p>Người giao: {item.senderUserId} · Người nhận: {item.receiverUserId}</p>
      <p>Đã làm: {item.completedTasks}</p><p>Chưa xử lý: {item.unresolvedIssues}</p><p>Giao dịch chờ: {item.pendingTransactions}</p><p>Thiết bị: {item.equipmentStatus}</p><p>Lưu ý: {item.notesForNext}</p>
      {item.receiverUserId === user?.userId && item.status === 'PendingConfirmation' && <button disabled={busy} onClick={() => action(() => api.confirmShiftHandover(selectedLotId, item.handoverId, { expectedVersion: item.version }, crypto.randomUUID()))}>Đã đọc và xác nhận nhận ca</button>}
    </article>)}
  </section>;
}
