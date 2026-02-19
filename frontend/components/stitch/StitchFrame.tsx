"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

type StitchFrameProps = {
  page: "landing" | "login" | "dashboard" | "connect" | "profile" | "post" | "logs" | "settings" | "compare" | "alerts";
  requireAuth?: boolean;
};

export default function StitchFrame({ page, requireAuth = false }: StitchFrameProps) {
  const router = useRouter();
  const [ready, setReady] = useState(!requireAuth);

  useEffect(() => {
    if (!requireAuth) {
      setReady(true);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setReady(true);
  }, [requireAuth, router]);

  if (!ready) {
    return (
      <div className="fixed inset-0 grid place-items-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <iframe
      className="fixed inset-0 h-[100dvh] w-screen border-0"
      src={`/stitch/${page}.html`}
      title={`stitch-${page}`}
    />
  );
}
