import Link from "next/link";
import type { Metadata } from "next";
import { Logo } from "@/components/ds/Logo";
import SentimentPreview from "@/components/SentimentPreview";
import type { PreviewResult } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

type Platform = "youtube" | "instagram";

async function fetchPreview(platform: string, handle: string): Promise<PreviewResult | null> {
  if (platform !== "youtube" && platform !== "instagram") return null;
  try {
    const res = await fetch(`${API_BASE}/public/preview/${platform}/${encodeURIComponent(handle)}`, {
      // cache curto no edge; o backend já cacheia 24h por @
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PreviewResult;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ platform: string; handle: string }> }
): Promise<Metadata> {
  const { platform, handle } = await params;
  const decoded = decodeURIComponent(handle);
  const data = await fetchPreview(platform, decoded);
  const score = data?.overall_score;
  const title = score != null
    ? `@${decoded.replace(/^@/, "")} tem reputação ${score}/10 — Sentimenta`
    : `Análise de sentimento de @${decoded.replace(/^@/, "")} — Sentimenta`;
  const description = score != null
    ? `A IA do Sentimenta leu os comentários e deu nota ${score}/10 de reputação. Veja o seu grátis.`
    : "Coloque seu @ e a IA lê o sentimento dos seus posts na hora. Grátis, sem cadastro.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PreviewPage(
  { params }: { params: Promise<{ platform: string; handle: string }> }
) {
  const { platform, handle } = await params;
  const decoded = decodeURIComponent(handle);
  const initialResult = await fetchPreview(platform, decoded);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <header className="flex items-center justify-between px-4 md:px-8 h-16 max-w-[1000px] mx-auto">
        <Link href="/"><Logo size="md" /></Link>
        <Link href="/login" className="text-sm font-medium" style={{ color: "var(--primary)" }}>Entrar</Link>
      </header>

      <main className="px-4 py-8 md:py-14">
        <div className="text-center mb-8 max-w-[560px] mx-auto">
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(1.6rem, 4vw, 2.2rem)", fontWeight: 800, color: "var(--text-primary)" }}>
            O que a audiência de <span style={{ color: "var(--primary)" }}>@{decoded.replace(/^@/, "")}</span> realmente sente
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            A IA leu os comentários dos posts recentes. Quer ver o seu? É grátis.
          </p>
        </div>

        <SentimentPreview
          initial={{ platform: platform as Platform, handle: decoded }}
          initialResult={initialResult}
        />
      </main>
    </div>
  );
}
