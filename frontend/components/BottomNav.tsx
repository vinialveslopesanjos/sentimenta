"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const navItems = [
  { href: "/dashboard", icon: "dashboard", labelKey: "dashboard" },
  { href: "/connect", icon: "link", labelKey: "connect" },
  { href: "/alerts", icon: "notifications", labelKey: "alerts" },
  { href: "/logs", icon: "terminal", labelKey: "logs" },
  { href: "/settings", icon: "settings", labelKey: "config" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/90 backdrop-blur-xl border-t border-slate-100 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1.5 rounded-xl transition-colors ${
                isActive
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className={`material-symbols-outlined text-[22px]${isActive ? " font-variation-settings-fill" : ""}`} style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                {item.icon}
              </span>
              <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
              {isActive && (
                <div className="absolute bottom-1 w-5 h-0.5 rounded-full bg-slate-900" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
