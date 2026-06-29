export type BlogCategory = "Analise de Sentimento" | "Gestao de Reputacao" | "Aquisicao e Ads";
export type BlogPersona = "agencias" | "social-media" | "criadores" | "fundadores";
export type BlogStatus = "draft" | "published";

export type BlogPost = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  status: BlogStatus;
  category: BlogCategory;
  persona: BlogPersona;
  tags: string[];
  coverImageUrl: string;
  coverImageAlt: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  cta: {
    label: string;
    href: string;
  };
  readTimeMinutes: number;
  authorName: string;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt: string;
};

type ApiBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  status: BlogStatus;
  category: BlogCategory;
  persona: BlogPersona;
  tags: string[];
  cover_image_url: string;
  cover_image_alt: string;
  seo_title?: string | null;
  seo_description?: string | null;
  cta: { label: string; href: string };
  read_time_minutes: number;
  author_name: string;
  published_at?: string | null;
  created_at?: string | null;
  updated_at: string;
};

export const blogCategories = [
  "Todos",
  "Analise de Sentimento",
  "Gestao de Reputacao",
  "Aquisicao e Ads",
] as const;

export const fallbackBlogPosts: BlogPost[] = [
  {
    slug: "como-saber-se-os-comentarios-do-instagram-estao-virando-risco",
    title: "Como saber se os comentarios do Instagram estao virando risco",
    excerpt:
      "Um guia direto para social medias e agencias identificarem sinais de crise antes de depender apenas de curtidas, alcance ou intuicao.",
    bodyMarkdown: [
      "Curtidas e alcance dizem se um post circulou. Comentarios dizem como ele foi recebido. O problema e que a maioria das equipes so percebe uma crise quando os comentarios negativos ja viraram print, DM ou reuniao urgente.",
      "O primeiro sinal costuma ser mudanca de tom, nao volume. Um post pode ter poucas respostas e mesmo assim carregar irritacao, ironia ou duvida publica. Por isso, olhar apenas quantidade de comentarios e insuficiente.",
      "Na pratica, vale acompanhar tres coisas: queda no score medio de sentimento, crescimento de emocoes como raiva ou medo, e repeticao de temas de critica. Quando os tres aparecem juntos, o post merece resposta rapida.",
      "Para agencias, esse tipo de leitura vira uma entrega clara para o cliente: nao e so dizer que o post performou, mas explicar se a audiencia ficou mais confiante, confusa, irritada ou engajada.",
      "O Sentimenta foi pensado para esse trabalho: conectar um perfil, coletar comentarios, analisar sentimento e mostrar onde esta o risco sem a equipe precisar ler centenas de mensagens manualmente.",
    ].join("\n\n"),
    status: "published",
    category: "Gestao de Reputacao",
    persona: "social-media",
    coverImageUrl: "/blog/risco-comentarios-instagram.png",
    coverImageAlt:
      "Ilustracao editorial de um painel de comentarios com sinais de alerta e sentimento",
    tags: ["instagram", "crise", "reputacao", "comentarios"],
    cta: {
      label: "Fazer um diagnostico gratuito",
      href: "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=risk-comments",
    },
    readTimeMinutes: 5,
    authorName: "Sentimenta",
    publishedAt: "2026-06-28T00:00:00Z",
    createdAt: "2026-06-28T00:00:00Z",
    updatedAt: "2026-06-28T00:00:00Z",
  },
  {
    slug: "relatorio-para-cliente-alem-de-curtidas-e-alcance",
    title: "Relatorio para cliente alem de curtidas e alcance",
    excerpt:
      "Como transformar comentarios em uma camada nova de relatorio para social media, atendimento e reputacao.",
    bodyMarkdown: [
      "Muitos relatorios de social media param em alcance, impressoes, curtidas e seguidores. Esses numeros sao uteis, mas nao respondem uma pergunta que clientes fazem cada vez mais: as pessoas gostaram mesmo?",
      "Comentarios permitem mostrar percepcao. Uma campanha pode ter alto alcance e ainda gerar desconfianca. Outra pode ter menos volume, mas revelar desejo de compra, elogios especificos e temas que merecem virar conteudo.",
      "Um bom relatorio de sentimento deve trazer poucos blocos: score geral, principais emocoes, temas positivos, temas negativos, comentarios que merecem resposta e recomendacao de proxima acao.",
      "A entrega fica mais forte quando a agencia mostra exemplos rastreaveis. O cliente precisa conseguir clicar ou reconhecer de onde saiu cada insight. Isso evita o risco de parecer texto inventado por IA.",
      "A oportunidade comercial para agencias e simples: vender inteligencia de audiencia como uma camada premium de relatorio, sem transformar a equipe em analista manual de comentarios.",
    ].join("\n\n"),
    status: "published",
    category: "Analise de Sentimento",
    persona: "agencias",
    coverImageUrl: "/blog/relatorio-cliente-sentimento.png",
    coverImageAlt:
      "Ilustracao editorial de relatorio de social media com comentarios classificados por sentimento",
    tags: ["agencias", "relatorios", "social-media", "clientes"],
    cta: {
      label: "Ver como ficaria para um cliente",
      href: "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=agency-report",
    },
    readTimeMinutes: 6,
    authorName: "Sentimenta",
    publishedAt: "2026-06-21T00:00:00Z",
    createdAt: "2026-06-21T00:00:00Z",
    updatedAt: "2026-06-28T00:00:00Z",
  },
  {
    slug: "google-ads-meta-ads-e-conteudo-para-um-saas-pequeno",
    title: "Google Ads, Meta Ads e conteudo para um SaaS pequeno",
    excerpt:
      "Um plano enxuto para validar demanda antes de gastar pesado com trafego pago.",
    bodyMarkdown: [
      "Para um SaaS pequeno, o erro comum e comecar pelo Ads Manager antes de clarear oferta, publico e evento de conversao. Trafego pago acelera aprendizado, mas tambem acelera desperdicio quando a pagina nao convence.",
      "A ordem mais segura e: criar uma oferta especifica, publicar uma pagina que explica essa oferta, medir cliques e cadastros, e so depois ligar campanhas com orcamento pequeno.",
      "Google Ads funciona melhor para demanda existente: pessoas procurando analise de sentimento, monitoramento de reputacao ou relatorio de comentarios. Meta Ads funciona melhor para provocar a dor com criativos visuais.",
      "Conteudo semanal ajuda porque cria paginas que podem rankear, abastece anuncios com argumentos reais e reduz dependencia de uma unica landing page. Mas o conteudo precisa ser util, nao enchimento para SEO.",
      "O fluxo ideal combina os tres: blog para educar, Google para capturar intencao e Meta para testar criativos e dores. Tudo com UTM e eventos de conversao desde o primeiro dia.",
    ].join("\n\n"),
    status: "published",
    category: "Aquisicao e Ads",
    persona: "fundadores",
    coverImageUrl: "/blog/aquisicao-google-meta-saas.png",
    coverImageAlt:
      "Ilustracao editorial de funil de aquisicao com blog, anuncios e landing page",
    tags: ["google-ads", "meta-ads", "saas", "aquisicao"],
    cta: {
      label: "Comecar pelo diagnostico",
      href: "/diagnostico?utm_source=blog&utm_medium=organic&utm_campaign=ads-saas",
    },
    readTimeMinutes: 7,
    authorName: "Sentimenta",
    publishedAt: "2026-06-14T00:00:00Z",
    createdAt: "2026-06-14T00:00:00Z",
    updatedAt: "2026-06-28T00:00:00Z",
  },
];

