import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { operations, type BlockPricing, type PricingVersion } from '../../services/operations';

const initial: BlockPricing = { blockMinutes: 15, rateVnd: 5000, dailyCapVnd: 150000, multiplier: 1, peakStart: null, peakEnd: null };
export default function PricingPolicyPage() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const [type, setType] = useState('CAR');
  const [plans, setPlans] = useState<PricingVersion[]>([]);
  const [rules, setRules] = useState<BlockPricing>(initial);
  const [name, setName] = useState('Biểu giá theo block');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let current = true;
    setLoaded(false); setPlans([]); setError(''); setNotice(''); setRules(initial); setReason('');
    if (!selectedLotId || selectedLotId === 'all') return;
    operations.pricing(selectedLotId, type).then(data => {
      if (!current) return;
      setPlans(data); setRules(data[0]?.rules ?? initial); setName(data[0]?.name ?? 'Biểu giá theo block'); setLoaded(true);
    }).catch(err => { if (current) setError(err.message); });
    return () => { current = false; };
  }, [selectedLotId, type]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const data = await operations.publish(selectedLotId, { vehicleType: type, name, expectedVersion: plans[0]?.version ?? 0, rules, reason });
      setPlans(data); setReason(''); setNotice(`Đã lưu phiên bản ${data[0].version}. Booking và phiên đỗ đã chốt giữ nguyên giá cũ.`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Không lưu được biểu giá.'); }
    finally { setBusy(false); }
  }
  return <section className="pm-module-page">
    <h1>Biểu giá theo bãi</h1>
    <p>Đơn giá tính cho mỗi block, làm tròn lên theo thời gian gửi; trần giá áp dụng theo ngày tại múi giờ của bãi.</p>
    {(!selectedLotId || selectedLotId === 'all') && <p>Chọn một bãi ở thanh trên để quản lý giá.</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <label>Loại xe <select value={type} disabled={busy} onChange={e => setType(e.target.value)}><option value="CAR">Ô tô</option><option value="MOTORBIKE">Xe máy</option></select></label>
    <form className="pm-glass-card" onSubmit={save}>
      <fieldset disabled={!loaded || busy} style={{ display: 'grid', gap: 16 }}>
        <label>Tên biểu giá <input required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
        <label>Phút mỗi block <input type="number" min={1} max={1440} required value={rules.blockMinutes} onChange={e => setRules({ ...rules, blockMinutes: +e.target.value })} /></label>
        <label>Giá mỗi block (VND) <input type="number" min={1} step={1} required value={rules.rateVnd} onChange={e => setRules({ ...rules, rateVnd: +e.target.value })} /></label>
        <label>Trần mỗi ngày (VND) <input type="number" min={1} step={1} required value={rules.dailyCapVnd} onChange={e => setRules({ ...rules, dailyCapVnd: +e.target.value })} /></label>
        <label>Hệ số cao điểm (tối đa 150%) <input type="number" min={1} max={1.5} step={0.01} required value={rules.multiplier} onChange={e => setRules({ ...rules, multiplier: +e.target.value })} /></label>
        <label>Bắt đầu cao điểm <input type="time" value={rules.peakStart ?? ''} onChange={e => setRules({ ...rules, peakStart: e.target.value || null })} /></label>
        <label>Kết thúc cao điểm <input type="time" value={rules.peakEnd ?? ''} onChange={e => setRules({ ...rules, peakEnd: e.target.value || null })} /></label>
        <p>Để trống cả hai giờ: hệ số áp dụng toàn thời gian. Nhập đủ hai giờ: chỉ block giao với khung cao điểm được nhân hệ số.</p>
        <label>Lý do thay đổi <textarea required maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
        <button type="submit">{busy ? 'Đang lưu…' : 'Lưu phiên bản mới'}</button>
      </fieldset>
    </form>
    <h2>Lịch sử phiên bản</h2>
    <table><thead><tr><th>Phiên bản</th><th>Hiệu lực từ</th><th>Đơn giá/block</th><th>Trạng thái</th><th>Người tạo</th></tr></thead><tbody>
      {plans.map(plan => <tr key={plan.id}><td>{plan.version}</td><td>{new Date(plan.effectiveFrom).toLocaleString('vi-VN')}</td><td>{plan.rules.rateVnd.toLocaleString('vi-VN')} / {plan.rules.blockMinutes} phút</td><td>{plan.status}</td><td>{plan.createdBy}</td></tr>)}
    </tbody></table>
  </section>;
}
