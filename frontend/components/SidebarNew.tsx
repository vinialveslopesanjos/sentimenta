"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Link2,
  GitBranch,
  BarChart3,
  Bell,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "./ds/Logo";
import { GlassInstagram, GlassYoutube, GlassTiktok, GlassTwitter, GlassX } from "./GlassSocialIcons";
import { authApi, connectionsApi } from "@/lib/api";
import { clearTokens, getRefreshToken, getToken } from "@/lib/auth";

interface SubItem {
  label: string;
  path: string;
  icon?: React.ReactNode;
  platform: string;
  connectionId?: string;
}

const platformIconMap: Record<string, (size: number) => React.ReactNode> = {
  instagram: (size) => <GlassInstagram size={size} />,
  youtube: (size) => <GlassYoutube size={size} />,
  tiktok: (size) => <GlassTiktok size={size} />,
  twitter: (size) => <GlassX size={size} />,
};

const platformShortMap: Record<string, string> = {
  instagram: "IG",
  youtube: "YT",
  tiktok: "TK",
  twitter: "X",
};

const navItemDefs = [
  { icon: Link2, labelKey: "connectProfiles" as const, path: "/dashboard/connect" },
  { icon: GitBranch, labelKey: "pipelineLogs" as const, path: "/dashboard/logs" },
  { icon: BarChart3, labelKey: "analysis" as const, path: "/dashboard/analysis" },
  { icon: Bell, labelKey: "alerts" as const, path: "/dashboard/alerts" },
  { icon: UserCircle, labelKey: "account" as const, path: "/dashboard/settings" },
];

export default function SidebarNew() {
  const tn = useTranslations("nav");
  const [collapsed, setCollapsed] = useState(false);
  const [dashExpanded, setDashExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [connections, setConnections] = useState<SubItem[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  const navItems = navItemDefs.map(d => ({ ...d, label: tn(d.labelKey) }));

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    connectionsApi.list(token).then((conns) => {
      const items: SubItem[] = conns.map((c) => ({
        label: `@${c.username}`,
        path: `/dashboard/profile/${c.id}`,
        icon: platformIconMap[c.platform]?.(16),
        platform: c.platform.charAt(0).toUpperCase() + c.platform.slice(1),
        connectionId: c.id,
      }));
      setConnections(items);
    }).catch(() => {});
  }, []);

  const isDashActive = pathname === "/dashboard" || connections.some(c => pathname.startsWith(c.path));

  const handleLogout = async () => {
    const token = getToken();
    const refreshToken = getRefreshToken();
    if (token) {
      try {
        await authApi.logout(token, refreshToken);
      } catch {}
    }
    clearTokens();
    router.replace("/login");
  };

  const navigate = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center px-4 h-16 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo size={collapsed ? "sm" : "md"} showText={!collapsed} />
          {!collapsed && (
            <span className="px-1.5 py-0.5 rounded text-[0.55rem] font-bold tracking-wider uppercase" style={{ backgroundColor: "var(--primary-bg)", color: "var(--primary)", border: "1px solid var(--primary)", lineHeight: 1.2 }}>
              beta
            </span>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2.5 flex flex-col gap-0.5 overflow-y-auto">
        {/* Dashboard parent */}
        <div>
          <div
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative cursor-pointer"
            style={{
              backgroundColor: isDashActive && !connections.some(c => pathname.startsWith(c.path)) ? "var(--primary-bg)" : "transparent",
              color: isDashActive ? "var(--primary)" : "var(--text-muted)",
            }}
          >
            {isDashActive && !connections.some(c => pathname.startsWith(c.path)) && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: "var(--primary)" }} />
            )}
            <div
              className="flex items-center gap-3 flex-1"
              onClick={() => navigate("/dashboard")}
            >
              <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={isDashActive ? 2 : 1.5} />
              {!collapsed && (
                <span className="flex-1 text-left" style={{ fontSize: "0.85rem", fontWeight: isDashActive ? 500 : 400 }}>
                  Dashboard
                </span>
              )}
            </div>
            {!collapsed && connections.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDashExpanded(!dashExpanded);
                }}
                className="p-0.5 rounded-md hover:opacity-70 transition-opacity"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${dashExpanded ? "rotate-0" : "-rotate-90"}`}
                />
              </button>
            )}
          </div>

          {/* Children dropdown — real connections */}
          {!collapsed && dashExpanded && connections.length > 0 && (
            <div className="ml-3 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: "1px solid var(--border)" }}>
              {connections.map(child => {
                const isActive = pathname.startsWith(child.path);
                return (
                  <button
                    key={child.path}
                    onClick={() => navigate(child.path)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-200"
                    style={{
                      backgroundColor: isActive ? "var(--primary-bg)" : "transparent",
                      color: isActive ? "var(--primary)" : "var(--text-faint)",
                    }}
                  >
                    {child.icon}
                    <span className="flex-1 text-left truncate" style={{ fontSize: "0.78rem", fontWeight: isActive ? 500 : 400 }}>
                      {child.label}
                    </span>
                    <span className="shrink-0" style={{ fontSize: "0.6rem", color: "var(--text-xfaint)" }}>
                      {platformShortMap[child.platform.toLowerCase()] || child.platform}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px my-2 mx-1" style={{ backgroundColor: "var(--border)" }} />

        {/* Other nav items */}
        {navItems.map((item) => {
          const isActive =
            pathname === item.path ||
            (item.path !== "/dashboard" && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative"
              style={{
                backgroundColor: isActive ? "var(--primary-bg)" : "transparent",
                color: isActive ? "var(--primary)" : "var(--text-muted)",
              }}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: "var(--primary)" }} />
              )}
              <item.icon className="w-[18px] h-[18px] shrink-0" strokeWidth={isActive ? 2 : 1.5} />
              {!collapsed && (
                <span style={{ fontSize: "0.85rem", fontWeight: isActive ? 500 : 400 }}>
                  {item.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2.5 pb-4 space-y-1 pt-3 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          style={{ color: "var(--text-faint)" }}
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!collapsed && <span style={{ fontSize: "0.85rem" }}>{tn("collapse")}</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          style={{ color: "var(--text-faint)" }}
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.5} />
          {!collapsed && <span style={{ fontSize: "0.85rem" }}>{tn("logout")}</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed z-[60] md:hidden w-10 h-10 rounded-full flex items-center justify-center"
        style={{ top: "7px", left: "12px", backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", boxShadow: "0 2px 12px -2px rgba(0,0,0,0.08)" }}
      >
        <Menu className="w-[18px] h-[18px]" strokeWidth={1.8} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[55] bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen flex-col z-50 transition-all duration-300 hidden md:flex ${
          collapsed ? "w-[64px]" : "w-[240px]"
        }`}
        style={{ backgroundColor: "var(--bg-card)", borderRight: "1px solid var(--border)", boxShadow: "1px 0 8px -2px rgba(0,0,0,0.04)" }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen w-[260px] flex flex-col z-[60] transition-transform duration-300 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "var(--bg-card)", borderRight: "1px solid var(--border)", boxShadow: "4px 0 16px -4px rgba(0,0,0,0.1)" }}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-3 p-1 rounded-lg"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>
    </>
  );
}
