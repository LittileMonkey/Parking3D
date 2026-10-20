import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setGoogleNotice("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/");
    } catch (cause) {
      if (cause instanceof ApiError && (cause.status === 404 || cause.status === 405)) {
        setError("Backend hiện chưa có API đăng nhập. Màn hình đã sẵn sàng tích hợp tại POST /api/v1/auth/login.");
      } else {
        setError(cause instanceof Error ? cause.message : "Đăng nhập chưa thành công. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="simple-auth-page">
      <Link className="simple-auth-back" to="/">
        <ArrowLeft size={16} /> Quay về trang chủ
      </Link>

      <section className="simple-auth-card" aria-labelledby="login-title">
        <header className="simple-auth-heading">
          <h1 id="login-title">Đăng nhập</h1>
          <p>Chào mừng bạn quay trở lại với ParkMatrix</p>
        </header>

        <form className="simple-auth-form" onSubmit={submit}>
          {error && <div className="simple-auth-alert" role="alert">{error}</div>}
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
            disabled={loading}
          />

          <div className="simple-auth-label-row">
            <label htmlFor="login-password">Mật khẩu</label>
            <Link to="/forgot-password">Quên mật khẩu?</Link>
          </div>
          <div className="simple-auth-password">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Nhập mật khẩu"
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

          <button className="simple-auth-submit" type="submit" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Xác nhận đăng nhập"}
          </button>
        </form>

        <div className="simple-auth-divider"><span>hoặc</span></div>
        <button
          className="simple-auth-google"
          type="button"
          onClick={() => setGoogleNotice("Đăng nhập Google chưa được kết nối. Cần cấu hình OAuth ở backend.")}
        >
          <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.14 3.57-8.85Z" />
            <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.92l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.09A12 12 0 0 0 12 24Z" />
            <path fill="#FBBC05" d="M5.25 14.26a7.2 7.2 0 0 1 0-4.52V6.65h-4A12 12 0 0 0 0 12c0 1.94.46 3.77 1.25 5.35l4-3.09Z" />
            <path fill="#EA4335" d="M12 4.77c1.77 0 3.36.61 4.61 1.8l3.45-3.45C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.25 6.65l4 3.09c.95-2.85 3.61-4.97 6.75-4.97Z" />
          </svg>
          Tiếp tục với Google
        </button>
        {googleNotice && <p className="simple-auth-notice" role="status">{googleNotice}</p>}

        <p className="simple-auth-switch">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </section>
    </main>
  );
}
