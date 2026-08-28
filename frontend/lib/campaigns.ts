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
    audience: "Agências de marketing e social media",
    title: "Entregue ao cliente o que curtidas e alcance não mostram",
    subtitle:
      "O Sentimenta transforma comentários de Instagram e YouTube em score de sentimento, emoções, temas de crítica e sinais de risco para relatórios mais fortes.",
    offer: "Diagnóstico gratuito de 1 perfil ou post público para mostrar 3 insights práticos.",
    ctaLabel: "Pedir diagnóstico para agência",
    ctaHref:
      "/diagnostico?utm_source=landing&utm_medium=campaign&utm_campaign=agencias-diagnostico",
    proofPoints: [
      "Relatório com percepção real da audiência, não apenas volume.",
      "Comentários negativos, irônicos ou recorrentes ficam mais fáceis de priorizar.",
      "Boa camada de upsell para clientes que já compram social media ou tráfego pago.",
    ],
    painPoints: [
      "Cliente pergunta se a campanha foi bem recebida e o relatório só mostra alcance.",
      "Equipe perde tempo lendo comentário manualmente antes de reunião.",
      "Crise pequena aparece nos comentários antes de virar problema público.",
    ],
    steps: [
      "Você conecta ou informa um perfil/post público.",
      "O Sentimenta coleta comentários e classifica sentimento, emoção e temas.",
      "Você recebe uma leitura clara para apresentar ao cliente ou agir com a equipe.",
    ],
    faq: [
      {
        question: "Isso substitui o relatório de social media?",
        answer:
          "Não. Ele adiciona uma camada de percepção: como as pessoas reagiram, quais temas apareceram e quais comentários merecem atenção.",
      },
      {
        question: "Precisa ler todos os comentários?",
        answer:
          "Não. A ideia é resumir padrões e destacar pontos de risco ou oportunidade para leitura humana seletiva.",
      },
    ],
  },
  "social-media": {
    slug: "social-media",
    audience: "Social medias e gestores de comunidade",
    title: "Pare de tentar sentir o clima dos comentários no olho",
    subtitle:
      "Veja rapidamente se a audiência está positiva, irritada, confusa ou preocupada, sem depender de achismo nem ler centenas de mensagens.",
    offer: "Analise um post ou perfil e encontre os comentários que merecem resposta primeiro.",
    ctaLabel: "Testar com meus comentários",
    ctaHref:
      "/diagnostico?utm_source=landing&utm_medium=campaign&utm_campaign=social-media-diagnostico",
    proofPoints: [
      "Score de sentimento para saber se o tom geral subiu ou caiu.",
      "Emoções e tópicos para entender o motivo da reação.",
      "Fila de comentários importantes para priorizar resposta.",
    ],
    painPoints: [
      "Ler comentário demais consome a manhã e ainda deixa dúvida.",
      "Comentários negativos isolados parecem maiores do que realmente são.",
      "Picos de crítica podem passar despercebidos quando o post performa bem.",
    ],
    steps: [
      "Você escolhe Instagram ou YouTube.",
      "O Sentimenta busca comentários recentes e analisa em lote.",
      "O dashboard mostra sentimento, emoções, temas e pontos de atenção.",
    ],
    faq: [
      {
        question: "Serve para post com poucos comentários?",
        answer:
          "Serve, mas fica melhor quando há volume suficiente para enxergar padrões. Em post pequeno, o valor é priorizar leitura e resposta.",
      },
      {
        question: "A IA inventa conclusões?",
        answer:
          "O produto foi desenhado para mostrar status e dados rastreáveis. Quando a coleta ou análise falha, a interface não deve fingir sucesso.",
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
