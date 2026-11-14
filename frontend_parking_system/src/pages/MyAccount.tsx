import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, UserRound, Car, Ticket, ShieldCheck } from "lucide-react";
import CustomerLayout from "../components/customer/CustomerLayout";
import { AccountProfile, AccountVehicles, AccountBookings } from "../components/customer/AccountPanels";
import AccountSecurity from "../components/customer/AccountSecurity";
import { useAuth } from "../context/AuthContext";
import "./MyAccount.css";
const tabs = [
    { id: "profile", label: "Hồ sơ cá nhân", icon: UserRound },
    { id: "vehicles", label: "Phương tiện của tôi", icon: Car },
    { id: "bookings", label: "Lịch sử đặt chỗ", icon: Ticket },
    { id: "security", label: "Mật khẩu & bảo mật", icon: ShieldCheck },
];
export default function MyAccount() {
    const { user, isAuthenticated, logout } = useAuth();
    const [reauthentication, setReauthentication] = useState<string | null>(null);
    const [params] = useSearchParams();
    const tab = tabs.find(item => item.id === params.get("tab"))?.id || "profile";
    if (!isAuthenticated)
        return <Navigate to={reauthentication || `/login?${new URLSearchParams({ returnTo: `/account?tab=${tab}` })}`} replace/>;
    async function reauthenticate(kind: "password" | "mfa") {
        setReauthentication(`/login?updated=${kind}`);
        await logout();
    }
    const name = user?.fullName || user?.userName || "Tài khoản của bạn";
    const initials = name.split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join("").toUpperCase();
    return <CustomerLayout><main className="customer-page account-page">
    <Link to="/" className="account-back"><ArrowLeft size={15}/>Trang chủ</Link>
    <div className="account-page-heading"><div><span className="account-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>Trang cá nhân</h1><p>Một nơi để quản lý thông tin, phương tiện và những hành trình của bạn.</p></div><Link className="account-primary" to="/booking">Tìm bãi đỗ<ArrowUpRight size={17}/></Link></div>
    <div className="account-layout"><aside className="account-sidebar"><div className="account-identity"><span className="account-large-avatar">{initials || <UserRound size={25}/>}</span><strong>{name}</strong><span>{user?.email?.toLowerCase()}</span></div><nav aria-label="Quản lý tài khoản">{tabs.map(({ id, label, icon: Icon }) => <Link key={id} to={`/account?tab=${id}`} aria-current={id === tab ? "page" : undefined}><Icon size={18}/><span>{label}</span></Link>)}</nav><div className="account-sidebar-note"><ShieldCheck size={17}/><span>Thông tin của bạn luôn gắn với tài khoản đang đăng nhập.</span></div></aside>
      <div className="account-content" key={tab}>{tab === "profile" ? <AccountProfile /> : tab === "vehicles" ? <AccountVehicles /> : tab === "bookings" ? <AccountBookings /> : <AccountSecurity onReauthenticate={reauthenticate}/>}</div>
    </div>
  </main></CustomerLayout>;
}
