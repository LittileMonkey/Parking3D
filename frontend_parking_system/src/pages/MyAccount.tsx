import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import CustomerLayout from "../components/customer/CustomerLayout";
import { useAuth } from "../context/AuthContext";
import { api, ApiError, request, type MembershipDto } from "../services/api";

type Visit = { id: string; code: string; status: string; startsAt: string; estimatedAmount: number; lotName: string };
type Vehicle = { id: string; licensePlate: string; vehicleType: string; isDefault: boolean };

export default function MyAccount() {
  const { isAuthenticated, user } = useAuth();
  const [bookings, setBookings] = useState<Visit[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [membership, setMembership] = useState<MembershipDto | null>(null);
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [emailNormalized, setEmailNormalized] = useState(user?.email ?? "");
  const [phoneE164, setPhoneE164] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [plate, setPlate] = useState("");
  const [type, setType] = useState("Car");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    if (!isAuthenticated) return;
    Promise.all([
      request<Visit[]>("/api/v1/bookings/mine"),
      request<Vehicle[]>("/api/v1/user-vehicles"),
      api.getAccountInformation().catch(() => null),
      api.getMyMembership().catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
    ])
      .then(([b, v, info, mem]) => {
        if (!active) return;
        setBookings(b);
        setVehicles(v);
        if (info) {
          setFullName(info.fullName ?? "");
          setEmailNormalized(info.emailNormalized ?? "");
          setPhoneE164(info.phoneE164 ?? "");
        }
        setMembership(mem);
        setError("");
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : "Không tải được dữ liệu tài khoản.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, revision]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  async function addVehicle(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request("/api/v1/user-vehicles", {
        method: "POST",
        body: JSON.stringify({ licensePlate: plate.trim(), vehicleType: type, isDefault: vehicles.length === 0 }),
      });
      setPlate("");
      setNotice("Đã thêm phương tiện.");
      setRevision((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được xe.");
    } finally {
      setBusy(false);
    }
  }

  async function setDefaultVehicle(v: Vehicle) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.updateUserVehicle(v.id, { licensePlate: v.licensePlate, vehicleType: v.vehicleType, isDefault: true });
      setNotice(`Đã đặt ${v.licensePlate} làm xe mặc định.`);
      setRevision((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được xe.");
    } finally {
      setBusy(false);
    }
  }

  async function removeVehicle(id: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.deleteUserVehicle(id);
      setNotice("Đã xóa phương tiện.");
      setRevision((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không xóa được xe.");
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.updateAccountInformation({
        fullName: fullName.trim(),
        emailNormalized: emailNormalized.trim(),
        phoneE164: phoneE164.trim() || null,
      });
      setNotice("Đã cập nhật thông tin tài khoản.");
      setRevision((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được thông tin.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api.changePassword({ password: currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNotice("Đã đổi mật khẩu thành công.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đổi được mật khẩu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CustomerLayout>
      <main className="customer-page">
        <h1>Tài khoản, xe và lịch sử đặt chỗ</h1>
        {error && <p role="alert">{error}</p>}
        {notice && <p role="status">{notice}</p>}
        {loading && <p role="status">Đang tải dữ liệu…</p>}

        <section className="customer-panel">
          <h2>Hồ sơ & Thành viên</h2>
          <p>
            Hạng thành viên:{" "}
            <strong>{membership ? `${membership.tierCode}${membership.status ? ` (${membership.status})` : ""}` : "Chưa kích hoạt"}</strong>
          </p>
          <form onSubmit={saveProfile}>
            <label>
              Họ và tên
              <input required maxLength={120} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label>
              Email
              <input type="email" required value={emailNormalized} onChange={(e) => setEmailNormalized(e.target.value)} />
            </label>
            <label>
              Số điện thoại (E.164)
              <input placeholder="+84901234567" value={phoneE164} onChange={(e) => setPhoneE164(e.target.value)} />
            </label>
            <button className="customer-button primary" disabled={busy}>Lưu hồ sơ</button>
          </form>
        </section>

        <section className="customer-panel">
          <h2>Đổi mật khẩu</h2>
          <form onSubmit={submitPassword}>
            <label>
              Mật khẩu hiện tại
              <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label>
              Mật khẩu mới
              <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label>
              Xác nhận mật khẩu mới
              <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
            <button className="customer-button secondary" disabled={busy}>Đổi mật khẩu</button>
          </form>
        </section>

        <section className="customer-panel">
          <h2>Xe của tôi</h2>
          {vehicles.map((v) => (
            <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span>
                {v.licensePlate} · {v.vehicleType}
                {v.isDefault ? " · Mặc định" : ""}
              </span>
              {!v.isDefault && (
                <button type="button" className="customer-button secondary" disabled={busy} onClick={() => setDefaultVehicle(v)}>
                  Đặt mặc định
                </button>
              )}
              <button type="button" className="customer-button secondary" disabled={busy} onClick={() => removeVehicle(v.id)}>
                Xóa
              </button>
            </div>
          ))}
          <form onSubmit={addVehicle}>
            <label>
              Biển số xe
              <input required maxLength={16} value={plate} onChange={(e) => setPlate(e.target.value)} />
            </label>
            <label>
              Loại xe
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="Car">Ô tô</option>
                <option value="Bike">Xe máy</option>
                <option value="EV">Ô tô điện</option>
              </select>
            </label>
            <button className="customer-button primary" disabled={busy}>Thêm xe</button>
          </form>
        </section>

        <section className="customer-panel">
          <h2>Đặt chỗ gần đây</h2>
          {!loading && !bookings.length && <p>Chưa có đặt chỗ.</p>}
          {bookings.map((b) => (
            <article key={b.id}>
              <h3>
                <Link to={"/bookings/" + b.id}>
                  {b.code} · {b.lotName}
                </Link>
              </h3>
              <p>
                {new Date(b.startsAt).toLocaleString("vi-VN")} · {b.status} · {b.estimatedAmount.toLocaleString("vi-VN")} VND
              </p>
            </article>
          ))}
        </section>
      </main>
    </CustomerLayout>
  );
}
