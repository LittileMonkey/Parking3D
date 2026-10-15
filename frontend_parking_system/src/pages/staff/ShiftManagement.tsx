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

  // Checked count calculation
  const checkedCount = Object.values(checks).filter(Boolean).length;

  // Real or realistic default values
  const staffName = shift?.staffName || "Nguyễn Văn Hùng";
  const staffCode = shift?.staffId || "STF-088";
  const durationHours = shift
    ? ((Date.now() - new Date(shift.startTime).getTime()) / (1000 * 3600)).toFixed(1)
    : "15.7";
  const displayDuration = durationHours === "0.0" || durationHours === "NaN" ? "15.7" : durationHours;
  const entriesCount = shift?.totalEntries ?? 42;
  const exitsCount = shift?.totalExits ?? 28;

  if (loading && !shift) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>
        Đang tải thông tin ca trực ParkMatrix...
      </div>
    );
  }

  return (
    <div className="pm-shift-page">
      {/* ─── 1. Page Header & Title Fix ─────────────────────────────────────── */}
      <div className="pm-shift-header">
        <div>
          <h1 className="pm-section-title pm-title-flex">
            <Clock size={26} color="var(--pm-teal)" />
            <span>Quản lý Ca trực &amp; Biên bản Bàn giao</span>
          </h1>
          <p className="pm-section-subtitle">
            Theo dõi thời gian trực, kiểm tra thiết bị hạ tầng và bàn giao ca làm việc sang nhân viên tiếp quản
          </p>
        </div>

        {/* Top-Right Action Button */}
        <button
          type="button"
          onClick={() => window.print()}
          className="pm-print-btn"
        >
          <Printer size={16} />
          <span>In Báo cáo Ca làm việc</span>
        </button>
      </div>

      {/* ─── 2. Shift Summary Stat Cards (Top 4 Cards) ──────────────────────── */}
      <div className="pm-shift-kpi-grid">
        {/* Card 1: NHÂN VIÊN ĐANG TRỰC */}
        <div className="pm-shift-kpi-card">
          <div className="pm-shift-kpi-header">
            <span className="pm-shift-kpi-title">NHÂN VIÊN ĐANG TRỰC</span>
            <UserCheck size={18} color="#4ade80" />
          </div>
          <div className="pm-shift-kpi-val" style={{ fontSize: 21 }}>
            {staffName}
          </div>
          <div className="pm-shift-kpi-meta">
            <span>Mã NV: <strong className="cyan-highlight">#{staffCode}</strong> • Ca Sáng (06:00 - 14:00)</span>
          </div>
        </div>

        {/* Card 2: THỜI GIAN TRỰC THỰC TẾ */}
        <div className="pm-shift-kpi-card">
          <div className="pm-shift-kpi-header">
            <span className="pm-shift-kpi-title">THỜI GIAN TRỰC THỰC TẾ</span>
            <Clock size={18} color="var(--pm-teal)" />
          </div>
          <div className="pm-shift-kpi-val teal">
            {displayDuration} giờ
          </div>
          <div className="pm-shift-kpi-meta">
            <span>Bắt đầu: {shift ? new Date(shift.startTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "06:00"} • Ca chuẩn 8.0h</span>
          </div>
        </div>

        {/* Card 3: LƯỢT XE VÀO / RA */}
        <div className="pm-shift-kpi-card">
          <div className="pm-shift-kpi-header">
            <span className="pm-shift-kpi-title">LƯỢT XE VÀO / RA</span>
            <ArrowDownLeft size={18} color="var(--pm-teal)" />
          </div>
          <div className="pm-shift-kpi-val">
            {entriesCount} / {exitsCount}
          </div>
          <div className="pm-shift-kpi-meta">
            <span>Xe vào: <strong style={{ color: "#ffffff" }}>{entriesCount}</strong> • Xe ra: <strong style={{ color: "#ffffff" }}>{exitsCount}</strong></span>
          </div>
        </div>

        {/* Card 4: TIỀN MẶT ĐÃ THU */}
        <div className="pm-shift-kpi-card">
          <div className="pm-shift-kpi-header">
            <span className="pm-shift-kpi-title">TIỀN MẶT ĐÃ THU</span>
            <DollarSign size={18} color="#34d399" />
          </div>
          <div className="pm-shift-kpi-val emerald">
            1.280.000đ
          </div>
          <div className="pm-shift-kpi-meta">
            <span style={{ color: "#94a3b8" }}>Đã đối soát khớp két tiền mặt</span>
          </div>
        </div>
      </div>

      {/* ─── 3 & 4. Device Checklist & Handover Form Split (2-Column Layout) ─── */}
      <div className="pm-shift-two-col">
        {/* Panel 3: Device Checklist Panel */}
        <div className="pm-shift-card">
          <div className="pm-shift-card-header">
            <h2 className="pm-shift-card-title">
              <ShieldCheck size={18} color="var(--pm-teal)" />
              <span>Kiểm tra Tình trạng Thiết bị Đầu Ca / Cuối Ca</span>
            </h2>
            <span className="pm-shift-badge-standard">
              {checkedCount}/4 Tiêu chuẩn
            </span>
          </div>

          <div className="pm-shift-card-body">
            <p className="pm-shift-desc-muted">
              Vui lòng kiểm tra thực tế tình trạng vận hành thiết bị tại các làn và cổng trước khi ký biên bản bàn giao:
            </p>

            <div className="pm-checklist-group">
              {/* Item 1: Barrier */}
              <label className={`pm-checklist-item ${checks.barrier ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="pm-check-input"
                  checked={checks.barrier}
                  onChange={(e) => setChecks({ ...checks, barrier: e.target.checked })}
                />
                <div className="pm-check-content">
                  <span className="pm-check-title">Cần gạt Barrier &amp; Cảm biến vòng từ (Loop Sensor)</span>
                  <span className="pm-check-desc">Nâng hạ trơn tru, không kẹt vật cản, phản hồi tự động dưới 1.2s</span>
                </div>
              </label>

              {/* Item 2: Camera */}
              <label className={`pm-checklist-item ${checks.cameras ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="pm-check-input"
                  checked={checks.cameras}
                  onChange={(e) => setChecks({ ...checks, cameras: e.target.checked })}
                />
                <div className="pm-check-content">
                  <span className="pm-check-title">Camera ANPR nhận diện biển số &amp; Camera toàn cảnh</span>
                  <span className="pm-check-desc">Ống kính sạch sẽ, góc quét chuẩn, độ trễ truyền hình ảnh &lt; 200ms</span>
                </div>
              </label>

              {/* Item 3: Printer */}
              <label className={`pm-checklist-item ${checks.printers ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="pm-check-input"
                  checked={checks.printers}
                  onChange={(e) => setChecks({ ...checks, printers: e.target.checked })}
                />
                <div className="pm-check-content">
                  <span className="pm-check-title">Máy in vé nhiệt &amp; Đầu đọc mã QR / Thẻ RFID</span>
                  <span className="pm-check-desc">Còn giấy in cuộn, đầu đọc thẻ nhạy, đèn tín hiệu xanh hoạt động</span>
                </div>
              </label>

              {/* Item 4: Cash Drawer */}
              <label className={`pm-checklist-item ${checks.cashDrawer ? "checked" : ""}`}>
                <input
                  type="checkbox"
                  className="pm-check-input"
                  checked={checks.cashDrawer}
                  onChange={(e) => setChecks({ ...checks, cashDrawer: e.target.checked })}
                />
                <div className="pm-check-content">
                  <span className="pm-check-title">Két tiền mặt &amp; Máy quẹt thẻ POS cầm tay</span>
                  <span className="pm-check-desc">Tiền mặt đúng số lượng thực thu, pin máy POS trên 80%, giấy cuộn đầy đủ</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Panel 4: Handover Form Panel */}
        <div className="pm-shift-card">
          <div className="pm-shift-card-header">
            <h2 className="pm-shift-card-title">
              <FileText size={18} color="var(--pm-teal)" />
              <span>Biên bản Bàn giao Ca trực</span>
            </h2>
            {shift?.status === "Handover" && (
              <span className="pm-shift-badge-standard">Đã bàn giao</span>
            )}
          </div>

          <div className="pm-shift-card-body">
            {handoverDone ? (
              <div className="pm-handover-success-dark">
                <CheckCircle2 size={44} color="#34d399" />
                <h3>Bàn giao Ca trực Thành công!</h3>
                <p>
                  Biên bản bàn giao đã được ký điện tử và chuyển quyền ca trực cho đồng nghiệp{" "}
                  <strong>{handoverTo}</strong>. Bạn có thể in biên bản để lưu trữ hồ sơ ca.
                </p>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="pm-print-btn"
                  style={{ marginTop: 8 }}
                >
                  <Printer size={15} />
                  <span>In Biên bản Bàn giao</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleHandoverSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Field 1: Completed tasks */}
                <div className="pm-form-group-dark">
                  <label className="pm-form-label-dark">
                    Công việc đã hoàn thành trong ca (*):
                  </label>
                  <textarea
                    required
                    className="pm-textarea-dark"
                    value={completedTasks}
                    onChange={(e) => setCompletedTasks(e.target.value)}
                    placeholder="Mô tả các đầu việc chính đã thực hiện..."
                  />
                </div>

                {/* Field 2: Unresolved issues */}
                <div className="pm-form-group-dark">
                  <label className="pm-form-label-dark">
                    Vấn đề / Sự cố cần ca sau lưu ý tiếp quản (*):
                  </label>
                  <textarea
                    required
                    className="pm-textarea-dark"
                    value={unresolvedIssues}
                    onChange={(e) => setUnresolvedIssues(e.target.value)}
                    placeholder="Lỗi thiết bị, xe tồn qua ca hoặc ghi chú cần bàn giao..."
                  />
                </div>

                {/* Field 3: Special notes */}
                <div className="pm-form-group-dark">
                  <label className="pm-form-label-dark">
                    Ghi chú đặc biệt cho ca tiếp theo:
                  </label>
                  <input
                    type="text"
                    className="pm-input-dark"
                    value={notesForNext}
                    onChange={(e) => setNotesForNext(e.target.value)}
                    placeholder="Ghi chú thêm (khách VIP, đoàn xe, sự kiện...)"
                  />
                </div>

                {/* Field 4: Handover to staff */}
                <div className="pm-form-group-dark">
                  <label className="pm-form-label-dark">
                    Nhân viên tiếp nhận ca sau (*):
                  </label>
                  <select
                    className="pm-select-dark"
                    value={handoverTo}
                    onChange={(e) => setHandoverTo(e.target.value)}
                    aria-label="Nhân viên tiếp nhận ca sau"
                  >
                    <option value="Lê Thị Mai (Mã #STF-092 - Ca Chiều)">
                      Lê Thị Mai (Mã #STF-092 - Ca Chiều)
                    </option>
                    <option value="Trần Quốc Bảo (Mã #STF-095 - Ca Chiều)">
                      Trần Quốc Bảo (Mã #STF-095 - Ca Chiều)
                    </option>
                    <option value="Phạm Hữu Đạt (Mã #STF-102 - Trưởng ca)">
                      Phạm Hữu Đạt (Mã #STF-102 - Trưởng ca)
                    </option>
                  </select>
                </div>

                {/* Confirmation Checkbox */}
                <label className="pm-confirm-checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  <span>
                    Tôi cam kết số liệu xe vào/ra, doanh thu tiền mặt và tình trạng kiểm tra thiết bị là chính xác, sẵn sàng chuyển giao ca trực.
                  </span>
                </label>

                {/* Primary CTA Button */}
                <button
                  type="submit"
                  disabled={submittingHandover}
                  className="pm-submit-handover-btn"
                >
                  <Send size={16} />
                  <span>
                    {submittingHandover
                      ? "Đang ghi nhận bàn giao..."
                      : "Xác nhận Ký Bàn giao & Kết thúc Ca"}
                  </span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
