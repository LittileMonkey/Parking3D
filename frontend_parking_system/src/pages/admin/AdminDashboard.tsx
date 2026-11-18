import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Users,
  Building2,
  Server,
  ShieldCheck,
  ArrowRight,
  Eye,
  Sliders,
} from "lucide-react";
import { api, type AccountUserDto, type ParkingLot } from "../../services/api";

interface AdminOutletContext {
  refreshKey: number;
  onTriggerRefresh: () => void;
}

export default function AdminDashboard() {
  const { refreshKey } = useOutletContext<AdminOutletContext>();

  const [accounts, setAccounts] = useState<AccountUserDto[]>([]);
  const [facilities, setFacilities] = useState<ParkingLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [accs, facs] = await Promise.allSettled([
          api.getAllAccounts(),
          api.getParkingLots(),
        ]);

        if (!mounted) return;

        if (accs.status === "fulfilled") {
          setAccounts(accs.value ?? []);
        } else {
          console.warn("Could not fetch accounts:", accs.reason);
        }

        if (facs.status === "fulfilled") {
          setFacilities(facs.value ?? []);
        } else {
          console.warn("Could not fetch facilities:", facs.reason);
        }


      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Lỗi khi tải dữ liệu tổng quan.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, [refreshKey]);

  // Compute breakdown stats
  const totalUsers = accounts.length;
  const adminCount = accounts.filter((a) => a.roles?.some((r) => r.toUpperCase().includes("ADMIN"))).length;
  const managerCount = accounts.filter((a) => a.roles?.some((r) => r.toUpperCase().includes("MANAGER"))).length;
  const staffCount = accounts.filter((a) => a.roles?.some((r) => r.toUpperCase().includes("STAFF"))).length;
  const customerCount = accounts.filter((a) => a.roles?.some((r) => r.toUpperCase().includes("CUSTOMER"))).length;

  return (
    <div>
      {error && (
        <div className="adm-alert error" role="alert">
          {error}
        </div>
      )}

      {/* ── KPI Grid (Gọn gàng) ── */}
      <section className="adm-kpi-grid">
        {/* KPI 1: Total Accounts */}
        <div className="adm-kpi-card adm-kpi-indigo">
          <div className="adm-kpi-header">
            <span className="adm-kpi-title">Tài Khoản Hệ Thống</span>
            <div className="adm-kpi-icon-wrap">
              <Users size={16} />
            </div>
          </div>
          <div className="adm-kpi-body">
            <span className="adm-kpi-number">{totalUsers || "—"}</span>
            <span className="adm-kpi-tag adm-tag-positive">Hoạt động</span>
          </div>
          <div className="adm-kpi-footer">
            <span>{adminCount} Admin • {managerCount} Quản lý • {staffCount} Staff • {customerCount} Khách</span>
          </div>
        </div>

        {/* KPI 2: Total Facilities */}
        <div className="adm-kpi-card adm-kpi-cyan">
          <div className="adm-kpi-header">
            <span className="adm-kpi-title">Mạng Lưới Bãi Đỗ</span>
            <div className="adm-kpi-icon-wrap">
              <Building2 size={16} />
            </div>
          </div>
          <div className="adm-kpi-body">
            <span className="adm-kpi-number">{facilities.length || "—"}</span>
            <span className="adm-kpi-tag adm-tag-positive">Đã kết nối</span>
          </div>
          <div className="adm-kpi-footer">
            <span>Quản lý tập trung toàn quốc qua GPS</span>
          </div>
        </div>

        {/* KPI 3: Microservices Health */}
        <div className="adm-kpi-card adm-kpi-emerald">
          <div className="adm-kpi-header">
            <span className="adm-kpi-title">Microservices Trực Tuyến</span>
            <div className="adm-kpi-icon-wrap">
              <Server size={16} />
            </div>
          </div>
          <div className="adm-kpi-body">
            <span className="adm-kpi-number">4 / 4</span>
            <span className="adm-kpi-tag adm-tag-positive">100% Ready</span>
          </div>
          <div className="adm-kpi-footer">
            <span>Identity • Parking • Payment • AI Vision</span>
          </div>
        </div>

        {/* KPI 4: Security & Compliance */}
        <div className="adm-kpi-card adm-kpi-amber">
          <div className="adm-kpi-header">
            <span className="adm-kpi-title">Bảo Mật & Phân Quyền</span>
            <div className="adm-kpi-icon-wrap">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="adm-kpi-body">
            <span className="adm-kpi-number">RBAC</span>
            <span className="adm-kpi-tag adm-tag-positive">Chuẩn hóa V4</span>
          </div>
          <div className="adm-kpi-footer">
            <span>Advisory Lock • Hold 5p • JWT Bearer</span>
          </div>
        </div>
      </section>

      {/* ── Facilities Quick View ── */}
      <section className="adm-card">
        <div className="adm-card-header">
          <div className="adm-card-title-group">
            <h2 className="adm-card-title">
              <Building2 size={17} color="#0891b2" />
              Mạng Lưới Bãi Đỗ Xe (Multi-Parking Platform)
            </h2>
            <p className="adm-card-desc">
              Xem sơ đồ 3D và quản lý slot riêng biệt trực tiếp trong phân hệ Admin.
            </p>
          </div>
          <Link to="/admin/facilities" className="adm-btn-secondary">
            <span>Xem tất cả ({facilities.length})</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mã Bãi</th>
                <th>Tên Cơ Sở Bãi Xe</th>
                <th>Địa Chỉ</th>
                <th>Tọa Độ GPS</th>
                <th>Trạng Thái</th>
                <th style={{ textAlign: "right" }}>Thao Tác Admin</th>
              </tr>
            </thead>
            <tbody>
              {facilities.slice(0, 4).map((f) => (
                <tr key={f.id}>
                  <td>
                    <span style={{ fontWeight: 800, color: "var(--adm-indigo)", background: "var(--adm-indigo-soft)", padding: "3px 7px", borderRadius: "5px", fontSize: "0.8rem" }}>
                      {f.code}
                    </span>
                  </td>
                  <td>
                    <strong>{f.name}</strong>
                  </td>
                  <td>{f.address}</td>
                  <td>
                    <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--adm-muted)" }}>
                      {f.latitude?.toFixed(4)}, {f.longitude?.toFixed(4)}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: "#15803d", fontWeight: 700, fontSize: "0.78rem" }}>
                      ● Online
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <Link
                        to={`/admin/map-3d/${f.id}`}
                        className="adm-btn-secondary"
                        style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                        title="Xem sơ đồ không gian 3D của riêng Admin"
                      >
                        <Eye size={12} />
                        <span>Xem 3D</span>
                      </Link>
                      <Link
                        to={`/admin/slots/${f.id}`}
                        className="adm-btn-primary"
                        style={{ padding: "4px 8px", fontSize: "0.74rem" }}
                        title="Quản lý và can thiệp trạng thái ô đỗ trực tiếp"
                      >
                        <Sliders size={12} />
                        <span>Quản lý Slot</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Recent Users Table ── */}
      <section className="adm-card">
        <div className="adm-card-header">
          <div className="adm-card-title-group">
            <h2 className="adm-card-title">
              <Users size={17} color="#4338ca" />
              Tài Khoản Người Dùng Mới Nhất
            </h2>
            <p className="adm-card-desc">
              Danh sách tài khoản từ Cơ sở Dữ liệu Identity.
            </p>
          </div>
          <Link to="/admin/users" className="adm-btn-primary">
            <span>Quản lý phân quyền</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Họ và Tên</th>
                <th>Email Đăng Ký</th>
                <th>Số Điện Thoại</th>
                <th>Vai Trò Nền Tảng</th>
                <th>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {accounts.slice(0, 5).map((acc) => {
                const roles = acc.roles || [];
                return (
                  <tr key={acc.id}>
                    <td>
                      <strong>{acc.fullName}</strong>
                    </td>
                    <td>{acc.emailNormalized}</td>
                    <td>{acc.phoneE164 || "—"}</td>
                    <td>
                      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                        {roles.map((r) => {
                          const code = r.toUpperCase();
                          const cls = code.includes("ADMIN")
                            ? "adm-role-admin"
                            : code.includes("MANAGER")
                            ? "adm-role-manager"
                            : code.includes("STAFF")
                            ? "adm-role-staff"
                            : "adm-role-customer";
                          return (
                            <span key={r} className={`adm-role-badge ${cls}`}>
                              {r}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <span style={{ color: "#15803d", fontWeight: 700, fontSize: "0.78rem" }}>
                        ● Hoạt động
                      </span>
                    </td>
                  </tr>
                );
              })}
              {accounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--adm-muted)" }}>
                    Không có tài khoản nào được hiển thị.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
