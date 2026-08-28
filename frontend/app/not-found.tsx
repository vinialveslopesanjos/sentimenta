import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4" style={{ backgroundColor: "var(--bg-page)" }}>
      <div className="text-center space-y-3">
        <h1 className="text-6xl font-bold" style={{ color: "var(--primary)" }}>404</h1>
        <h2 className="text-xl font-medium" style={{ color: "var(--text-primary)" }}>
          Página não encontrada
        </h2>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          A página que você procura não existe ou foi movida.
        </p>
      </div>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
      >
        Voltar ao início
      </Link>
    </div>
  );
}
