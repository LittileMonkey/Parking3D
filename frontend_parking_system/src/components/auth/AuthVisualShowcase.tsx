import { KeyRound, ShieldCheck } from "lucide-react";

// Decorative diagrams, independent of live availability or verification state.
export default function AuthVisualShowcase({ recovery = false }: { recovery?: boolean }) {
  if (recovery) {
    return (
      <div className="auth-recovery-visual">
        <div className="auth-recovery-emblem" aria-hidden="true">
          <span className="auth-recovery-orbit" />
          <ShieldCheck size={64} strokeWidth={1.2} />
          <span className="auth-recovery-key"><KeyRound size={22} strokeWidth={1.5} /></span>
        </div>
        <ol className="auth-recovery-steps" aria-label="Các bước khôi phục mật khẩu">
          <li><span>01</span>Email</li>
          <li><span>02</span>Mã OTP</li>
          <li><span>03</span>Mật khẩu mới</li>
        </ol>
      </div>
    );
  }

  return (
    <figure className="auth-parking-visual">
      <svg className="auth-parking-diagram" viewBox="0 0 480 310" fill="none" aria-hidden="true">
        <defs>
          <pattern id="auth-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" stroke="currentColor" strokeOpacity=".045" />
          </pattern>
          <g id="auth-map-car">
            <rect x="6" y="6" width="23" height="44" rx="8" fill="currentColor" fillOpacity=".16" />
            <path d="M10 18h15M10 37h15" stroke="currentColor" strokeOpacity=".4" strokeWidth="3" />
            <rect x="6" y="6" width="23" height="44" rx="8" stroke="currentColor" strokeOpacity=".35" />
          </g>
          <g id="auth-map-bay">
            <path d="M0 0v58h36V0" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.5" />
          </g>
        </defs>
        <rect width="480" height="310" fill="url(#auth-map-grid)" />
        <ellipse cx="245" cy="264" rx="174" ry="20" fill="currentColor" fillOpacity=".04" />
        <g transform="translate(72 46) matrix(1 .15 -.32 .85 0 0)">
          <rect x="0" y="13" width="365" height="222" rx="18" fill="var(--color-ice)" stroke="currentColor" strokeOpacity=".12" />
          <rect width="365" height="222" rx="18" fill="var(--color-white)" stroke="currentColor" strokeOpacity=".24" />
          <path d="M20 111h325" stroke="currentColor" strokeOpacity=".12" strokeDasharray="6 7" />
          <g transform="translate(32 24)">
            {[0, 43, 86, 129, 172, 215, 258].map((x, i) => (
              <g key={x} transform={`translate(${x} 0)`}>
                <use href="#auth-map-bay" />
                {[0, 1, 4, 6].includes(i) && <use href="#auth-map-car" />}
              </g>
            ))}
          </g>
          <g transform="translate(32 140)">
            {[0, 43, 86, 129, 172, 215, 258].map((x, i) => (
              <g key={x} transform={`translate(${x} 0)`}>
                <use href="#auth-map-bay" />
                {[0, 2, 3, 6].includes(i) && <use href="#auth-map-car" />}
              </g>
            ))}
          </g>
          <rect x="158" y="21" width="42" height="64" rx="6" fill="var(--color-ice)" stroke="currentColor" strokeWidth="1.5" />
          <text x="179" y="62" textAnchor="middle" fill="currentColor" fontSize="25" fontWeight="600">P</text>
          <path d="M15 111h119q45 0 45-25V69" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 6" />
          <circle cx="16" cy="111" r="5" fill="currentColor" />
          <path d="m173 77 6-8 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <path d="M355 39v28" stroke="currentColor" strokeOpacity=".25" strokeDasharray="3 4" />
        <circle cx="355" cy="30" r="12" fill="var(--color-white)" stroke="currentColor" strokeOpacity=".2" />
        <path d="m351 30 3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption>
        <span>Không gian đỗ xe, trong tầm tay.</span>
        <span>Sơ đồ minh họa</span>
      </figcaption>
    </figure>
  );
}
