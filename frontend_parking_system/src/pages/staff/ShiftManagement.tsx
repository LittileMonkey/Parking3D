import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Clock,
  UserCheck,
  CheckCircle2,
  ArrowDownLeft,
  FileText,
  ShieldCheck,
  Send,
  DollarSign,
  Printer,
} from "lucide-react";
import { staffApi } from "../../services/staff/staffApi";
import type { ShiftInfo, HandoverPayload } from "../../types/staff";

export default function ShiftManagement() {
  const { selectedLotId } = useOutletContext<{ selectedLotId?: string }>() || {};

  const [shift, setShift] = useState<ShiftInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Handover form state
  const [completedTasks, setCompletedTasks] = useState(
    "Đã hoàn thành kiểm tra làn xe vào/ra ca sáng, vệ sinh đầu đọc thẻ cổng G1, đối soát doanh thu tiền mặt.",
  );
  const [unresolvedIssues, setUnresolvedIssues] = useState(
    "Cần theo dõi thêm motor giảm tốc barrier cổng G1; kiểm tra ô B1-A12 nếu xe 51F-123.45 lùi ra.",
  );
  const [equipmentStatus] = useState("Thiết bị hoạt động bình thường");
  const [notesForNext, setNotesForNext] = useState(
    "Ca chiều dự kiến có đoàn xe hội nghị lúc 15h30, cần ưu tiên giữ chỗ khu vực Tầng B1.",
  );
  const [handoverTo, setHandoverTo] = useState("Lê Thị Mai (STF-092)");
  const [confirmed, setConfirmed] = useState(false);
  const [submittingHandover, setSubmittingHandover] = useState(false);
  const [handoverDone, setHandoverDone] = useState(false);

  // Equipment checklist state
  const [checks, setChecks] = useState({
    barrier: true,
    cameras: true,
    printers: true,
    cashDrawer: true,
  });

  const loadShift = async () => {
    try {
      const lotId = selectedLotId || "lot-01";
      const s = await staffApi.getCurrentShift(lotId);
      setShift(s);
    } catch (err) {
      console.error("Load shift error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShift();
  }, [selectedLotId]);

  const handleHandoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      alert("Vui lòng tích xác nhận cam kết bàn giao chính xác.");
      return;
    }
    setSubmittingHandover(true);
    try {
      const payload: HandoverPayload = {
        completedTasks,
        unresolvedIssues,
        pendingTransactions: "Không có giao dịch treo",
        equipmentStatus,
        notesForNext,
        handoverToStaffId: handoverTo,
        confirmed: true,
      };
      await staffApi.submitHandover(payload);
      setHandoverDone(true);
      loadShift();
    } catch (err: any) {
      alert("Lỗi bàn giao ca: " + err.message);
    } finally {
      setSubmittingHandover(false);
    }
  };

  if (loading && !shift) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Đang tải ca trực...</div>;
  }

  const shiftDurationHours = shift
    ? ((Date.now() - new Date(shift.startTime).getTime()) / (1000 * 3600)).toFixed(1)
    : "0";

  return (
    <div>
      {/* Page Header */}
      <div className="staff-page-header">
        <div>
          <h1 className="staff-page-title">
            <Clock size={24} color="var(--teal)" />
            Quản lý Ca trực & Biên bản Bàn giao
          </h1>
          <p className="staff-page-desc">
            Theo dõi thời gian trực, kiểm tra thiết bị hạ tầng và bàn giao ca làm việc sang nhân viên tiếp quản
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="staff-quick-btn staff-btn-secondary"
        >
          <Printer size={16} />
          <span>In Báo cáo Ca làm việc</span>
        </button>
      </div>

      {/* Current Shift Summary Card */}
      <div className="staff-kpi-grid">
        <div className="staff-kpi-card success">
          <div className="staff-kpi-header">
            <span>NHÂN VIÊN ĐANG TRỰC</span>
            <UserCheck size={18} color="var(--green)" />
          </div>
          <div className="staff-kpi-value" style={{ fontSize: 20 }}>
            {shift?.staffName}
          </div>
          <div className="staff-kpi-meta">
            <span>Mã NV: {shift?.staffId} • Ca Sáng (06:00 - 14:00)</span>
          </div>
        </div>

        <div className="staff-kpi-card">
          <div className="staff-kpi-header">
            <span>THỜI GIAN TRỰC THỰC TẾ</span>
            <Clock size={18} color="var(--teal)" />
          </div>
          <div className="staff-kpi-value">{shiftDurationHours} giờ</div>
          <div className="staff-kpi-meta">
            <span>Bắt đầu lúc: {shift && new Date(shift.startTime).toLocaleTimeString("vi-VN")}</span>
          </div>
        </div>

        <div className="staff-kpi-card">
          <div className="staff-kpi-header">
            <span>LƯỢT XE VÀO / RA</span>
            <ArrowDownLeft size={18} color="var(--teal)" />
          </div>
          <div className="staff-kpi-value">
            {shift?.totalEntries} / {shift?.totalExits}
          </div>
          <div className="staff-kpi-meta">
            <span>Xe vào: {shift?.totalEntries} • Xe ra: {shift?.totalExits}</span>
          </div>
        </div>

        <div className="staff-kpi-card">
          <div className="staff-kpi-header">
            <span>TIỀN MẶT ĐÃ THU</span>
            <DollarSign size={18} color="var(--green)" />
          </div>
          <div className="staff-kpi-value" style={{ color: "var(--green)" }}>
            1.280.000đ
          </div>
          <div className="staff-kpi-meta">
            <span>Đã khớp số liệu két tiền mặt</span>
          </div>
        </div>
      </div>

      {/* Checklist & Handover Form Split */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
        {/* Equipment & Facility Checklist */}
        <div className="staff-card">
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <ShieldCheck size={16} color="var(--teal)" />
              Kiểm tra Tình trạng Thiết bị Đầu Ca / Cuối Ca
            </h2>
            <span className="staff-badge badge-available">4/4 Tiêu chuẩn</span>
          </div>
          <div className="staff-card-body">
            <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
              Vui lòng kiểm tra thực tế tình trạng vận hành thiết bị tại các cổng trước khi bàn giao:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={checks.barrier}
                  onChange={(e) => setChecks({ ...checks, barrier: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--teal)" }}
                />
                <div>
                  <strong>Cần gạt Barrier & Cảm biến vòng từ (Loop Sensor)</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Nâng hạ trơn tru, không kẹt vật cản</div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={checks.cameras}
                  onChange={(e) => setChecks({ ...checks, cameras: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--teal)" }}
                />
                <div>
                  <strong>Camera ANPR nhận diện biển số & Camera toàn cảnh</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Ống kính sạch sẽ, độ trễ &lt; 200ms</div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={checks.printers}
                  onChange={(e) => setChecks({ ...checks, printers: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--teal)" }}
                />
                <div>
                  <strong>Máy in vé nhiệt & Đầu đọc mã QR / Thẻ RFID</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Còn giấy in cuộn, đèn tín hiệu xanh</div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
                <input
                  type="checkbox"
                  checked={checks.cashDrawer}
                  onChange={(e) => setChecks({ ...checks, cashDrawer: e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: "var(--teal)" }}
                />
                <div>
                  <strong>Két tiền mặt & Máy quẹt thẻ POS</strong>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>Tiền mặt đúng số lượng, pin POS trên 80%</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Handover Submission Form */}
        <div className="staff-card">
          <div className="staff-card-header">
            <h2 className="staff-card-title">
              <FileText size={16} color="var(--teal)" />
              Biên bản Bàn giao Ca trực
            </h2>
            {shift?.status === "Handover" && (
              <span className="staff-badge badge-resolved">Đã bàn giao</span>
            )}
          </div>
          <div className="staff-card-body">
            {handoverDone ? (
              <div style={{ padding: 20, textAlign: "center", background: "#f0fdf4", borderRadius: 10, border: "1px solid #86efac" }}>
                <CheckCircle2 size={40} color="var(--green)" style={{ margin: "0 auto 10px" }} />
                <h3 style={{ margin: "0 0 6px", color: "#166534" }}>Bàn giao Ca thành công!</h3>
                <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                  Biên bản bàn giao đã được chuyển cho <strong>{handoverTo}</strong>. Bạn có thể rời ca hoặc in biên bản lưu trữ.
                </p>
              </div>
            ) : (
              <form onSubmit={handleHandoverSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="staff-form-group">
                  <label className="staff-label">Công việc đã hoàn thành trong ca (*):</label>
                  <textarea
                    required
                    className="staff-textarea"
                    value={completedTasks}
                    onChange={(e) => setCompletedTasks(e.target.value)}
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-label">Vấn đề / Sự cố cần ca sau lưu ý tiếp quản (*):</label>
                  <textarea
                    required
                    className="staff-textarea"
                    value={unresolvedIssues}
                    onChange={(e) => setUnresolvedIssues(e.target.value)}
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-label">Ghi chú đặc biệt cho ca tiếp theo:</label>
                  <input
                    type="text"
                    className="staff-input"
                    value={notesForNext}
                    onChange={(e) => setNotesForNext(e.target.value)}
                  />
                </div>

                <div className="staff-form-group">
                  <label className="staff-label">Nhân viên tiếp nhận ca sau (*):</label>
                  <select
                    className="staff-select"
                    value={handoverTo}
                    onChange={(e) => setHandoverTo(e.target.value)}
                  >
                    <option value="Lê Thị Mai (STF-092)">Lê Thị Mai (Mã #STF-092 - Ca Chiều)</option>
                    <option value="Trần Quốc Bảo (STF-095)">Trần Quốc Bảo (Mã #STF-095 - Ca Chiều)</option>
                    <option value="Phạm Hữu Đạt (STF-102)">Phạm Hữu Đạt (Mã #STF-102 - Trưởng ca)</option>
                  </select>
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", marginTop: 4 }}>
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: "var(--teal)" }}
                  />
                  <span>Tôi cam kết số liệu xe vào/ra, doanh thu tiền mặt và tình trạng thiết bị là chính xác.</span>
                </label>

                <button
                  type="submit"
                  disabled={submittingHandover}
                  className="staff-quick-btn staff-btn-primary"
                  style={{ width: "100%", justifyContent: "center", padding: "12px", marginTop: 8 }}
                >
                  <Send size={16} />
                  <span>{submittingHandover ? "Đang gửi bàn giao..." : "Xác nhận Ký Bàn giao & Kết thúc Ca"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
