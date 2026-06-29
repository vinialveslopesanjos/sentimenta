export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  updatedAt: string;
  readTime: string;
  category: "Analise de Sentimento" | "Gestao de Reputacao" | "Aquisicao e Ads";
  persona: "agencias" | "social-media" | "criadores" | "fundadores";
  heroImage: string;
  heroAlt: string;
  imagePrompt: string;
  tags: string[];
  body: string[];
  cta: {
    label: string;
    href: string;
  };
};

export const blogPosts: BlogPost[] = [
  {
    slug: "como-saber-se-os-comentarios-do-instagram-estao-virando-risco",
    title: "Como saber se os comentarios do Instagram estao virando risco",
    excerpt:
      "Um guia direto para social medias e agencias identificarem sinais de crise antes de depender apenas de curtidas, alcance ou intuicao.",
    date: "2026-06-28",
    updatedAt: "2026-06-28",
    readTime: "5 min",
    category: "Gestao de Reputacao",
    persona: "social-media",
    heroImage: "/blog/risco-comentarios-instagram.png",
    heroAlt:
      "Ilustracao editorial de um painel de comentarios com sinais de alerta e sentimento",
    imagePrompt:
      "Pastel vector editorial illustration for a SaaS blog article about Instagram comments becoming reputation risk. Show a clean dashboard with comment bubbles, sentiment colors, and one subtle alert indicator. No text, no logos, no people, soft teal rose and warm amber palette, modern B2B SaaS style.",
    tags: ["instagram", "crise", "reputacao", "comentarios"],
    body: [
      "Curtidas e alcance dizem se um post circulou. Comentarios dizem como ele foi recebido. O problema e que a maioria das equipes so percebe uma crise quando os comentarios negativos ja viraram print, DM ou reuniao urgente.",
      "O primeiro sinal costuma ser mudanca de tom, nao volume. Um post pode ter poucas respostas e mesmo assim carregar irritacao, ironia ou duvida publica. Por isso, olhar apenas quantidade de comentarios e insuficiente.",
      "Na pratica, vale acompanhar tres coisas: queda no score medio de sentimento, crescimento de emocoes como raiva ou medo, e repeticao de temas de critica. Quando os tres aparecem juntos, o post merece resposta rapida.",
      "Para agencias, esse tipo de leitura vira uma entrega clara para o cliente: nao e so dizer que o post performou, mas explicar se a audiencia ficou mais confiante, confusa, irritada ou engajada.",
      "O Sentimenta foi pensado para esse trabalho: conectar um perfil, coletar comentarios, analisar sentimento e mostrar onde esta o risco sem a equipe precisar ler centenas de mensagens manualmente.",
    ],
    cta: {
      label: "Fazer um diagnostico gratuito",
      href: "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=risk-comments",
    },
  },
  {
    slug: "relatorio-para-cliente-alem-de-curtidas-e-alcance",
    title: "Relatorio para cliente alem de curtidas e alcance",
    excerpt:
      "Como transformar comentarios em uma camada nova de relatorio para social media, atendimento e reputacao.",
    date: "2026-06-21",
    updatedAt: "2026-06-28",
    readTime: "6 min",
    category: "Analise de Sentimento",
    persona: "agencias",
    heroImage: "/blog/relatorio-cliente-sentimento.png",
    heroAlt:
      "Ilustracao editorial de relatorio de social media com comentarios classificados por sentimento",
    imagePrompt:
      "Pastel vector illustration for a digital agency SaaS blog article. Show a polished client report with charts, comment cards, and sentiment indicators. No readable text, no logos, clean whitespace, teal rose amber palette, professional and calm.",
    tags: ["agencias", "relatorios", "social-media", "clientes"],
    body: [
      "Muitos relatorios de social media param em alcance, impressoes, curtidas e seguidores. Esses numeros sao uteis, mas nao respondem uma pergunta que clientes fazem cada vez mais: as pessoas gostaram mesmo?",
      "Comentarios permitem mostrar percepcao. Uma campanha pode ter alto alcance e ainda gerar desconfianca. Outra pode ter menos volume, mas revelar desejo de compra, elogios especificos e temas que merecem virar conteudo.",
      "Um bom relatorio de sentimento deve trazer poucos blocos: score geral, principais emocoes, temas positivos, temas negativos, comentarios que merecem resposta e recomendacao de proxima acao.",
      "A entrega fica mais forte quando a agencia mostra exemplos rastreaveis. O cliente precisa conseguir clicar ou reconhecer de onde saiu cada insight. Isso evita o risco de parecer texto inventado por IA.",
      "A oportunidade comercial para agencias e simples: vender inteligencia de audiencia como uma camada premium de relatorio, sem transformar a equipe em analista manual de comentarios.",
    ],
    cta: {
      label: "Ver como ficaria para um cliente",
      href: "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=agency-report",
    },
  },
  {
    slug: "google-ads-meta-ads-e-conteudo-para-um-saas-pequeno",
    title: "Google Ads, Meta Ads e conteudo para um SaaS pequeno",
    excerpt:
      "Um plano enxuto para validar demanda antes de gastar pesado com trafego pago.",
    date: "2026-06-14",
    updatedAt: "2026-06-28",
    readTime: "7 min",
    category: "Aquisicao e Ads",
    persona: "fundadores",
    heroImage: "/blog/aquisicao-google-meta-saas.png",
    heroAlt:
      "Ilustracao editorial de funil de aquisicao com blog, anuncios e landing page",
    imagePrompt:
      "Pastel vector editorial illustration for a SaaS acquisition article. Show a simple funnel connecting blog articles, Google search ads, Meta ad creatives, and a product signup screen. No readable text, no logos, clean B2B startup style, teal rose amber palette.",
    tags: ["google-ads", "meta-ads", "saas", "aquisicao"],
    body: [
      "Para um SaaS pequeno, o erro comum e comecar pelo Ads Manager antes de clarear oferta, publico e evento de conversao. Trafego pago acelera aprendizado, mas tambem acelera desperdicio quando a pagina nao convence.",
      "A ordem mais segura e: criar uma oferta especifica, publicar uma pagina que explica essa oferta, medir cliques e cadastros, e so depois ligar campanhas com orcamento pequeno.",
      "Google Ads funciona melhor para demanda existente: pessoas procurando analise de sentimento, monitoramento de reputacao ou relatorio de comentarios. Meta Ads funciona melhor para provocar a dor com criativos visuais.",
      "Conteudo semanal ajuda porque cria paginas que podem rankear, abastece anuncios com argumentos reais e reduz dependencia de uma unica landing page. Mas o conteudo precisa ser util, nao enchimento para SEO.",
      "O fluxo ideal combina os tres: blog para educar, Google para capturar intencao e Meta para testar criativos e dores. Tudo com UTM e eventos de conversao desde o primeiro dia.",
    ],
    cta: {
      label: "Comecar pelo diagnostico",
      href: "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=ads-saas",
    },
  },
];

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

export function getFeaturedPost() {
  return blogPosts[0];
}
