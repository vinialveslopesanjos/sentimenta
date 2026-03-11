import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Termos de Uso — Sentimenta",
  description: "Termos de uso da plataforma Sentimenta, operada pela Mazy Labs.",
};

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#FDFBFF]">
      {/* Header */}
      <header className="border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-200 to-violet-300 flex items-center justify-center shadow-sm">
              <svg fill="none" height="16" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width="16">
                <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" />
              </svg>
            </div>
            <span className="text-lg font-sans font-bold text-slate-700">sentimenta</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-sans font-bold text-slate-800 mb-2">Termos de Uso</h1>
        <p className="text-sm text-slate-400 mb-10">Última atualização: 11 de março de 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 leading-relaxed text-[15px]">

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao acessar e utilizar a plataforma <strong>Sentimenta</strong>, operada pela <strong>Mazy Labs</strong>, você concorda
              integralmente com estes Termos de Uso. Caso não concorde, não utilize nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Descrição do serviço</h2>
            <p>
              A Sentimenta é uma plataforma SaaS (Software as a Service) que realiza análise de sentimento de comentários
              em redes sociais, utilizando inteligência artificial. O serviço permite que você conecte suas contas de redes
              sociais (Instagram, TikTok) para coletar e analisar o sentimento dos comentários recebidos em seus posts.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">3. Cadastro e conta</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Você deve fornecer informações verdadeiras e atualizadas ao se cadastrar.</li>
              <li>Você é responsável pela segurança de sua senha e por todas as atividades realizadas em sua conta.</li>
              <li>Cada pessoa pode manter apenas uma conta na plataforma.</li>
              <li>A verificação de e-mail é obrigatória para acessar as funcionalidades da plataforma.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Uso aceitável</h2>
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
            <h2 className="text-xl font-semibold text-slate-800 mb-3">5. Planos e limitações</h2>
            <p>
              A Sentimenta oferece diferentes planos de assinatura, cada um com limites específicos de perfis monitorados,
              volume de análises e funcionalidades disponíveis. Os detalhes e preços de cada plano estão disponíveis
              na página de planos da plataforma.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>O plano gratuito possui limitações de uso e funcionalidades.</li>
              <li>Os planos pagos são cobrados via Stripe, em ciclos mensais ou anuais conforme escolha do usuário.</li>
              <li>A Mazy Labs reserva-se o direito de alterar preços e funcionalidades dos planos, com aviso prévio de 30 dias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">6. Propriedade intelectual</h2>
            <p>
              Todo o conteúdo da plataforma Sentimenta — incluindo código, design, marca, textos e algoritmos — é propriedade
              da Mazy Labs e protegido por leis de propriedade intelectual. Os dados e análises gerados para você são de seu
              uso exclusivo, mas a tecnologia subjacente permanece propriedade da Mazy Labs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">7. Limitação de responsabilidade</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>As análises de sentimento são geradas por inteligência artificial e podem conter imprecisões. Não devem ser usadas como única base para decisões críticas.</li>
              <li>A Mazy Labs não se responsabiliza por perdas decorrentes de decisões tomadas com base exclusivamente nas análises da plataforma.</li>
              <li>Não garantimos disponibilidade ininterrupta do serviço, embora nos esforcemos para manter alta disponibilidade.</li>
              <li>Interrupções nas APIs de terceiros (Instagram, TikTok) podem afetar temporariamente a coleta de dados.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">8. Cancelamento e exclusão de dados</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Você pode cancelar sua assinatura a qualquer momento. O acesso ao plano pago permanece ativo até o fim do período já pago.</li>
              <li>Você pode solicitar a exclusão completa da sua conta e todos os dados associados a qualquer momento, diretamente na plataforma ou por e-mail.</li>
              <li>Após a exclusão, seus dados serão removidos de nossos servidores em até 30 dias, conforme nossa <Link href="/privacidade" className="text-violet-600 hover:text-violet-800 underline">Política de Privacidade</Link>.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">9. Modificações nos termos</h2>
            <p>
              A Mazy Labs pode atualizar estes termos periodicamente. Alterações significativas serão comunicadas com
              antecedência de 30 dias por e-mail ou aviso na plataforma. O uso continuado após as alterações constitui
              aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">10. Lei aplicável e foro</h2>
            <p>
              Estes termos são regidos pela legislação da República Federativa do Brasil. Fica eleito o foro da
              comarca de São Paulo/SP para dirimir quaisquer controvérsias oriundas destes termos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">11. Contato</h2>
            <p>
              Para dúvidas sobre estes termos, entre em contato:
            </p>
            <p className="mt-2">
              <strong>Mazy Labs</strong><br />
              E-mail: <a href="mailto:contato@mazylabs.com.br" className="text-violet-600 hover:text-violet-800 underline">contato@mazylabs.com.br</a>
            </p>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">&copy; {new Date().getFullYear()} Mazy Labs. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <Link href="/termos" className="text-sm text-slate-400 hover:text-violet-600 transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="text-sm text-slate-400 hover:text-violet-600 transition-colors">Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
