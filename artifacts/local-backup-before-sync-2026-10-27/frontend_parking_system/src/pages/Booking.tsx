import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, RotateCcw, Scan, SquareParking } from 'lucide-react';
import ParkingViewer, { statusLabel, type ModelSlot } from '../components/parking/ParkingViewer';
import layout from '../components/parking/preview-layout.json';
import './Booking.css';
export default function Booking() {
  const [selected, setSelected] = useState<ModelSlot | null>(null);
  const [topView, setTopView] = useState(false);
  const [flat, setFlat] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [webglError, setWebglError] = useState(false);
  const onError = useCallback(() => { setWebglError(true); setFlat(true); }, []);
  const slots = layout.slots;
  const rows = [...new Set(slots.map(slot => slot.slotId.charAt(0)))];
  const available = slots.filter(s => s.status === 'AVAILABLE').length;
  const slotButtons = (row?: string) => slots.filter(s => !row || s.slotId.startsWith(row)).map(slot => <button key={slot.slotId} className={`slot-${slot.status.toLowerCase()}`} aria-pressed={selected?.slotId === slot.slotId} onClick={() => setSelected(slot)}><strong>{slot.slotId}</strong><span>{statusLabel(slot.status)}</span></button>);
  return <main className="booking-page">
    <div className="booking-study">Đây là sản phẩm phục vụ học tập, không dùng cho hoạt động thực tế.</div>
    <div className="booking-shell">
      <div className="booking-topline"><Link to="/" className="booking-back"><ArrowLeft size={16} /> ParkMatrix</Link><span>Bản xem trước thiết kế</span></div>
      <header className="booking-heading"><div><p className="booking-eyebrow">KHÔNG GIAN ĐỖ XE</p><h1>Một góc nhìn. Toàn bộ bãi xe.</h1><p>Khám phá mặt bằng và chọn từng ô để xem thông tin.</p></div><span className="booking-preview-tag">Dữ liệu minh họa</span></header>
      <div className="booking-layout">
        <section className="booking-scene" aria-label="Sơ đồ bãi đỗ">
          <div className="booking-scene-bar"><div><SquareParking size={20} /><div><strong>Bãi ngoài trời</strong><span>Tầng trệt · 4 khu · 60 ô</span></div></div><div className="booking-tools" role="group" aria-label="Chế độ xem"><button aria-pressed={!flat} disabled={webglError} onClick={() => setFlat(false)}>3D</button><button aria-pressed={flat} onClick={() => setFlat(true)}>2D</button>{!flat && <><button aria-label="Nhìn từ trên cao" aria-pressed={topView} onClick={() => setTopView(!topView)}><Scan size={17} /></button><button aria-label="Đặt lại góc nhìn" onClick={() => { setTopView(false); setResetKey(k => k + 1); }}><RotateCcw size={17} /></button></>}</div></div>
          {webglError && <p className="booking-webgl-error" role="alert">Đồ họa 3D không khả dụng. Bạn có thể xem và chọn ô trên sơ đồ 2D.</p>}
          {flat ? <div className="booking-flat" aria-label="Sơ đồ 2D">{rows.map(row => <div className="booking-flat-row" key={row}><strong>KHU {row}</strong><div>{slotButtons(row)}</div>{row !== rows[rows.length - 1] && <p className="booking-flat-aisle">← LÀN LƯU THÔNG →</p>}</div>)}<div className="booking-flat-gates"><span>↑ Lối vào</span><span>Chốt bảo vệ</span><span>↓ Lối ra</span></div></div> : <ParkingViewer selectedId={selected?.slotId ?? null} onSelect={setSelected} layout={layout} topView={topView} resetKey={resetKey} onError={onError} />}
          <div className="booking-legend">{['AVAILABLE','OCCUPIED','RESERVED','MAINTENANCE','SELECTED'].map(s => <span key={s}><i className={s.toLowerCase()} />{s === 'SELECTED' ? 'Đang xem' : statusLabel(s)}</span>)}</div><p className="booking-interaction-hint">{flat ? 'Chọn ô để xem thông tin chi tiết.' : 'Kéo để xoay · Cuộn hoặc chụm hai ngón để thu phóng · Bấm ô để xem'}</p>
        </section>
        <aside className="booking-info"><p className="booking-eyebrow">TỔNG QUAN MẶT BẰNG</p><div className="booking-capacity"><strong>{available}<small> / {slots.length}</small></strong><span>ô trống trong mô hình</span></div><div className="booking-occupancy" aria-hidden="true">{slots.map(s => <i className={s.status.toLowerCase()} key={s.slotId} />)}</div><div className="booking-summary">{['OCCUPIED','RESERVED','MAINTENANCE'].map(s => <span key={s}><b>{slots.filter(slot => slot.status === s).length}</b>{statusLabel(s)}</span>)}</div>
          <div className="booking-detail" aria-live="polite" aria-atomic="true">{selected ? <><div className="booking-detail-title"><span>Ô đang xem</span><strong>{selected.slotId}</strong></div><span className={`booking-status slot-${selected.status.toLowerCase()}`}>{statusLabel(selected.status)}</span><dl><div><dt>Tầng / Khu</dt><dd>Trệt / {selected.slotId.charAt(0)}</dd></div><div><dt>Phương tiện</dt><dd>Ô tô</dd></div><div><dt>Kích thước</dt><dd>{selected.width} × {selected.length} m</dd></div></dl><button className="booking-clear" onClick={() => setSelected(null)}>Bỏ chọn</button></> : <div className="booking-empty"><SquareParking size={32} /><h2>Bạn muốn xem ô nào?</h2><p>Chọn trên sơ đồ hoặc danh sách bên dưới. Thông tin ô sẽ xuất hiện tại đây.</p></div>}</div>
          <Link className="booking-search-link" to="/search">Tìm bãi & đặt chỗ <ArrowUpRight size={17} /></Link><p className="booking-disclaimer">Mô hình minh họa, chưa kết nối trạng thái thực tế. Chọn ô ở đây chưa tạo lượt giữ chỗ.</p>
        </aside>
      </div><section className="booking-slot-section"><h2>Danh sách ô đỗ</h2><p>Có thể dùng bàn phím để chọn và xem mọi trạng thái.</p><div className="booking-slot-list" aria-label="Danh sách ô đỗ">{slotButtons()}</div></section>
    </div>
  </main>;
}
