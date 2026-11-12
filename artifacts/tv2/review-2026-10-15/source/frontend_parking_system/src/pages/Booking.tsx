import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import ParkingViewer, { type ModelSlot } from "../components/parking/ParkingViewer";
import "./Booking.css";

// These identifiers belong to the supplied model, not to a live facility.
const demoSlots: ModelSlot[] = ["A", "B"].flatMap(row =>
  Array.from({ length: 8 }, (_, index) => ({ slotId: `${row}${String(index + 1).padStart(2, "0")}`,
    floor: 1, type: "Car", status: "AVAILABLE", width: 4, length: 6 })));

export default function Booking() {
  const [slots, setSlots] = useState<ModelSlot[]>(demoSlots);
  const [selected, setSelected] = useState<ModelSlot | null>(null);
  const onReady = useCallback((items: ModelSlot[]) => setSlots(items), []);
  return <main className="booking-page">
    <div className="booking-shell">
      <Link to="/" className="booking-back">← Về trang chủ</Link>
      <header><span className="booking-eyebrow">PARKMATRIX • BOOKING</span>
        <h1>Chọn vị trí đỗ xe</h1>
        <p>Bấm vào ô trong mô hình để xem thông tin. Kéo để xoay, cuộn hoặc chụm hai ngón tay để thu phóng.</p>
      </header>
      <p className="booking-notice">Bãi mẫu từ mô hình 3D • Trạng thái minh họa, chưa kết nối dữ liệu bãi thực tế và chưa giữ chỗ.</p>
      <div className="booking-layout">
        <section className="booking-scene" aria-label="Chọn ô đỗ">
          <ParkingViewer selectedId={selected?.slotId ?? null} onSelect={setSelected} onReady={onReady} />
          <div className="booking-legend"><span><i className="available" />Còn chỗ (mẫu)</span><span><i className="selected" />Đang chọn</span></div>
          <div className="booking-slot-list" aria-label="Danh sách ô đỗ">
            {slots.map(slot => <button key={slot.slotId} aria-pressed={slot.slotId === selected?.slotId}
              onClick={() => setSelected(slot)}>{slot.slotId}</button>)}
          </div>
        </section>
        <aside className="booking-info" aria-live="polite" aria-atomic="true">
          <h2>Thông tin ô đang chọn</h2>
          {selected ? <>
            <div className="booking-slot-code">{selected.slotId}</div>
            <dl>
              <div><dt>Tầng</dt><dd>{selected.floor}</dd></div>
              <div><dt>Khu vực</dt><dd>{selected.slotId.charAt(0)}</dd></div>
              <div><dt>Loại xe</dt><dd>{selected.type === "Car" ? "Ô tô" : selected.type}</dd></div>
              <div><dt>Trạng thái mẫu</dt><dd>{selected.status === "AVAILABLE" ? "Còn chỗ" : selected.status}</dd></div>
              <div><dt>Chiều rộng</dt><dd>{selected.width} m</dd></div>
              <div><dt>Chiều dài</dt><dd>{selected.length} m</dd></div>
            </dl>
            <button className="booking-clear" onClick={() => setSelected(null)}>Bỏ chọn ô</button>
          </> : <p className="booking-empty">Chọn một ô trên mô hình hoặc trong danh sách để xem mã ô, tầng, loại xe và kích thước.</p>}
        </aside>
      </div>
    </div>
  </main>;
}
