import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <span className="text-lg font-semibold">Sentimenta</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Login
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border text-xs text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
            Powered by AI
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight">
            Entenda o que dizem
            <br />
            <span className="text-accent">sobre você</span>
          </h1>

          <p className="text-lg text-text-secondary max-w-lg mx-auto">
            Conecte suas redes sociais e descubra o sentimento real dos seus
            seguidores. Comentários analisados por IA em segundos.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex h-12 px-8 items-center justify-center rounded-lg bg-accent hover:bg-accent-hover text-white font-medium transition-colors"
            >
              Comece agora
            </Link>
            <Link
              href="#features"
              className="inline-flex h-12 px-8 items-center justify-center rounded-lg border border-border hover:bg-surface-hover text-text-secondary hover:text-text-primary font-medium transition-colors"
            >
              Como funciona
            </Link>
          </div>

          {/* Platform badges */}
          <div className="flex items-center justify-center gap-6 pt-8">
            {["Instagram", "YouTube", "Twitter"].map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 text-sm text-text-muted"
              >
                <div className="w-6 h-6 rounded bg-surface-hover" />
                {p}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Features */}
      <section id="features" className="px-6 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-12">
            Como funciona
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Conecte",
                desc: "Vincule seu Instagram ou YouTube em um clique via OAuth seguro.",
              },
              {
                step: "02",
                title: "Analise",
                desc: "Nossa IA analisa cada comentário: sentimento, emoções, tópicos e sarcasmo.",
              },
              {
                step: "03",
                title: "Entenda",
                desc: "Dashboard com insights acionáveis sobre sua reputação digital.",
              },
            ].map((f) => (
              <div
                key={f.step}
                className="p-6 rounded-xl border border-border bg-surface"
              >
                <div className="text-accent font-mono text-sm mb-3">
                  {f.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border text-center text-xs text-text-muted">
        Sentimenta &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
