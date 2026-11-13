import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Car,
  CheckCircle2,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Layers,
  Activity,
  ArrowRight,
} from "lucide-react";
import { operations, type OperationalSlot, type UsageReport } from "../../services/operations";
import { api } from "../../services/api";

export default function StaffDashboard() {
  const { selectedLotId } = useOutletContext<{ selectedLotId: string }>();
  const [data, setData] = useState<{
    slots: OperationalSlot[];
    usage: UsageReport;
    incidents: any[];
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let current = true;
    if (!selectedLotId) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");

    async function load() {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      try {
        const [slots, usage, incidents] = await Promise.all([
          operations.slots(selectedLotId),
          operations.summary(selectedLotId, from.toISOString(), new Date().toISOString()),
          api.getIncidents(selectedLotId),
        ]);
        if (current) {
          setData({ slots, usage, incidents: incidents.items || [] });
          setError("");
        }
      } catch (err) {
        if (current) {
          setData(null);
          setError(err instanceof Error ? err.message : "Không tải được dữ liệu vận hành.");
        }
      } finally {
        if (current) setLoading(false);
      }
    }

    load();
    const timer = setInterval(load, 15000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [selectedLotId]);

  if (!selectedLotId) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "rgba(255, 255, 255, 0.65)" }}>
        <Car size={48} style={{ opacity: 0.35, marginBottom: 12 }} />
        <h2 style={{ fontSize: 20, color: "#ffffff", fontWeight: 700, margin: "0 0 8px 0" }}>
          Tổng quan vận hành bãi đỗ
        </h2>
        <p style={{ fontSize: 14 }}>Vui lòng chọn cơ sở bãi đỗ được phân công ở thanh trên cùng để xem số liệu realtime.</p>
      </div>
    );
  }

  const availableCount = data ? data.slots.filter((s) => s.status === "AVAILABLE").length : 0;
  const maintenanceCount = data ? data.slots.filter((s) => s.operationalStatus === "MAINTENANCE").length : 0;
  const disabledCount = data ? data.slots.filter((s) => s.operationalStatus === "DISABLED").length : 0;
  const occupiedCount = data ? data.usage.occupied : 0;
  const totalSlots = data ? data.slots.length : 0;
  const occupancyPct = totalSlots > 0 ? Math.round((occupiedCount * 100) / totalSlots) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 12,
            padding: "12px 16px",
            color: "#fca5a5",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {/* Card 1: Ô khả dụng */}
        <div
          style={{
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderRadius: 18,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Ô đỗ khả dụng
            </span>
            <CheckCircle2 size={18} color="#34d399" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            {loading && !data ? "..." : availableCount}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>
            Trên tổng số {totalSlots} vị trí thiết kế
          </span>
        </div>

        {/* Card 2: Công suất hiện tại */}
        <div
          style={{
            background: "rgba(6, 182, 212, 0.12)",
            border: "1px solid rgba(6, 182, 212, 0.35)",
            borderRadius: 18,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Đang có xe ({occupancyPct}%)
            </span>
            <Car size={18} color="#38bdf8" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            {loading && !data ? "..." : `${occupiedCount} / ${totalSlots}`}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>
            Bảo trì: {maintenanceCount} · Khóa: {disabledCount}
          </span>
        </div>

        {/* Card 3: Lưu lượng hôm nay */}
        <div
          style={{
            background: "rgba(59, 130, 246, 0.12)",
            border: "1px solid rgba(59, 130, 246, 0.35)",
            borderRadius: 18,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Lưu lượng hôm nay
            </span>
            <Activity size={18} color="#60a5fa" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            {loading && !data ? "..." : `${data?.usage.entries ?? 0} / ${data?.usage.exits ?? 0}`}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", display: "flex", gap: 10 }}>
            <span><ArrowDownLeft size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Vào: {data?.usage.entries ?? 0}</span>
            <span><ArrowUpRight size={13} style={{ display: "inline", verticalAlign: "middle" }} /> Ra: {data?.usage.exits ?? 0}</span>
          </span>
        </div>

        {/* Card 4: Sự cố đang mở */}
        <div
          style={{
            background: "rgba(245, 158, 11, 0.12)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: 18,
            padding: "18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#fcd34d", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Sự cố cần lưu ý
            </span>
            <AlertTriangle size={18} color="#fbbf24" />
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.02em" }}>
            {loading && !data ? "..." : data?.incidents.length ?? 0}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>
            Bao gồm lệch biển số, lỗi cổng & ngoại lệ
          </span>
        </div>
      </div>

      {/* Quick Action Navigation Grid */}
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", margin: "10px 0 12px" }}>
          Truy cập nhanh chức năng trực ca
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          <Link
            to="/staff/operations"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(6, 182, 212, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                <Car size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Kiểm soát Vào / Ra xe</div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>Check-in & Check-out camera ANPR</div>
              </div>
            </div>
            <ArrowRight size={16} color="rgba(255, 255, 255, 0.4)" />
          </Link>

          <Link
            to="/staff/parking"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
                <Layers size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Mặt bằng Ô đỗ Realtime</div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>Sơ đồ 3D / 2D và trạng thái slot</div>
              </div>
            </div>
            <ArrowRight size={16} color="rgba(255, 255, 255, 0.4)" />
          </Link>

          <Link
            to="/staff/incidents"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(245, 158, 11, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24" }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Xử lý Sự cố & Ngoại lệ</div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>Báo cáo và theo dõi ticket sự cố</div>
              </div>
            </div>
            <ArrowRight size={16} color="rgba(255, 255, 255, 0.4)" />
          </Link>

          <Link
            to="/staff/shifts"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 18px",
              borderRadius: 14,
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              textDecoration: "none",
              transition: "all 0.2s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(168, 85, 247, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c084fc" }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Ca trực & Bàn giao</div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.55)" }}>Biên bản giao nhận ca và tiền mặt</div>
              </div>
            </div>
            <ArrowRight size={16} color="rgba(255, 255, 255, 0.4)" />
          </Link>
        </div>
      </div>

      {/* Recent Incidents Table / List */}
      {data && data.incidents.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", marginBottom: 12 }}>
            Sự cố phát sinh gần đây tại bãi
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.incidents.slice(0, 4).map((inc: any) => (
              <div
                key={inc.incidentId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: "rgba(15, 23, 42, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: inc.severity === "Critical" ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)",
                      color: inc.severity === "Critical" ? "#fca5a5" : "#fcd34d",
                    }}
                  >
                    {inc.severity}
                  </span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#ffffff" }}>{inc.title}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(255, 255, 255, 0.5)" }}>
                      Trạng thái: {inc.status} · Tạo lúc {new Date(inc.createdAt).toLocaleTimeString("vi-VN")}
                    </div>
                  </div>
                </div>
                <Link
                  to="/staff/incidents"
                  style={{
                    fontSize: 12,
                    color: "#38bdf8",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Xem chi tiết &gt;
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
