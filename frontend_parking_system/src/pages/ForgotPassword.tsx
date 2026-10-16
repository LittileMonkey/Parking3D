import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

type Step = "email" | "otp" | "password" | "success";

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (step === "email") {
      setEmail(email.trim().toLowerCase());
      setStep("otp");
      return;
    }

    if (step === "otp") {
      if (!/^\d{6}$/.test(otp)) {
        setError("OTP phải gồm đúng 6 chữ số.");
        return;
      }
      setStep("password");
      return;
    }

    if (password.length < 8) {
      setError("Mật khẩu mới cần có ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }

    setStep("success");
  };

  const goBack = () => {
    setError("");
    setStep(step === "password" ? "otp" : "email");
  };

  return (
    <main className="forgot-page">
      <Link className="forgot-back-link" to="/login">
        <ArrowLeft size={17} />
        Quay lại đăng nhập
      </Link>

      <section className="forgot-card">
        {step === "success" ? (
          <div className="forgot-success" role="status">
            <CheckCircle2 size={48} />
            <h1>Đổi mật khẩu thành công</h1>
            <p>Bạn có thể đăng nhập bằng mật khẩu mới ngay bây giờ.</p>
            <Link className="forgot-submit" to="/login">Đi đến đăng nhập</Link>
          </div>
        ) : (
          <>
            <header className="forgot-heading">
              <h1>
                {step === "email" && "Quên mật khẩu"}
                {step === "otp" && "Xác thực OTP"}
                {step === "password" && "Đặt mật khẩu mới"}
              </h1>
              <p>
                {step === "email" && "Nhập email để nhận mã PIN xác thực qua Gmail."}
                {step === "otp" && <>Nhập mã OTP đã được gửi đến <strong>{email}</strong>.</>}
                {step === "password" && "Tạo mật khẩu mới để hoàn tất khôi phục tài khoản."}
              </p>
            </header>

            <form className="forgot-form" onSubmit={submit}>
              {error && <div className="forgot-error" role="alert">{error}</div>}

              {step === "email" && (
                <div className="forgot-field">
                  <label htmlFor="forgot-email">Địa chỉ email</label>
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    required
                  />
                </div>
              )}

              {step === "otp" && (
                <div className="forgot-field">
                  <label htmlFor="forgot-otp">Mã OTP 6 chữ số</label>
                  <input
                    id="forgot-otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    placeholder="Nhập mã OTP"
                    required
                  />
                </div>
              )}

              {step === "password" && (
                <>
                  <div className="forgot-field">
                    <label htmlFor="forgot-password">Mật khẩu mới</label>
                    <input
                      id="forgot-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Ít nhất 8 ký tự"
                      required
                    />
                  </div>
                  <div className="forgot-field">
                    <label htmlFor="forgot-confirm-password">Xác nhận mật khẩu mới</label>
                    <input
                      id="forgot-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Nhập lại mật khẩu mới"
                      required
                    />
                  </div>
                </>
              )}

              <button className="forgot-submit" type="submit">
                {step === "email" && "Gửi mã PIN"}
                {step === "otp" && "Xác thực OTP"}
                {step === "password" && "Đổi mật khẩu"}
              </button>
            </form>

            {(step === "otp" || step === "password") && (
              <button className="forgot-step-back" type="button" onClick={goBack}>
                <ArrowLeft size={15} />
                {step === "otp" ? "Quay lại nhập email" : "Quay lại xác thực OTP"}
              </button>
            )}
          </>
        )}
      </section>
    </main>
  );
}
