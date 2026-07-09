"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/ds/Logo";

function DeletionContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/v1/meta/deletion-status/${encodeURIComponent(code)}`)
      .then(r => r.json())
      .then(d => setStatus(d.status || "completed"))
      .catch(() => setStatus("completed"));
  }, [code]);

  return (
    <main className="max-w-[640px] mx-auto px-4 py-12">
      {code && (
        <div className="rounded-2xl p-5 mb-8 flex items-start gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: "var(--sentiment-positive, #22c55e)" }} />
          <div>
            <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
              {status === null ? "Verificando sua solicitação..." : "Exclusão concluída"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
              Código de confirmação: <code style={{ color: "var(--primary)" }}>{code}</code>
              <br />
              Os dados associados à sua conta do Instagram foram removidos dos nossos servidores.
            </p>
          </div>
        </div>
      )}

      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.8rem", fontWeight: 800, color: "var(--text-primary)" }}>
        Exclusão de dados
      </h1>
      <div className="mt-4 space-y-4 text-sm" style={{ color: "var(--text-muted)", lineHeight: 1.8 }}>
        <p>
          O Sentimenta analisa comentários públicos dos seus perfis conectados. Você pode
          excluir seus dados a qualquer momento, por qualquer um destes caminhos:
        </p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>
            <strong style={{ color: "var(--text-primary)" }}>Pelo painel:</strong> Conta → Zona de Perigo →
            "Excluir Conta". Remove permanentemente sua conta e todos os dados (perfis, posts,
            comentários e análises).
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>Pelo Instagram:</strong> Configurações →
            Site e apps → remova o app "sentimenta". A Meta nos notifica automaticamente e
            excluímos os dados da sua conta do Instagram na hora — você recebe um código de
            confirmação como o exibido nesta página.
          </li>
          <li>
            <strong style={{ color: "var(--text-primary)" }}>Por e-mail:</strong> escreva para{" "}
            <a href="mailto:contato@mazylabs.com.br" style={{ color: "var(--primary)" }}>contato@mazylabs.com.br</a>{" "}
            informando o e-mail ou @ da conta. Atendemos em até 72h úteis.
          </li>
        </ol>
        <p className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" style={{ color: "var(--primary)" }} />
          Detalhes sobre o tratamento de dados na nossa{" "}
          <Link href="/privacidade" style={{ color: "var(--primary)" }}>Política de Privacidade</Link>.
        </p>
      </div>
    </main>
  );
}

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <header className="flex items-center px-4 md:px-8 h-16 max-w-[640px] mx-auto">
        <Link href="/"><Logo size="md" /></Link>
      </header>
      <Suspense fallback={null}>
        <DeletionContent />
      </Suspense>
    </div>
  );
}
