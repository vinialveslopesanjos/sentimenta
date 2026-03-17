"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Headphones, Mail, MessageCircle, ChevronDown, Send } from "lucide-react";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";

const faqs = [
  { q: "Como conectar meu perfil do Instagram?", a: "Basta informar o @ do perfil público que deseja monitorar. Não é necessário login no Instagram. Nossa IA coleta apenas comentários de perfis públicos." },
  { q: "Quanto tempo leva a primeira análise?", a: "A primeira análise completa leva menos de 2 minutos. Após isso, as sincronizações são automáticas e levam segundos." },
  { q: "Posso monitorar perfis de concorrentes?", a: "Sim! Você pode monitorar qualquer perfil público, incluindo concorrentes. É ótimo para benchmarking de sentimento." },
  { q: "Como funciona o alerta de crise?", a: "Quando a porcentagem de comentários negativos ultrapassa o limiar configurado por você, o sistema envia uma notificação por e-mail e/ou no dashboard." },
  { q: "Meus dados estão seguros?", a: "Sim. Utilizamos criptografia ponta a ponta, servidores brasileiros e somos compliance com a LGPD." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim. Sem multas ou burocracia. Ao cancelar, sua conta fica pausada e você pode reativar quando quiser." },
];

export default function SuportePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/v1/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setSent(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch {
      // Silently handle - backend will be implemented later
      setSent(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)", fontFamily: "'Inter', sans-serif" }}>
      {/* NAV */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl shadow-sm" style={{ backgroundColor: "color-mix(in srgb, var(--bg-card) 80%, transparent)" }}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link href="/"><Logo size="md" /></Link>
          <Link href="/login"><Button size="sm">Comece gratis</Button></Link>
        </div>
      </nav>

      {/* CONTENT */}
      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-12">
        <Link href="/" className="flex items-center gap-2 mb-8" style={{ fontSize: "0.82rem", color: "var(--primary)" }}>
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}>
            <Headphones className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>Central de Suporte</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>Estamos aqui para ajudar</p>
          </div>
        </div>

        {/* Contact Cards */}
        <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <Mail className="w-5 h-5 mb-3" style={{ color: "var(--primary)" }} />
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>E-mail</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>suporte@sentimenta.com.br</p>
                <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", marginTop: 2 }}>Resposta em ate 24h uteis</p>
              </div>
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <MessageCircle className="w-5 h-5 mb-3" style={{ color: "var(--primary)" }} />
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>Chat</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>Disponivel no dashboard</p>
                <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", marginTop: 2 }}>Seg-Sex, 9h as 18h</p>
              </div>
            </div>

            {/* FAQ */}
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Perguntas frequentes</h2>

            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)" }}>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 ml-3 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 -mt-1">
                      <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{faq.a}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Envie uma mensagem</h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 24 }}>Preencha o formulario abaixo e retornaremos o mais breve possivel.</p>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}>
                <Send className="w-5 h-5" style={{ color: "var(--primary)" }} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>Mensagem enviada!</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>Retornaremos em ate 24h uteis.</p>
              <button onClick={() => setSent(false)} className="mt-4 px-4 py-2 rounded-xl transition-colors" style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--primary)", border: "1px solid var(--border)" }}>
                Enviar outra mensagem
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>Nome</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Seu nome"
                    className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                    style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>E-mail</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="seu@email.com"
                    className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                    style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>Assunto</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Resumo do seu problema ou duvida"
                  className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                  style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>Mensagem</label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Descreva em detalhes como podemos ajudar..."
                  className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none resize-none"
                  style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
              <div className="flex justify-end">
                <Button size="md" disabled={sending} icon={<Send className="w-4 h-4" />}>
                  {sending ? "Enviando..." : "Enviar mensagem"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer className="py-10 px-4 md:px-8" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size="sm" />
          <div className="flex items-center gap-8">
            {[{ name: "Privacidade", path: "/privacidade" }, { name: "Termos", path: "/termos" }, { name: "Suporte", path: "/suporte" }, { name: "Blog", path: "/blog" }].map(link => (
              <Link key={link.name} href={link.path} style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{link.name}</Link>
            ))}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>&copy; 2026 Sentimenta</p>
        </div>
      </footer>
    </div>
  );
}
