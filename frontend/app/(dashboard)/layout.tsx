"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { clearTokens, getToken } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    authApi
      .me(token)
      .then((user) => {
        setUserName(user.name);
        setOk(true);
      })
      .catch(() => {
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  if (!ok) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-brand-bg">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-lg shadow-violet-100 animate-pulse">
            <svg fill="none" height="20" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="20">
              <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
            </svg>
          </div>
          <div className="h-1 w-24 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full w-full progress-shimmer rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-brand-bg">
      <Sidebar userName={userName} />
      <div className="flex-1 min-w-0 flex flex-col">
        {children}
      </div>
    </div>
  );
}
