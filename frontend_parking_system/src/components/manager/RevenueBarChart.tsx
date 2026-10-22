import { useState } from "react";
import type { RevenueTimePoint } from "../../types/manager";

interface Props {
  data: RevenueTimePoint[];
  totalTodayRevenue: number;
}

export default function RevenueBarChart({ data, totalTodayRevenue }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="pm-chart-empty">
        <p>Chưa có dữ liệu giao dịch cho khung thời gian này.</p>
      </div>
    );
  }

  const formatVnd = (num: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(num);
  };

  const width = 640;
  const height = 240;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxRevenue = Math.max(...data.map((d) => d.totalRevenue), 10000000);
  const barWidth = Math.min(38, chartWidth / data.length - 14);

  const getY = (val: number) => paddingTop + chartHeight - (val / maxRevenue) * chartHeight;
  const getX = (idx: number) => paddingLeft + idx * (chartWidth / data.length) + (chartWidth / data.length - barWidth) / 2;

  const yTicks = [
    0,
    Math.round(maxRevenue * 0.33),
    Math.round(maxRevenue * 0.66),
    maxRevenue,
  ];

  const hoveredItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="pm-revenue-chart-card">
      <div className="pm-chart-header">
        <div>
          <div className="pm-card-tag">DOANH THU & GIAO DỊCH</div>
          <h3 className="pm-chart-title">Dòng Tiền Thanh Toán Theo Khung Giờ</h3>
        </div>

        <div className="pm-revenue-badge-group">
          <span className="pm-badge-cyan">
            Tổng: <strong>{formatVnd(totalTodayRevenue)}</strong>
          </span>
        </div>
      </div>

      <div className="pm-svg-chart-container">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="pm-responsive-svg"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="digitalBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14afbe" />
              <stop offset="100%" stopColor="#087f8c" />
            </linearGradient>
            <linearGradient id="cashBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a47" />
              <stop offset="100%" stopColor="#0e2634" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {yTicks.map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick} className="pm-grid-row">
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
                  {tick >= 1000000 ? `${(tick / 1000000).toFixed(1)}Tr` : `${Math.round(tick / 1000)}k`}
                </text>
              </g>
            );
          })}

          {/* Render Stacked Bars (Digital on top, Cash at bottom) */}
          {data.map((d, idx) => {
            const x = getX(idx);
            const cashHeight = (d.cashAmount / maxRevenue) * chartHeight;
            const digitalHeight = (d.digitalAmount / maxRevenue) * chartHeight;
            const totalHeight = cashHeight + digitalHeight;
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                style={{ cursor: "pointer", transition: "opacity 0.2s ease" }}
                opacity={hoveredIdx !== null && !isHovered ? 0.45 : 1}
              >
                {/* Invisible Hitbox */}
                <rect
                  x={x - 6}
                  y={paddingTop}
                  width={barWidth + 12}
                  height={chartHeight}
                  fill="transparent"
                />

                {/* Cash portion (Bottom) */}
                <rect
                  x={x}
                  y={paddingTop + chartHeight - cashHeight}
                  width={barWidth}
                  height={cashHeight}
                  fill="url(#cashBarGradient)"
                  rx="4"
                />

                {/* Digital portion (Stacked Top) */}
                <rect
                  x={x}
                  y={paddingTop + chartHeight - totalHeight}
                  width={barWidth}
                  height={digitalHeight}
                  fill="url(#digitalBarGradient)"
                  rx="4"
                />

                {/* Subtle highlight border when hovered */}
                {isHovered && (
                  <rect
                    x={x - 2}
                    y={paddingTop + chartHeight - totalHeight - 2}
                    width={barWidth + 4}
                    height={totalHeight + 4}
                    fill="none"
                    stroke="#14afbe"
                    strokeWidth="2"
                    rx="6"
                  />
                )}

                {/* X Axis Time label */}
                <text
                  x={x + barWidth / 2}
                  y={height - 12}
                  textAnchor="middle"
                  className={`pm-axis-x-label ${isHovered ? "active" : ""}`}
                  fontSize="10"
                >
                  {d.timeLabel.split(" - ")[0]}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredItem && (
          <div
            className="pm-chart-tooltip"
            style={{
              left: `clamp(10px, ${(getX(hoveredIdx!) / width) * 100}%, calc(100% - 210px))`,
              top: `20px`,
            }}
          >
            <div className="pm-tooltip-time">{hoveredItem.timeLabel}</div>
            <div className="pm-tooltip-row">
              <span className="text-cyan">Chuyển khoản/Ví:</span>
              <strong>{formatVnd(hoveredItem.digitalAmount)}</strong>
            </div>
            <div className="pm-tooltip-row">
              <span className="text-navy">Tiền mặt S2-06:</span>
              <strong>{formatVnd(hoveredItem.cashAmount)}</strong>
            </div>
            <div className="pm-tooltip-divider" />
            <div className="pm-tooltip-row total">
              <span>Tổng:</span>
              <strong>{formatVnd(hoveredItem.totalRevenue)}</strong>
            </div>
            <div className="pm-tooltip-badge">
              <span>{hoveredItem.transactionCount} lượt xe thanh toán</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="pm-chart-footer">
        <div className="pm-legend-item">
          <span className="pm-legend-dot cyan" />
          <span>Thanh toán số (Ví điện tử / VietQR / App) - 58%</span>
        </div>
        <div className="pm-legend-item">
          <span className="pm-legend-dot navy" />
          <span>Tiền mặt thu tại cổng (S2-06) - 42%</span>
        </div>
      </div>
    </div>
  );
}
