import type { Metadata } from "next";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";

export const metadata: Metadata = {
  title: "Política de Privacidade — Sentimenta",
  description: "Política de privacidade da plataforma Sentimenta, operada pela Mazy Labs.",
};

const sectionStyle = { fontSize: "0.85rem", lineHeight: 1.85, color: "var(--text-muted)" } as const;
const headingStyle = { fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 700 as const, color: "var(--text-primary)", marginTop: 28, marginBottom: 8 };

export default function PrivacidadePage() {
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
            <Shield className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>Política de Privacidade</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>Última atualização: 11 de março de 2026</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div style={sectionStyle}>
            <section>
              <h2 style={headingStyle}>1. Quem somos</h2>
              <p>
                A <strong>Sentimenta</strong> é uma plataforma de análise de sentimento para redes sociais, operada pela <strong>Mazy Labs</strong> (&ldquo;nós&rdquo;, &ldquo;nosso&rdquo;).
                Esta política explica como coletamos, usamos, armazenamos e protegemos seus dados pessoais, em conformidade com a
                Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>2. Dados que coletamos</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Dados de cadastro:</strong> nome, endereço de e-mail e senha (armazenada de forma criptografada).</li>
                <li><strong>Dados de redes sociais:</strong> posts, comentários e informações de perfil público obtidos via APIs oficiais (Instagram, TikTok) ou serviços de coleta de dados públicos (Apify).</li>
                <li><strong>Dados de pagamento:</strong> processados integralmente pelo <strong>Stripe</strong>. Não armazenamos números de cartão de crédito em nossos servidores.</li>
                <li><strong>Dados de uso:</strong> cookies essenciais e informações de navegação para melhoria da experiência.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>3. Finalidade do tratamento</h2>
              <p>Utilizamos seus dados para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Realizar análise de sentimento de comentários em redes sociais utilizando inteligência artificial.</li>
                <li>Fornecer dashboards, relatórios e insights sobre o sentimento do seu público.</li>
                <li>Gerenciar sua conta, autenticação e assinatura.</li>
                <li>Enviar comunicações transacionais (verificação de e-mail, notificações de conta).</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>4. Base legal</h2>
              <p>
                O tratamento de dados é realizado com base no seu <strong>consentimento</strong> (Art. 7º, I da LGPD) e na
                <strong> execução de contrato</strong> (Art. 7º, V da LGPD) ao utilizar nossos serviços.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>5. Armazenamento e segurança</h2>
              <p>
                Seus dados são armazenados em servidores localizados no Brasil, utilizando banco de dados PostgreSQL com criptografia em trânsito (TLS/SSL).
                Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou destruição.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>6. Compartilhamento de dados</h2>
              <p>Compartilhamos dados apenas com os seguintes parceiros, estritamente para a prestação do serviço:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Apify:</strong> coleta de dados públicos de redes sociais.</li>
                <li><strong>Stripe:</strong> processamento de pagamentos e gestão de assinaturas.</li>
                <li><strong>Resend:</strong> envio de e-mails transacionais.</li>
                <li><strong>OpenRouter / Google:</strong> análise de sentimento via modelos de linguagem (LLM). Os textos dos comentários são enviados para processamento e não são retidos por esses provedores.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>7. Seus direitos como titular</h2>
              <p>Conforme a LGPD, você tem direito a:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Acesso:</strong> saber quais dados pessoais possuímos sobre você.</li>
                <li><strong>Correção:</strong> solicitar a atualização de dados incompletos ou incorretos.</li>
                <li><strong>Exclusão:</strong> solicitar a eliminação dos seus dados pessoais. Você pode excluir sua conta diretamente nas configurações da plataforma ou entrando em contato conosco.</li>
                <li><strong>Portabilidade:</strong> solicitar uma cópia dos seus dados em formato estruturado.</li>
                <li><strong>Revogação do consentimento:</strong> retirar seu consentimento a qualquer momento.</li>
                <li><strong>Informação:</strong> ser informado sobre o compartilhamento de seus dados com terceiros.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>8. Retenção de dados</h2>
              <p>
                Seus dados são mantidos enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta, todos os dados pessoais
                são removidos de nossos servidores em até 30 dias, exceto quando a retenção for necessária para cumprimento de
                obrigação legal.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>9. Cookies</h2>
              <p>
                Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação, preferências).
                Não utilizamos cookies de rastreamento de terceiros para fins publicitários.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>10. Contato</h2>
              <p>
                Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
              </p>
              <p className="mt-2">
                <strong>Mazy Labs</strong><br />
                E-mail: <a href="mailto:contato@mazylabs.com.br" style={{ color: "var(--primary)", fontWeight: 600 }}>contato@mazylabs.com.br</a>
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>11. Alterações nesta política</h2>
              <p>
                Esta política pode ser atualizada periodicamente. Notificaremos sobre alterações significativas por e-mail ou
                por meio de aviso na plataforma. O uso continuado dos serviços após a publicação de alterações constitui
                aceitação das mesmas.
              </p>
            </section>
          </div>
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
