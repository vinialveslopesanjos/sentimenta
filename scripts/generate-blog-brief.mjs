#!/usr/bin/env node

const args = process.argv.slice(2);

function readArg(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const weeklyTopics = [
  {
    topic: "comentarios negativos no Instagram",
    persona: "social-media",
    title: "Como lidar com comentarios negativos no Instagram sem depender de achismo",
  },
  {
    topic: "relatorio de sentimento para clientes de agencia",
    persona: "agencias",
    title: "Como criar um relatorio de sentimento que o cliente entende",
  },
  {
    topic: "risco reputacional em posts com muitas criticas",
    persona: "social-media",
    title: "Como perceber quando um post esta virando risco de reputacao",
  },
  {
    topic: "como vender analise de comentarios como upsell",
    persona: "agencias",
    title: "Como uma agencia pode vender analise de comentarios como upsell",
  },
  {
    topic: "temas de conteudo escondidos nos comentarios",
    persona: "criadores",
    title: "Como encontrar ideias de conteudo nos comentarios da audiencia",
  },
  {
    topic: "Google Ads e Meta Ads para validar um SaaS pequeno",
    persona: "fundadores",
    title: "Como usar Google Ads e Meta Ads sem queimar verba no inicio",
  },
];

function weekNumber(date) {
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOfYear = Math.floor((date - firstDay) / 86400000) + 1;
  return Math.ceil((dayOfYear + firstDay.getUTCDay()) / 7);
}

const picked = hasFlag("weekly")
  ? weeklyTopics[weekNumber(new Date()) % weeklyTopics.length]
  : null;

const topic = readArg("topic", picked?.topic || "comentarios do Instagram");
const persona = readArg("persona", picked?.persona || "social-media");
const out = readArg("out", "");
const today = new Date().toISOString().slice(0, 10);

const slug = topic
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const customTitle = picked?.title || readArg("title", "");
const title = customTitle || (persona === "agencias"
    ? `Como transformar ${topic} em relatorio para cliente`
    : `Como lidar com ${topic} sem depender de achismo`);

const brief = {
  date: today,
  slug,
  persona,
  topic,
  title,
  searchIntent: "A pessoa quer entender uma dor pratica e encontrar uma forma simples de agir.",
  promise: "Mostrar um caminho claro para transformar comentarios em decisao, sem inventar dados.",
  outline: [
    "Abrir com a dor concreta em linguagem simples.",
    "Explicar por que curtidas e alcance nao respondem tudo.",
    "Mostrar 3 sinais que a pessoa pode observar nos comentarios.",
    "Conectar a dor ao diagnostico do Sentimenta.",
    "Fechar com um CTA unico para testar com um perfil ou post publico.",
  ],
  imagePrompt: `Pastel vector editorial illustration for a SaaS blog article about ${topic}. Show a clean dashboard with comment bubbles, sentiment indicators, and a calm professional atmosphere. No readable text, no logos, teal rose amber palette.`,
  cta: `/login?utm_source=blog&utm_medium=organic&utm_campaign=${slug}`,
};

const output = `${JSON.stringify(brief, null, 2)}\n`;

if (out) {
  const { mkdirSync, writeFileSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, output, "utf8");
}

console.log(output);
