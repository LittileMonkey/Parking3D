import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UserRound, Mail, Phone, Car, Bike, Zap, Plus, Pencil, Trash2, Star, Ticket, ArrowUpRight, MapPin, Clock3, RefreshCw, Info } from "lucide-react";
import { api, ApiError, type MembershipDto, type UserVehicle } from "../../services/api";
import { normalizePhoneNumber } from "../../services/registration";
import { useAuth } from "../../context/AuthContext";
import { AccountAlert, AccountDialog, accountDate, bookingStatusLabels } from "./AccountUi";
export function AccountProfile() {
    const { user, updateProfile } = useAuth();
    const [form, setForm] = useState({ fullName: "", email: "", phone: "" });
    const [membership, setMembership] = useState<MembershipDto | null>(null), [membershipError, setMembershipError] = useState(false);
    const [loaded, setLoaded] = useState(false), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0);
    const [error, setError] = useState(""), [notice, setNotice] = useState("");
    useEffect(() => {
        let active = true;
        setLoading(true);
        setError("");
        setMembershipError(false);
        api.getAccountInformation().then(info => { if (active) {
            setForm({ fullName: info.fullName || "", email: info.emailNormalized?.toLowerCase() || "", phone: info.phoneE164 || "" });
            setLoaded(true);
        } })
            .catch(e => { if (active)
            setError(e.message || "Chưa thể tải hồ sơ."); }).finally(() => { if (active)
            setLoading(false); });
        api.getMyMembership().then(value => { if (active)
            setMembership(value); }).catch(e => { if (active && !(e instanceof ApiError && e.status === 404))
            setMembershipError(true); });
        return () => { active = false; };
    }, [revision]);
    async function save(event: FormEvent) {
        event.preventDefault();
        if (busy || !loaded)
            return;
        setError("");
        setNotice("");
        if (!form.fullName.trim()) {
            setError("Vui lòng nhập họ và tên.");
            return;
        }
        setBusy(true);
        try {
            const updated = await api.updateAccountInformation({ fullName: form.fullName.trim(), emailNormalized: form.email.trim().toUpperCase(), phoneE164: normalizePhoneNumber(form.phone) });
            updateProfile({ fullName: updated.fullName, email: updated.emailNormalized });
            setForm({ fullName: updated.fullName, email: updated.emailNormalized?.toLowerCase() || form.email, phone: updated.phoneE164 || form.phone });
            setNotice("Đã lưu thông tin cá nhân.");
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Không lưu được hồ sơ.");
        }
        finally {
            setBusy(false);
        }
    }
    const tier = membership ? ({ STANDARD: "Thành viên tiêu chuẩn", PREMIUM: "Thành viên ưu tiên", VIP: "Thành viên VIP" }[membership.tierCode.toUpperCase()] || membership.tierCode) : null;
    return <section className="account-panel"><div className="account-panel-heading"><span className="account-section-icon"><UserRound size={22}/></span><div><h2>Hồ sơ cá nhân</h2><p>Cập nhật thông tin để thuận tiện khi đặt chỗ và liên hệ.</p></div></div>
    <div className="account-membership"><Star size={19}/><div><strong>{tier || (membershipError ? "Chưa tải được hạng thành viên" : "Tài khoản ParkMatrix")}</strong><span>{membership?.discountPercent ? `Ưu đãi ${membership.discountPercent}% theo chính sách thành viên.` : "Thông tin của bạn được quản lý trong tài khoản này."}</span></div></div>
    <AccountAlert error={error} notice={notice}/>
    {loading ? <div className="account-empty" role="status">Đang tải hồ sơ…</div> : !loaded ? <button className="account-button" onClick={() => setRevision(n => n + 1)}><RefreshCw size={16}/>Tải lại hồ sơ</button> : <form onSubmit={save} className="account-form"><div className="account-form-grid">
      <label className="account-field full">Họ và tên<span className="account-input-icon"><UserRound size={17}/><input value={form.fullName} required maxLength={100} autoComplete="name" disabled={busy} onChange={e => setForm({ ...form, fullName: e.target.value })}/></span></label>
      <label className="account-field">Địa chỉ email<span className="account-input-icon"><Mail size={17}/><input type="email" value={form.email} required maxLength={255} autoComplete="email" disabled={busy} onChange={e => setForm({ ...form, email: e.target.value })}/></span></label>
      <label className="account-field">Số điện thoại<span className="account-input-icon"><Phone size={17}/><input type="tel" value={form.phone} required maxLength={24} autoComplete="tel" placeholder="0912 345 678 hoặc +84…" disabled={busy} onChange={e => setForm({ ...form, phone: e.target.value })}/></span></label>
    </div><div className="account-form-footer"><span className="account-muted">Thông tin chỉ được lưu khi bạn xác nhận.</span><button className="account-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu thay đổi"}</button></div></form>}
    {user?.email && <p className="account-footnote">Email đăng nhập hiện tại: {user.email.toLowerCase()}</p>}
  </section>;
}
const vehicleNames: Record<string, string> = { CAR: "Ô tô", BIKE: "Xe máy", MOTORBIKE: "Xe máy", EV: "Ô tô điện" };
export function AccountVehicles() {
    const [vehicles, setVehicles] = useState<UserVehicle[]>([]), [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [revision, setRevision] = useState(0);
    const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
    const [editing, setEditing] = useState<UserVehicle | null>(null), [adding, setAdding] = useState(false), [deleting, setDeleting] = useState<UserVehicle | null>(null);
    const [viewing, setViewing] = useState<UserVehicle | null>(null), [viewingLoading, setViewingLoading] = useState(false);
    const [form, setForm] = useState({ licensePlate: "", vehicleType: "Car", isDefault: false });
    useEffect(() => { let active = true; setLoading(true); setError(""); api.getUserVehicles().then(rows => { if (active) {
        setVehicles(rows);
        setLoaded(true);
    } }).catch(e => { if (active)
        setError(e.message); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [revision]);
    function open(vehicle?: UserVehicle) { setError(""); setNotice(""); setEditing(vehicle || null); setAdding(!vehicle); setForm(vehicle ? { licensePlate: vehicle.licensePlate, vehicleType: vehicle.vehicleType, isDefault: vehicle.isDefault } : { licensePlate: "", vehicleType: "Car", isDefault: !vehicles.length }); }
    async function viewDetail(v: UserVehicle) {
        setViewingLoading(true);
        setError("");
        try {
            const detail = await api.getUserVehicleById(v.id);
            setViewing(detail);
        } catch {
            setViewing(v);
        } finally {
            setViewingLoading(false);
        }
    }
    async function save(event: FormEvent) {
        event.preventDefault();
        if (busy || !form.licensePlate.trim())
            return;
        setBusy(true);
        setError("");
        try {
            const payload = { ...form, licensePlate: form.licensePlate.trim().toUpperCase() };
            if (editing)
                await api.updateUserVehicle(editing.id, payload);
            else
                await api.createUserVehicle(payload);
            setEditing(null);
            setAdding(false);
            setNotice(editing ? "Đã cập nhật phương tiện." : "Đã thêm phương tiện.");
            setRevision(n => n + 1);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Không lưu được phương tiện.");
        }
        finally {
            setBusy(false);
        }
    }
    async function makeDefault(vehicle: UserVehicle) {
        if (busy)
            return;
        setBusy(true);
        setError("");
        setNotice("");
        try {
            await api.updateUserVehicle(vehicle.id, { licensePlate: vehicle.licensePlate, vehicleType: vehicle.vehicleType, isDefault: true });
            setNotice(`Đã đặt ${vehicle.licensePlate} làm phương tiện mặc định.`);
            setRevision(n => n + 1);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Không cập nhật được phương tiện.");
        }
        finally {
            setBusy(false);
        }
    }
    async function remove() {
        if (!deleting || busy)
            return;
        setBusy(true);
        setError("");
        try {
            await api.deleteUserVehicle(deleting.id);
            setDeleting(null);
            setNotice("Đã xóa phương tiện.");
            setRevision(n => n + 1);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Không xóa được phương tiện.");
        }
        finally {
            setBusy(false);
        }
    }
    const dialogOpen = adding || Boolean(editing) || Boolean(deleting) || Boolean(viewing);
    return <section className="account-panel"><div className="account-row between"><div className="account-panel-heading"><span className="account-section-icon"><Car size={22}/></span><div><h2>Phương tiện của tôi</h2><p>Lưu xe thường dùng để chọn nhanh khi đặt chỗ.</p></div></div><button className="account-primary" disabled={busy || !loaded} onClick={() => open()}><Plus size={17}/>Thêm phương tiện</button></div>
    {!dialogOpen && <AccountAlert error={error} notice={notice}/>}
    {loading && !loaded ? <div className="account-empty" role="status">Đang tải phương tiện…</div> : !loaded ? <button className="account-button" onClick={() => setRevision(n => n + 1)}>Tải lại phương tiện</button> : !vehicles.length ? <div className="account-empty"><Car size={36}/><h3>Thêm chiếc xe đầu tiên của bạn</h3><p>Phương tiện đã lưu sẽ xuất hiện khi bạn chọn chỗ đỗ.</p><button className="account-button" onClick={() => open()}>Thêm phương tiện</button></div> : <div className="account-vehicle-grid">{vehicles.map(vehicle => {
                const kind = vehicle.vehicleType.toUpperCase(), Icon = kind === "BIKE" || kind === "MOTORBIKE" ? Bike : kind === "EV" ? Zap : Car;
                return <article key={vehicle.id} className={`account-vehicle-card ${vehicle.isDefault ? "is-default" : ""}`}><div className="account-row between"><span className="account-vehicle-icon"><Icon size={27}/></span>{vehicle.isDefault && <span className="account-default-badge"><Star size={12}/>Mặc định</span>}</div><h3>{vehicle.licensePlate}</h3><p>{vehicleNames[kind] || vehicle.vehicleType}</p>{vehicle.isDefault && vehicles.length === 1 && <p className="account-footnote">Thêm phương tiện khác trước khi xóa xe mặc định duy nhất.</p>}<div className="account-vehicle-actions"><button className="account-button" disabled={busy} onClick={() => open(vehicle)}><Pencil size={14}/> Chỉnh sửa</button><button className="account-button" disabled={busy || viewingLoading} onClick={() => void viewDetail(vehicle)}><Info size={14}/> Chi tiết</button>{!vehicle.isDefault && <button className="account-text-button" disabled={busy} onClick={() => void makeDefault(vehicle)}>Đặt mặc định</button>}<button className="account-icon-button danger" disabled={busy || (vehicle.isDefault && vehicles.length === 1)} title={vehicle.isDefault && vehicles.length === 1 ? "Thêm phương tiện khác trước khi xóa xe mặc định duy nhất." : "Xóa phương tiện"} aria-label={`Xóa xe ${vehicle.licensePlate}`} onClick={() => { setError(""); setDeleting(vehicle); }}><Trash2 size={16}/></button></div></article>;
            })}</div>}
    {viewing && <AccountDialog title="Hồ sơ chi tiết phương tiện" onClose={() => setViewing(null)}>
        <div className="account-stack" style={{ gap: 16 }}>
            <div style={{ background: "#f8fafc", border: "1.5px solid #cbd5e1", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#e0f2fe", color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {viewing.vehicleType.toUpperCase() === "BIKE" || viewing.vehicleType.toUpperCase() === "MOTORBIKE" ? (
                            <Bike size={24} />
                        ) : viewing.vehicleType.toUpperCase() === "EV" ? (
                            <Zap size={24} />
                        ) : (
                            <Car size={24} />
                        )}
                    </div>
                    <div>
                        <div style={{ display: "inline-block", border: "2px solid #0f172a", borderRadius: 6, padding: "3px 12px", background: "#ffffff", fontSize: "1.15rem", fontWeight: 800, letterSpacing: 2, color: "#0f172a", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                            {viewing.licensePlate}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 4 }}>
                            {vehicleNames[viewing.vehicleType.toUpperCase()] || viewing.vehicleType}
                        </div>
                    </div>
                </div>
                {viewing.isDefault && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4 }}>
                        <Star size={13} fill="#b45309" />
                        Xe mặc định
                    </span>
                )}
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", display: "grid", gap: 10, fontSize: "0.875rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>Loại phương tiện:</span>
                    <strong style={{ color: "#0f172a" }}>{vehicleNames[viewing.vehicleType.toUpperCase()] || viewing.vehicleType}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>Vai trò đặt chỗ:</span>
                    <strong style={{ color: viewing.isDefault ? "#d97706" : "#475569" }}>
                        {viewing.isDefault ? "Phương tiện chính (Tự động chọn)" : "Phương tiện phụ"}
                    </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: 8 }}>
                    <span style={{ color: "#64748b" }}>Trạng thái nhận diện:</span>
                    <strong style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                        Sẵn sàng đặt chỗ
                    </strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#64748b" }}>Nhận diện tại cổng:</span>
                    <span style={{ color: "#334155", textAlign: "right", maxWidth: 220 }}>
                        Camera ANPR tự động quét biển số khi ra/vào bãi
                    </span>
                </div>
            </div>

            <div className="account-row" style={{ justifyContent: "flex-end", gap: 10 }}>
                <button
                    type="button"
                    className="account-button"
                    onClick={() => {
                        const v = viewing;
                        setViewing(null);
                        open(v);
                    }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                    <Pencil size={14} />
                    Chỉnh sửa xe này
                </button>
                <button type="button" className="account-button" onClick={() => setViewing(null)}>Đóng</button>
            </div>
        </div>
    </AccountDialog>}
    {(adding || editing) && <AccountDialog title={editing ? "Chỉnh sửa phương tiện" : "Thêm phương tiện"} onClose={() => { if (!busy) {
        setAdding(false);
        setEditing(null);
        setError("");
    } }}><form className="account-form" onSubmit={save}><AccountAlert error={error}/><label className="account-field">Biển số xe<input required maxLength={16} placeholder="Ví dụ: 51A-123.45" value={form.licensePlate} disabled={busy} onChange={e => setForm({ ...form, licensePlate: e.target.value })}/></label><label className="account-field">Loại phương tiện<select value={form.vehicleType} disabled={busy} onChange={e => setForm({ ...form, vehicleType: e.target.value })}><option value="Car">Ô tô</option><option value="Bike">Xe máy</option><option value="EV">Ô tô điện</option></select></label><label className="account-checkbox"><input type="checkbox" checked={form.isDefault} disabled={busy} onChange={e => setForm({ ...form, isDefault: e.target.checked })}/>Dùng làm phương tiện mặc định</label><button className="account-primary" disabled={busy}>{busy ? "Đang lưu…" : "Lưu phương tiện"}</button></form></AccountDialog>}
    {deleting && <AccountDialog title="Xóa phương tiện?" onClose={() => { if (!busy) {
        setDeleting(null);
        setError("");
    } }}><div className="account-stack"><AccountAlert error={error}/><p>Xe <strong>{deleting.licensePlate}</strong> sẽ được gỡ khỏi danh sách phương tiện của bạn.</p><div className="account-row"><button className="account-button" disabled={busy} onClick={() => setDeleting(null)}>Giữ lại xe</button><button className="account-danger-button" disabled={busy} onClick={() => void remove()}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</button></div></div></AccountDialog>}
  </section>;
}
type Visit = {
    id: string;
    code: string;
    status: string;
    startsAt: string;
    endsAt?: string;
    estimatedAmount: number;
    lotName: string;
};
export function AccountBookings() {
    const [items, setItems] = useState<Visit[]>([]), [loading, setLoading] = useState(true), [loaded, setLoaded] = useState(false), [error, setError] = useState(""), [revision, setRevision] = useState(0);
    const [query, setQuery] = useState(""), [filter, setFilter] = useState("all"), [page, setPage] = useState(1);
    useEffect(() => { let active = true; setLoading(true); setError(""); api.getMyBookings().then(rows => { if (active) {
        setItems(rows);
        setLoaded(true);
    } }).catch(e => { if (active)
        setError(e.message); }).finally(() => { if (active)
        setLoading(false); }); return () => { active = false; }; }, [revision]);
    const visible = items.filter(item => (filter === "all" || item.status.toUpperCase() === filter) && `${item.code} ${item.lotName}`.toLocaleLowerCase("vi-VN").includes(query.trim().toLocaleLowerCase("vi-VN")));
    const pages = Math.max(1, Math.ceil(visible.length / 8));
    useEffect(() => { setPage(current => Math.min(current, pages)); }, [pages]);
    return <section className="account-panel"><div className="account-panel-heading"><span className="account-section-icon"><Ticket size={22}/></span><div><h2>Lịch sử đặt chỗ</h2><p>Theo dõi trạng thái, thanh toán và vé đỗ xe của bạn.</p></div></div><AccountAlert error={error}/><div className="account-booking-filters"><label className="account-field">Tìm đặt chỗ<input type="search" placeholder="Mã đặt chỗ hoặc tên bãi" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></label><label className="account-field">Trạng thái<select value={filter} onChange={e => { setFilter(e.target.value); setPage(1); }}><option value="all">Tất cả trạng thái</option>{Object.entries(bookingStatusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><button className="account-icon-button" aria-label="Tải lại đặt chỗ" disabled={loading} onClick={() => setRevision(n => n + 1)}><RefreshCw size={17}/></button></div>
    {loading && !loaded ? <div className="account-empty" role="status">Đang tải đặt chỗ…</div> : !error && !visible.length ? <div className="account-empty"><Ticket size={36}/><h3>{items.length ? "Không có kết quả phù hợp" : "Hành trình tiếp theo đang chờ bạn"}</h3><p>{items.length ? "Thử thay đổi từ khóa hoặc trạng thái." : "Chọn một bãi phù hợp và đặt chỗ cho chuyến đi của bạn."}</p>{!items.length && <Link className="account-primary" to="/booking">Tìm bãi đỗ<ArrowUpRight size={16}/></Link>}</div> : <div className="account-booking-list">{visible.slice((page - 1) * 8, page * 8).map(item => <article className="account-booking-card" key={item.id}><div className="account-row between"><strong className="account-booking-code">{item.code}</strong><span className={`account-booking-status status-${item.status.toUpperCase()}`}>{bookingStatusLabels[item.status.toUpperCase()] || item.status}</span></div><h3>{item.lotName}</h3><div className="account-booking-details"><span><Clock3 size={15}/>{accountDate(item.startsAt)}</span><span><MapPin size={15}/>{item.endsAt ? `Đến ${accountDate(item.endsAt)}` : "Chi tiết thời gian trên vé"}</span></div><div className="account-row between"><strong>{Number.isFinite(Number(item.estimatedAmount)) ? `${Number(item.estimatedAmount).toLocaleString("vi-VN")} đ` : "Chưa có giá"}<small>Phí ước tính</small></strong><Link className="account-button" to={`/bookings/${encodeURIComponent(item.id)}`}>{item.status.toUpperCase() === "PENDING_PAYMENT" ? "Tiếp tục thanh toán" : "Xem chi tiết"}<ArrowUpRight size={15}/></Link></div></article>)}</div>}
    {loaded && <div className="account-pagination"><span>{visible.length} kết quả trong tối đa 100 đặt chỗ gần nhất</span>{pages > 1 && <div><button disabled={page <= 1} className="account-button" aria-label="Trang đặt chỗ trước" onClick={() => setPage(n => n - 1)}>Trước</button><span>{page} / {pages}</span><button disabled={page >= pages} className="account-button" aria-label="Trang đặt chỗ sau" onClick={() => setPage(n => n + 1)}>Sau</button></div>}</div>}
  </section>;
}
