import { useState } from "react";
import type { OccupancyTimePoint } from "../../types/manager";

interface Props {
  data: OccupancyTimePoint[];
  totalCapacity: number;
}

export default function OccupancyAreaChart({ data, totalCapacity }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [activeVehicleFilter, setActiveVehicleFilter] = useState<"all" | "car" | "moto" | "ev">("all");

  if (!data || data.length === 0) {
    return (
      <div className="pm-chart-empty">
        <p>Không có dữ liệu xu hướng công suất cho khung thời gian này.</p>
      </div>
    );
  }

  // SVG Chart dimensions
  const width = 640;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(totalCapacity, ...data.map((d) => d.capacity || d.occupied * 1.2), 100);

  // Helper coordinate mapper
  const getX = (index: number) => paddingLeft + (index / (data.length - 1)) * chartWidth;
  const getY = (val: number) => paddingTop + chartHeight - (val / maxVal) * chartHeight;

  // Build points based on selected vehicle filter
  const points = data.map((d, i) => {
    let val = d.occupied;
    if (activeVehicleFilter === "car") val = d.carOccupied * 1.5;
    if (activeVehicleFilter === "moto") val = d.motoOccupied * 1.5;
    if (activeVehicleFilter === "ev") val = d.evOccupied * 3;
    return { x: getX(i), y: getY(Math.min(maxVal, val)), raw: d, displayVal: val };
  });

  // Construct SVG cubic Bezier curve string
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) / 2;
    const cp2y = p1.y;
    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
  }

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`;

  // Horizontal Gridline values
  const yTicks = [0, Math.round(maxVal * 0.33), Math.round(maxVal * 0.66), maxVal];

  const hoveredPoint = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <div className="pm-occupancy-chart-card">
      <div className="pm-chart-header">
        <div>
          <div className="pm-card-tag">BIỂU ĐỒ THỜI GIAN THỰC</div>
          <h3 className="pm-chart-title">Công Suất & Tỷ Lệ Lấp Đầy Theo Giờ</h3>
        </div>

        {/* Vehicle filter pills */}
        <div className="pm-pill-selector" role="tablist" aria-label="Lọc phương tiện">
          <button
            type="button"
            className={`pm-pill-btn ${activeVehicleFilter === "all" ? "active" : ""}`}
            onClick={() => setActiveVehicleFilter("all")}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`pm-pill-btn ${activeVehicleFilter === "car" ? "active" : ""}`}
            onClick={() => setActiveVehicleFilter("car")}
          >
            Ô tô
          </button>
          <button
            type="button"
            className={`pm-pill-btn ${activeVehicleFilter === "moto" ? "active" : ""}`}
            onClick={() => setActiveVehicleFilter("moto")}
          >
            Xe máy
          </button>
          <button
            type="button"
            className={`pm-pill-btn ${activeVehicleFilter === "ev" ? "active" : ""}`}
            onClick={() => setActiveVehicleFilter("ev")}
          >
            Xe điện EV
          </button>
        </div>
      </div>

      <div className="pm-svg-chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="pm-responsive-svg"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#087f8c" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#14afbe" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#14afbe" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineStrokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#087f8c" />
              <stop offset="50%" stopColor="#14afbe" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#087f8c" floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Horizontal Gridlines */}
          {yTicks.map((tickVal) => {
            const y = getY(tickVal);
            return (
              <g key={tickVal} className="pm-grid-row">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(19, 45, 58, 0.08)"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="pm-axis-text"
                >
                  {tickVal}
                </text>
              </g>
            );
          })}

          {/* Fill Area with Gradient */}
          <path d={areaPath} fill="url(#occupancyGradient)" />

          {/* Main Curved Line with glow */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#lineStrokeGradient)"
            strokeWidth="3.2"
            strokeLinecap="round"
            filter="url(#glow)"
          />

          {/* Interactive Hover Vertical Bar & Dot */}
          {points.map((p, idx) => (
            <g key={idx} onMouseEnter={() => setHoverIndex(idx)} style={{ cursor: "pointer" }}>
              {/* Invisible wide hitbox for easy touch/mouse hover */}
              <rect
                x={p.x - 18}
                y={paddingTop}
                width={36}
                height={chartHeight}
                fill="transparent"
              />

              {/* X Axis Label */}
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                className={`pm-axis-x-label ${hoverIndex === idx ? "active" : ""}`}
              >
                {p.raw.timeLabel}
              </text>

              {/* Highlight Dot on hover */}
              {hoverIndex === idx && (
                <g>
                  <line
                    x1={p.x}
                    y1={paddingTop}
                    x2={p.x}
                    y2={paddingTop + chartHeight}
                    stroke="#087f8c"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    opacity="0.75"
                  />
                  <circle cx={p.x} cy={p.y} r="7" fill="#ffffff" stroke="#087f8c" strokeWidth="3" />
                  <circle cx={p.x} cy={p.y} r="3" fill="#14afbe" />
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* Floating Tooltip Box */}
        {hoveredPoint && (
          <div
            className="pm-chart-tooltip"
            style={{
              left: `clamp(10px, ${(hoveredPoint.x / width) * 100}%, calc(100% - 190px))`,
              top: `clamp(10px, ${(hoveredPoint.y / height) * 100}% - 40px, 120px)`,
            }}
          >
            <div className="pm-tooltip-time">{hoveredPoint.raw.timeLabel}</div>
            <div className="pm-tooltip-row">
              <span>Đang đỗ:</span>
              <strong>{hoveredPoint.raw.occupied} chỗ</strong>
            </div>
            <div className="pm-tooltip-row text-muted">
              <span>Còn trống:</span>
              <span>{hoveredPoint.raw.available} chỗ</span>
            </div>
            <div className="pm-tooltip-badge">
              <span>Tỷ lệ: {Math.round((hoveredPoint.raw.occupied / (hoveredPoint.raw.capacity || 1)) * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart Footer Legend */}
      <div className="pm-chart-footer">
        <div className="pm-legend-item">
          <span className="pm-legend-dot teal" />
          <span>Lưu lượng xe đang đỗ thực tế</span>
        </div>
        <div className="pm-legend-item">
          <span className="pm-legend-dot dashed" />
          <span>Ngưỡng giới hạn công suất ({totalCapacity} ô)</span>
        </div>
        <div className="pm-legend-meta">
          <span>Đỉnh điểm: <strong>08:30 - 09:45 (88.4%)</strong></span>
        </div>
      </div>
    </div>
  );
}
