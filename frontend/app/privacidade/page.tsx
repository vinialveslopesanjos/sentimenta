import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidade — Sentimenta",
  description: "Política de privacidade da plataforma Sentimenta, operada pela Mazy Labs.",
};

export default function PrivacidadePage() {
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
        <h1 className="text-3xl font-sans font-bold text-slate-800 mb-2">Política de Privacidade</h1>
        <p className="text-sm text-slate-400 mb-10">Última atualização: 11 de março de 2026</p>

        <div className="prose prose-slate max-w-none space-y-8 text-slate-600 leading-relaxed text-[15px]">

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Quem somos</h2>
            <p>
              A <strong>Sentimenta</strong> é uma plataforma de análise de sentimento para redes sociais, operada pela <strong>Mazy Labs</strong> ("nós", "nosso").
              Esta política explica como coletamos, usamos, armazenamos e protegemos seus dados pessoais, em conformidade com a
              Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Dados que coletamos</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, endereço de e-mail e senha (armazenada de forma criptografada).</li>
              <li><strong>Dados de redes sociais:</strong> posts, comentários e informações de perfil público obtidos via APIs oficiais (Instagram, TikTok) ou serviços de coleta de dados públicos (Apify).</li>
              <li><strong>Dados de pagamento:</strong> processados integralmente pelo <strong>Stripe</strong>. Não armazenamos números de cartão de crédito em nossos servidores.</li>
              <li><strong>Dados de uso:</strong> cookies essenciais e informações de navegação para melhoria da experiência.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">3. Finalidade do tratamento</h2>
            <p>Utilizamos seus dados para:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Realizar análise de sentimento de comentários em redes sociais utilizando inteligência artificial.</li>
              <li>Fornecer dashboards, relatórios e insights sobre o sentimento do seu público.</li>
              <li>Gerenciar sua conta, autenticação e assinatura.</li>
              <li>Enviar comunicações transacionais (verificação de e-mail, notificações de conta).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Base legal</h2>
            <p>
              O tratamento de dados é realizado com base no seu <strong>consentimento</strong> (Art. 7º, I da LGPD) e na
              <strong> execução de contrato</strong> (Art. 7º, V da LGPD) ao utilizar nossos serviços.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">5. Armazenamento e segurança</h2>
            <p>
              Seus dados são armazenados em servidores localizados no Brasil, utilizando banco de dados PostgreSQL com criptografia em trânsito (TLS/SSL).
              Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, perda ou destruição.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">6. Compartilhamento de dados</h2>
            <p>Compartilhamos dados apenas com os seguintes parceiros, estritamente para a prestação do serviço:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Apify:</strong> coleta de dados públicos de redes sociais.</li>
              <li><strong>Stripe:</strong> processamento de pagamentos e gestão de assinaturas.</li>
              <li><strong>Resend:</strong> envio de e-mails transacionais.</li>
              <li><strong>OpenRouter / Google:</strong> análise de sentimento via modelos de linguagem (LLM). Os textos dos comentários são enviados para processamento e não são retidos por esses provedores.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">7. Seus direitos como titular</h2>
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
            <h2 className="text-xl font-semibold text-slate-800 mb-3">8. Retenção de dados</h2>
            <p>
              Seus dados são mantidos enquanto sua conta estiver ativa. Ao solicitar a exclusão da conta, todos os dados pessoais
              são removidos de nossos servidores em até 30 dias, exceto quando a retenção for necessária para cumprimento de
              obrigação legal.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">9. Cookies</h2>
            <p>
              Utilizamos cookies essenciais para o funcionamento da plataforma (autenticação, preferências).
              Não utilizamos cookies de rastreamento de terceiros para fins publicitários.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">10. Contato</h2>
            <p>
              Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
            </p>
            <p className="mt-2">
              <strong>Mazy Labs</strong><br />
              E-mail: <a href="mailto:contato@mazylabs.com.br" className="text-violet-600 hover:text-violet-800 underline">contato@mazylabs.com.br</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">11. Alterações nesta política</h2>
            <p>
              Esta política pode ser atualizada periodicamente. Notificaremos sobre alterações significativas por e-mail ou
              por meio de aviso na plataforma. O uso continuado dos serviços após a publicação de alterações constitui
              aceitação das mesmas.
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
