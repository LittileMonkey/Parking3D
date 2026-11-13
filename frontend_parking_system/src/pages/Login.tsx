import { useState, useEffect, type FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Lock,
  AlertCircle,
  Car,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth, getRedirectPathForUser } from "../context/AuthContext";
import "./Auth.css";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [loading, setLoading] = useState(false);

  // Nếu tài khoản nội bộ (Staff / Admin / Manager) đã có phiên hợp lệ, tự động điều hướng vào dashboard
  useEffect(() => {
    if (user) {
      const targetPath = getRedirectPathForUser(user);
      if (targetPath !== "/") {
        navigate(targetPath, { replace: true });
      }
    }
  }, [user, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setGoogleNotice("");
    setLoading(true);

    try {
      const authUser = await login(
        email.trim().toLowerCase(),
        password
      );

      // Điều hướng chính xác theo vai trò tài khoản:
      // - PARKING_STAFF -> /staff/dashboard
      // - ADMIN / PARKING_MANAGER -> /manager/dashboard
      // - Khách hàng -> /
      const targetPath = getRedirectPathForUser(authUser);
      navigate(targetPath, { replace: true });
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng nhập. Màn hình đã sẵn sàng tích hợp tại POST /api/v1/auth/login.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng nhập chưa thành công. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pm-auth-page">
      <div className="pm-auth-ambient-glow" />

      <Link className="pm-auth-back-btn" to="/">
        <ArrowLeft size={16} /> Quay về trang chủ
      </Link>

      <section className="pm-auth-card" aria-labelledby="login-title">
        <header className="pm-auth-brand">
          <div className="pm-auth-logo-badge">
            <Car size={26} />
          </div>
          <h1 id="login-title" className="pm-auth-title">Đăng nhập</h1>
          <p className="pm-auth-subtitle">Chào mừng bạn quay trở lại với hệ thống ParkMatrix</p>
        </header>

        {error && (
          <div className="pm-auth-alert" role="alert">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="pm-auth-form" onSubmit={submit}>
          <div className="pm-auth-field">
            <label className="pm-auth-label" htmlFor="login-email">
              Email đăng nhập
            </label>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <Mail size={17} />
              </span>
              <input
                id="login-email"
                className="pm-auth-input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="pm-auth-field">
            <div className="pm-auth-label-row">
              <label className="pm-auth-label" htmlFor="login-password">
                Mật khẩu
              </label>
              <Link className="pm-auth-label-link" to="/forgot-password">
                Quên mật khẩu?
              </Link>
            </div>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <Lock size={17} />
              </span>
              <input
                id="login-password"
                className="pm-auth-input"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="pm-auth-eye-btn"
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button className="pm-auth-submit-btn" type="submit" disabled={loading}>
            {loading ? "Đang xác thực..." : "Xác nhận đăng nhập"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="pm-auth-divider">
          <span>hoặc</span>
        </div>

        <button
          className="pm-auth-google-btn"
          type="button"
          onClick={() =>
            setGoogleNotice("Đăng nhập Google chưa được kết nối. Vui lòng sử dụng email/mật khẩu.")
          }
        >
          <svg className="google-mark" viewBox="0 0 24 24" width={20} height={20} aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.14 3.57-8.85Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.09A12 12 0 0 0 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.25 14.26a7.2 7.2 0 0 1 0-4.52V6.65h-4A12 12 0 0 0 0 12c0 1.94.46 3.77 1.25 5.35l4-3.09Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.25 6.65l4 3.09c.95-2.85 3.61-4.97 6.75-4.97Z"
            />
          </svg>
          Tiếp tục với Google
        </button>

        {googleNotice && (
          <p className="pm-auth-notice" role="status">
            {googleNotice}
          </p>
        )}

        <Link className="pm-auth-guest-link" to="/guest-login">
          <Sparkles size={16} />
          Khách vãng lai: Đăng nhập nhanh bằng mã OTP Email
        </Link>

        <p className="pm-auth-footer">
          Chưa có tài khoản?
          <Link to="/register">Đăng ký ngay</Link>
        </p>
      </section>
    </main>
  );
}
