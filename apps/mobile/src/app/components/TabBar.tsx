import React from "react";
import { useNavigate, useLocation } from "react-router";
import { motion } from "motion/react";
import {
  LayoutDashboard,
  Link2,
  Bell,
  BarChart3,
  Settings,
} from "lucide-react";

const tabs = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Home" },
  { path: "/connect", icon: Link2, label: "Conectar" },
  { path: "/alerts", icon: Bell, label: "Alertas" },
  { path: "/compare", icon: BarChart3, label: "Comparar" },
  { path: "/settings", icon: Settings, label: "Config" },
];

export function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return (
        location.pathname === "/dashboard" ||
        location.pathname === "/" ||
        location.pathname.startsWith("/dashboard/connection") ||
        location.pathname.startsWith("/posts")
      );
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-[430px] mx-auto">
        <div
          style={{
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderTop: "1px solid rgba(196,181,253,0.15)",
          }}
        >
          <div className="flex items-center justify-around px-2 pt-2 pb-6">
            {tabs.map((tab) => {
              const active = isActive(tab.path);
              const Icon = tab.icon;
              return (
                <button
                  key={tab.path}
                  onClick={() => navigate(tab.path)}
                  className="flex flex-col items-center gap-0.5 min-w-[56px] py-1 relative"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  {/* Liquid blob indicator */}
                  <div className="relative flex items-center justify-center w-12 h-9">
                    {active && (
                      <motion.div
                        layoutId="liquid-blob"
                        className="absolute inset-0 rounded-[18px]"
                        style={{
                          background:
                            "linear-gradient(135deg, rgba(196,181,253,0.28) 0%, rgba(103,232,249,0.18) 100%)",
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 380,
                          damping: 28,
                          mass: 0.8,
                        }}
                      />
                    )}

                    {/* Glow pulse on active */}
                    {active && (
                      <motion.div
                        layoutId="liquid-glow"
                        className="absolute inset-0 rounded-[18px]"
                        style={{
                          background:
                            "radial-gradient(circle at center, rgba(139,92,246,0.2) 0%, transparent 70%)",
                        }}
                        animate={{
                          opacity: [0.6, 1, 0.6],
                          scale: [0.95, 1.05, 0.95],
                        }}
                        transition={{
                          duration: 2.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}

                    <div className="relative z-10">
                      <Icon
                        size={22}
                        className="transition-colors duration-200"
                        style={{
                          color: active ? "#8B5CF6" : "#94A3B8",
                          strokeWidth: active ? 2.2 : 1.5,
                        }}
                      />
                    </div>

                    {/* Notification dot */}
                    {tab.path === "/alerts" && (
                      <motion.div
                        className="absolute top-0 right-1 w-2 h-2 bg-rose-400 rounded-full z-20"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.6, repeat: Infinity }}
                      />
                    )}
                  </div>

                  <motion.span
                    animate={{
                      color: active ? "#8B5CF6" : "#94A3B8",
                      fontWeight: active ? 500 : 400,
                    }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontSize: "10px",
                      fontFamily: "'Outfit', sans-serif",
                    }}
                  >
                    {tab.label}
                  </motion.span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
