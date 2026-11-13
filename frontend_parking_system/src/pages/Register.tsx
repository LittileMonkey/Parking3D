import { useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  Mail,
  Lock,
  Car,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../services/api";
import "./Auth.css";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setGoogleNotice("");

    if (password.length < 8) {
      setError("Mật khẩu cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setLoading(true);
    try {
      await api.register({
        email: email.trim().toLowerCase(),
        fullName: fullName.trim(),
        password,
      });
      setComplete(true);
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng ký. Màn hình đã sẵn sàng tích hợp tại POST /api/v1/auth/register.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng ký chưa thành công. Vui lòng kiểm tra lại thông tin.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (complete) {
    return (
      <main className="pm-auth-page">
        <div className="pm-auth-ambient-glow" />

        <Link className="pm-auth-back-btn" to="/">
          <ArrowLeft size={16} /> Quay về trang chủ
        </Link>

        <section className="pm-auth-card pm-auth-success-box" aria-labelledby="register-complete-title">
          <div className="pm-auth-success-icon">
            <CheckCircle2 size={36} />
          </div>
          <header className="pm-auth-brand" style={{ marginBottom: 12 }}>
            <h1 id="register-complete-title" className="pm-auth-title" style={{ fontSize: 22 }}>
              Đăng ký thành công!
            </h1>
            <p className="pm-auth-subtitle" style={{ fontSize: 13.5 }}>
              Tài khoản <strong>{email}</strong> đã được tạo thành công. Bạn có thể đăng nhập để trải nghiệm dịch vụ bãi đỗ thông minh.
            </p>
          </header>

          <Link
            className="pm-auth-submit-btn"
            to="/login"
            style={{ textDecoration: "none" }}
          >
            Đến màn hình đăng nhập <ArrowRight size={16} />
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="pm-auth-page">
      <div className="pm-auth-ambient-glow" />

      <Link className="pm-auth-back-btn" to="/">
        <ArrowLeft size={16} /> Quay về trang chủ
      </Link>

      <section className="pm-auth-card register-mode" aria-labelledby="register-title">
        <header className="pm-auth-brand">
          <div className="pm-auth-logo-badge">
            <Car size={26} />
          </div>
          <h1 id="register-title" className="pm-auth-title">Tạo tài khoản mới</h1>
          <p className="pm-auth-subtitle">Gia nhập ParkMatrix để đặt chỗ và gửi xe nhanh chóng</p>
        </header>

        {error && (
          <div className="pm-auth-alert" role="alert">
            <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="pm-auth-form" onSubmit={submit}>
          <div className="pm-auth-field">
            <label className="pm-auth-label" htmlFor="register-name">
              Họ và tên
            </label>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <User size={17} />
              </span>
              <input
                id="register-name"
                className="pm-auth-input"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn An"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="pm-auth-field">
            <label className="pm-auth-label" htmlFor="register-email">
              Địa chỉ Email
            </label>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <Mail size={17} />
              </span>
              <input
                id="register-email"
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
            <label className="pm-auth-label" htmlFor="register-password">
              Mật khẩu (ít nhất 8 ký tự)
            </label>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <Lock size={17} />
              </span>
              <input
                id="register-password"
                className="pm-auth-input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
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

          <div className="pm-auth-field">
            <label className="pm-auth-label" htmlFor="register-confirm">
              Xác nhận mật khẩu
            </label>
            <div className="pm-auth-input-wrapper">
              <span className="pm-auth-input-icon">
                <Lock size={17} />
              </span>
              <input
                id="register-confirm"
                className="pm-auth-input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu vừa đặt"
                required
                disabled={loading}
              />
            </div>
          </div>

          <button className="pm-auth-submit-btn" type="submit" disabled={loading}>
            {loading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
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
            setGoogleNotice("Đăng ký Google chưa được kết nối. Vui lòng tạo tài khoản bằng email.")
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

        <p className="pm-auth-footer">
          Đã có tài khoản?
          <Link to="/login">Đăng nhập ngay</Link>
        </p>
      </section>
    </main>
  );
}
