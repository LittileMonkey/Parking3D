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
    <div
      style={{
        background: "#ffffff",
        border: "1px solid var(--pm-border)",
        borderRadius: 16,
        padding: "14px 20px",
        boxShadow: "0 4px 16px rgba(7, 45, 89, 0.03)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: "#edf7fd",
            color: "var(--pm-blue)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title="Cơ sở bãi đỗ đang điều hành"
        >
          <Building2 size={18} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: "var(--pm-navy)" }}>{facilityName}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "var(--pm-blue)",
                background: "var(--pm-ice)",
                border: "1px solid rgba(13, 70, 133, 0.18)",
                padding: "2px 8px",
                borderRadius: 6,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
              title="Phạm vi ủy quyền quản trị bãi xe"
            >
              <ShieldCheck size={11} /> RBAC: {parkingLotId}
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--pm-muted)", marginTop: 2, display: "block" }}>
            <MapPin size={11} style={{ display: "inline", marginRight: 3, verticalAlign: "middle", color: "var(--pm-blue)" }} />
            {facilityCode} • {moduleTitle}
            {moduleDescription && ` — ${moduleDescription}`}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {children}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            fontWeight: 700,
            color: "#065f46",
            background: "#d1fae5",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            padding: "4px 10px",
            borderRadius: 9999,
          }}
          title="Độ trễ truyền nhận telemetry thời gian thực"
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
          <span>14ms (Healthy)</span>
        </div>
      </div>
    </div>
  );
}
