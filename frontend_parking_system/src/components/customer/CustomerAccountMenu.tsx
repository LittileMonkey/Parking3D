import { useEffect, useId, useRef } from "react";
import { Link } from "react-router-dom";
import { UserRound, Car, Ticket, ShieldCheck, LogOut, ChevronDown, ArrowUpRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
export default function CustomerAccountMenu({ open, onOpenChange, onLogout, portalPath }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLogout: () => void;
    portalPath: string | null;
}) {
    const { user } = useAuth();
    const { lang } = useLanguage();
    const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    const name = user?.fullName || user?.userName || (lang === "en" ? "Your account" : "Tài khoản của bạn");
    const initials = name.split(/\s+/).filter(Boolean).slice(-2).map(word => word[0]).join("").toUpperCase();
    useEffect(() => {
        if (!open)
            return;
        const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node))
            onOpenChange(false); };
        const escape = (e: KeyboardEvent) => { if (e.key === "Escape") {
            onOpenChange(false);
            trigger.current?.focus();
        } };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape);
        return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
    }, [open, onOpenChange]);
    const links = [
        { tab: "profile", vi: "Hồ sơ cá nhân", en: "Personal profile", icon: UserRound },
        { tab: "vehicles", vi: "Phương tiện của tôi", en: "My vehicles", icon: Car },
        { tab: "bookings", vi: "Lịch sử đặt chỗ", en: "My bookings", icon: Ticket },
        { tab: "security", vi: "Mật khẩu & bảo mật", en: "Password & security", icon: ShieldCheck },
    ];
    return <div className="customer-account-menu" ref={root} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node))
        onOpenChange(false); }}>
    <button ref={trigger} type="button" className={`customer-profile-trigger ${open ? "is-open" : ""}`} aria-label="Mở menu tài khoản" aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>
      <span className="customer-avatar">{initials || <UserRound size={18}/>}</span><span className="customer-profile-name">{name}</span><ChevronDown size={14}/>
    </button>
    {open && <section id={id} className="customer-profile-panel" aria-label="Menu tài khoản">
      <div className="customer-profile-summary"><strong>{name}</strong><span>{user?.email?.toLowerCase()}</span></div>
      <nav aria-label="Trang cá nhân">{links.map(({ tab, vi, en, icon: Icon }) => <Link key={tab} to={`/account?tab=${tab}`} onClick={() => onOpenChange(false)}><Icon size={17}/><span>{lang === "en" ? en : vi}</span></Link>)}</nav>
      {portalPath && <Link className="customer-portal-link" to={portalPath} onClick={() => onOpenChange(false)}><ArrowUpRight size={17}/>{portalPath.includes("staff") ? "Không gian nhân viên" : "Không gian quản lý"}</Link>}
      <button className="customer-menu-logout" type="button" onClick={onLogout}><LogOut size={17}/>{lang === "en" ? "Log out" : "Đăng xuất"}</button>
    </section>}
  </div>;
}
