import { useState, useEffect } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Building2,
  MapPin,
  Compass,
  Search,
  CheckCircle2,
  Sliders,
  Eye,
} from "lucide-react";
import { api, type ParkingLot } from "../../services/api";

interface AdminOutletContext {
  refreshKey: number;
  onTriggerRefresh: () => void;
}

export default function AdminFacilitiesPage() {
  const { refreshKey, onTriggerRefresh } = useOutletContext<AdminOutletContext>();

  const [facilities, setFacilities] = useState<ParkingLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadLots() {
      setLoading(true);
      setError("");
      try {
        const data = await api.getParkingLots();
        if (mounted) setFacilities(data || []);
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Không tải được danh sách bãi đỗ xe.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadLots();
    return () => { mounted = false; };
  }, [refreshKey]);

  const filtered = facilities.filter(
    (f) =>
      f.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="adm-card">
        <div className="adm-card-header">
          <div className="adm-card-title-group">
            <h2 className="adm-card-title">
              <Building2 size={20} color="#0891b2" />
              Mạng Lưới Hạ Tầng Bãi Đỗ Xe (Multi-Parking Platform)
            </h2>
            <p className="adm-card-desc">
              Quản trị danh mục bãi đỗ xe tập trung trên toàn hệ thống. Tích hợp thuật toán định vị GPS Haversine, mô hình 3D Digital Twin và biểu phí riêng biệt.
            </p>
          </div>
          <button onClick={onTriggerRefresh} className="adm-btn-secondary">
            Làm mới
          </button>
        </div>

        {/* Search */}
        <div className="adm-filter-bar">
          <div className="adm-search-input-wrap">
            <Search size={16} className="adm-search-icon" />
            <input
              type="text"
              placeholder="Tìm kiếm bãi theo mã bãi, tên cơ sở hoặc địa chỉ..."
              className="adm-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--adm-muted)", fontWeight: 600 }}>
            Tổng cộng: <strong>{filtered.length}</strong> cơ sở
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px", background: "#fee2e2", color: "#b91c1c", borderRadius: "10px", fontSize: "0.85rem", marginBottom: "16px" }}>
            {error}
          </div>
        )}

        {/* Facilities Table */}
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Mã Bãi</th>
                <th>Tên Cơ Sở & Địa Chỉ</th>
                <th>Tọa Độ GPS</th>
                <th>Múi Giờ</th>
                <th>Trạng Thái Vận Hành</th>
                <th style={{ textAlign: "right" }}>Liên Kết Nghiệp Vụ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lot) => (
                <tr key={lot.id}>
                  <td>
                    <span
                      style={{
                        fontWeight: 800,
                        color: "var(--adm-cyan)",
                        background: "var(--adm-cyan-soft)",
                        padding: "4px 8px",
                        borderRadius: "6px",
                        fontSize: "0.85rem",
                      }}
                    >
                      {lot.code}
                    </span>
                  </td>
                  <td>
                    <div>
                      <strong style={{ fontSize: "0.95rem" }}>{lot.name}</strong>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--adm-muted)", fontSize: "0.8rem", marginTop: "2px" }}>
                        <MapPin size={12} />
                        <span>{lot.address}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: "monospace", fontSize: "0.82rem" }}>
                      <Compass size={13} color="var(--adm-muted)" />
                      <span>{lot.latitude?.toFixed(5)}, {lot.longitude?.toFixed(5)}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.82rem", color: "var(--adm-muted)" }}>
                      {lot.timezone || "Asia/Ho_Chi_Minh"}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#15803d", fontWeight: 700, fontSize: "0.8rem" }}>
                      <CheckCircle2 size={13} />
                      Đang Hoạt Động
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <Link
                        to={`/admin/map-3d/${lot.id}`}
                        className="adm-btn-secondary"
                        style={{ padding: "4px 9px", fontSize: "0.75rem" }}
                        title="Xem sơ đồ 3D Digital Twin độc lập của Admin"
                      >
                        <Eye size={12} />
                        <span>Xem 3D</span>
                      </Link>

                      <Link
                        to={`/admin/slots/${lot.id}`}
                        className="adm-btn-primary"
                        style={{ padding: "4px 9px", fontSize: "0.75rem" }}
                        title="Quản lý và can thiệp trạng thái ô đỗ trực tiếp"
                      >
                        <Sliders size={12} />
                        <span>Quản lý Slot</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--adm-muted)" }}>
                    Không tìm thấy bãi đỗ xe nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
