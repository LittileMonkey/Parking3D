import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, request } from '../../services/api';
import { operations } from '../../services/operations';

export default function StaffShiftsPage() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const [staff, setStaff] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState('');
  const [validUntil, setValidUntil] = useState('');
  useEffect(() => {
    let current = true; setStaff([]); setShifts([]); setHandovers([]); setError('');
    if (!selectedLotId || selectedLotId === 'all') return;
    Promise.all([request<any[]>(`/api/v1/staff-assignments?lotId=${encodeURIComponent(selectedLotId)}`), operations.shifts(selectedLotId), api.getShiftHandovers(selectedLotId)])
      .then(([roster, active, transfers]) => { if (current) { setStaff(roster); setShifts(active); setHandovers(transfers.items); } })
      .catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [selectedLotId, revision]);
  async function mutate(task: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice('');
    try { await task(); setNotice('Đã lưu thay đổi.'); setRevision(value => value + 1); }
    catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được phân công.'); }
    finally { setBusy(false); }
  }
  function assign(event: React.FormEvent) {
    event.preventDefault();
    mutate(() => api.assignStaffToLot({ staffUserId: userId, lotId: selectedLotId, roleCode: 'PARKING_STAFF', validFrom: new Date().toISOString(), validUntil: validUntil ? new Date(validUntil).toISOString() : undefined }));
  }
  const name = (id: string) => staff.find(item => item.staffUserId === id)?.name ?? id;
  return <section className="pm-module-page"><h1>Nhân sự và ca trực</h1>
    <p>Chọn một bãi cụ thể. Quyền phân công/thu hồi được kiểm tra theo quyền quản lý nhân sự của bạn tại bãi; thay đổi vai trò toàn nền tảng thuộc Admin.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form onSubmit={assign}><fieldset disabled={busy || !selectedLotId || selectedLotId === 'all'}>
      <label>Mã tài khoản nhân viên do Admin cung cấp <input required value={userId} pattern="[0-9a-fA-F-]{36}" onChange={e => setUserId(e.target.value)} /></label>
      <label>Hiệu lực đến (để trống nếu không giới hạn) <input type="datetime-local" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></label>
      <button type="submit">Phân công nhân viên</button>
    </fieldset></form>
    <table><thead><tr><th>Nhân viên</th><th>Vai trò</th><th>Từ</th><th>Đến</th><th>Thao tác</th></tr></thead><tbody>{staff.map(item => <tr key={item.assignmentId}><td>{item.name}</td><td>{item.roleCode}</td><td>{new Date(item.validFrom).toLocaleString('vi-VN')}</td><td>{item.validUntil ? new Date(item.validUntil).toLocaleString('vi-VN') : 'Không giới hạn'}</td><td><button disabled={busy} onClick={() => mutate(() => api.revokeStaffAssignment(item.assignmentId))}>Thu hồi phân công</button></td></tr>)}</tbody></table>
    <h2>Ca đang mở</h2>{shifts.map(shift => <p key={shift.id}>{name(shift.staffUserId)} · Bắt đầu {new Date(shift.startedAt).toLocaleString('vi-VN')}</p>)}
    <h2>Bàn giao gần đây</h2>{handovers.map(item => <p key={item.handoverId}>{name(item.senderUserId)} → {name(item.receiverUserId)} · {item.status}</p>)}
  </section>;
}
