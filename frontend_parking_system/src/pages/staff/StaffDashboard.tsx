import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Car, CircleParking, ArrowLeftRight, AlertTriangle, ArrowRight, Clock, RefreshCw } from "lucide-react";
import { operations, type OperationalSlot, type UsageReport } from "../../services/operations";
import { api, type IncidentSummaryDto } from "../../services/api";
import type { StaffContext } from "../../components/staff/StaffLayout";
import { StaffStatus, staffDate } from "../../components/staff/StaffUi";
export default function StaffDashboard() {
    const { selectedLotId, lots } = useOutletContext<StaffContext>();
    const [data, setData] = useState<{
        slots: OperationalSlot[];
        usage: UsageReport;
        incidents: IncidentSummaryDto[];
        openCount: number;
    } | null>(null);
    const [error, setError] = useState(""), [loading, setLoading] = useState(true), [revision, setRevision] = useState(0), [updatedAt, setUpdatedAt] = useState("");
    useEffect(() => {
        let current = true, inFlight = false;
        async function load() {
            if (inFlight)
                return;
            inFlight = true;
            const from = new Date();
            from.setHours(0, 0, 0, 0);
            try {
                const [slots, usage, open, progress, escalated] = await Promise.all([operations.slots(selectedLotId), operations.summary(selectedLotId, from.toISOString(), new Date().toISOString()), api.getIncidents(selectedLotId, "Open", undefined, undefined, 1, 5), api.getIncidents(selectedLotId, "InProgress", undefined, undefined, 1, 5), api.getIncidents(selectedLotId, "Escalated", undefined, undefined, 1, 5)]);
                if (current) {
                    setData({ slots, usage, incidents: [...open.items, ...progress.items, ...escalated.items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5), openCount: open.totalCount + progress.totalCount + escalated.totalCount });
                    setUpdatedAt(new Date().toISOString());
                    setError("");
                }
            }
            catch (err) {
                if (current)
                    setError(err instanceof Error ? err.message : "Không tải được dữ liệu vận hành.");
            }
            finally {
                inFlight = false;
                if (current)
                    setLoading(false);
            }
        }
        void load();
        const timer = setInterval(() => void load(), 15000);
        return () => { current = false; clearInterval(timer); };
    }, [selectedLotId, revision]);
    const available = data?.slots.filter(s => s.status === "AVAILABLE").length;
    const capacity = data?.slots.length;
    const metrics = [
        { label: "Ô đỗ khả dụng", value: available, note: capacity === undefined ? "Đang chờ dữ liệu" : `Trên ${capacity} vị trí tại bãi`, icon: CircleParking },
        { label: "Xe đang trong bãi", value: data?.usage.occupied, note: "Theo phiên đỗ hiện tại", icon: Car },
        { label: "Lượt vào / ra hôm nay", value: data ? `${data.usage.entries} / ${data.usage.exits}` : undefined, note: "Tính từ đầu ngày", icon: ArrowLeftRight },
        { label: "Sự cố cần theo dõi", value: data?.openCount, note: "Gồm sự cố đã chuyển quản lý", icon: AlertTriangle },
    ];
    return <div className="staff-page">
    <div className="staff-page-heading"><div><span className="staff-eyebrow">SẴN SÀNG CHO CA LÀM VIỆC</span><h1>Tổng quan vận hành</h1><p>{lots.find(l => l.id === selectedLotId)?.name} · Theo dõi tình hình bãi và tiếp tục công việc trong ca.</p></div><button className="staff-button" onClick={() => { setLoading(true); setRevision(n => n + 1); }} disabled={loading}><RefreshCw size={16}/>Tải lại</button></div>
    {error && <div className="staff-alert error" role="alert">{error}{data && " Đang hiển thị số liệu đã tải trước đó."}</div>}
    <div className="staff-metric-grid">{metrics.map(({ label, value, note, icon: Icon }) => <article className="staff-metric" key={label}><div><span>{label}</span><Icon size={18}/></div><strong>{value ?? "—"}</strong><small>{note}</small></article>)}</div>
    <div className="staff-quick-links">{[{ to: "operations", title: "Tiếp nhận & xuất bãi", sub: "Kiểm tra QR, biển số và thanh toán." }, { to: "parking", title: "Xem sơ đồ bãi đỗ", sub: "Theo dõi ô trống và tình trạng vận hành." }, { to: "shifts", title: "Chuẩn bị bàn giao ca", sub: "Ghi lại công việc và các vấn đề còn tồn." }].map(link => <Link className="staff-panel" key={link.to} to={`/staff/${link.to}`}><div><h3>{link.title}</h3><span className="staff-muted staff-small">{link.sub}</span></div><ArrowRight size={19}/></Link>)}</div>
    <section className="staff-panel staff-stack"><div className="staff-row between"><h2>Sự cố đang theo dõi</h2><Link className="staff-button" to="/staff/incidents">Xem tất cả<ArrowRight size={15}/></Link></div>{!data ? <div className="staff-empty" role="status">{loading ? "Đang tải tình hình bãi…" : "Chưa có dữ liệu. Hãy thử tải lại."}</div> : !data.incidents.length ? <div className="staff-empty">Hiện chưa có sự cố cần theo dõi tại bãi này.</div> : data.incidents.map(item => <div className="staff-row between" key={item.incidentId}><div><strong>{item.title}</strong><div className="staff-muted staff-small">{staffDate(item.updatedAt)}</div></div><StaffStatus status={item.status}/></div>)}</section>
    {updatedAt && <div className="staff-muted staff-small staff-row"><Clock size={14}/>Cập nhật {staffDate(updatedAt)} · Tự tải lại mỗi 15 giây</div>}
  </div>;
}
