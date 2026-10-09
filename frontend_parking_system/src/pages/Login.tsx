import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [googleNotice, setGoogleNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(userName.trim(), password);
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
          <label htmlFor="login-username">Email hoặc tên đăng nhập</label>
          <input
            id="login-username"
            type="text"
            autoComplete="username"
            value={userName}
            onChange={(event) => setUserName(event.target.value)}
            placeholder="name@example.com"
            required
            disabled={loading}
          />

          <label htmlFor="login-password">Mật khẩu</label>
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
          <span className="google-mark" aria-hidden="true">G</span>
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
