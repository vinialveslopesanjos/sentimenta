import type { Metadata } from "next";

export type CampaignPage = {
  slug: "agencias" | "social-media";
  audience: string;
  title: string;
  subtitle: string;
  offer: string;
  ctaLabel: string;
  ctaHref: string;
  proofPoints: string[];
  painPoints: string[];
  steps: string[];
  faq: Array<{ question: string; answer: string }>;
};

export const campaignPages: Record<CampaignPage["slug"], CampaignPage> = {
  agencias: {
    slug: "agencias",
    audience: "Agencias de marketing e social media",
    title: "Entregue ao cliente o que curtidas e alcance nao mostram",
    subtitle:
      "O Sentimenta transforma comentarios de Instagram e YouTube em score de sentimento, emocoes, temas de critica e sinais de risco para relatorios mais fortes.",
    offer: "Diagnostico gratuito de 1 perfil ou post publico para mostrar 3 insights praticos.",
    ctaLabel: "Pedir diagnostico para agencia",
    ctaHref:
      "/diagnostico?utm_source=landing&utm_medium=campaign&utm_campaign=agencias-diagnostico",
    proofPoints: [
      "Relatorio com percepcao real da audiencia, nao apenas volume.",
      "Comentarios negativos, ironicos ou recorrentes ficam mais faceis de priorizar.",
      "Boa camada de upsell para clientes que ja compram social media ou trafego pago.",
    ],
    painPoints: [
      "Cliente pergunta se a campanha foi bem recebida e o relatorio so mostra alcance.",
      "Equipe perde tempo lendo comentario manualmente antes de reuniao.",
      "Crise pequena aparece nos comentarios antes de virar problema publico.",
    ],
    steps: [
      "Voce conecta ou informa um perfil/post publico.",
      "O Sentimenta coleta comentarios e classifica sentimento, emocao e temas.",
      "Voce recebe uma leitura clara para apresentar ao cliente ou agir com a equipe.",
    ],
    faq: [
      {
        question: "Isso substitui o relatorio de social media?",
        answer:
          "Nao. Ele adiciona uma camada de percepcao: como as pessoas reagiram, quais temas apareceram e quais comentarios merecem atencao.",
      },
      {
        question: "Precisa ler todos os comentarios?",
        answer:
          "Nao. A ideia e resumir padroes e destacar pontos de risco ou oportunidade para leitura humana seletiva.",
      },
    ],
  },
  "social-media": {
    slug: "social-media",
    audience: "Social medias e gestores de comunidade",
    title: "Pare de tentar sentir o clima dos comentarios no olho",
    subtitle:
      "Veja rapidamente se a audiencia esta positiva, irritada, confusa ou preocupada, sem depender de achismo nem ler centenas de mensagens.",
    offer: "Analise um post ou perfil e encontre os comentarios que merecem resposta primeiro.",
    ctaLabel: "Testar com meus comentarios",
    ctaHref:
      "/diagnostico?utm_source=landing&utm_medium=campaign&utm_campaign=social-media-diagnostico",
    proofPoints: [
      "Score de sentimento para saber se o tom geral subiu ou caiu.",
      "Emocoes e topicos para entender o motivo da reacao.",
      "Fila de comentarios importantes para priorizar resposta.",
    ],
    painPoints: [
      "Ler comentario demais consome a manha e ainda deixa duvida.",
      "Comentarios negativos isolados parecem maiores do que realmente sao.",
      "Picos de critica podem passar despercebidos quando o post performa bem.",
    ],
    steps: [
      "Voce escolhe Instagram ou YouTube.",
      "O Sentimenta busca comentarios recentes e analisa em lote.",
      "O dashboard mostra sentimento, emocoes, temas e pontos de atencao.",
    ],
    faq: [
      {
        question: "Serve para post com poucos comentarios?",
        answer:
          "Serve, mas fica melhor quando ha volume suficiente para enxergar padroes. Em post pequeno, o valor e priorizar leitura e resposta.",
      },
      {
        question: "A IA inventa conclusoes?",
        answer:
          "O produto foi desenhado para mostrar status e dados rastreaveis. Quando a coleta ou analise falha, a interface nao deve fingir sucesso.",
      },
    ],
  },
};

export function campaignMetadata(page: CampaignPage): Metadata {
  return {
    title: `${page.audience} | Sentimenta`,
    description: page.subtitle,
    alternates: {
      canonical: `/campanhas/${page.slug}`,
    },
    openGraph: {
      title: page.title,
      description: page.subtitle,
      type: "website",
    },
  };
}
