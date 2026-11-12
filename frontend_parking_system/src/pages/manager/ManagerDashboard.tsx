import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { managerApi } from '../../services/manager/managerApi';
import { operations, type UsageReport, type RevenueReport } from '../../services/operations';

export default function ManagerDashboard() {
  const { selectedLotId, period, refreshKey } = useOutletContext<{ selectedLotId: string; period: string; refreshKey: number }>();
  const [rows, setRows] = useState<{ id: string; name: string; usage: UsageReport; revenue: RevenueReport }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState('');
  useEffect(() => {
    let current = true;
    async function load() {
      try {
        const facilities = await managerApi.getManagedFacilities();
        const from = new Date(); from.setHours(0, 0, 0, 0);
        if (period === 'week') from.setDate(from.getDate() - 6);
        if (period === 'month') from.setDate(1);
        if (period === 'year') { from.setMonth(0, 1); }
        const until = new Date().toISOString();
        const next = await Promise.all(facilities.filter(lot => selectedLotId === 'all' || lot.lotId === selectedLotId).map(async lot => {
          const [usage, revenue] = await Promise.all([operations.usage(lot.lotId, from.toISOString(), until), operations.revenue(lot.lotId, from.toISOString(), until)]);
          return { id: lot.lotId, name: lot.name, usage, revenue };
        }));
        if (current) { setRows(next); setError(''); setUpdated(new Date().toLocaleString('vi-VN')); }
      } catch (err) { if (current) { setRows([]); setError(err instanceof Error ? err.message : 'Không tải được báo cáo.'); } }
      finally { if (current) setLoading(false); }
    }
    setLoading(true); load(); const timer = setInterval(load, 30000);
    return () => { current = false; clearInterval(timer); };
  }, [selectedLotId, period, refreshKey]);
  const total = rows.reduce((sum, row) => ({ occupied: sum.occupied + row.usage.occupied, capacity: sum.capacity + row.usage.capacity,
    entries: sum.entries + row.usage.entries, exits: sum.exits + row.usage.exits, revenue: sum.revenue + row.revenue.net }), { occupied: 0, capacity: 0, entries: 0, exits: 0, revenue: 0 });
  return <section className="pm-module-page">
    <h1>Tổng quan các bãi được phân công</h1>
    <p>Số xe đang đỗ là trạng thái hiện tại. Lượt vào/ra và tiền thu tính theo kỳ đã chọn, theo múi giờ trình duyệt. Cập nhật: {updated || '—'}.</p>
    {loading && <p>Đang tải…</p>}{error && <p role="alert">{error}</p>}
    {!loading && !error && rows.length === 0 && <p>Không có bãi quản lý trong phạm vi đã chọn.</p>}
    {!error && <div className="pm-glass-card"><p>Đang đỗ: {total.occupied} · Sức chứa đang hoạt động: {total.capacity}</p><p>Lượt vào: {total.entries} · Lượt ra: {total.exits}</p><p>Tiền thu sau hoàn tiền: {total.revenue.toLocaleString('vi-VN')} VND</p></div>}
    <table><thead><tr><th>Bãi</th><th>Đang đỗ</th><th>Vào</th><th>Ra</th><th>Thu tiền mặt</th><th>Thu điện tử</th><th>Hoàn tiền</th><th>Thu ròng</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.id}><td>{row.name}</td><td>{row.usage.occupied}</td><td>{row.usage.entries}</td><td>{row.usage.exits}</td><td>{row.revenue.cash.toLocaleString('vi-VN')}</td><td>{row.revenue.digital.toLocaleString('vi-VN')}</td><td>{row.revenue.refunds.toLocaleString('vi-VN')}</td><td>{row.revenue.net.toLocaleString('vi-VN')}</td></tr>)}
    </tbody></table>
  </section>;
}
