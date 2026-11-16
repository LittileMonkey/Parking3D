import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Users,
  Search,
  Filter,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Phone,
  Mail,
  Award,
} from "lucide-react";
import { api, type AccountUserDto } from "../../services/api";

interface AdminOutletContext {
  refreshKey: number;
  onTriggerRefresh: () => void;
}

const AVAILABLE_ROLES = [
  { code: "ADMIN", label: "Quản trị viên (ADMIN)", color: "adm-role-admin" },
  { code: "PARKING_MANAGER", label: "Quản lý bãi xe (PARKING_MANAGER)", color: "adm-role-manager" },
  { code: "PARKING_STAFF", label: "Nhân viên trực bãi (PARKING_STAFF)", color: "adm-role-staff" },
  { code: "CUSTOMER", label: "Khách hàng thông thường (CUSTOMER)", color: "adm-role-customer" },
];

const MEMBERSHIP_TIERS = [
  { code: "STANDARD", label: "Standard (Tiêu chuẩn)" },
  { code: "SILVER", label: "Silver (Hạng Bạc - Giảm 5%)" },
  { code: "GOLD", label: "Gold (Hạng Vàng - Giảm 10%)" },
  { code: "PLATINUM", label: "Platinum (Hạng Bạch kim - Giảm 20% & Ưu tiên slot)" },
];

