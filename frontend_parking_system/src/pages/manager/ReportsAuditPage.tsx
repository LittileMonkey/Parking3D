import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Download,
  Search,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  FileDown,
  Database,
  Lock,
} from "lucide-react";
import FacilityRbacStrip from "../../components/manager/FacilityRbacStrip";
import { managerApi } from "../../services/manager/managerApi";
import type {
  AuditLogEntry,
  AuditActionType,
  ReportExportRequest,
} from "../../types/manager";

interface OutletContextType {
  selectedLotId: string;
}

export default function ReportsAuditPage() {
  const { selectedLotId } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadLogs() {
      setLoading(true);
      try {
        const res = await managerApi.getAuditLogs(selectedLotId || "PKM-METRO-01", actionFilter);
        if (res.isSuccess && res.result) {
          setLogs(res.result);
        }
      } catch (err) {
        console.error("Load audit logs error", err);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, [selectedLotId, actionFilter]);

  const handleExport = async (reportType: ReportExportRequest["reportType"], format: "pdf" | "excel" | "csv") => {
    const key = `${reportType}-${format}`;
    setExporting(key);
    try {
      const res = await managerApi.exportReport({
        reportType,
        format,
        dateRange: "today",
        parkingLotId: selectedLotId || "PKM-METRO-01",
      });
      if (res.isSuccess) {
        setExportNotice(res.message);
        setTimeout(() => setExportNotice(null), 5000);
      }
    } catch (err) {
      console.error("Export report error", err);
    } finally {
      setExporting(null);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.id.toLowerCase().includes(q) ||
      log.operatorName.toLowerCase().includes(q) ||
      log.targetEntity.toLowerCase().includes(q) ||
      log.justificationNote.toLowerCase().includes(q) ||
      log.actionType.toLowerCase().includes(q)
    );
  });

  const getActionTypeBadge = (action: AuditActionType) => {
    switch (action) {
      case "PRICE_UPDATE":
        return <span className="pm-badge pm-badge-info">PRICE_UPDATE</span>;
      case "SLOT_OVERRIDE":
        return <span className="pm-badge pm-badge-warning">SLOT_OVERRIDE</span>;
      case "SHIFT_APPROVAL":
        return <span className="pm-badge pm-badge-success">SHIFT_APPROVAL</span>;
      case "BARRIER_OVERRIDE":
        return <span className="pm-badge pm-badge-danger">BARRIER_OVERRIDE</span>;
      case "REFUND_APPROVED":
        return <span className="pm-badge pm-badge-info">REFUND_APPROVED</span>;
      case "DISCREPANCY_FLAGGED":
        return <span className="pm-badge pm-badge-warning">DISCREPANCY_FLAGGED</span>;
      default:
        return <span className="pm-badge pm-badge-neutral">{action}</span>;
    }
  };

  return (
    <div className="pm-module-page">
      <FacilityRbacStrip
        parkingLotId={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        facilityName="Metropolis Central Hub"
        facilityCode={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        moduleTitle="Reports & Append-Only Audit Logs"
        moduleDescription="Truy xuất báo cáo tài chính & Nhật ký kiểm toán bất biến theo tiêu chuẩn an toàn bảo mật"
      />

      {exportNotice && (
        <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", borderRadius: 12, padding: "12px 18px", color: "#34d399", display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle2 size={18} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Report Exporter Widget */}
      <div className="pm-glass-card">
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <Download size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Trung Tâm Kết Xuất Báo Cáo Định Kỳ</h2>
              <span className="pm-card-subtitle">Xuất file nhanh chuẩn PDF và Excel phục vụ kế toán & thanh tra</span>
            </div>
          </div>
          <span className="pm-badge pm-badge-info">
            <Lock size={11} /> Ký số bảo mật SHA-256
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {/* Card 1: Daily Revenue */}
          <div style={{ background: "rgba(17, 24, 39, 0.6)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileSpreadsheet size={20} style={{ color: "#34d399" }} />
              <div>
                <strong style={{ color: "#ffffff", fontSize: 14 }}>Báo Cáo Doanh Thu Ngày</strong>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Phân tách tiền mặt vs VietQR, block 15m</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <button
                type="button"
                className="pm-btn-outline"
                style={{ flex: 1, padding: "7px 10px", fontSize: 11, justifyContent: "center" }}
                disabled={exporting === "daily_revenue-pdf"}
                onClick={() => handleExport("daily_revenue", "pdf")}
              >
                <FileDown size={13} /> {exporting === "daily_revenue-pdf" ? "Đang xuất..." : "PDF"}
              </button>
              <button
                type="button"
                className="pm-btn-primary"
                style={{ flex: 1, padding: "7px 10px", fontSize: 11, justifyContent: "center" }}
                disabled={exporting === "daily_revenue-excel"}
                onClick={() => handleExport("daily_revenue", "excel")}
              >
                <FileSpreadsheet size={13} /> {exporting === "daily_revenue-excel" ? "Đang xuất..." : "Excel (XLSX)"}
              </button>
            </div>
          </div>

          {/* Card 2: Traffic & Occupancy */}
          <div style={{ background: "rgba(17, 24, 39, 0.6)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileSpreadsheet size={20} style={{ color: "#38bdf8" }} />
              <div>
                <strong style={{ color: "#ffffff", fontSize: 14 }}>Lưu Lượng & Tỷ Lệ Lấp Đầy</strong>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Phân tích giờ cao điểm, xe ra vào tuần</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <button
                type="button"
                className="pm-btn-outline"
                style={{ flex: 1, padding: "7px 10px", fontSize: 11, justifyContent: "center" }}
                disabled={exporting === "weekly_traffic-pdf"}
                onClick={() => handleExport("weekly_traffic", "pdf")}
              >
                <FileDown size={13} /> {exporting === "weekly_traffic-pdf" ? "Đang xuất..." : "PDF"}
              </button>
              <button
                type="button"
                className="pm-btn-primary"
                style={{ flex: 1, padding: "7px 10px", fontSize: 11, justifyContent: "center" }}
                disabled={exporting === "weekly_traffic-excel"}
                onClick={() => handleExport("weekly_traffic", "excel")}
              >
                <FileSpreadsheet size={13} /> {exporting === "weekly_traffic-excel" ? "Đang xuất..." : "Excel (XLSX)"}
              </button>
            </div>
          </div>

          {/* Card 3: Cash Reconciliation */}
          <div style={{ background: "rgba(17, 24, 39, 0.6)", borderRadius: 14, padding: 16, border: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <FileSpreadsheet size={20} style={{ color: "#fbbf24" }} />
              <div>
                <strong style={{ color: "#ffffff", fontSize: 14 }}>Đối Soát Két Tiền Mặt Thu Ngân</strong>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>Biên bản bàn giao ca trực & chênh lệch</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <button
                type="button"
                className="pm-btn-outline"
                style={{ flex: 1, padding: "7px 10px", fontSize: 11, justifyContent: "center" }}
                disabled={exporting === "cash_reconciliation-pdf"}
                onClick={() => handleExport("cash_reconciliation", "pdf")}
              >
                <FileDown size={13} /> {exporting === "cash_reconciliation-pdf" ? "Đang xuất..." : "PDF"}
              </button>
              <button
                type="button"
                className="pm-btn-primary"
                style={{ flex: 1, padding: "7px 10px", fontSize: 11, justifyContent: "center" }}
                disabled={exporting === "cash_reconciliation-excel"}
                onClick={() => handleExport("cash_reconciliation", "excel")}
              >
                <FileSpreadsheet size={13} /> {exporting === "cash_reconciliation-excel" ? "Đang xuất..." : "Excel (XLSX)"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filterable Audit Log Data Table */}
      <div className="pm-glass-card">
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <Database size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Nhật Ký Kiểm Toán Bất Biến (Append-Only Audit Trail)</h2>
              <span className="pm-card-subtitle">Ghi nhận toàn bộ thao tác can thiệp hệ thống với dấu thời gian UTC và IP</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 260 }}>
            <div style={{ position: "relative", width: "100%", maxWidth: 380 }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                className="pm-form-input"
                style={{ paddingLeft: 34 }}
                placeholder="Tìm mã log, người thao tác, đối tượng, lý do..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Filter size={14} style={{ color: "#94a3b8" }} />
            <select
              className="pm-form-select"
              style={{ width: "auto" }}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="ALL">Tất cả loại hành động</option>
              <option value="PRICE_UPDATE">Cập nhật biểu phí (PRICE_UPDATE)</option>
              <option value="SLOT_OVERRIDE">Ghi đè ô đỗ (SLOT_OVERRIDE)</option>
              <option value="SHIFT_APPROVAL">Duyệt ca trực (SHIFT_APPROVAL)</option>
              <option value="BARRIER_OVERRIDE">Mở barrier khẩn cấp (BARRIER_OVERRIDE)</option>
              <option value="REFUND_APPROVED">Hoàn phí (REFUND_APPROVED)</option>
              <option value="DISCREPANCY_FLAGGED">Báo sai lệch (DISCREPANCY_FLAGGED)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Đang tải nhật ký kiểm toán…</div>
        ) : (
        <div className="pm-table-wrapper">
          <table className="pm-data-table">
            <thead>
              <tr>
                <th>Mã Audit</th>
                <th>Thời Gian (UTC)</th>
                <th>Người Thực Hiện</th>
                <th>Hành Động</th>
                <th>Đối Tượng Tác Động</th>
                <th>Căn Cứ / Lý Do Can Thiệp (Justification)</th>
                <th>Địa Chỉ IP</th>
                <th>Trạng Thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontWeight: 700, color: "#00f2fe", fontFamily: "monospace" }}>{log.id}</td>
                  <td style={{ fontSize: 11, color: "#94a3b8" }}>{log.timestampUtc.replace("T", " ").replace("Z", "")}</td>
                  <td>
                    <div style={{ color: "#ffffff", fontWeight: 600 }}>{log.operatorName}</div>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>{log.operatorRole}</span>
                  </td>
                  <td>{getActionTypeBadge(log.actionType)}</td>
                  <td style={{ fontWeight: 600, color: "#a8cdd0" }}>{log.targetEntity}</td>
                  <td style={{ fontSize: 12, maxWidth: 320, lineHeight: 1.4 }}>{log.justificationNote}</td>
                  <td style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>{log.ipAddress}</td>
                  <td>
                    <span className={`pm-badge ${log.status === "SUCCESS" ? "pm-badge-success" : "pm-badge-warning"}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  );
}