export const blogPosts = fallbackBlogPosts;

function apiBase() {
  if (typeof window !== "undefined") return "";
  return process.env.API_URL || "http://127.0.0.1:8000";
}

export function normalizeBlogPost(post: ApiBlogPost): BlogPost {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    bodyMarkdown: post.body_markdown,
    status: post.status,
    category: post.category,
    persona: post.persona,
    tags: post.tags || [],
    coverImageUrl: post.cover_image_url,
    coverImageAlt: post.cover_image_alt,
    seoTitle: post.seo_title,
    seoDescription: post.seo_description,
    cta: post.cta,
    readTimeMinutes: post.read_time_minutes,
    authorName: post.author_name,
    publishedAt: post.published_at,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  };
}

export async function fetchPublishedBlogPosts(): Promise<BlogPost[]> {
  try {
    const response = await fetch(`${apiBase()}/api/v1/blog/posts`, { cache: "no-store" });
    if (!response.ok) return fallbackBlogPosts;
    const data = (await response.json()) as { posts: ApiBlogPost[] };
    return data.posts.map(normalizeBlogPost);
  } catch {
    return fallbackBlogPosts;
  }
}

export async function fetchPublishedBlogPost(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`${apiBase()}/api/v1/blog/posts/${slug}`, { cache: "no-store" });
    if (response.ok) {
      return normalizeBlogPost((await response.json()) as ApiBlogPost);
    }
    return null;
  } catch {
    return fallbackBlogPosts.find((post) => post.slug === slug) || null;
  }
}

export function getBlogPost(slug: string) {
  return fallbackBlogPosts.find((post) => post.slug === slug);
}

export function getFeaturedPost(posts: BlogPost[] = fallbackBlogPosts) {
  return posts[0];
}

export function formatBlogDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("pt-BR");
}
