import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../services/api";

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
      <main className="simple-auth-page">
        <Link className="simple-auth-back" to="/">
          <ArrowLeft size={16} /> Quay về trang chủ
        </Link>
        <section className="simple-auth-card simple-register-card simple-auth-complete" aria-labelledby="register-complete-title">
          <span className="simple-auth-success-icon"><CheckCircle2 size={30} /></span>
          <header className="simple-auth-heading">
            <h1 id="register-complete-title">Đăng ký thành công</h1>
            <p>Tài khoản <strong>{email}</strong> đã được tạo. Bạn có thể đăng nhập ngay bây giờ.</p>
          </header>
          <Link className="simple-auth-submit simple-auth-link-button" to="/login">Đi đến đăng nhập</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="simple-auth-page">
      <Link className="simple-auth-back" to="/">
        <ArrowLeft size={16} /> Quay về trang chủ
      </Link>

      <section className="simple-auth-card simple-register-card" aria-labelledby="register-title">
        <header className="simple-auth-heading">
          <h1 id="register-title">Tạo tài khoản</h1>
          <p>Điền thông tin để đăng ký ParkMatrix</p>
        </header>

        <form className="simple-auth-form simple-register-form" onSubmit={submit}>
          {error && <div className="simple-auth-alert" role="alert">{error}</div>}
          <label htmlFor="register-name">Họ và tên</label>
          <input
            id="register-name"
            autoComplete="name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Nguyễn Văn An"
            required
            disabled={loading}
          />

          <label htmlFor="register-email">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            disabled={loading}
          />

          <label htmlFor="register-password">Mật khẩu</label>
          <div className="simple-auth-password">
            <input
              id="register-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Ít nhất 8 ký tự"
              required
              disabled={loading}
            />
            <button
              type="button"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="register-confirm">Xác nhận mật khẩu</label>
          <input
            id="register-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Nhập lại mật khẩu"
            required
            disabled={loading}
          />

          <button className="simple-auth-submit" type="submit" disabled={loading}>
            {loading ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
          </button>
        </form>

        <div className="simple-auth-divider"><span>hoặc</span></div>
        <button
          className="simple-auth-google"
          type="button"
          onClick={() => setGoogleNotice("Đăng ký Google chưa được kết nối. Cần cấu hình OAuth ở backend.")}
        >
          <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.14 3.57-8.85Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.09A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.25 14.26a7.2 7.2 0 0 1 0-4.52V6.65h-4A12 12 0 0 0 0 12c0 1.94.46 3.77 1.25 5.35l4-3.09Z" />
            <path fill="#EA4335" d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.25 6.65l4 3.09c.95-2.85 3.61-4.97 6.75-4.97Z" />
          </svg>
          Đăng ký với Google
        </button>
        {googleNotice && <p className="simple-auth-notice" role="status">{googleNotice}</p>}

        <p className="simple-auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </section>
    </main>
  );
}
