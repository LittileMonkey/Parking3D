import React from "react";
import { Building2, ShieldCheck, MapPin } from "lucide-react";

interface FacilityRbacStripProps {
  parkingLotId?: string;
  facilityName?: string;
  facilityCode?: string;
  moduleTitle: string;
  moduleDescription?: string;
  children?: React.ReactNode;
}

export default function FacilityRbacStrip({
  parkingLotId = "PKM-METRO-01",
  facilityName = "Metropolis Central Hub",
  facilityCode = "PKM-METRO-01",
  moduleTitle,
  moduleDescription,
  children,
}: FacilityRbacStripProps) {
  return (
    <div className="pm-facility-rbac-strip">
      <div className="pm-rbac-left">
        <div className="pm-header-icon-box" title="Cơ sở đang kích hoạt">
          <Building2 size={20} />
        </div>
        <div className="pm-facility-title-wrap">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="pm-facility-name-text">{facilityName}</span>
            <span className="pm-rbac-tag" title="Phạm vi ủy quyền quản lý cơ sở">
              <ShieldCheck size={12} /> RBAC: {parkingLotId}
            </span>
          </div>
          <span className="pm-facility-code-text">
            <MapPin size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "middle" }} />
            {facilityCode} • {moduleTitle}
            {moduleDescription && ` — ${moduleDescription}`}
          </span>
        </div>
      </div>

      <div className="pm-rbac-right">
        {children}
        <div className="pm-latency-badge" title="Độ trễ kết nối API & Cảm biến thời gian thực">
          <span className="pm-latency-dot" />
          <span>14ms (Healthy)</span>
        </div>
      </div>
    </div>
  );
}
