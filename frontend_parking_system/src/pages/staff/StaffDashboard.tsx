import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { operations, type OperationalSlot, type UsageReport } from '../../services/operations';
import { api } from '../../services/api';

export default function StaffDashboard() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const [data, setData] = useState<{ slots: OperationalSlot[]; usage: UsageReport; incidents: any[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true; setData(null); setError('');
    if (!selectedLotId) return;
    async function load() {
      const from = new Date(); from.setHours(0, 0, 0, 0);
      try {
        const [slots, usage, incidents] = await Promise.all([operations.slots(selectedLotId), operations.summary(selectedLotId, from.toISOString(), new Date().toISOString()), api.getIncidents(selectedLotId)]);
        if (current) { setData({ slots, usage, incidents: incidents.items }); setError(''); }
      } catch (err) { if (current) { setData(null); setError(err instanceof Error ? err.message : 'Không tải được dữ liệu.'); } }
    }
    load(); const timer = setInterval(load, 15000);
    return () => { current = false; clearInterval(timer); };
  }, [selectedLotId]);
  return <section className="pm-module-page"><h1>Tổng quan vận hành</h1>
    {error && <p role="alert">{error}</p>}{!selectedLotId && <p>Chọn bãi được phân công.</p>}
    {data && <><div className="pm-glass-card"><p>Đang đỗ: {data.usage.occupied} · Số ô: {data.slots.length} · Có thể dùng: {data.slots.filter(slot => slot.status === 'AVAILABLE').length}</p>
      <p>Bảo trì: {data.slots.filter(slot => slot.operationalStatus === 'MAINTENANCE').length} · Ngừng sử dụng: {data.slots.filter(slot => slot.operationalStatus === 'DISABLED').length}</p>
      <p>Lượt vào hôm nay: {data.usage.entries} · Lượt ra hôm nay: {data.usage.exits} (theo múi giờ trình duyệt)</p></div>
      <p><Link to="/staff/operations">Xử lý xe vào/ra</Link> · <Link to="/staff/shifts">Ca trực và bàn giao</Link> · <Link to="/staff/incidents">Quản lý sự cố</Link></p>
      <h2>Sự cố gần đây</h2>{data.incidents.map(item => <article key={item.incidentId} className="pm-glass-card"><strong>{item.title}</strong><p>{item.severity} · {item.status}</p></article>)}
    </>}
  </section>;
}
