"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { connectionsApi } from "@/lib/api";
import { getToken } from "@/lib/auth";

export default function TikTokPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { router.replace("/login"); return; }
    connectionsApi.list(token).then(conns => {
      const tt = conns.find(c => c.platform === "tiktok");
      if (tt) router.replace(`/dashboard/profile/${tt.id}`);
      else router.replace("/dashboard/connect");
    }).catch(() => router.replace("/dashboard"));
  }, [router]);

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
    </div>
  );
  return null;
}
