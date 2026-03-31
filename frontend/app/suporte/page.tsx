"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Headphones, Mail, MessageCircle, ChevronDown, Send } from "lucide-react";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";
import { useTranslations } from "next-intl";

const faqKeys = ["faq1", "faq2", "faq3", "faq4", "faq5", "faq6"] as const;

export default function SuportePage() {
  const t = useTranslations("support");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/v1/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to send");
      setSent(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch {
      alert(t("sendError"));
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
          <Link href="/login"><Button size="sm">{t("startFree")}</Button></Link>
        </div>
      </nav>

      {/* CONTENT */}
      <div className="max-w-[800px] mx-auto px-4 md:px-8 py-12">
        <Link href="/" className="flex items-center gap-2 mb-8" style={{ fontSize: "0.82rem", color: "var(--primary)" }}>
          <ArrowLeft className="w-4 h-4" /> {t("backHome")}
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}>
            <Headphones className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>{t("title")}</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>{t("subtitle")}</p>
          </div>
        </div>

        {/* Contact Cards */}
        <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <Mail className="w-5 h-5 mb-3" style={{ color: "var(--primary)" }} />
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("emailTitle")}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>{t("emailAddress")}</p>
                <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", marginTop: 2 }}>{t("emailResponseTime")}</p>
              </div>
              <div className="rounded-xl p-5" style={{ backgroundColor: "var(--bg-subtle)" }}>
                <MessageCircle className="w-5 h-5 mb-3" style={{ color: "var(--primary)" }} />
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.95rem", fontWeight: 600, color: "var(--text-primary)" }}>{t("chatTitle")}</h3>
                <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>{t("chatAvailability")}</p>
                <p style={{ fontSize: "0.68rem", color: "var(--text-faint)", marginTop: 2 }}>{t("chatHours")}</p>
              </div>
            </div>

            {/* FAQ */}
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("faqTitle")}</h2>

            <div className="space-y-2">
              {faqKeys.map((key, i) => (
                <div key={key} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left">
                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-primary)" }}>{t(`${key}.q`)}</span>
                    <ChevronDown className={`w-4 h-4 shrink-0 ml-3 transition-transform duration-300 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 pb-4 -mt-1">
                      <p style={{ fontSize: "0.82rem", lineHeight: 1.7, color: "var(--text-muted)" }}>{t(`${key}.a`)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{t("formTitle")}</h2>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 24 }}>{t("formSubtitle")}</p>

          {sent ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "var(--primary-bg)" }}>
                <Send className="w-5 h-5" style={{ color: "var(--primary)" }} />
              </div>
              <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--text-primary)" }}>{t("sentTitle")}</h3>
              <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>{t("sentSubtitle")}</p>
              <button onClick={() => setSent(false)} className="mt-4 px-4 py-2 rounded-xl transition-colors" style={{ fontSize: "0.82rem", fontWeight: 500, color: "var(--primary)", border: "1px solid var(--border)" }}>
                {t("sendAnother")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>{t("labelName")}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t("placeholderName")}
                    className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                    style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>{t("labelEmail")}</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder={t("placeholderEmail")}
                    className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                    style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>{t("labelSubject")}</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={e => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder={t("placeholderSubject")}
                  className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none"
                  style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.78rem", fontWeight: 500, color: "var(--text-primary)", display: "block", marginBottom: 6 }}>{t("labelMessage")}</label>
                <textarea
                  required
                  rows={5}
                  value={formData.message}
                  onChange={e => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  placeholder={t("placeholderMessage")}
                  className="w-full px-4 py-3 rounded-xl transition-all focus:outline-none resize-none"
                  style={{ fontSize: "0.85rem", backgroundColor: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                />
              </div>
              <div className="flex justify-end">
                <Button size="md" disabled={sending} icon={<Send className="w-4 h-4" />}>
                  {sending ? t("sending") : t("sendMessage")}
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
            {[{ name: t("footerPrivacy"), path: "/privacidade" }, { name: t("footerTerms"), path: "/termos" }, { name: t("footerSupport"), path: "/suporte" }, { name: t("footerBlog"), path: "/blog" }].map(link => (
              <Link key={link.path} href={link.path} style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{link.name}</Link>
            ))}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text-faint)" }}>{t("footerCopyright")}</p>
        </div>
      </footer>
    </div>
  );
}
