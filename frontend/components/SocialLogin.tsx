"use client";

import { useEffect, useRef, useState } from "react";
import { authApi } from "@/lib/api";
import { setTokens } from "@/lib/auth";
import { useRouter } from "next/navigation";

// Tipo global de window.google já declarado em lib/useGoogleLogin.ts
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/**
 * Botões de login social. Instagram funciona sempre (credencial já configurada);
 * Google só aparece quando NEXT_PUBLIC_GOOGLE_CLIENT_ID está setado (ver
 * docs/prioridade/GOOGLE_OAUTH_SETUP.md). Login social pula o muro de
 * verificação de e-mail — o e-mail já vem verificado do provedor.
 */
export default function SocialLogin({ onError }: { onError?: (msg: string) => void }) {
  const router = useRouter();
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [instaLoading, setInstaLoading] = useState(false);

  async function handleInstagram() {
    setInstaLoading(true);
    try {
      const { auth_url } = await authApi.instagramAuthUrl();
      window.location.href = auth_url;
    } catch (err) {
      setInstaLoading(false);
      onError?.(err instanceof Error ? err.message : "Falha ao iniciar login com Instagram");
    }
  }

  // Google Identity Services — só quando há client id configurado
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleBtnRef.current) return;

    async function handleCredential(response: { credential: string }) {
      try {
        const res = await authApi.googleLogin(response.credential);
        setTokens(res.access_token, res.refresh_token);
        router.replace("/dashboard");
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Falha ao entrar com Google");
      }
    }

    const init = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
    };

    if (window.google) {
      init();
    } else {
      const existing = document.getElementById("google-gsi");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "google-gsi";
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.onload = init;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", init);
      }
    }
  }, [router, onError]);

  return (
    <div className="space-y-3">
      {GOOGLE_CLIENT_ID && (
        <div ref={googleBtnRef} className="flex justify-center" />
      )}

      <button
        type="button"
        onClick={handleInstagram}
        disabled={instaLoading}
        className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl font-medium transition-all disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)", color: "white", fontSize: "0.88rem" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
        {instaLoading ? "Redirecionando..." : "Continuar com Instagram"}
      </button>
    </div>
  );
}
