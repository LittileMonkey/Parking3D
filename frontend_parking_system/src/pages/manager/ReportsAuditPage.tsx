import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Calendar,
  Download,
  FileText,
  DollarSign,
  Clock,
  ShieldCheck,
  Filter,
  RefreshCw,
  AlertCircle,
  Car,
} from "lucide-react";
import { operations, type OperationAudit, type RevenueReport, type UsageReport } from "../../services/operations";

interface OutletContextType {
  selectedLotId: string;
  period?: string;
  setPeriod?: (p: any) => void;
  refreshKey?: number;
}

export default function ReportsAuditPage() {
  const { selectedLotId, refreshKey } = useOutletContext<OutletContextType>();
  const todayStr = new Date().toLocaleDateString("en-CA");

  const [from, setFrom] = useState(todayStr);
  const [until, setUntil] = useState(todayStr);
  const [data, setData] = useState<{ revenue: RevenueReport; usage: UsageReport; audit: OperationAudit[] } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState("ALL");

  // Quick period helper
  const handleQuickPeriod = (days: number) => {
    const end = new Date();
    const start = new Date();
    if (days > 0) {
      start.setDate(end.getDate() - (days - 1));
    }
    setFrom(start.toLocaleDateString("en-CA"));
    setUntil(end.toLocaleDateString("en-CA"));
  };

  useEffect(() => {
    let current = true;
    setData(null);
    setError("");

    if (!selectedLotId || selectedLotId === "all") {
      return;
    }

    const begin = new Date(from + "T00:00:00");
    const end = new Date(until + "T00:00:00");
    end.setDate(end.getDate() + 1);

    if (!Number.isFinite(begin.getTime()) || !Number.isFinite(end.getTime()) || end <= begin) {
      setError("Khoảng thời gian không hợp lệ. Vui lòng kiểm tra lại ngày bắt đầu và kết thúc.");
      return;
    }

    setLoading(true);
    const args = [selectedLotId, begin.toISOString(), end.toISOString()] as const;

    Promise.all([operations.revenue(...args), operations.usage(...args), operations.audit(...args)])
      .then(([revenue, usage, audit]) => {
        if (current) setData({ revenue, usage, audit });
      })
      .catch((err) => {
        if (current) setError(err.message || "Không thể tải báo cáo từ máy chủ.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });

    return () => {
      current = false;
    };
  }, [selectedLotId, from, until, refreshKey]);

  function handleDownloadCsv() {
    if (!data) return;
    const rows: unknown[][] = [
      ["Báo cáo vận hành bãi đỗ xe ParkMatrix", ""],
      ["Mã cơ sở", selectedLotId],
      ["Từ ngày", from],
      ["Đến hết ngày", until],
      ["Thời điểm xuất file", new Date().toLocaleString("vi-VN")],
      [],
      ["CHỈ SỐ DOANH THU & LƯU LƯỢNG", "GIÁ TRỊ"],
      ["Đơn vị tiền tệ", data.revenue.currency],
      ["Tổng doanh thu gộp (Gross)", data.revenue.gross],
      ["Thu tiền mặt (Cash)", data.revenue.cash],
      ["Thu điện tử (Digital / QR)", data.revenue.digital],
      ["Tổng hoàn tiền (Refunds)", data.revenue.refunds],
      ["Thu ròng thực tế (Net Revenue)", data.revenue.net],
      ["Tổng lượt xe vào (Entries)", data.usage.entries],
      ["Tổng lượt xe ra (Exits)", data.usage.exits],
      ["Thời gian đỗ trung bình (phút)", Math.round(data.usage.averageDurationMinutes)],
      [],
      ["NHẬT KÝ KIỂM TOÁN THAY ĐỔI (AUDIT TRAIL)", "", "", "", ""],
      ["Thời gian (UTC)", "Người thao tác", "Hành động (Action)", "Đối tượng (Target)", "Lý do can thiệp (Justification Note)"],
      ...data.audit.map((item) => [
        item.timestampUtc,
        item.operatorId ?? item.operatorRole,
        item.actionType,
        item.targetEntity,
        item.justificationNote ?? "",
      ]),
    ];

    const cell = (value: unknown) => {
      let text = String(value ?? "");
      if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"', '""') + '"';
    };

    const csvContent = "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ParkMatrix-Report-${selectedLotId}-${from}-${until}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Filtered audit list
  const filteredAudit = useMemo(() => {
    if (!data?.audit) return [];
    if (actionFilter === "ALL") return data.audit;
    return data.audit.filter((item) => item.actionType.toUpperCase().includes(actionFilter.toUpperCase()));
  }, [data?.audit, actionFilter]);

  const getActionBadgeClass = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("OVERRIDE") || act.includes("LOCK") || act.includes("MAINTENANCE")) {
      return "pm-badge danger";
    }
    if (act.includes("PRICE") || act.includes("RATE")) {
      return "pm-badge warning";
    }
    if (act.includes("ASSIGN") || act.includes("STAFF")) {
      return "pm-badge info";
    }
    return "pm-badge success";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* ── 1. Date Range & Filter Card ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="pm-card-title-group">
            <div className="pm-card-icon">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="pm-card-h3">Khoảng Thời Gian Báo Cáo & Đối Soát</h3>
              <span className="pm-card-sub">Dữ liệu tài chính, lưu lượng xe vào ra và kiểm toán theo múi giờ trình duyệt</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="pm-period-pills">
              <button
                type="button"
                className={`pm-period-btn ${from === todayStr && until === todayStr ? "active" : ""}`}
                onClick={() => handleQuickPeriod(1)}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className="pm-period-btn"
                onClick={() => handleQuickPeriod(7)}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                className="pm-period-btn"
                onClick={() => handleQuickPeriod(30)}
              >
                30 ngày qua
              </button>
            </div>

            <button
              type="button"
              className="pm-btn pm-btn-primary"
              disabled={!data || loading}
              onClick={handleDownloadCsv}
              style={{ height: 38, padding: "0 16px" }}
              title="Tải tệp CSV đối soát kế toán"
            >
              <Download size={14} />
              <span>Xuất Báo Cáo CSV</span>
            </button>
          </div>
        </div>

        {/* Date Inputs Form */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div className="pm-form-group" style={{ marginBottom: 0 }}>
            <label className="pm-label" htmlFor="report-from-date">
              Từ ngày:
            </label>
            <input
              id="report-from-date"
              type="date"
              className="pm-input-date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="pm-form-group" style={{ marginBottom: 0 }}>
            <label className="pm-label" htmlFor="report-until-date">
              Đến hết ngày:
            </label>
            <input
              id="report-until-date"
              type="date"
              className="pm-input-date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </div>
        </div>

        {(!selectedLotId || selectedLotId === "all") && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#edf7fd",
              border: "1px solid rgba(13, 70, 133, 0.2)",
              borderRadius: 12,
              color: "var(--pm-blue)",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertCircle size={16} />
            <span>Vui lòng chọn một cơ sở bãi đỗ cụ thể ở thanh điều khiển phía trên để xem chi tiết báo cáo và nhật ký audit.</span>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#fee2e2",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: 12,
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            role="alert"
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── 2. Summary KPI Metrics Grid ── */}
      {data && (
        <div className="pm-stat-grid">
          {/* KPI 1: Thu ròng kỳ này */}
          <div className="pm-stat-card">
            <div className="pm-stat-top">
              <span className="pm-stat-label">Thu ròng kỳ này</span>
              <span className="pm-stat-pill mint">
                <DollarSign size={11} /> {data.revenue.currency}
              </span>
            </div>
            <div className="pm-stat-val">
              {data.revenue.net.toLocaleString("vi-VN")}
              <span style={{ fontSize: 18, color: "var(--pm-muted)", fontWeight: 500 }}> ₫</span>
            </div>
            <div className="pm-stat-foot" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span>Tiền mặt: <strong>{data.revenue.cash.toLocaleString("vi-VN")} ₫</strong></span>
              <span>•</span>
              <span>Điện tử: <strong>{data.revenue.digital.toLocaleString("vi-VN")} ₫</strong></span>
              {data.revenue.refunds > 0 && (
                <span style={{ color: "var(--pm-rose)", width: "100%", marginTop: 4 }}>
                  Hoàn tiền: -{data.revenue.refunds.toLocaleString("vi-VN")} ₫
                </span>
              )}
            </div>
          </div>

          {/* KPI 2: Lưu lượng xe */}
          <div className="pm-stat-card">
            <div className="pm-stat-top">
              <span className="pm-stat-label">Lưu lượng đỗ xe</span>
              <span className="pm-stat-pill blue">
                <Car size={11} /> Giao dịch
              </span>
            </div>
            <div className="pm-stat-val">
              {data.usage.entries + data.usage.exits}
              <span style={{ fontSize: 18, color: "var(--pm-muted)", fontWeight: 500 }}> lượt</span>
            </div>
            <div className="pm-stat-foot" style={{ justifyContent: "space-between" }}>
              <span>Lượt vào: <strong style={{ color: "#10b981" }}>+{data.usage.entries}</strong></span>
              <span>•</span>
              <span>Lượt ra: <strong style={{ color: "var(--pm-blue)" }}>-{data.usage.exits}</strong></span>
            </div>
          </div>

          {/* KPI 3: Thời gian đỗ trung bình */}
          <div className="pm-stat-card">
            <div className="pm-stat-top">
              <span className="pm-stat-label">Thời gian đỗ trung bình</span>
              <span className="pm-stat-pill amber">
                <Clock size={11} /> Block: 15p
              </span>
            </div>
            <div className="pm-stat-val">
              {Math.round(data.usage.averageDurationMinutes)}
              <span style={{ fontSize: 18, color: "var(--pm-muted)", fontWeight: 500 }}> phút/lượt</span>
            </div>
            <div className="pm-stat-foot">
              <span style={{ color: "#10b981", fontWeight: 600 }}>Hiệu suất cao</span>
              <span>• Hệ số quay vòng ô đỗ ổn định</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="pm-card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <RefreshCw size={24} className="spin-animation" style={{ color: "var(--pm-blue)", margin: "0 auto 12px" }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--pm-muted)" }}>
            Đang truy xuất dữ liệu doanh thu và nhật ký kiểm toán từ máy chủ…
          </p>
        </div>
      )}

      {/* ── 3. Audit Trail Table Card ── */}
      {data && !loading && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon" style={{ background: "#fef3c7", color: "#b45309" }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">
                  Nhật Ký Kiểm Toán Thay Đổi ({filteredAudit.length} sự kiện)
                </h3>
                <span className="pm-card-sub">
                  Ghi lại toàn bộ can thiệp: đổi biểu giá, phân công nhân sự, can thiệp trạng thái ô đỗ và phê duyệt ngoại lệ
                </span>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Filter size={14} style={{ color: "var(--pm-muted)" }} />
              <select
                className="pm-select-light"
                style={{ height: 36, fontSize: 12 }}
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                aria-label="Lọc theo loại hành động"
              >
                <option value="ALL">Tất cả hành động</option>
                <option value="PRICE">Thay đổi giá & chính sách</option>
                <option value="SLOT">Can thiệp ô đỗ / Khóa bảo trì</option>
                <option value="STAFF">Phân công / Thu hồi nhân sự</option>
                <option value="OVERRIDE">Phê duyệt ngoại lệ</option>
              </select>
            </div>
          </div>

          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Thời Điểm</th>
                  <th>Người Thao Tác</th>
                  <th>Hành Động</th>
                  <th>Đối Tượng</th>
                  <th>Lý Do Can Thiệp (Audit Note)</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudit.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "48px 20px", color: "var(--pm-muted)" }}>
                      <FileText size={32} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                      <div style={{ fontWeight: 600, fontSize: 14 }}>Không có sự kiện audit nào trong khoảng thời gian đã chọn</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>Mọi thay đổi chính sách hoặc can thiệp bãi đỗ sẽ tự động lưu vết tại đây.</div>
                    </td>
                  </tr>
                ) : (
                  filteredAudit.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>
                        {new Date(item.timestampUtc).toLocaleString("vi-VN")}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{item.operatorId ?? item.operatorRole}</span>
                      </td>
                      <td>
                        <span className={getActionBadgeClass(item.actionType)}>
                          {item.actionType}
                        </span>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {item.targetEntity}
                      </td>
                      <td style={{ color: item.justificationNote ? "var(--pm-navy)" : "var(--pm-muted)" }}>
                        {item.justificationNote || "— Không có ghi chú —"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
