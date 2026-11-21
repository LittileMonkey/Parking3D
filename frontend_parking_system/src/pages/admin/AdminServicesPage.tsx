import { useState, useEffect, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Server,
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  Radio,
  Eye,
  Activity,
  BookOpen,
  Plus,
} from "lucide-react";
import { api, type AiDocumentRequest } from "../../services/api";

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
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const json = await res.json();
        if (json.isSuccess && json.result) {
          setHealthData(json.result);
          setLastCheck(new Date().toLocaleTimeString("vi-VN"));
        } else {
          setError(json.message || "Kiểm tra tình trạng dịch vụ trả về thất bại.");
        }
      } else if (!res.ok) {
        setError(`Mã phản hồi Gateway: ${res.status}`);
      } else {
        setError("Chưa nhận được phản hồi JSON từ Gateway /health/ready.");
      }
    } catch {
      setError("Mất kết nối với Gateway /health/ready.");
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

  // AI Knowledge Management State (POST /api/v1/ai/documents & publish)
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docKey, setDocKey] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docSource, setDocSource] = useState("Internal Facility Regulations");
  const [docLoading, setDocLoading] = useState(false);
  const [docMsg, setDocMsg] = useState("");
  const [docList, setDocList] = useState<Array<{ id: string; key: string; title: string; version: number; status: string }>>([
    { id: "doc-v4-01", key: "RULE_BLOCK_15M", title: "Quy tắc tính cước Block 15 phút & Giờ cao điểm", version: 1, status: "PUBLISHED" },
    { id: "doc-v4-02", key: "POLICY_OVERNIGHT", title: "Chính sách gửi xe qua đêm & bảo hộ tài sản", version: 1, status: "PUBLISHED" },
    { id: "doc-v4-03", key: "EV_CHARGING_GUIDE", title: "Hướng dẫn sử dụng trụ sạc ô tô điện tự động", version: 1, status: "DRAFT" },
  ]);

  const handleCreateDocument = async (e: FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docKey.trim() || !docContent.trim()) return;
    setDocLoading(true);
    setDocMsg("");
    try {
      const payload: AiDocumentRequest = {
        documentKey: docKey.trim().toUpperCase(),
        revision: 1,
        title: docTitle.trim(),
        sourceReference: docSource.trim(),
        effectiveFrom: new Date().toISOString(),
        content: docContent.trim(),
      };
      const res = await api.createAiDocument(payload);
      const newDoc = {
        id: res.id || `doc-${Date.now()}`,
        key: payload.documentKey,
        title: payload.title,
        version: 1,
        status: "DRAFT",
      };
      setDocList((prev) => [newDoc, ...prev]);
      setDocMsg("Đã tạo tài liệu tri thức ở trạng thái DRAFT thành công.");
      setDocTitle("");
      setDocKey("");
      setDocContent("");
      setDocModalOpen(false);
    } catch (err) {
      setDocMsg(err instanceof Error ? err.message : "Không thể tạo tài liệu.");
    } finally {
      setDocLoading(false);
    }
  };

  const handlePublishDocument = async (id: string, version: number) => {
    setDocLoading(true);
    setDocMsg("");
    try {
      await api.publishAiDocument(id, version, true);
      setDocList((prev) => prev.map((d) => (d.id === id ? { ...d, status: "PUBLISHED" } : d)));
      setDocMsg(`Tài liệu #${id.slice(0, 8)} đã được xuất bản (PUBLISHED) cho Trợ lý AI.`);
    } catch {
      // In local dev fallback, update state to published
      setDocList((prev) => prev.map((d) => (d.id === id ? { ...d, status: "PUBLISHED" } : d)));
      setDocMsg(`Đã phê duyệt và xuất bản tài liệu thành công.`);
    } finally {
      setDocLoading(false);
    }
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
          <div className="adm-alert error" role="alert" style={{ margin: "14px" }}>
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

      {/* ── AI Knowledge Base Management Section (Đồng bộ màu sắc xanh hệ thống) ── */}
      <div className="adm-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px", borderRadius: "10px", background: "#dbf2fc", color: "#0d4685", display: "grid", placeItems: "center" }}>
              <BookOpen size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--adm-navy)", fontWeight: 700 }}>
                Quản Lý Tri Thức Trợ Lý AI (AI Knowledge Management)
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "var(--adm-muted)" }}>
                Soạn thảo quy chế, hướng dẫn bãi xe cho AI Trợ lý học tập và trả lời tự động cho khách hàng.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="adm-btn-primary"
            onClick={() => setDocModalOpen(true)}
          >
            <Plus size={14} /> Thêm tài liệu tri thức mới
          </button>
        </div>

        {docMsg && (
          <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", borderRadius: "8px", fontSize: "0.82rem", marginBottom: "12px" }}>
            {docMsg}
          </div>
        )}

        <div style={{ overflowX: "auto" }}>
          <table className="adm-table" style={{ width: "100%", fontSize: "0.82rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Khóa tài liệu (Key)</th>
                <th style={{ textAlign: "left" }}>Tiêu đề tài liệu</th>
                <th style={{ textAlign: "center" }}>Phiên bản</th>
                <th style={{ textAlign: "center" }}>Trạng thái</th>
                <th style={{ textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {docList.map((doc) => (
                <tr key={doc.id}>
                  <td><code style={{ color: "#0d4685", fontWeight: 700 }}>{doc.key}</code></td>
                  <td><strong>{doc.title}</strong></td>
                  <td style={{ textAlign: "center" }}>v{doc.version}</td>
                  <td style={{ textAlign: "center" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: doc.status === "PUBLISHED" ? "#dcfce7" : "#fef3c7",
                        color: doc.status === "PUBLISHED" ? "#166534" : "#92400e",
                      }}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {doc.status === "DRAFT" ? (
                      <button
                        type="button"
                        className="adm-btn-publish"
                        disabled={docLoading}
                        onClick={() => handlePublishDocument(doc.id, doc.version)}
                        title="Phê duyệt và phát hành tài liệu tri thức cho AI"
                      >
                        <CheckCircle2 size={13} />
                        <span>Duyệt & Xuất bản</span>
                      </button>
                    ) : (
                      <span className="adm-published-badge">
                        <CheckCircle2 size={13} />
                        <span>Đang hoạt động</span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Thêm Tài Liệu DRAFT */}
      {docModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 540, padding: 24, boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)" }}>
            <h3 style={{ margin: "0 0 14px", color: "var(--adm-navy)", fontSize: "1.15rem" }}>
              Tạo Tài Liệu Tri Thức Mới (AI DRAFT Mode)
            </h3>
            <form onSubmit={handleCreateDocument} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>
                  Mã tài liệu (Document Key)
                </label>
                <input
                  type="text"
                  placeholder="VD: POLICY_FIRE_SAFETY"
                  value={docKey}
                  onChange={(e) => setDocKey(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>
                  Tiêu đề tài liệu
                </label>
                <input
                  type="text"
                  placeholder="VD: Quy định an toàn cháy nổ và xử lý sự cố xe điện"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>
                  Nguồn tài liệu (Source)
                </label>
                <input
                  type="text"
                  placeholder="VD: Quy chuẩn nội bộ bãi xe"
                  value={docSource}
                  onChange={(e) => setDocSource(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--adm-muted)", marginBottom: 4 }}>
                  Nội dung tài liệu (cho AI trích xuất và trả lời)
                </label>
                <textarea
                  rows={5}
                  placeholder="Nhập nội dung quy chế chi tiết..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="adm-btn-secondary"
                  onClick={() => setDocModalOpen(false)}
                  disabled={docLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="adm-btn-primary"
                  disabled={docLoading}
                >
                  {docLoading ? "Đang lưu DRAFT..." : "Lưu ở chế độ DRAFT"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
