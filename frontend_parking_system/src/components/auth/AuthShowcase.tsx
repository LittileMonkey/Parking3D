import { ParkingCircle } from "lucide-react";
import { Link } from "react-router-dom";
import AuthVisualShowcase from "./AuthVisualShowcase";

const content = {
  login: {
    title: "Chỗ đỗ sẵn sàng. Hành trình nhẹ nhàng.",
    description: "Tìm bãi, đặt chỗ và theo dõi lượt đỗ trong cùng một tài khoản.",
  },
  register: {
    title: "Bắt đầu hành trình đỗ xe thuận tiện.",
    description: "Tạo tài khoản để lưu phương tiện và quản lý các lượt đặt chỗ.",
  },
  recovery: {
    title: "Lấy lại quyền truy cập.",
    description: "Khôi phục mật khẩu qua email để tiếp tục sử dụng ParkMatrix.",
  },
};

export default function AuthShowcase({ variant }: { variant: keyof typeof content }) {
  const { title, description } = content[variant];

  return (
    <aside className={`auth-showcase auth-showcase--${variant}`}>
      <header>
        <Link to="/" className="auth-brand-badge" aria-label="ParkMatrix — Trang chủ">
          <span className="auth-brand-icon-box"><ParkingCircle size={26} strokeWidth={2.4} /></span>
          <span className="auth-brand-text">
            <strong>PARKMATRIX</strong>
            <span>Smart 3D Parking</span>
          </span>
        </Link>
      </header>
      <div className="auth-showcase-content">
        <h1 className="auth-showcase-title">{title}</h1>
        <p className="auth-showcase-desc">{description}</p>
        <AuthVisualShowcase recovery={variant === "recovery"} />
      </div>
      <p className="auth-showcase-footer">Một tài khoản. Mọi hành trình.</p>
    </aside>
  );
}
