import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-4" style={{ backgroundColor: "var(--bg-base, #0a0a0f)" }}>
      <div className="text-center space-y-3">
        <h1 className="text-6xl font-bold" style={{ color: "var(--primary, #6c63ff)" }}>404</h1>
        <h2 className="text-xl font-medium" style={{ color: "var(--text-main, #e0e0e0)" }}>
          Página não encontrada
        </h2>
        <p className="text-sm" style={{ color: "var(--text-faint, #888)" }}>
          A página que você procura não existe ou foi movida.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        style={{ backgroundColor: "var(--primary, #6c63ff)", color: "#fff" }}
      >
        Voltar ao Dashboard
      </Link>
    </div>
  );
}
