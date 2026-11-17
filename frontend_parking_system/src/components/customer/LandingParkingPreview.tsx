import { useId } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Layers3, ParkingCircle } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

// An illustrative product visual. Live, bookable layouts belong to the selected lot's booking flow.
export default function LandingParkingPreview() {
  const { lang } = useLanguage();
  const text = (vi: string, en: string) => lang === "en" ? en : vi;
  const id = useId().replace(/:/g, "");
  const gridId = `${id}-grid`;
  const carId = `${id}-car`;

  return (
    <figure className="lp-parking-preview">
      <div className="lp-preview-toolbar">
        <span><Layers3 size={17} />{text("Không gian đỗ xe", "Your parking space")}</span>
        <span className="lp-preview-label">{text("Sơ đồ minh họa", "Illustrative layout")}</span>
      </div>

      <svg className="lp-preview-map" viewBox="0 0 520 340" role="img"
        aria-label={text("Minh họa sơ đồ bãi đỗ với các ô xe và lối di chuyển, không phải dữ liệu chỗ trống thực tế", "Illustrative parking layout with spaces and a driving aisle, not live availability")}>
        <defs>
          <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M28 0H0V28" fill="none" stroke="#072d59" strokeOpacity=".045" />
          </pattern>
          <g id={carId}>
            <rect x="7" y="10" width="19" height="37" rx="6" fill="#072d59" opacity=".1" />
            <rect x="6" y="6" width="19" height="37" rx="6" fill="currentColor" stroke="#072d59" strokeOpacity=".28" />
            <path d="M9 16h13l-2-6h-9zM10 33h11l1 6H9z" fill="#fff" fillOpacity=".8" />
            <path d="M8 20v9M23 20v9" stroke="#fff" strokeOpacity=".55" />
          </g>
        </defs>

        <rect width="520" height="340" rx="12" fill={`url(#${gridId})`} />
        <ellipse cx="258" cy="288" rx="206" ry="25" fill="#072d59" fillOpacity=".045" />
        <g transform="translate(146 28) matrix(.98 .24 -.54 .72 0 0)">
          <rect y="15" width="350" height="240" rx="17" fill="#dbeaf5" stroke="#b5ccde" />
          <rect width="350" height="240" rx="17" fill="#fff" stroke="#a9c2d9" />
          <rect x="13" y="92" width="324" height="46" rx="4" fill="#f0f6fb" />
          <path d="M18 115h314" stroke="#b5ccde" strokeDasharray="6 7" />

          {[0, 1].map(row => (
            <g key={row} transform={`translate(28 ${row === 0 ? 20 : 154})`}>
              {[0, 1, 2, 3, 4, 5, 6].map(column => {
                const selected = row === 0 && column === 4;
                const hasCar = row === 0 ? [0, 1, 3, 6].includes(column) : [0, 2, 3, 5].includes(column);
                return (
                  <g key={column} transform={`translate(${column * 43} 0)`}>
                    <rect width="32" height="56" rx="4" fill={selected ? "#dbf2fc" : "#f8fbfd"}
                      stroke={selected ? "#0d4685" : "#cfdeeb"} strokeWidth={selected ? 1.8 : 1} />
                    {hasCar && <use href={`#${carId}`} style={{ color: column % 3 === 0 ? "#7692ad" : "#d8e3ec" }} />}
                    {selected && <text x="16" y="36" textAnchor="middle" fill="#0d4685" fontSize="25" fontWeight="600">P</text>}
                    <text x="16" y={row === 0 ? -5 : 69} textAnchor="middle" fill="#7c96ad" fontSize="8">{row === 0 ? "A" : "B"}0{column + 1}</text>
                  </g>
                );
              })}
            </g>
          ))}

          <path d="M17 115h167q32 0 32-29v-9" fill="none" stroke="#0d4685" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 5" />
          <circle cx="17" cy="115" r="5" fill="#0d4685" />
          <path d="m211 85 5-8 5 8" fill="none" stroke="#0d4685" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m296 109 7 6-7 6" fill="none" stroke="#9bb4ca" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>

      <figcaption className="lp-preview-caption">
        <span className="lp-preview-caption-icon"><ParkingCircle size={22} /></span>
        <span><strong>{text("Chọn chỗ đỗ, theo cách của bạn.", "Your space. Your choice.")}</strong>
          <small>{text("Khám phá sơ đồ khi chọn một bãi đỗ.", "Explore the layout when you choose a lot.")}</small></span>
        <Link to="/booking" aria-label={text("Tìm bãi để xem sơ đồ", "Find a lot to view its layout")}><ArrowUpRight size={20} /></Link>
      </figcaption>
    </figure>
  );
}
