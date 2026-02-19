"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearTokens, getToken } from "@/lib/auth";

const navItems = [
  { href: "/dashboard", icon: "grid_view", label: "Dashboard" },
  { href: "/connect", icon: "add_link", label: "Conectar" },
  { href: "/logs", icon: "sync_alt", label: "Logs" },
  { href: "/compare", icon: "bar_chart", label: "Comparativo" },
  { href: "/alerts", icon: "notifications_active", label: "Alertas" },
  { href: "/settings", icon: "manage_accounts", label: "Configurações" },
];

export default function Sidebar({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const token = getToken();
    if (token) {
      try {
        await authApi.logout?.(token);
      } catch {
        // ignore
      }
    }
    clearTokens();
    router.replace("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden md:flex w-20 bg-white/60 border-r border-slate-100 flex-col items-center py-6 gap-6 shrink-0 z-20">
      {/* Logo mark */}
      <Link href="/dashboard" className="shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100 hover:scale-105 transition-transform">
          <svg
            fill="none"
            height="20"
            stroke="white"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            width="20"
          >
            <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
          </svg>
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-2 flex-1 mt-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative group p-2.5 rounded-xl transition-all duration-200 flex items-center justify-center ${
                active
                  ? "bg-white shadow-active text-brand-lilacDark"
                  : "text-slate-400 hover:text-brand-lilacDark hover:bg-white hover:shadow-sm"
              }`}
              title={item.label}
            >
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
                {item.label}
              </span>
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-lilacDark rounded-r" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User avatar + logout */}
      <div className="mt-auto flex flex-col items-center gap-3">
        <button
          onClick={handleLogout}
          className="relative group w-10 h-10 rounded-full bg-gradient-to-br from-brand-lilacLight to-brand-cyanLight border-2 border-white shadow-sm flex items-center justify-center hover:ring-2 hover:ring-brand-lilac transition-all"
          title="Sair"
        >
          <span className="text-sm font-sans font-medium text-brand-lilacDark">
            {userName ? userName[0].toUpperCase() : "U"}
          </span>
          <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg">
            Sair
          </span>
        </button>
      </div>
    </aside>
  );
}