export default function AdminUsersPage() {
  const { refreshKey, onTriggerRefresh } = useOutletContext<AdminOutletContext>();

  const [accounts, setAccounts] = useState<AccountUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // Edit Role & Membership Modal State
  const [selectedUser, setSelectedUser] = useState<AccountUserDto | null>(null);
  const [newRole, setNewRole] = useState("CUSTOMER");
  const [newTier, setNewTier] = useState("STANDARD");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Server Lookup by Email (GET /api/v1/account/by-email)
  const [serverEmailQuery, setServerEmailQuery] = useState("");
  const [serverEmailLoading, setServerEmailLoading] = useState(false);
  const [serverEmailResult, setServerEmailResult] = useState<AccountUserDto | null>(null);
  const [serverEmailError, setServerEmailError] = useState("");

  const handleLookupByEmailServer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const email = serverEmailQuery.trim();
    if (!email) return;
    setServerEmailLoading(true);
    setServerEmailError("");
    setServerEmailResult(null);
    try {
      const acc = await api.getAccountByEmail(email);
      setServerEmailResult(acc);
      if (acc && !accounts.some((a) => a.id === acc.id)) {
        setAccounts((prev) => [acc, ...prev]);
      }
    } catch (err) {
      setServerEmailError(
        err instanceof Error ? err.message : `Không tìm thấy tài khoản với email "${email}" trên Identity Service.`
      );
    } finally {
      setServerEmailLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadAccounts() {
      setLoading(true);
      setError("");
      try {
        const data = await api.getAllAccounts();
        if (mounted) setAccounts(data || []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách tài khoản.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadAccounts();
    return () => { mounted = false; };
  }, [refreshKey]);

  const filteredAccounts = accounts.filter((acc) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      acc.fullName?.toLowerCase().includes(term) ||
      acc.emailNormalized?.toLowerCase().includes(term) ||
      acc.phoneE164?.includes(term);

    if (!matchSearch) return false;
    if (roleFilter === "ALL") return true;

    return acc.roles?.some((r) => r.toUpperCase() === roleFilter);
  });

  const handleOpenEdit = (user: AccountUserDto) => {
    setSelectedUser(user);
    const primaryRole = user.roles?.[0]?.toUpperCase() || "CUSTOMER";
    setNewRole(primaryRole);
    setNewTier("STANDARD");
    setActionMessage(null);
  };

  const handleSaveRole = async () => {
    if (!selectedUser) return;
    setIsSubmitting(true);
    setActionMessage(null);
    try {
      await Promise.all([
        api.updateUserRole(selectedUser.id, newRole),
        api.updateUserMembership(selectedUser.id, newTier).catch(() => null),
      ]);
      setActionMessage({ type: "success", text: `Đã cập nhật vai trò ${newRole} và hạng ${newTier} thành công cho ${selectedUser.fullName}.` });
      setTimeout(() => {
        setSelectedUser(null);
        onTriggerRefresh();
      }, 1000);
    } catch (err) {
      setActionMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Cập nhật vai trò/hội viên thất bại. Kiểm tra kết nối API.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* ── Page Header & Stats Summary ── */}
      <div className="adm-card" style={{ marginBottom: "20px" }}>
        <div className="adm-card-header">
          <div className="adm-card-title-group">
            <h2 className="adm-card-title">
              <Users size={20} color="#4338ca" />
              Danh Sách Người Dùng & Phân Quyền RBAC Nền Tảng
            </h2>
            <p className="adm-card-desc">
              Quản trị toàn bộ danh tính người dùng trong hệ thống (Identity Database). Quản trị viên có toàn quyền gán vai trò: Admin, Manager, Staff, Customer.
            </p>
          </div>
          <button onClick={onTriggerRefresh} className="adm-btn-secondary">
            Làm mới danh sách
          </button>
        </div>

        {/* ── Filters Bar ── */}
        <div className="adm-filter-bar">
          <div className="adm-search-input-wrap">
            <Search size={16} className="adm-search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên, email, số điện thoại..."
              className="adm-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={16} color="var(--adm-muted)" />
            <select
              className="adm-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="ADMIN">Quản trị viên (ADMIN)</option>
              <option value="PARKING_MANAGER">Quản lý bãi (PARKING_MANAGER)</option>
              <option value="PARKING_STAFF">Nhân viên trực bãi (PARKING_STAFF)</option>
              <option value="CUSTOMER">Khách hàng (CUSTOMER)</option>
            </select>
          </div>
        </div>

        {/* ── Server Email Lookup Bar (GET /api/v1/account/by-email) ── */}
        <div
          style={{
            margin: "0 0 16px 0",
            padding: "12px 16px",
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px dashed var(--adm-indigo-soft, #c7d2fe)",
            display: "grid",
            gap: 10,
          }}
        >
          <form
            onSubmit={handleLookupByEmailServer}
            style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 260 }}>
              <Mail size={16} color="#4338ca" />
              <input
                type="email"
                placeholder="Tra cứu chính xác tài khoản qua Server bằng Email..."
                className="adm-search-input"
                style={{ flex: 1, background: "#fff" }}
                value={serverEmailQuery}
                onChange={(e) => setServerEmailQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="adm-btn-secondary"
              style={{ background: "#4338ca", color: "#fff", borderColor: "#4338ca" }}
              disabled={serverEmailLoading || !serverEmailQuery.trim()}
            >
              {serverEmailLoading ? "Đang tra cứu..." : "Tra Cứu Server (Identity)"}
            </button>
            {serverEmailResult && (
              <button
                type="button"
                className="adm-btn-secondary"
                onClick={() => {
                  setServerEmailResult(null);
                  setServerEmailQuery("");
                }}
              >
                Xóa kết quả
              </button>
            )}
          </form>

          {serverEmailError && (
            <div style={{ color: "#b91c1c", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={14} />
              <span>{serverEmailError}</span>
            </div>
          )}

          {serverEmailResult && (
            <div
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle2 size={18} color="#059669" />
                <div>
                  <strong style={{ color: "#065f46" }}>{serverEmailResult.fullName}</strong>
                  <span style={{ fontSize: 12, color: "#047857", marginLeft: 8 }}>
                    ({serverEmailResult.emailNormalized})
                  </span>
                  <div style={{ fontSize: 12, color: "#065f46", marginTop: 2 }}>
                    Vai trò: <strong>{serverEmailResult.roles?.join(", ") || "CUSTOMER"}</strong> · Hạng:{" "}
                    <strong>{serverEmailResult.membershipTier || "STANDARD"}</strong>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="adm-btn-secondary"
                style={{ background: "#059669", color: "#fff", borderColor: "#059669" }}
                onClick={() => handleOpenEdit(serverEmailResult)}
              >
                Phân quyền tài khoản này
              </button>
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#b91c1c", borderRadius: "10px", fontSize: "0.85rem", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {/* ── User Table ── */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Họ và Tên</th>
                <th>Thông Tin Liên Hệ</th>
                <th>Vai Trò Nền Tảng</th>
                <th>Hạng Thành Viên</th>
                <th>Trạng Thái</th>
                <th style={{ textAlign: "right" }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((u) => {
                const roles = u.roles || [];
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "34px",
                            height: "34px",
                            borderRadius: "8px",
                            background: "var(--adm-indigo-soft)",
                            color: "var(--adm-indigo)",
                            fontWeight: 700,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8rem",
                          }}
                        >
                          {(u.fullName || "U").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <strong style={{ display: "block" }}>{u.fullName}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--adm-muted)" }}>ID: {u.id?.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "0.82rem" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <Mail size={12} color="var(--adm-muted)" />
                          {u.emailNormalized}
                        </span>
                        {u.phoneE164 && (
                          <span style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--adm-muted)" }}>
                            <Phone size={12} />
                            {u.phoneE164}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
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
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", fontWeight: 700, color: "var(--adm-navy)" }}>
                        <Award size={14} color="#d97706" />
                        {u.status || "ACTIVE"}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: "#15803d", fontWeight: 700, fontSize: "0.8rem" }}>
                        ● Hoạt động
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="adm-btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.78rem" }}
                      >
                        <Edit2 size={13} />
                        <span>Sửa quyền</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredAccounts.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--adm-muted)" }}>
                    Không tìm thấy người dùng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Edit Role Modal ── */}
      {selectedUser && (
        <div className="adm-modal-backdrop" onClick={() => !isSubmitting && setSelectedUser(null)}>
          <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="adm-modal-header">
              <h3 className="adm-modal-title">Cập Nhật Vai Trò Nền Tảng (RBAC)</h3>
              <button
                className="adm-modal-close"
                onClick={() => !isSubmitting && setSelectedUser(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="adm-modal-body">
              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-muted)" }}>Người dùng:</label>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--adm-navy)", marginTop: "4px" }}>
                  {selectedUser.fullName} ({selectedUser.emailNormalized})
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                  Chọn vai trò mới:
                </label>
                <select
                  className="adm-select"
                  style={{ width: "100%", marginTop: "6px" }}
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={isSubmitting}
                >
                  {AVAILABLE_ROLES.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--adm-muted)" }}>
                  Hạng hội viên (Membership Tier):
                </label>
                <select
                  className="adm-select"
                  style={{ width: "100%", marginTop: "6px" }}
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value)}
                  disabled={isSubmitting}
                >
                  {MEMBERSHIP_TIERS.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "10px", fontSize: "0.8rem", color: "var(--adm-muted)" }}>
                <strong>Lưu ý quyền hạn:</strong>
                <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
                  <li><strong>ADMIN:</strong> Toàn quyền truy cập mọi tài nguyên, quản lý bãi và phân quyền.</li>
                  <li><strong>PARKING_MANAGER:</strong> Quản lý slot, sơ đồ 3D và nhân sự bãi được gán.</li>
                  <li><strong>PARKING_STAFF:</strong> Thao tác check-in/out và thanh toán tại bãi được gán.</li>
                  <li><strong>CUSTOMER:</strong> Đặt chỗ trước và thanh toán trên giao diện khách hàng.</li>
                </ul>
              </div>

              {actionMessage && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: actionMessage.type === "success" ? "#dcfce7" : "#fee2e2",
                    color: actionMessage.type === "success" ? "#15803d" : "#b91c1c",
                  }}
                >
                  {actionMessage.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{actionMessage.text}</span>
                </div>
              )}
            </div>

            <div className="adm-modal-footer">
              <button
                type="button"
                className="adm-btn-secondary"
                onClick={() => setSelectedUser(null)}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="adm-btn-primary"
                onClick={handleSaveRole}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
