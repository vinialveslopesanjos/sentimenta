/**
 * Glass-style social media icons
 * Simplified from Figma export — uses inline SVGs with glass effect
 */

interface GlassIconProps {
  size?: number;
  className?: string;
}

function GlassShell({ size = 48, children, glowColor, className = "" }: GlassIconProps & { children: React.ReactNode; glowColor: string }) {
  const inner = size * 0.85;
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-[30%] blur-md opacity-30" style={{ background: glowColor }} />
      <div
        className="relative flex items-center justify-center rounded-[30%] overflow-hidden"
        style={{
          width: inner,
          height: inner,
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

export function GlassInstagram({ size = 48, className }: GlassIconProps) {
  const s = size * 0.4;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #E1306C, #FCAF45)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-grad)" strokeWidth="2" />
        <circle cx="12" cy="12" r="5" stroke="url(#ig-grad)" strokeWidth="2" />
        <circle cx="18" cy="6" r="1.5" fill="url(#ig-grad)" />
        <defs>
          <linearGradient id="ig-grad" x1="2" y1="22" x2="22" y2="2">
            <stop stopColor="#FCAF45" />
            <stop offset="0.5" stopColor="#E1306C" />
            <stop offset="1" stopColor="#833AB4" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

export function GlassYoutube({ size = 48, className }: GlassIconProps) {
  const s = size * 0.4;
  return (
    <GlassShell size={size} className={className} glowColor="#FC0D1B">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M22.5 6.2C22.2 5.1 21.4 4.3 20.3 4C18.7 3.5 12 3.5 12 3.5S5.3 3.5 3.7 4C2.6 4.3 1.8 5.1 1.5 6.2C1 7.8 1 12 1 12S1 16.2 1.5 17.8C1.8 18.9 2.6 19.7 3.7 20C5.3 20.5 12 20.5 12 20.5S18.7 20.5 20.3 20C21.4 19.7 22.2 18.9 22.5 17.8C23 16.2 23 12 23 12S23 7.8 22.5 6.2Z" fill="#FC0D1B" />
        <path d="M10 15.5L16 12L10 8.5V15.5Z" fill="white" />
      </svg>
    </GlassShell>
  );
}

export function GlassTiktok({ size = 48, className }: GlassIconProps) {
  const s = size * 0.4;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #25F4EE, #FE2C55)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M9 12C6.8 12 5 13.8 5 16C5 18.2 6.8 20 9 20C11.2 20 13 18.2 13 16V4C14 6.5 16.5 8 19 8" stroke="url(#tt-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <defs>
          <linearGradient id="tt-grad" x1="5" y1="20" x2="19" y2="4">
            <stop stopColor="#FE2C55" />
            <stop offset="0.5" stopColor="#000" />
            <stop offset="1" stopColor="#25F4EE" />
          </linearGradient>
        </defs>
      </svg>
    </GlassShell>
  );
}

export function GlassTwitter({ size = 48, className }: GlassIconProps) {
  const s = size * 0.4;
  return (
    <GlassShell size={size} className={className} glowColor="#1DA1F2">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="#1DA1F2">
        <path d="M23 3C22.1 3.7 21 4.1 19.8 4.3C20.7 3.5 21.3 2.5 21.7 1.3C20.8 2 19.8 2.5 18.7 2.8C17.9 1.9 16.7 1.3 15.4 1.3C12.9 1.3 10.9 3.3 10.9 5.8C10.9 6.2 10.9 6.5 11 6.8C7.7 6.7 4.7 4.9 2.7 2.1C2.3 2.9 2 3.8 2 4.7C2 6.4 2.9 7.9 4.2 8.8C3.4 8.8 2.7 8.5 2 8.2V8.3C2 10.5 3.6 12.3 5.7 12.8C5.3 12.9 4.8 12.9 4.4 12.9C4.1 12.9 3.8 12.9 3.5 12.8C4.1 14.6 5.8 15.9 7.8 15.9C6.2 17.2 4.2 17.9 1.9 17.9C1.5 17.9 1.2 17.9 0.8 17.8C2.9 19.2 5.3 20 7.9 20C15.4 20 19.5 12.9 19.5 6.7V6.1C20.4 5.4 21.2 4.5 21.8 3.5L23 3Z" />
      </svg>
    </GlassShell>
  );
}

export function GlassX({ size = 48, className }: GlassIconProps) {
  const s = size * 0.35;
  return (
    <GlassShell size={size} className={className} glowColor="linear-gradient(135deg, #333, #666)">
      <svg width={s} height={s} viewBox="0 0 24 24" fill="var(--text-primary, #000)">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    </GlassShell>
  );
}

export function GlassSocialIcon({ platform, size = 48 }: { platform: string; size?: number }) {
  switch (platform.toLowerCase()) {
    case "instagram": return <GlassInstagram size={size} />;
    case "youtube": return <GlassYoutube size={size} />;
    case "tiktok": return <GlassTiktok size={size} />;
    case "twitter": return <GlassTwitter size={size} />;
    case "x":
    case "x / twitter": return <GlassX size={size} />;
    default: return null;
  }
}
