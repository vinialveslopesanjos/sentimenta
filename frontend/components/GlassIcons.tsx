/**
 * Glassmorphic Icon Components
 * Inspired by the imported Glassmorphism Icon Pack
 * Self-contained, reusable icons with glass effect + gradient glow
 */

interface GlassIconProps {
  size?: number;
  className?: string;
}

function GlassShell({ size = 48, className = "", children, glowColor }: GlassIconProps & { children: React.ReactNode; glowColor: string }) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Glow behind */}
      <div
        className="absolute inset-0 rounded-[30%] blur-lg opacity-40"
        style={{ background: glowColor }}
      />
      {/* Glass card */}
      <div
        className="relative flex items-center justify-center rounded-[30%] overflow-hidden"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          background: "linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.12))",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.3)",
          boxShadow: "0 4px 16px -4px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.4)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Chart / Analytics icon - teal glow */
export function GlassChartIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.35;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #39b8c6, #88d4dd)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="12" width="4" height="9" rx="1" fill="url(#gc1)" />
        <rect x="10" y="6" width="4" height="15" rx="1" fill="url(#gc2)" />
        <rect x="17" y="3" width="4" height="18" rx="1" fill="url(#gc3)" />
        <defs>
          <linearGradient id="gc1" x1="5" y1="12" x2="5" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#88d4dd" />
            <stop offset="1" stopColor="#39b8c6" />
          </linearGradient>
          <linearGradient id="gc2" x1="12" y1="6" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#61c6d1" />
            <stop offset="1" stopColor="#2e939e" />
          </linearGradient>
          <linearGradient id="gc3" x1="19" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#39b8c6" />
            <stop offset="1" stopColor="#1d4649" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Heart / Sentiment icon - rose glow */
export function GlassHeartIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #c56d89, #b6496b)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="url(#gh1)" />
        <defs>
          <linearGradient id="gh1" x1="12" y1="3" x2="12" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d392a6" />
            <stop offset="1" stopColor="#b6496b" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Shield / Alert icon - gold glow */
export function GlassShieldIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #c69a6c, #b88147)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5z" fill="url(#gs1)" />
        <path d="M12 8v4M12 16h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <defs>
          <linearGradient id="gs1" x1="12" y1="2" x2="12" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c69a6c" />
            <stop offset="1" stopColor="#b88147" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** People / Team icon - green-blue glow */
export function GlassPeopleIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #22c55e, #39b8c6)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3.5" fill="url(#gp1)" />
        <path d="M2 21v-2a5 5 0 0110 0v2" fill="url(#gp2)" />
        <circle cx="17" cy="9" r="2.5" fill="url(#gp3)" opacity="0.7" />
        <path d="M14 21v-1.5a4 4 0 016 0V21" fill="url(#gp3)" opacity="0.7" />
        <defs>
          <linearGradient id="gp1" x1="9" y1="3" x2="9" y2="11" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34d399" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="gp2" x1="7" y1="14" x2="7" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#39b8c6" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="gp3" x1="17" y1="6" x2="17" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#61c6d1" />
            <stop offset="1" stopColor="#39b8c6" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Bell / Notification icon - rose-gold glow */
export function GlassBellIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #b6496b, #b88147)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" fill="url(#gb1)" />
        <path d="M13.73 21a2 2 0 01-3.46 0" stroke="#b88147" strokeWidth="1.5" strokeLinecap="round" />
        <defs>
          <linearGradient id="gb1" x1="12" y1="2" x2="12" y2="17" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d392a6" />
            <stop offset="1" stopColor="#b6496b" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Zap / Lightning icon - gold glow */
export function GlassZapIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #c69a6c, #b88147)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="url(#gz1)" />
        <defs>
          <linearGradient id="gz1" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c69a6c" />
            <stop offset="1" stopColor="#b88147" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Eye / Visibility icon - teal glow */
export function GlassEyeIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #61c6d1, #39b8c6)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" fill="url(#ge1)" fillOpacity="0.3" />
        <circle cx="12" cy="12" r="4" fill="url(#ge2)" />
        <circle cx="12" cy="12" r="1.5" fill="white" />
        <defs>
          <linearGradient id="ge1" x1="1" y1="12" x2="23" y2="12" gradientUnits="userSpaceOnUse">
            <stop stopColor="#88d4dd" />
            <stop offset="1" stopColor="#39b8c6" />
          </linearGradient>
          <linearGradient id="ge2" x1="8" y1="8" x2="16" y2="16" gradientUnits="userSpaceOnUse">
            <stop stopColor="#61c6d1" />
            <stop offset="1" stopColor="#2e939e" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Target / Precision icon - rose-teal glow */
export function GlassTargetIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.38;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #b6496b, #39b8c6)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="url(#gt1)" strokeWidth="2" fill="none" />
        <circle cx="12" cy="12" r="6" stroke="url(#gt2)" strokeWidth="2" fill="none" />
        <circle cx="12" cy="12" r="2" fill="url(#gt3)" />
        <defs>
          <linearGradient id="gt1" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="#88d4dd" />
            <stop offset="1" stopColor="#39b8c6" />
          </linearGradient>
          <linearGradient id="gt2" x1="6" y1="6" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c56d89" />
            <stop offset="1" stopColor="#b6496b" />
          </linearGradient>
          <linearGradient id="gt3" x1="10" y1="10" x2="14" y2="14" gradientUnits="userSpaceOnUse">
            <stop stopColor="#d392a6" />
            <stop offset="1" stopColor="#b6496b" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

/** Link / Connect icon - green-teal glow */
export function GlassLinkIcon({ size = 48, className = "" }: GlassIconProps) {
  const s = size * 0.35;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #22c55e, #39b8c6)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="url(#gli1)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="url(#gli2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="gli1" x1="15" y1="3" x2="15" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="#39b8c6" />
            <stop offset="1" stopColor="#22c55e" />
          </linearGradient>
          <linearGradient id="gli2" x1="9" y1="9" x2="9" y2="21" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22c55e" />
            <stop offset="1" stopColor="#39b8c6" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

