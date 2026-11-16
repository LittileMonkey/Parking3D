import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Server,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  ShieldCheck,
  Zap,
  Radio,
  Eye,
  Activity,
} from "lucide-react";

interface AdminOutletContext {
  refreshKey: number;
  onTriggerRefresh: () => void;
}

interface ServiceHealthData {
  service: string;
  dependencies: {
    identity: boolean;
    parking: boolean;
    payment: boolean;
    ai: boolean;
  };
}

export default function AdminServicesPage() {
  const { refreshKey } = useOutletContext<AdminOutletContext>();

  const [healthData, setHealthData] = useState<ServiceHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [error, setError] = useState("");

  const checkServices = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/health/ready");
      if (res.ok) {
        const json = await res.json();
        if (json.isSuccess && json.result) {
          setHealthData(json.result);
          setLastCheck(new Date().toLocaleTimeString("vi-VN"));
        } else {
          setError(json.message || "Kiểm tra tình trạng dịch vụ trả về thất bại.");
        }
      } else {
        setError(`Mã phản hồi Gateway: ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mất kết nối với Gateway /health/ready.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkServices();
  }, [refreshKey]);

  const deps = healthData?.dependencies || {
    identity: false,
    parking: false,
    payment: false,
    ai: false,
  };

  const servicesList = [
    {
      name: "API Gateway",
      role: "YARP Reverse Proxy & Rate Limiting",
      status: true,
      portHttp: 8080,
      portGrpc: null,
      db: null,
    },
    {
      name: "Parking Identity",
      role: "Xác thực JWT, RBAC & Quản lý nhân sự",
      status: deps.identity,
      portHttp: 5041,
      portGrpc: 5042,
      db: "parking_identity",
    },
    {
      name: "Parking Domain",
      role: "Sơ đồ 3D, Slot, Check-in/out & Đặt chỗ",
      status: deps.parking,
      portHttp: 8082,
      portGrpc: 8083,
      db: "parking_parking",
    },
    {
      name: "Parking Payment",
      role: "Cổng VNPay, Thu tiền mặt & Hóa đơn",
      status: deps.payment,
      portHttp: 8084,
      portGrpc: 8085,
      db: "parking_payment",
    },
    {
      name: "AI Vision Service",
      role: "Nhận diện biển số (OCR) & AI Trợ lý",
      status: deps.ai,
      portHttp: 5004,
      portGrpc: 5005,
      db: "parking_ai",
    },
  ];

  const onlineCount = servicesList.filter((s) => s.status).length;

  return (
    <div>
      {/* ── Top Summary Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "14px" }}>
        <div className="adm-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", color: "#0284c7" }}>
            <Server size={18} />
          </div>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase" }}>TỔNG MICROSERVICES</span>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--adm-navy)" }}>{onlineCount} / {servicesList.length} Online</div>
          </div>
        </div>

        <div className="adm-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
            <Activity size={18} />
          </div>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase" }}>GATEWAY ROUTE</span>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "#15803d" }}>Port :8080 (YARP)</div>
          </div>
        </div>

        <div className="adm-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", color: "#059669" }}>
            <Database size={18} />
          </div>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase" }}>CƠ SỞ DỮ LIỆU</span>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: "var(--adm-navy)" }}>4 DB Schemas</div>
          </div>
        </div>

        <div className="adm-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", color: "#d97706" }}>
            <Eye size={18} />
          </div>
          <div>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase" }}>AI VISION OCR</span>
            <div style={{ fontSize: "1.15rem", fontWeight: 800, color: deps.ai ? "#15803d" : "#b45309" }}>{deps.ai ? "Sẵn sàng" : "Port :5004"}</div>
          </div>
        </div>
      </div>

      {/* ── Main Clean Table ── */}
      <div className="adm-card">
        <div className="adm-card-header" style={{ padding: "12px 18px", borderBottom: "1px solid var(--adm-border-subtle)" }}>
          <div className="adm-card-title-group">
            <h2 className="adm-card-title" style={{ fontSize: "1rem" }}>
              <Server size={18} color="#0284c7" />
              Tình Trạng Cụm Dịch Vụ Microservices & AI Vision
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
              {lastCheck ? (
                <span style={{ fontSize: "0.74rem", color: "var(--adm-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Radio size={12} color="#10b981" />
                  Lần kiểm tra gần nhất: <strong>{lastCheck}</strong>
                </span>
              ) : (
                <span style={{ fontSize: "0.74rem", color: "var(--adm-muted)" }}>Kiểm tra trạng thái thời gian thực</span>
              )}
            </div>
          </div>
          <button onClick={checkServices} className="adm-btn-primary" disabled={loading} style={{ padding: "6px 12px", fontSize: "0.76rem" }}>
            <RefreshCw size={13} className={loading ? "adm-spin" : ""} />
            <span>{loading ? "Đang kiểm tra..." : "Kiểm tra kết nối lại"}</span>
          </button>
        </div>

        {error && (
          <div style={{ margin: "14px", padding: "10px 14px", background: "#fee2e2", color: "#b91c1c", borderRadius: "8px", fontSize: "0.78rem" }}>
            {error}
          </div>
        )}

        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Dịch Vụ</th>
                <th>Vai Trò Nghiệp Vụ</th>
                <th>Cổng Kết Nối</th>
                <th>Cơ Sở Dữ Liệu</th>
                <th style={{ textAlign: "right" }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {servicesList.map((svc) => (
                <tr key={svc.name}>
                  <td>
                    <strong style={{ fontSize: "0.86rem", color: "var(--adm-navy)" }}>{svc.name}</strong>
                  </td>
                  <td>
                    <span style={{ fontSize: "0.78rem", color: "var(--adm-muted)" }}>{svc.role}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.74rem", color: "#0369a1", background: "#e0f2fe", padding: "2px 6px", borderRadius: "4px" }}>
                        HTTP :{svc.portHttp}
                      </span>
                      {svc.portGrpc && (
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "0.74rem", color: "#0891b2", background: "#ecfeff", padding: "2px 6px", borderRadius: "4px" }}>
                          gRPC :{svc.portGrpc}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {svc.db ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "0.78rem", color: "var(--adm-navy)" }}>
                        <Database size={12} color="var(--adm-muted)" />
                        <code>{svc.db}</code>
                      </span>
                    ) : (
                      <span style={{ color: "var(--adm-muted)", fontSize: "0.75rem" }}>— Stateless</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        background: svc.status ? "#dcfce7" : "#fee2e2",
                        color: svc.status ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {svc.status ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {svc.status ? "ONLINE (200)" : "OFFLINE"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Compact Architecture Status Bar ── */}
      <div
        className="adm-card"
        style={{
          padding: "12px 18px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: "12px",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Zap size={16} color="#0284c7" />
          <div style={{ fontSize: "0.76rem" }}>
            <strong style={{ color: "var(--adm-navy)" }}>Advisory Lock Engine: </strong>
            <span style={{ color: "var(--adm-muted)" }}>Chống overbooking qua <code>pg_advisory_xact_lock</code></span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Radio size={16} color="#10b981" />
          <div style={{ fontSize: "0.76rem" }}>
            <strong style={{ color: "var(--adm-navy)" }}>SignalR Realtime: </strong>
            <span style={{ color: "var(--adm-muted)" }}>Đồng bộ trạng thái ô đỗ tức thời trên sơ đồ 3D</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck size={16} color="#059669" />
          <div style={{ fontSize: "0.76rem" }}>
            <strong style={{ color: "var(--adm-navy)" }}>Facility-Scoped RBAC: </strong>
            <span style={{ color: "var(--adm-muted)" }}>Phân quyền theo phạm vi cơ sở bãi đỗ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
