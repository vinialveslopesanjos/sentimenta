export type BlogCategory = string;
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

export type BlogSettings = {
  navPricingLabel: string;
  navCtaLabel: string;
  navCtaHref: string;
  heroEyebrow: string;
  heroTitle: string;
  heroDescription: string;
  searchPlaceholder: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  sidebarTitle: string;
  sidebarDescription: string;
  sidebarCtaLabel: string;
  sidebarCtaHref: string;
  allCategoryLabel: string;
  categories: string[];
  emptyStateText: string;
  articleNavCtaLabel: string;
  articleNavCtaHref: string;
  articleCtaTitle: string;
  articleCtaDescription: string;
  updatedAt?: string | null;
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

export type ApiBlogSettings = {
  nav_pricing_label: string;
  nav_cta_label: string;
  nav_cta_href: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  search_placeholder: string;
  hero_cta_label: string;
  hero_cta_href: string;
  sidebar_title: string;
  sidebar_description: string;
  sidebar_cta_label: string;
  sidebar_cta_href: string;
  all_category_label: string;
  categories: string[];
  empty_state_text: string;
  article_nav_cta_label: string;
  article_nav_cta_href: string;
  article_cta_title: string;
  article_cta_description: string;
  updated_at?: string | null;
};

export const fallbackBlogSettings: BlogSettings = {
  navPricingLabel: "Preços",
  navCtaLabel: "Comece grátis",
  navCtaHref: "/login?utm_source=blog&utm_medium=nav&utm_campaign=start-free",
  heroEyebrow: "Conteúdo para transformar comentários em decisão",
  heroTitle: "Reputação digital sem ler comentário por comentário",
  heroDescription:
    "Guias curtos para social medias, agências e fundadores entenderem sentimento, temas e sinais de crise antes que a conversa vire ruído.",
  searchPlaceholder: "Buscar por dor, canal ou assunto",
  heroCtaLabel: "Diagnóstico gratuito",
  heroCtaHref: "/diagnostico?utm_source=blog&utm_medium=hero&utm_campaign=diagnostico",
  sidebarTitle: "Veja isso com comentários reais",
  sidebarDescription:
    "Conecte um perfil público e veja sentimento, emoções, temas e sinais de crise em poucos minutos.",
  sidebarCtaLabel: "Testar com um perfil",
  sidebarCtaHref: "/diagnostico?utm_source=blog&utm_medium=sidebar&utm_campaign=diagnostico",
  allCategoryLabel: "Todos",
  categories: ["Análise de Sentimento", "Gestão de Reputação"],
  emptyStateText: "Nenhum artigo encontrado para essa busca.",
  articleNavCtaLabel: "Comece grátis",
  articleNavCtaHref: "/login?utm_source=blog&utm_medium=article_nav&utm_campaign=start-free",
  articleCtaTitle: "Quer ver isso com comentários reais?",
  articleCtaDescription:
    "O caminho mais rápido é analisar um perfil ou post público e transformar comentários em score, temas, emoções e riscos claros.",
  updatedAt: null,
};

export const fallbackBlogPosts: BlogPost[] = [
  {
    slug: "como-saber-se-os-comentarios-do-instagram-estao-virando-risco",
    title: "Como saber se os comentários do Instagram estão virando risco",
    excerpt:
      "Um guia direto para social medias e agências identificarem sinais de crise antes de depender apenas de curtidas, alcance ou intuição.",
    bodyMarkdown: [
      "Curtidas e alcance mostram se um post circulou. **Os comentários mostram como ele foi recebido.** É ali que aparecem dúvidas, ironias, críticas recorrentes e sinais de desgaste.",
      "O primeiro sinal de risco costuma ser **mudança de tom**, não volume. Um post pode ter poucos comentários e ainda assim carregar irritação, desconfiança ou medo.",
      "Na prática, vale acompanhar três sinais: **queda no score médio de sentimento**, crescimento de emoções como raiva ou medo e repetição de temas de crítica.",
      "Para agências e social medias, essa leitura vira uma entrega clara: explicar **se a audiência ficou mais confiante, confusa, irritada ou engajada**.",
      "O Sentimenta foi pensado para mostrar onde está o risco **sem a equipe precisar ler centenas de mensagens manualmente**.",
    ].join("\n\n"),
    status: "published",
    category: "Gestão de Reputação",
    persona: "social-media",
    coverImageUrl: "/blog/risco-comentarios-instagram.png",
    coverImageAlt:
      "Ilustração editorial de um painel de comentários com sinais de alerta e sentimento",
    tags: ["instagram", "crise", "reputação", "comentários"],
    cta: {
      label: "Fazer um diagnóstico gratuito",
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
    title: "Relatório para cliente além de curtidas e alcance",
    excerpt:
      "Como transformar comentários em uma camada nova de relatório para social media, atendimento e reputação.",
    bodyMarkdown: [
      "Muitos relatórios de social media param em alcance, impressões, curtidas e seguidores. Esses números são úteis, mas não respondem à pergunta: **as pessoas gostaram mesmo?**",
      "Comentários mostram percepção. Uma campanha pode ter alto alcance e ainda gerar desconfiança; outra pode revelar desejo de compra e temas que merecem virar conteúdo.",
      "Um bom relatório de sentimento deve trazer **score geral, principais emoções, temas positivos, temas negativos e comentários que merecem resposta**.",
      "A entrega fica mais forte quando a agência mostra exemplos rastreáveis. Isso evita o risco de parecer texto inventado por IA.",
      "A oportunidade comercial é vender **inteligência de audiência** como uma camada premium de relatório.",
    ].join("\n\n"),
    status: "published",
    category: "Análise de Sentimento",
    persona: "agencias",
    coverImageUrl: "/blog/relatorio-cliente-sentimento.png",
    coverImageAlt:
      "Ilustração editorial de relatório de social media com comentários classificados por sentimento",
    tags: ["agências", "relatórios", "social-media", "clientes"],
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

export function normalizeBlogSettings(settings: ApiBlogSettings): BlogSettings {
  return {
    navPricingLabel: settings.nav_pricing_label,
    navCtaLabel: settings.nav_cta_label,
    navCtaHref: settings.nav_cta_href,
    heroEyebrow: settings.hero_eyebrow,
    heroTitle: settings.hero_title,
    heroDescription: settings.hero_description,
    searchPlaceholder: settings.search_placeholder,
    heroCtaLabel: settings.hero_cta_label,
    heroCtaHref: settings.hero_cta_href,
    sidebarTitle: settings.sidebar_title,
    sidebarDescription: settings.sidebar_description,
    sidebarCtaLabel: settings.sidebar_cta_label,
    sidebarCtaHref: settings.sidebar_cta_href,
    allCategoryLabel: settings.all_category_label,
    categories: settings.categories?.filter(Boolean) || fallbackBlogSettings.categories,
    emptyStateText: settings.empty_state_text,
    articleNavCtaLabel: settings.article_nav_cta_label,
    articleNavCtaHref: settings.article_nav_cta_href,
    articleCtaTitle: settings.article_cta_title,
    articleCtaDescription: settings.article_cta_description,
    updatedAt: settings.updated_at,
  };
}

export function getBlogCategories(settings: BlogSettings = fallbackBlogSettings) {
  return [settings.allCategoryLabel, ...settings.categories].filter(
    (category, index, categories) => category && categories.indexOf(category) === index,
  );
}

export async function fetchBlogSettings(): Promise<BlogSettings> {
  try {
    const response = await fetch(`${apiBase()}/api/v1/blog/settings`, { cache: "no-store" });
    if (!response.ok) return fallbackBlogSettings;
    return normalizeBlogSettings((await response.json()) as ApiBlogSettings);
  } catch {
    return fallbackBlogSettings;
  }
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
