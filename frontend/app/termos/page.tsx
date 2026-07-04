import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ds/Logo";
import { Button } from "@/components/ds/Button";

export const metadata: Metadata = {
  title: "Termos de Uso — Sentimenta",
  description: "Termos de uso da plataforma Sentimenta, operada pela Mazy Labs.",
};

const sectionStyle = { fontSize: "0.85rem", lineHeight: 1.85, color: "var(--text-muted)" } as const;
const headingStyle = { fontFamily: "'Outfit', sans-serif", fontSize: "1.05rem", fontWeight: 700 as const, color: "var(--text-primary)", marginTop: 28, marginBottom: 8 };

export default function TermosPage() {
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
            <FileText className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)" }}>Termos de Uso</h1>
            <p style={{ fontSize: "0.75rem", color: "var(--text-faint)" }}>Última atualização: 11 de março de 2026</p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl p-6 md:p-8" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div style={sectionStyle}>
            <section>
              <h2 style={headingStyle}>1. Aceitação dos termos</h2>
              <p>
                Ao acessar e utilizar a plataforma <strong>Sentimenta</strong>, operada pela <strong>Mazy Labs</strong>, você concorda
                integralmente com estes Termos de Uso. Caso não concorde, não utilize nossos serviços.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>2. Descrição do serviço</h2>
              <p>
                A Sentimenta é uma plataforma SaaS (Software as a Service) que realiza análise de sentimento de comentários
                em redes sociais, utilizando inteligência artificial. O serviço permite que você conecte suas contas de redes
                sociais (Instagram, TikTok) para coletar e analisar o sentimento dos comentários recebidos em seus posts.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>3. Cadastro e conta</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Você deve fornecer informações verdadeiras e atualizadas ao se cadastrar.</li>
                <li>Você é responsável pela segurança de sua senha e por todas as atividades realizadas em sua conta.</li>
                <li>Cada pessoa pode manter apenas uma conta na plataforma.</li>
                <li>A verificação de e-mail é obrigatória para acessar as funcionalidades da plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>4. Uso aceitável</h2>
              <p>Ao utilizar a Sentimenta, você concorda em <strong>NÃO</strong>:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Utilizar o serviço para assédio, perseguição (stalking), bullying ou qualquer forma de intimidação.</li>
                <li>Coletar ou analisar dados de terceiros sem autorização ou de forma que viole sua privacidade.</li>
                <li>Utilizar os insights obtidos para discriminação, difamação ou qualquer atividade ilegal.</li>
                <li>Tentar acessar dados de outros usuários da plataforma.</li>
                <li>Realizar engenharia reversa, scraping ou sobrecarga intencional dos nossos servidores.</li>
                <li>Compartilhar, revender ou sublicenciar o acesso à plataforma sem autorização.</li>
                <li>Utilizar o serviço de qualquer forma que viole leis brasileiras ou internacionais aplicáveis.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>5. Planos e limitações</h2>
              <p>
                A Sentimenta oferece diferentes planos de assinatura, cada um com limites específicos de perfis monitorados,
                volume de análises e funcionalidades disponíveis. Os detalhes e preços de cada plano estão disponíveis
                na página de planos da plataforma.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>O trial gratuito pode exigir cartão e possui limitações de uso e funcionalidades.</li>
                <li>Os planos pagos são cobrados via Stripe, em ciclos mensais ou anuais conforme escolha do usuário.</li>
                <li>A Mazy Labs reserva-se o direito de alterar preços e funcionalidades dos planos, com aviso prévio de 30 dias.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>6. Propriedade intelectual</h2>
              <p>
                Todo o conteúdo da plataforma Sentimenta — incluindo código, design, marca, textos e algoritmos — é propriedade
                da Mazy Labs e protegido por leis de propriedade intelectual. Os dados e análises gerados para você são de seu
                uso exclusivo, mas a tecnologia subjacente permanece propriedade da Mazy Labs.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>7. Limitação de responsabilidade</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>As análises de sentimento são geradas por inteligência artificial e podem conter imprecisões. Não devem ser usadas como única base para decisões críticas.</li>
                <li>A Mazy Labs não se responsabiliza por perdas decorrentes de decisões tomadas com base exclusivamente nas análises da plataforma.</li>
                <li>Não garantimos disponibilidade ininterrupta do serviço, embora nos esforcemos para manter alta disponibilidade.</li>
                <li>Interrupções nas APIs de terceiros (Instagram, TikTok) podem afetar temporariamente a coleta de dados.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>8. Cancelamento e exclusão de dados</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Você pode cancelar sua assinatura a qualquer momento. O acesso ao plano pago permanece ativo até o fim do período já pago.</li>
                <li>Você pode solicitar a exclusão completa da sua conta e todos os dados associados a qualquer momento, diretamente na plataforma ou por e-mail.</li>
                <li>Após a exclusão, seus dados serão removidos de nossos servidores em até 30 dias, conforme nossa <Link href="/privacidade" style={{ color: "var(--primary)", fontWeight: 600, textDecoration: "underline" }}>Política de Privacidade</Link>.</li>
              </ul>
            </section>

            <section>
              <h2 style={headingStyle}>9. Modificações nos termos</h2>
              <p>
                A Mazy Labs pode atualizar estes termos periodicamente. Alterações significativas serão comunicadas com
                antecedência de 30 dias por e-mail ou aviso na plataforma. O uso continuado após as alterações constitui
                aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>10. Lei aplicável e foro</h2>
              <p>
                Estes termos são regidos pela legislação da República Federativa do Brasil. Fica eleito o foro da
                comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas destes termos.
              </p>
            </section>

            <section>
              <h2 style={headingStyle}>11. Contato</h2>
              <p>
                Para dúvidas sobre estes termos, entre em contato:
              </p>
              <p className="mt-2">
                <strong>Mazy Labs</strong><br />
                E-mail: <a href="mailto:contato@mazylabs.com.br" style={{ color: "var(--primary)", fontWeight: 600 }}>contato@mazylabs.com.br</a>
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
