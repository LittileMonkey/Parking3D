import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Grid3X3, AlertTriangle, Clock, LogOut, Menu, X, MapPin, CircleParking } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { api, type ParkingLot } from "../../services/api";
import "./StaffPortal.css";
import "./StaffWorkspace.css";
export interface StaffContext {
    selectedLotId: string;
    lots: ParkingLot[];
}
const tabs = [
    { path: "dashboard", label: "Tổng quan", icon: LayoutDashboard },
    { path: "operations", label: "Vào / Ra xe", icon: ArrowLeftRight },
    { path: "parking", label: "Sơ đồ bãi đỗ", icon: Grid3X3 },
    { path: "incidents", label: "Sự cố trong ca", icon: AlertTriangle },
    { path: "shifts", label: "Bàn giao ca", icon: Clock },
];
export default function StaffLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [lots, setLots] = useState<ParkingLot[]>([]);
    const [selectedLotId, setSelectedLotId] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 900px)").matches);
    useEffect(() => {
        const media = window.matchMedia("(max-width: 900px)");
        const changed = () => { setIsMobile(media.matches); setMenuOpen(false); };
        media.addEventListener("change", changed);
        return () => media.removeEventListener("change", changed);
    }, []);
    useEffect(() => { setMenuOpen(false); }, [location.pathname]);
    useEffect(() => {
        const escape = (e: KeyboardEvent) => { if (e.key === "Escape")
            setMenuOpen(false); };
        window.addEventListener("keydown", escape);
        return () => window.removeEventListener("keydown", escape);
    }, []);
    useEffect(() => {
        let current = true;
        setLoading(true);
        setError("");
        Promise.all([api.getParkingLots(), api.getStaffAssignmentsMe()]).then(([catalog, assignments]) => {
            if (!current)
                return;
            const ids = new Set(assignments.map(a => a.lotId));
            const assigned = catalog.filter(lot => ids.has(lot.id));
            setLots(assigned);
            setSelectedLotId(previous => assigned.some(lot => lot.id === previous) ? previous : assigned[0]?.id ?? "");
        }).catch(err => { if (current)
            setError(err instanceof Error ? err.message : "Không tải được bãi đỗ được phân công."); })
            .finally(() => { if (current)
            setLoading(false); });
        return () => { current = false; };
    }, [revision]);
    const selected = lots.find(lot => lot.id === selectedLotId);
    const currentTab = tabs.find(tab => location.pathname.includes(tab.path)) ?? tabs[0];
    return <div className="staff-app">
    {menuOpen && <button className="staff-menu-backdrop" aria-label="Đóng menu điều hướng" onClick={() => setMenuOpen(false)}/>}
    <aside className={`staff-workspace-sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Điều hướng nhân viên" inert={isMobile && !menuOpen}>
      <NavLink to="/staff/dashboard" className="staff-wordmark"><CircleParking size={34}/><span>PARKMATRIX<small>KHÔNG GIAN VẬN HÀNH</small></span></NavLink>
      <div className="staff-sidebar-caption">KHU VỰC NHÂN VIÊN</div>
      <nav>{tabs.map(({ path, label, icon: Icon }) => <NavLink key={path} to={`/staff/${path}`} className={({ isActive }) => `staff-workspace-link ${isActive ? "active" : ""}`}><Icon size={19}/>{label}</NavLink>)}</nav>
      <div className="staff-sidebar-profile"><span className="staff-profile-initial">{(user?.fullName || user?.email || "NV").slice(0, 2).toUpperCase()}</span><div><strong>{user?.fullName || user?.email || "Nhân viên"}</strong><small>Nhân viên vận hành</small></div></div>
      <button className="staff-workspace-link" onClick={async () => { await logout(); navigate("/login"); }}><LogOut size={18}/>Đăng xuất</button>
    </aside>
    <div className="staff-workspace-main">
      <header className="staff-workspace-topbar">
        <div className="staff-topbar-title"><button className="staff-menu-button" aria-label={menuOpen ? "Đóng menu" : "Mở menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21}/> : <Menu size={21}/>}</button><div><small>KHÔNG GIAN LÀM VIỆC</small><strong>{currentTab.label}</strong></div></div>
        <label className="staff-facility-picker"><MapPin size={18}/><span>Bãi trực</span><select aria-label="Chọn cơ sở bãi đỗ" value={selectedLotId} disabled={loading || !lots.length} onChange={e => setSelectedLotId(e.target.value)}>{!lots.length && <option value="">{loading ? "Đang tải…" : "Chưa có bãi được phân công"}</option>}{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.name}</option>)}</select></label>
      </header>
      <main className="staff-content">
        {loading ? <div className="staff-empty" role="status">Đang tải không gian làm việc…</div> : error ? <div className="staff-alert error" role="alert">{error}<button onClick={() => setRevision(n => n + 1)}>Thử lại</button></div> : !selected ? <div className="staff-empty"><MapPin size={30}/><h1>Chưa có bãi được phân công</h1><p>Liên hệ quản lý để được cấp quyền làm việc tại bãi đỗ.</p></div> : <Outlet key={selectedLotId} context={{ selectedLotId, lots } satisfies StaffContext}/>}
      </main>
    </div>
  </div>;
}
