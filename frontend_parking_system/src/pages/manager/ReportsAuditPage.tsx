import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { operations, type OperationAudit, type RevenueReport, type UsageReport } from '../../services/operations';

export default function ReportsAuditPage() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const day = new Date().toLocaleDateString('en-CA');
  const [from, setFrom] = useState(day);
  const [until, setUntil] = useState(day);
  const [data, setData] = useState<{ revenue: RevenueReport; usage: UsageReport; audit: OperationAudit[] } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let current = true; setData(null); setError('');
    if (!selectedLotId || selectedLotId === 'all') return;
    const begin = new Date(from + 'T00:00:00');
    const end = new Date(until + 'T00:00:00'); end.setDate(end.getDate() + 1);
    if (!Number.isFinite(begin.getTime()) || !Number.isFinite(end.getTime()) || end <= begin) { setError('Khoảng ngày không hợp lệ.'); return; }
    setLoading(true);
    const args = [selectedLotId, begin.toISOString(), end.toISOString()] as const;
    Promise.all([operations.revenue(...args), operations.usage(...args), operations.audit(...args)])
      .then(([revenue, usage, audit]) => { if (current) setData({ revenue, usage, audit }); })
      .catch(err => { if (current) setError(err.message); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [selectedLotId, from, until]);
  function download() {
    if (!data) return;
    const rows: unknown[][] = [['Bãi', selectedLotId], ['Từ ngày', from], ['Đến hết ngày', until],
      ['Đơn vị tiền', data.revenue.currency], ['Tổng thu', data.revenue.gross], ['Tiền mặt', data.revenue.cash],
      ['Điện tử', data.revenue.digital], ['Hoàn tiền', data.revenue.refunds], ['Thu ròng', data.revenue.net],
      ['Lượt vào', data.usage.entries], ['Lượt ra', data.usage.exits], ['Thời gian đỗ trung bình (phút)', data.usage.averageDurationMinutes],
      [], ['Thời gian audit', 'Người thao tác', 'Hành động', 'Đối tượng', 'Lý do'],
      ...data.audit.map(item => [item.timestampUtc, item.operatorId ?? item.operatorRole, item.actionType, item.targetEntity, item.justificationNote ?? ''])];
    const cell = (value: unknown) => { let text = String(value ?? ''); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `parking-${selectedLotId}-${from}-${until}.csv`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="pm-module-page"><h1>Báo cáo và nhật ký thay đổi</h1>
    <p>Chọn bãi cụ thể. Khoảng ngày dùng múi giờ trình duyệt. Hiển thị tối đa 1.000 sự kiện audit gần nhất trong khoảng chọn.</p>
    <label>Từ ngày <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>Đến hết ngày <input type="date" value={until} onChange={e => setUntil(e.target.value)} /></label>
    <button disabled={!data || loading} onClick={download}>Tải báo cáo CSV</button>
    {loading && <p>Đang tải…</p>}{error && <p role="alert">{error}</p>}
    {data && <><div className="pm-glass-card"><p>Thu ròng: {data.revenue.net.toLocaleString('vi-VN')} VND · Tiền mặt: {data.revenue.cash.toLocaleString('vi-VN')} · Điện tử: {data.revenue.digital.toLocaleString('vi-VN')}</p><p>Lượt vào: {data.usage.entries} · Lượt ra: {data.usage.exits} · Thời gian đỗ trung bình: {Math.round(data.usage.averageDurationMinutes)} phút</p></div>
      <table><thead><tr><th>Thời gian</th><th>Người thao tác</th><th>Hành động</th><th>Đối tượng</th><th>Lý do</th></tr></thead><tbody>
        {data.audit.map(item => <tr key={item.id}><td>{new Date(item.timestampUtc).toLocaleString('vi-VN')}</td><td>{item.operatorId ?? item.operatorRole}</td><td>{item.actionType}</td><td>{item.targetEntity}</td><td>{item.justificationNote}</td></tr>)}
      </tbody></table></>}
  </section>;
}
