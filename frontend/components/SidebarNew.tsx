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
  FileText,
  Activity,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "./ds/Logo";
import { GlassInstagram, GlassYoutube, GlassTiktok, GlassTwitter, GlassX } from "./GlassSocialIcons";
import { authApi, connectionsApi, creditsApi } from "@/lib/api";
import { clearTokens, getRefreshToken, getToken } from "@/lib/auth";
import { CreditIndicator } from "./CreditBalance";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";

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
  const [creditData, setCreditData] = useState<{ total: number; planAllocation: number; planCredits: number } | null>(null);
  const [userPlan, setUserPlan] = useState("free");
  const router = useRouter();
  const pathname = usePathname();

  const navItems = navItemDefs.map(d => ({ ...d, label: tn(d.labelKey) }));
  if (userPlan === "admin") {
    navItems.push({ icon: FileText, labelKey: "account", path: "/dashboard/admin/blog", label: "Blog" });
    navItems.push({ icon: Activity, labelKey: "account", path: "/dashboard/admin/operations", label: "Operações" });
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authApi.me(token).then((user) => setUserPlan(user.plan || "free")).catch(() => {});
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
    creditsApi.getCredits(token).then((data) => {
      setCreditData({ total: data.total, planAllocation: data.plan_allocation, planCredits: data.plan_credits });
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
            <span className="px-1 py-px rounded text-[0.5rem] font-semibold tracking-wide uppercase" style={{ backgroundColor: "var(--primary-bg)", color: "var(--primary)", lineHeight: 1.2 }}>
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
            <button
              type="button"
              aria-label={tn("dashboard")}
              aria-current={isDashActive && !connections.some(c => pathname.startsWith(c.path)) ? "page" : undefined}
              className="flex items-center gap-3 flex-1"
              onClick={() => navigate("/dashboard")}
            >
              <LayoutDashboard className="w-[18px] h-[18px] shrink-0" strokeWidth={isDashActive ? 2 : 1.5} />
              {!collapsed && (
                <span className="flex-1 text-left" style={{ fontSize: "0.85rem", fontWeight: isDashActive ? 500 : 400 }}>
                  Dashboard
                </span>
              )}
            </button>
            {!collapsed && connections.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDashExpanded(!dashExpanded);
                }}
                aria-label={dashExpanded ? tn("hideProfiles") : tn("showProfiles")}
                aria-expanded={dashExpanded}
                aria-controls="sidebar-profile-links"
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
            <div id="sidebar-profile-links" className="ml-3 pl-3 mt-0.5 space-y-0.5" style={{ borderLeft: "1px solid var(--border)" }}>
              {connections.map(child => {
                const isActive = pathname.startsWith(child.path);
                return (
                  <button
                    type="button"
                    key={child.path}
                    onClick={() => navigate(child.path)}
                    aria-label={`${child.label} · ${child.platform}`}
                    aria-current={isActive ? "page" : undefined}
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
              type="button"
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
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
        {!collapsed && creditData && (
          <button
            type="button"
            className="mb-1 w-full cursor-pointer text-left"
            onClick={() => navigate("/dashboard/settings?tab=billing")}
          >
            <CreditIndicator
              total={creditData.total}
              planAllocation={creditData.planAllocation}
              planCredits={creditData.planCredits}
            />
          </button>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? tn("expand") : tn("collapse")}
          aria-expanded={!collapsed}
          className="hidden md:flex w-full items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
          style={{ color: "var(--text-faint)" }}
        >
          {collapsed ? <ChevronRight className="w-[18px] h-[18px]" /> : <ChevronLeft className="w-[18px] h-[18px]" />}
          {!collapsed && <span style={{ fontSize: "0.85rem" }}>{tn("collapse")}</span>}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          aria-label={tn("logout")}
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
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={tn("openMenu")}
            className="fixed z-[60] flex h-10 w-10 items-center justify-center rounded-full md:hidden"
            style={{ top: "7px", left: "12px", backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)", boxShadow: "0 2px 12px -2px rgba(0,0,0,0.08)" }}
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
          </button>
        </SheetTrigger>
        <SheetContent
          id="mobile-sidebar"
          aria-modal="true"
          side="left"
          closeLabel={tn("closeMenu")}
          overlayClassName="z-[65] bg-black/40 md:hidden"
          className="z-[70] h-screen w-[260px] max-w-[calc(100%-2rem)] gap-0 border-r p-0 md:hidden"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "4px 0 16px -4px rgba(0,0,0,0.1)" }}
        >
          <SheetTitle className="sr-only">{tn("openMenu")}</SheetTitle>
          {sidebarContent}
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen flex-col z-50 transition-all duration-300 hidden md:flex ${
          collapsed ? "w-[64px]" : "w-[240px]"
        }`}
        style={{ backgroundColor: "var(--bg-card)", borderRight: "1px solid var(--border)", boxShadow: "1px 0 8px -2px rgba(0,0,0,0.04)" }}
      >
        {sidebarContent}
      </aside>

    </>
  );
}
