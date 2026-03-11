"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "sentimenta_cookie_consent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 sm:p-6">
      <div className="max-w-3xl mx-auto bg-white/95 backdrop-blur-lg border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 px-5 py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <p className="text-sm text-slate-600 flex-1 text-center sm:text-left">
          Usamos cookies para melhorar sua experiência na plataforma.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/privacidade"
            className="text-sm text-slate-400 hover:text-violet-600 transition-colors whitespace-nowrap"
          >
            Saiba mais
          </Link>
          <button
            onClick={handleAccept}
            className="px-5 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
