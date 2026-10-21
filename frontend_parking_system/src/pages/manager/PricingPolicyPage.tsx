import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  DollarSign,
  Clock,
  TrendingUp,
  Save,
  RotateCcw,
  History,
  CheckCircle,
  FileText,
  Percent,
  AlertCircle,
} from "lucide-react";
import FacilityRbacStrip from "../../components/manager/FacilityRbacStrip";
import { managerApi } from "../../services/manager/managerApi";
import type {
  PricingPlan,
  PricingPlanHistoryItem,
  PricingPlanStatus,
  VehicleCategory,
} from "../../types/manager";

interface OutletContextType {
  selectedLotId: string;
}

export default function PricingPolicyPage() {
  const { selectedLotId } = useOutletContext<OutletContextType>();
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlan] = useState<PricingPlan | null>(null);
  const [history, setHistory] = useState<PricingPlanHistoryItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [hourlyRate, setHourlyRate] = useState<number>(25000);
  const [billingUnitMinutes, setBillingUnitMinutes] = useState<number>(15);
  const [dailyCap, setDailyCap] = useState<number>(250000);
  const [peakMultiplier, setPeakMultiplier] = useState<number>(1.25);
  const [peakHoursStart, setPeakHoursStart] = useState<string>("07:00");
  const [peakHoursEnd, setPeakHoursEnd] = useState<string>("18:30");
  const [freeGracePeriodMinutes, setFreeGracePeriodMinutes] = useState<number>(15);
  const [overnightSurcharge, setOvernightSurcharge] = useState<number>(60000);
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>("Car");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const res = await managerApi.getPricingPlans(selectedLotId || "PKM-METRO-01");
        if (res.isSuccess && res.result) {
          setActivePlan(res.result.activePlan);
          setHistory(res.result.history);
          const r = res.result.activePlan.rules;
          setHourlyRate(r.hourlyRate);
          setBillingUnitMinutes(r.billingUnitMinutes);
          setDailyCap(r.dailyCap);
          setPeakMultiplier(r.peakMultiplier);
          setPeakHoursStart(r.peakHoursStart);
          setPeakHoursEnd(r.peakHoursEnd);
          setFreeGracePeriodMinutes(r.freeGracePeriodMinutes);
          setOvernightSurcharge(r.overnightSurcharge);
          setVehicleCategory(res.result.activePlan.vehicleCategory);
        }
      } catch (err) {
        console.error("Failed to load pricing plans", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedLotId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePlan) return;
    setIsSaving(true);
    try {
      const updated: PricingPlan = {
        ...activePlan,
        vehicleCategory,
        rules: {
          hourlyRate,
          billingUnitMinutes,
          dailyCap,
          peakMultiplier,
          peakHoursStart,
          peakHoursEnd,
          freeGracePeriodMinutes,
          overnightSurcharge,
        },
      };
      const res = await managerApi.savePricingPlan(updated);
      if (res.isSuccess) {
        setActivePlan(res.result);
        setIsEditing(false);
        setSaveSuccessMsg(res.message);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Save error", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: PricingPlanStatus) => {
    switch (status) {
      case "Active":
        return <span className="pm-badge pm-badge-success"><CheckCircle size={11} /> Đang Áp Dụng (Active)</span>;
      case "Draft":
        return <span className="pm-badge pm-badge-warning"><Clock size={11} /> Bản Thảo (Draft)</span>;
      case "Archived":
        return <span className="pm-badge pm-badge-neutral"><History size={11} /> Đã Lưu Trữ (Archived)</span>;
    }
  };

  return (
    <div className="pm-module-page">
      {/* Top Facility RBAC Bar */}
      <FacilityRbacStrip
        parkingLotId={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        facilityName="Metropolis Central Hub"
        facilityCode={selectedLotId === "all" ? "PKM-METRO-01" : selectedLotId}
        moduleTitle="Pricing & Policy Management"
        moduleDescription="Cấu hình biểu giá, block 15 phút & hệ số cao điểm theo Baseline V4"
      />

      {saveSuccessMsg && (
        <div style={{ background: "rgba(16, 185, 129, 0.2)", border: "1px solid #10b981", borderRadius: 12, padding: "12px 18px", color: "#34d399", display: "flex", alignItems: "center", gap: 10 }}>
          <CheckCircle size={18} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Grid: Active Plan Summary & Configuration Form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 24 }}>
        {/* Left Column: Active Plan Card */}
        <div className="pm-glass-card">
          <div className="pm-card-header-row">
            <div className="pm-card-header-left">
              <div className="pm-header-icon-box">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="pm-card-title">Chính Sách Hiện Hành</h2>
                <span className="pm-card-subtitle">Áp dụng tự động tại barrier và app khách</span>
              </div>
            </div>
            {activePlan && getStatusBadge(activePlan.status)}
          </div>

          {loading ? (
            <div style={{ color: "#94a3b8", padding: 20 }}>Đang tải dữ liệu biểu phí…</div>
          ) : activePlan ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "rgba(17, 24, 39, 0.6)", borderRadius: 12, padding: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>Tên chính sách & Phiên bản:</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 4 }}>
                  {activePlan.name} <span style={{ color: "#00f2fe", fontSize: 12 }}>({activePlan.version})</span>
                </div>
                <div style={{ fontSize: 11, color: "#a8cdd0", marginTop: 6 }}>
                  Loại xe: <strong>{activePlan.vehicleCategory === "Car" ? "Ô tô (Dưới 9 chỗ)" : activePlan.vehicleCategory}</strong> • Hiệu lực từ: <strong>01/03/2026</strong>
                </div>
              </div>

              {/* Key Highlights */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                <div style={{ background: "rgba(17, 24, 39, 0.6)", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Đơn giá mỗi giờ:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#34d399", marginTop: 2 }}>
                    {activePlan.rules.hourlyRate.toLocaleString("vi-VN")} đ
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Block: {activePlan.rules.billingUnitMinutes} phút</div>
                </div>

                <div style={{ background: "rgba(17, 24, 39, 0.6)", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Trần tối đa ngày:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#22d3ee", marginTop: 2 }}>
                    {activePlan.rules.dailyCap.toLocaleString("vi-VN")} đ
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Bảo vệ khách đỗ dài</div>
                </div>

                <div style={{ background: "rgba(17, 24, 39, 0.6)", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Hệ số cao điểm:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fbbf24", marginTop: 2 }}>
                    {activePlan.rules.peakMultiplier}x
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                    {activePlan.rules.peakHoursStart} - {activePlan.rules.peakHoursEnd}
                  </div>
                </div>

                <div style={{ background: "rgba(17, 24, 39, 0.6)", padding: 12, borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Miễn phí hủy/đỗ:</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#e2e8f0", marginTop: 2 }}>
                    {activePlan.rules.freeGracePeriodMinutes} phút
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Ân hạn ra vào nhanh</div>
                </div>
              </div>

              <div style={{ background: "rgba(8, 127, 140, 0.1)", border: "1px solid rgba(20, 175, 190, 0.3)", borderRadius: 12, padding: 12, fontSize: 11, color: "#cbd5e1" }}>
                <AlertCircle size={14} style={{ color: "#22d3ee", display: "inline", marginRight: 6, verticalAlign: "middle" }} />
                Baseline V4 Rule: Giá dự kiến (EstimatedPrice) được tính theo công thức lũy tiến block 15 phút, tự động kích hoạt hệ số cao điểm theo múi giờ bãi xe.
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column: Rule Configuration Form */}
        <div className="pm-glass-card">
          <div className="pm-card-header-row">
            <div className="pm-card-header-left">
              <div className="pm-header-icon-box">
                <FileText size={20} />
              </div>
              <div>
                <h2 className="pm-card-title">Cấu Hình Thông Số & Thuật Toán Tính Phí</h2>
                <span className="pm-card-subtitle">Chỉnh sửa trực tiếp hoặc tạo phiên bản kế nhiệm</span>
              </div>
            </div>
            <button
              type="button"
              className={isEditing ? "pm-btn-primary" : "pm-btn-outline"}
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? "Chế độ xem" : "Chỉnh sửa biểu phí"}
            </button>
          </div>

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div className="pm-form-grid">
              <div className="pm-form-group">
                <label className="pm-form-label">
                  <DollarSign size={13} /> Đơn Giá Cơ Bản (VND / giờ)
                </label>
                <input
                  type="number"
                  step="1000"
                  className="pm-form-input"
                  value={hourlyRate}
                  disabled={!isEditing}
                  onChange={(e) => setHourlyRate(Number(e.target.value))}
                  required
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <Clock size={13} /> Block Tính Phí (Billing Unit)
                </label>
                <select
                  className="pm-form-select"
                  value={billingUnitMinutes}
                  disabled={!isEditing}
                  onChange={(e) => setBillingUnitMinutes(Number(e.target.value))}
                >
                  <option value={15}>15 phút (Chuẩn SRS Baseline V4)</option>
                  <option value={30}>30 phút</option>
                  <option value={60}>60 phút (Theo giờ tròn)</option>
                </select>
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <TrendingUp size={13} /> Mức Thu Tối Đa Trong Ngày (Daily Cap)
                </label>
                <input
                  type="number"
                  step="5000"
                  className="pm-form-input"
                  value={dailyCap}
                  disabled={!isEditing}
                  onChange={(e) => setDailyCap(Number(e.target.value))}
                  required
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <Percent size={13} /> Hệ Số Giờ Cao Điểm (Peak Multiplier)
                </label>
                <input
                  type="number"
                  step="0.05"
                  className="pm-form-input"
                  value={peakMultiplier}
                  disabled={!isEditing}
                  onChange={(e) => setPeakMultiplier(Number(e.target.value))}
                  required
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <Clock size={13} /> Giờ Cao Điểm Bắt Đầu
                </label>
                <input
                  type="time"
                  className="pm-form-input"
                  value={peakHoursStart}
                  disabled={!isEditing}
                  onChange={(e) => setPeakHoursStart(e.target.value)}
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <Clock size={13} /> Giờ Cao Điểm Kết Thúc
                </label>
                <input
                  type="time"
                  className="pm-form-input"
                  value={peakHoursEnd}
                  disabled={!isEditing}
                  onChange={(e) => setPeakHoursEnd(e.target.value)}
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <Clock size={13} /> Thời Gian Ân Hạn Miễn Phí (Phút)
                </label>
                <input
                  type="number"
                  className="pm-form-input"
                  value={freeGracePeriodMinutes}
                  disabled={!isEditing}
                  onChange={(e) => setFreeGracePeriodMinutes(Number(e.target.value))}
                />
              </div>

              <div className="pm-form-group">
                <label className="pm-form-label">
                  <DollarSign size={13} /> Phụ Phí Đỗ Qua Đêm (VND)
                </label>
                <input
                  type="number"
                  step="5000"
                  className="pm-form-input"
                  value={overnightSurcharge}
                  disabled={!isEditing}
                  onChange={(e) => setOvernightSurcharge(Number(e.target.value))}
                />
              </div>
            </div>

            {isEditing && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 10 }}>
                <button
                  type="button"
                  className="pm-btn-outline"
                  onClick={() => setIsEditing(false)}
                >
                  <RotateCcw size={14} /> Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="pm-btn-primary"
                  disabled={isSaving}
                >
                  <Save size={14} /> {isSaving ? "Đang lưu..." : "Phê duyệt & Ban hành phiên bản mới"}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Pricing Plan History Table with Versioning */}
      <div className="pm-glass-card">
        <div className="pm-card-header-row">
          <div className="pm-card-header-left">
            <div className="pm-header-icon-box">
              <History size={20} />
            </div>
            <div>
              <h2 className="pm-card-title">Lịch Sử Phiên Bản & Nhật Ký Thay Đổi Biểu Phí</h2>
              <span className="pm-card-subtitle">Lưu vết kiểm toán bất biến theo tiêu chuẩn quản trị cơ sở</span>
            </div>
          </div>
        </div>

        <div className="pm-table-wrapper">
          <table className="pm-data-table">
            <thead>
              <tr>
                <th>Phiên Bản</th>
                <th>Trạng Thái</th>
                <th>Ngày Hiệu Lực</th>
                <th>Người Phê Duyệt</th>
                <th>Đơn Giá / Giờ</th>
                <th>Trần Ngày</th>
                <th>Hệ Số Cao Điểm</th>
                <th>Tóm Tắt Thay Đổi</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 700, color: "#00f2fe" }}>{item.version}</td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td>{item.effectiveDate}</td>
                  <td style={{ color: "#ffffff" }}>{item.changedBy}</td>
                  <td style={{ color: "#34d399", fontWeight: 600 }}>{item.hourlyRate.toLocaleString("vi-VN")} đ</td>
                  <td>{item.dailyCap.toLocaleString("vi-VN")} đ</td>
                  <td style={{ color: "#fbbf24" }}>{item.peakMultiplier}x</td>
                  <td style={{ fontSize: 12, maxWidth: 300 }}>{item.changeSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
