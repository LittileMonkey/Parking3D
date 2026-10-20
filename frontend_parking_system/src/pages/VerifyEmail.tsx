import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Clock3, MailCheck, RefreshCw } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ApiError, api } from "../services/api";

const OTP_LIFETIME_MS = 60_000;

function getExpiryTime(expiresAt?: string): number {
  const parsedExpiry = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  return Number.isFinite(parsedExpiry) ? parsedExpiry : Date.now() + OTP_LIFETIME_MS;
}

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeEmail = (location.state as { email?: string } | null)?.email;
  const email = routeEmail ?? sessionStorage.getItem("parking.pendingVerificationEmail") ?? "";
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState(
    () => Number(sessionStorage.getItem("parking.emailOtpExpiresAt")) || 0,
  );
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (routeEmail) {
      sessionStorage.setItem("parking.pendingVerificationEmail", routeEmail);
    }
  }, [routeEmail]);

  useEffect(() => {
    const updateRemainingTime = () => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };
    updateRemainingTime();
    const interval = window.setInterval(updateRemainingTime, 250);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  const verify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!email) {
      setError("Không tìm thấy email cần xác thực. Vui lòng đăng ký lại.");
      return;
    }
    if (secondsLeft <= 0) {
      setError("Mã xác thực đã hết hạn. Hãy gửi lại mã mới.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Vui lòng nhập đủ 6 chữ số trong mã xác thực.");
      return;
    }

    setLoading(true);
    try {
      await api.verifyEmailOtp(email, otp);
      sessionStorage.removeItem("parking.pendingVerificationEmail");
      sessionStorage.removeItem("parking.emailOtpExpiresAt");
      sessionStorage.setItem("parking.verifiedEmail", email);
      navigate("/email-verified", { replace: true, state: { email } });
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Không thể xác thực email. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!email) {
      setError("Không tìm thấy email cần xác thực. Vui lòng đăng ký lại.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await api.resendEmailOtp(email);
      const nextExpiry = getExpiryTime(response.expiresAt);
      sessionStorage.setItem("parking.emailOtpExpiresAt", String(nextExpiry));
      setExpiresAt(nextExpiry);
      setOtp("");
      setNotice(response.message ?? "Mã xác thực mới đã được gửi đến email của bạn.");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : cause instanceof Error
            ? cause.message
            : "Không thể gửi lại mã. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="simple-auth-page">
      <Link className="simple-auth-back" to="/register">
        <ArrowLeft size={16} /> Quay lại đăng ký
      </Link>

      <section className="simple-auth-card simple-otp-card" aria-labelledby="otp-title">
        <span className="simple-otp-icon"><MailCheck size={25} /></span>
        <header className="simple-auth-heading">
          <h1 id="otp-title">Xác thực email</h1>
          <p>
            Nhập mã gồm 6 chữ số đã được gửi đến
            <strong className="simple-otp-email">{email || " email đăng ký của bạn"}</strong>
          </p>
        </header>

        {!email && (
          <div className="simple-auth-alert" role="alert">
            Không tìm thấy email đăng ký cần xác thực. Hãy quay lại và đăng ký lại.
          </div>
        )}
        {error && <div className="simple-auth-alert" role="alert">{error}</div>}

        {email && (
          <>
            <form className="simple-auth-form" onSubmit={verify}>
              <label htmlFor="email-otp">Mã xác thực OTP</label>
              <input
                id="email-otp"
                className="simple-otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                aria-describedby="otp-expiry"
                required
                disabled={loading || secondsLeft === 0}
              />
              <p
                id="otp-expiry"
                className={`simple-otp-countdown${secondsLeft === 0 ? " is-expired" : ""}`}
                aria-live="polite"
              >
                <Clock3 size={15} />
                {secondsLeft > 0
                  ? `Mã có hiệu lực trong ${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
                  : "Mã đã hết hạn"}
              </p>
              <button
                className="simple-auth-submit"
                type="submit"
                disabled={loading || secondsLeft === 0 || otp.length !== 6}
              >
                {loading ? "Đang xác thực..." : "Xác nhận email"}
              </button>
            </form>

            {notice && <p className="simple-auth-notice" role="status">{notice}</p>}
            <div className="simple-otp-resend">
              <span>Chưa nhận được email?</span>
              <button type="button" onClick={resend} disabled={loading || secondsLeft > 0}>
                <RefreshCw size={14} />
                {loading ? "Đang gửi..." : "Gửi lại mã"}
              </button>
            </div>
          </>
        )}

        {!email && <Link className="simple-auth-submit simple-auth-link-button" to="/register">Đi đến đăng ký</Link>}
      </section>
    </main>
  );
}
