import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import {
  CreditCard,
  Car,
  Bike,
  Zap,
  Sparkles,
  History,
  CheckCircle2,
  AlertCircle,
  Save,
  Calculator,
  RefreshCw,
} from "lucide-react";
import { operations, type BlockPricing, type PricingVersion } from "../../services/operations";

const initialRules: BlockPricing = {
  blockMinutes: 15,
  rateVnd: 5000,
  dailyCapVnd: 150000,
  multiplier: 1,
  peakStart: null,
  peakEnd: null,
};

interface OutletContextType {
  selectedLotId: string;
  refreshKey?: number;
}

export default function PricingPolicyPage() {
  const { selectedLotId, refreshKey } = useOutletContext<OutletContextType>();
  const [type, setType] = useState<"CAR" | "EV" | "MOTORBIKE">("CAR");
  const [plans, setPlans] = useState<PricingVersion[]>([]);
  const [rules, setRules] = useState<BlockPricing>(initialRules);
  const [name, setName] = useState("Biểu giá tiêu chuẩn theo block");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let current = true;
    setLoaded(false);
    setPlans([]);
    setError("");
    setNotice("");
    setRules(initialRules);
    setReason("");

    if (!selectedLotId || selectedLotId === "all") return;

    operations
      .pricing(selectedLotId, type)
      .then((data) => {
        if (!current) return;
        setPlans(data);
        if (data.length > 0) {
          setRules(data[0].rules ?? initialRules);
          setName(data[0].name ?? "Biểu giá tiêu chuẩn theo block");
        } else {
          setRules(initialRules);
          setName("Biểu giá tiêu chuẩn theo block");
        }
        setLoaded(true);
      })
      .catch((err) => {
        if (current) setError(err.message || "Không thể tải biểu phí từ máy chủ.");
      });

    return () => {
      current = false;
    };
  }, [selectedLotId, type, refreshKey]);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!reason.trim()) {
      setError("Vui lòng nhập lý do điều chỉnh biểu giá để phục vụ lưu vết kiểm toán!");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const data = await operations.publish(selectedLotId, {
        vehicleType: type,
        name,
        expectedVersion: plans[0]?.version ?? 0,
        rules,
        reason: reason.trim(),
      });
      setPlans(data);
      setReason("");
      setNotice(
        `Đã ban hành phiên bản mới (v${data[0].version}). Các đặt chỗ và phiên đỗ đã chốt trước thời điểm này được giữ nguyên giá cũ bảo vệ khách hàng.`
      );
      setTimeout(() => setNotice(""), 8000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu phiên bản biểu giá mới.");
    } finally {
      setBusy(false);
    }
  }

  // Real-time Price Simulation Calculations
  const simulation = useMemo(() => {
    const blockMins = rules.blockMinutes || 15;
    const rate = rules.rateVnd || 5000;
    const mult = rules.multiplier || 1;
    const cap = rules.dailyCapVnd || 150000;

    // 1 block cost
    const oneBlockCost = rate;

    // 2 hours regular: 120 mins
    const blocksIn2H = Math.ceil(120 / blockMins);
    const cost2HRegular = Math.min(blocksIn2H * rate, cap);

    // 2 hours peak
    const cost2HPeak = Math.min(Math.round(blocksIn2H * rate * mult), cap);

    // 8 hours day parking
    const blocksIn8H = Math.ceil(480 / blockMins);
    const cost8H = Math.min(blocksIn8H * rate, cap);

    return {
      oneBlockCost,
      cost2HRegular,
      cost2HPeak,
      cost8H,
      dailyCap: cap,
    };
  }, [rules]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
      {/* ── 1. Top Vehicle Switcher & Context Banner ── */}
      <div className="pm-card">
        <div className="pm-card-header">
          <div className="pm-card-title-group">
            <div className="pm-card-icon">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="pm-card-h3">Thiết Lập Biểu Phí & Chính Sách Giá Theo Bãi</h3>
              <span className="pm-card-sub">
                Hệ thống tính tiền theo block lũy tiến, hệ số cao điểm và trần tiền ngày theo chuẩn SCRUM-100
              </span>
            </div>
          </div>

          {/* Vehicle Type Switcher Pills */}
          <div className="pm-period-pills">
            <button
              type="button"
              className={`pm-period-btn ${type === "CAR" ? "active" : ""}`}
              onClick={() => setType("CAR")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Car size={14} />
              <span>Ô tô (CAR)</span>
            </button>
            <button
              type="button"
              className={`pm-period-btn ${type === "EV" ? "active" : ""}`}
              onClick={() => setType("EV")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Zap size={14} />
              <span>Ô tô điện (EV)</span>
            </button>
            <button
              type="button"
              className={`pm-period-btn ${type === "MOTORBIKE" ? "active" : ""}`}
              onClick={() => setType("MOTORBIKE")}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Bike size={14} />
              <span>Xe máy (MOTORBIKE)</span>
            </button>
          </div>
        </div>

        {(!selectedLotId || selectedLotId === "all") && (
          <div
            style={{
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
            <span>Vui lòng chọn một cơ sở bãi xe cụ thể ở thanh công cụ phía trên để xem và cấu hình biểu giá.</span>
          </div>
        )}

        {notice && (
          <div
            style={{
              padding: "12px 16px",
              background: "#d1fae5",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 12,
              color: "#065f46",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
            role="status"
          >
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div
            style={{
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

      {/* ── 2. Pricing Studio Grid: Configuration Form (2/3) + Simulation Preview (1/3) ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
          {/* Form Card */}
          <div className="pm-card" style={{ flex: 1.8 }}>
            <div className="pm-card-header">
              <div className="pm-card-title-group">
                <div className="pm-card-icon" style={{ background: "#d1fae5", color: "#065f46" }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="pm-card-h3">
                    Thông Số Biểu Giá ({type === "CAR" ? "Ô tô" : type === "EV" ? "Ô tô điện (EV)" : "Xe máy"})
                  </h3>
                  <span className="pm-card-sub">
                    Phiên bản hiện tại: <strong>v{plans[0]?.version ?? 1}</strong> • Trạng thái:{" "}
                    <span className="pm-badge success">Active</span>
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <fieldset disabled={!loaded || busy} style={{ border: "none", padding: 0, margin: 0 }}>
                <div className="pm-form-group">
                  <label className="pm-label" htmlFor="plan-name">
                    Tên biểu giá:
                  </label>
                  <input
                    id="plan-name"
                    type="text"
                    className="pm-input-text"
                    required
                    maxLength={200}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Biểu giá tiêu chuẩn theo block 15 phút"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="block-minutes">
                      Thời lượng mỗi block (phút):
                    </label>
                    <input
                      id="block-minutes"
                      type="number"
                      min={1}
                      max={1440}
                      className="pm-input-number"
                      required
                      value={rules.blockMinutes}
                      onChange={(e) => setRules({ ...rules, blockMinutes: Number(e.target.value) })}
                    />
                    <small style={{ fontSize: 11, color: "var(--pm-muted)" }}>Quy chuẩn: 15 phút</small>
                  </div>

                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="rate-vnd">
                      Đơn giá mỗi block (VND):
                    </label>
                    <input
                      id="rate-vnd"
                      type="number"
                      min={100}
                      step={500}
                      className="pm-input-number"
                      required
                      value={rules.rateVnd}
                      onChange={(e) => setRules({ ...rules, rateVnd: Number(e.target.value) })}
                    />
                    <small style={{ fontSize: 11, color: "var(--pm-muted)" }}>
                      = {(rules.rateVnd * 4).toLocaleString("vi-VN")} ₫ / giờ
                    </small>
                  </div>

                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="daily-cap">
                      Trần giá mỗi ngày (VND):
                    </label>
                    <input
                      id="daily-cap"
                      type="number"
                      min={1000}
                      step={10000}
                      className="pm-input-number"
                      required
                      value={rules.dailyCapVnd}
                      onChange={(e) => setRules({ ...rules, dailyCapVnd: Number(e.target.value) })}
                    />
                    <small style={{ fontSize: 11, color: "var(--pm-muted)" }}>Tối đa cho 24 giờ</small>
                  </div>

                  <div className="pm-form-group">
                    <label className="pm-label" htmlFor="peak-multiplier">
                      Hệ số cao điểm (tối đa 1.5x):
                    </label>
                    <input
                      id="peak-multiplier"
                      type="number"
                      min={1.0}
                      max={1.5}
                      step={0.05}
                      className="pm-input-number"
                      required
                      value={rules.multiplier}
                      onChange={(e) => setRules({ ...rules, multiplier: Number(e.target.value) })}
                    />
                    <small style={{ fontSize: 11, color: "var(--pm-muted)" }}>
                      Tăng {Math.round((rules.multiplier - 1) * 100)}% phí giờ cao điểm
                    </small>
                  </div>
                </div>

                {/* Peak Hours Range */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 16,
                    padding: "16px",
                    background: "#f8fafc",
                    border: "1px solid var(--pm-border)",
                    borderRadius: 14,
                    marginBottom: 16,
                  }}
                >
                  <div className="pm-form-group" style={{ marginBottom: 0 }}>
                    <label className="pm-label" htmlFor="peak-start">
                      Bắt đầu cao điểm:
                    </label>
                    <input
                      id="peak-start"
                      type="time"
                      className="pm-input-text"
                      value={rules.peakStart ?? ""}
                      onChange={(e) => setRules({ ...rules, peakStart: e.target.value || null })}
                    />
                  </div>

                  <div className="pm-form-group" style={{ marginBottom: 0 }}>
                    <label className="pm-label" htmlFor="peak-end">
                      Kết thúc cao điểm:
                    </label>
                    <input
                      id="peak-end"
                      type="time"
                      className="pm-input-text"
                      value={rules.peakEnd ?? ""}
                      onChange={(e) => setRules({ ...rules, peakEnd: e.target.value || null })}
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: "var(--pm-muted)" }}>
                    💡 <em>Để trống cả hai giờ: Hệ số áp dụng toàn thời gian. Nhập đủ hai giờ: Chỉ block rơi vào khung cao điểm mới nhân hệ số.</em>
                  </div>
                </div>

                {/* Audit Note Justification */}
                <div className="pm-form-group">
                  <label className="pm-label" htmlFor="change-reason">
                    Lý do điều chỉnh (Bắt buộc lưu vết kiểm toán):
                  </label>
                  <textarea
                    id="change-reason"
                    rows={3}
                    className="pm-textarea"
                    required
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="VD: Điều chỉnh giá gửi ô tô ngày thường theo quyết định số 48/QĐ-BQL để cân đối cung cầu giờ cao điểm."
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="submit"
                    className="pm-btn pm-btn-primary"
                    disabled={!loaded || busy}
                    style={{ minWidth: 200 }}
                  >
                    {busy ? (
                      <>
                        <RefreshCw size={15} className="spin-animation" />
                        <span>Đang lưu phiên bản…</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>Ban Hành Phiên Bản Mới</span>
                      </>
                    )}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>

          {/* Simulation Preview Card */}
          <div className="pm-card" style={{ flex: 1 }}>
            <div className="pm-card-header">
              <div className="pm-card-title-group">
                <div className="pm-card-icon" style={{ background: "#edf7fd", color: "#0d4685" }}>
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="pm-card-h3">Mô Phỏng Tính Phí Thực Tế</h3>
                  <span className="pm-card-sub">Xem trước chi phí khách phải trả theo các kịch bản thời gian gửi</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Scenario 1 */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderRadius: 14,
                  border: "1px solid var(--pm-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pm-navy)" }}>1 Block đầu tiên ({rules.blockMinutes} phút)</div>
                  <div style={{ fontSize: 11.5, color: "var(--pm-muted)" }}>Khách đỗ ngắn hạn / giao hàng</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--pm-blue)" }}>
                  {simulation.oneBlockCost.toLocaleString("vi-VN")} ₫
                </div>
              </div>

              {/* Scenario 2 */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "#f8fafc",
                  borderRadius: 14,
                  border: "1px solid var(--pm-border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pm-navy)" }}>2 Giờ giờ bình thường</div>
                  <div style={{ fontSize: 11.5, color: "var(--pm-muted)" }}>8 blocks × {rules.rateVnd.toLocaleString("vi-VN")} ₫</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#10b981" }}>
                  {simulation.cost2HRegular.toLocaleString("vi-VN")} ₫
                </div>
              </div>

              {/* Scenario 3 */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "#fef3c7",
                  borderRadius: 14,
                  border: "1px solid rgba(245, 158, 11, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e" }}>
                    2 Giờ giờ cao điểm ({rules.multiplier}x)
                  </div>
                  <div style={{ fontSize: 11.5, color: "#b45309" }}>Áp dụng khung giờ cao điểm</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#b45309" }}>
                  {simulation.cost2HPeak.toLocaleString("vi-VN")} ₫
                </div>
              </div>

              {/* Scenario 4 */}
              <div
                style={{
                  padding: "14px 16px",
                  background: "#edf7fd",
                  borderRadius: 14,
                  border: "1px solid rgba(13, 70, 133, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--pm-navy)" }}>Trần tối đa cả ngày (24h)</div>
                  <div style={{ fontSize: 11.5, color: "var(--pm-muted)" }}>Tự động khóa trần bảo vệ khách</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--pm-navy)" }}>
                  {simulation.dailyCap.toLocaleString("vi-VN")} ₫
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Version History Table Card ── */}
      {selectedLotId && selectedLotId !== "all" && (
        <div className="pm-card">
          <div className="pm-card-header">
            <div className="pm-card-title-group">
              <div className="pm-card-icon">
                <History size={18} />
              </div>
              <div>
                <h3 className="pm-card-h3">Lịch Sử Phiên Bản Biểu Giá ({plans.length} phiên bản)</h3>
                <span className="pm-card-sub">Lưu vết toàn bộ các lần ban hành giá để tra cứu tranh chấp và đối soát</span>
              </div>
            </div>
          </div>

          <div className="pm-table-container">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Phiên Bản</th>
                  <th>Hiệu Lực Từ</th>
                  <th>Đơn Giá / Block</th>
                  <th>Trần Ngày</th>
                  <th>Hệ Số Cao Điểm</th>
                  <th>Trạng Thái</th>
                  <th>Người Ban Hành</th>
                </tr>
              </thead>
              <tbody>
                {plans.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "36px 20px", color: "var(--pm-muted)" }}>
                      Chưa có phiên bản biểu giá nào được lưu cho loại xe này.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan, idx) => (
                    <tr key={plan.id}>
                      <td style={{ fontWeight: 700 }}>
                        <span className={`pm-badge ${idx === 0 ? "success" : "info"}`}>
                          v{plan.version} {idx === 0 ? "• Hiện hành" : ""}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{new Date(plan.effectiveFrom).toLocaleString("vi-VN")}</td>
                      <td>
                        <strong>{plan.rules.rateVnd.toLocaleString("vi-VN")} ₫</strong> / {plan.rules.blockMinutes} phút
                      </td>
                      <td>{plan.rules.dailyCapVnd.toLocaleString("vi-VN")} ₫</td>
                      <td>{plan.rules.multiplier}x</td>
                      <td>
                        <span className={`pm-badge ${plan.status === "ACTIVE" ? "success" : "warning"}`}>
                          {plan.status}
                        </span>
                      </td>
                      <td>{plan.createdBy || "BQL Bãi Đỗ"}</td>
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
