import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BarChart3, CheckCircle2, MessageSquareText, ShieldCheck } from "lucide-react";
import { CampaignCta } from "@/components/CampaignCta";
import { Logo } from "@/components/ds/Logo";
import { campaignMetadata, campaignPages } from "@/lib/campaigns";

type CampaignRouteProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return Object.keys(campaignPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: CampaignRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const page = campaignPages[slug as keyof typeof campaignPages];
  if (!page) return {};
  return campaignMetadata(page);
}

export default async function CampaignPage({ params }: CampaignRouteProps) {
  const { slug } = await params;
  const page = campaignPages[slug as keyof typeof campaignPages];
  if (!page) notFound();

  return (
    <main className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      <nav className="sticky top-0 z-50 backdrop-blur-xl" style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 84%, transparent)", borderBottom: "1px solid var(--border)" }}>
        <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 md:px-8">
          <Link href="/">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/blog" className="hidden text-sm md:inline" style={{ color: "var(--text-muted)" }}>
              Blog
            </Link>
            <CampaignCta
              href={page.ctaHref}
              label="Comece grátis"
              campaign={page.slug}
              location="nav"
            />
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-4 py-12 md:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-16">
        <div>
          <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
            {page.audience}
          </span>
          <h1 className="mt-5 max-w-[720px]" style={{ color: "var(--text-primary)", fontFamily: "'Outfit', sans-serif", fontSize: "clamp(2.2rem, 6vw, 4.2rem)", fontWeight: 800, letterSpacing: "0", lineHeight: 1.02 }}>
            {page.title}
          </h1>
          <p className="mt-5 max-w-[660px] text-lg leading-8" style={{ color: "var(--text-muted)" }}>
            {page.subtitle}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CampaignCta
              href={page.ctaHref}
              label={page.ctaLabel}
              campaign={page.slug}
              location="hero"
            />
            <Link href="/blog" className="inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-medium" style={{ color: "var(--primary)", backgroundColor: "var(--primary-bg)" }}>
              Ver artigos
            </Link>
          </div>
          <p className="mt-4 text-sm" style={{ color: "var(--text-muted)" }}>
            {page.offer}
          </p>
        </div>

        <div className="rounded-lg border p-5 shadow-sm" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Exemplo do que você passa a enxergar
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Score", "7.8"],
              ["Negativos", "18%"],
              ["Risco", "Médio"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md p-4" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
                <p className="mt-1 text-xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {[
              ["Elogio recorrente", "produto fácil de entender"],
              ["Crítica recorrente", "dúvida sobre preço"],
              ["Ação sugerida", "responder objeção no próximo post"],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3 rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
                <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{label}</p>
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8" style={{ backgroundColor: "var(--bg-subtle)" }}>
        <div className="mx-auto grid max-w-[1120px] grid-cols-1 gap-6 md:grid-cols-3">
          {page.proofPoints.map((point) => (
            <div key={point} className="rounded-lg border p-5" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
              <CheckCircle2 className="mb-4 h-5 w-5" style={{ color: "var(--sentiment-positive)" }} />
              <p className="leading-7" style={{ color: "var(--text-secondary)" }}>{point}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-[1120px] grid-cols-1 gap-10 px-4 py-12 md:px-8 lg:grid-cols-2">
        <div>
          <div className="mb-5 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" style={{ color: "var(--secondary)" }} />
            <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Dores que essa página ataca</h2>
          </div>
          <div className="space-y-3">
            {page.painPoints.map((point) => (
              <p key={point} className="rounded-md p-4 leading-7" style={{ backgroundColor: "var(--secondary-bg)", color: "var(--text-secondary)" }}>
                {point}
              </p>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Como funciona</h2>
          </div>
          <div className="space-y-3">
            {page.steps.map((step, index) => (
              <div key={step} className="flex gap-4 rounded-md border p-4" style={{ borderColor: "var(--border)" }}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold" style={{ color: "white", backgroundColor: "var(--primary)" }}>
                  {index + 1}
                </span>
                <p className="leading-7" style={{ color: "var(--text-secondary)" }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-4 pb-14 md:px-8">
        <div className="rounded-lg border p-6 md:p-8" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <h2 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Perguntas comuns</h2>
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
            {page.faq.map((item) => (
              <div key={item.question} className="rounded-md p-4" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.question}</h3>
                <p className="mt-2 leading-7" style={{ color: "var(--text-muted)" }}>{item.answer}</p>
              </div>
            ))}
          </div>
          <div className="mt-7">
            <CampaignCta
              href={page.ctaHref}
              label={page.ctaLabel}
              campaign={page.slug}
              location="footer"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
