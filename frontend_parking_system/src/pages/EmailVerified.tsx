import { Check } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export default function EmailVerified() {
  const location = useLocation();
  const routeEmail = (location.state as { email?: string } | null)?.email;
  const email = routeEmail ?? sessionStorage.getItem("parking.verifiedEmail") ?? "";

  return (
    <main className="simple-auth-page">
      <section className="simple-auth-card simple-auth-complete" aria-labelledby="verified-title">
        {email ? (
          <>
            <span className="simple-verified-icon"><Check size={27} /></span>
            <p className="simple-verified-label">XÁC THỰC THÀNH CÔNG</p>
            <h1 id="verified-title">Email của bạn đã được xác thực</h1>
            <p className="simple-verified-email">{email}</p>
            <p>Tài khoản đã sẵn sàng. Quay về trang chủ để đăng nhập.</p>
          </>
        ) : (
          <>
            <h1 id="verified-title">Chưa xác thực email</h1>
            <p>Vui lòng nhập mã OTP hợp lệ trước khi tiếp tục.</p>
          </>
        )}
        <Link
          className="simple-auth-submit simple-auth-link-button"
          to={email ? "/" : "/register"}
          onClick={() => {
            if (email) sessionStorage.removeItem("parking.verifiedEmail");
          }}
        >
          {email ? "Về trang chủ để đăng nhập" : "Đi đến đăng ký"}
        </Link>
      </section>
    </main>
  );
}
