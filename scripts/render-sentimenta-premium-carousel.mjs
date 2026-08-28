import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve("output/sentimenta-premium-carousel");
const W = 2160;
const H = 2700;
const EXPORT_W = 4320;
const EXPORT_H = 5400;

const C = {
  ink: "#0f085e",
  text: "#17133f",
  muted: "#5f6f77",
  faint: "#8fa0a7",
  teal: "#39b8c6",
  tealDark: "#1f8f9b",
  rose: "#b6496b",
  roseSoft: "#d9a0b2",
  gold: "#b88147",
  paper: "#f7fbfb",
  white: "#ffffff",
  line: "rgba(15,8,94,0.12)",
};

const slides = [
  {
    eyebrow: "REPUTAÇÃO EM TEMPO REAL",
    title: "Comentários não são ruído.",
    title2: "São sinal.",
    body:
      "Antes de virar crise, tendência ou oportunidade, quase tudo aparece primeiro na conversa da audiência.",
    index: "01",
    variant: "hero",
  },
  {
    eyebrow: "SINAL 01",
    title: "O tom muda antes do volume.",
    body:
      "Uma marca atenta percebe quando elogios viram dúvidas, dúvidas viram irritação e irritação vira pressão pública.",
    index: "02",
    variant: "tone",
  },
  {
    eyebrow: "SINAL 02",
    title: "Polaridade sozinha engana.",
    body:
      "Um comentário positivo pode esconder sarcasmo. Um negativo pode revelar uma chance de corrigir rota.",
    index: "03",
    variant: "emotion",
  },
  {
    eyebrow: "SINAL 03",
    title: "Emoção mostra urgência.",
    body:
      "Raiva, nojo, medo e tristeza pedem respostas diferentes. Tratar tudo como negativo empobrece a leitura.",
    index: "04",
    variant: "radar",
  },
  {
    eyebrow: "SINAL 04",
    title: "Os melhores insights estão nos detalhes.",
    body:
      "Não é apenas quantos comentaram. É quem comentou, sobre qual tema, com qual emoção e em que momento.",
    index: "05",
    variant: "details",
  },
  {
    eyebrow: "COMO OPERAR",
    title: "Leia comentários como um painel vivo.",
    body:
      "Agrupe temas, acompanhe viradas de sentimento e transforme percepção social em decisão diária.",
    index: "06",
    variant: "system",
  },
  {
    eyebrow: "SENTIMENTA",
    title: "Sua reputação já está falando.",
    title2: "Escute melhor.",
    body:
      "O Sentimenta transforma comentários em sinais claros de sentimento, emoção e risco.",
    index: "07",
    variant: "close",
  },
];

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textBlock(text, x, y, width, size, lineHeight, color = C.text, weight = 500) {
  const maxChars = Math.floor(width / (size * 0.5));
  return wrapText(text, maxChars)
    .map(
      (line, i) =>
        `<text x="${x}" y="${y + i * lineHeight}" class="sans" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(line)}</text>`,
    )
    .join("\n");
}

function logo(x = 142, y = 132, scale = 1) {
  const s = scale;
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect width="72" height="72" rx="20.16" fill="url(#logoGrad)" filter="url(#logoShadow)"/>
    <svg x="18" y="18" width="36" height="36" viewBox="0 0 24 24" fill="none">
      <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <text x="94" y="48" class="brand" font-size="34" font-weight="500" fill="${C.ink}">sentimenta</text>
  </g>`;
}

function defs() {
  return `
  <defs>
    <linearGradient id="logoGrad" x1="0" y1="72" x2="72" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${C.roseSoft}"/>
      <stop offset="1" stop-color="${C.teal}"/>
    </linearGradient>
    <linearGradient id="ruleGrad" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="${C.teal}" stop-opacity="0"/>
      <stop offset=".48" stop-color="${C.teal}" stop-opacity=".8"/>
      <stop offset="1" stop-color="${C.rose}" stop-opacity="0"/>
    </linearGradient>
    <filter id="logoShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="16" stdDeviation="16" flood-color="${C.teal}" flood-opacity=".28"/>
    </filter>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="34" stdDeviation="34" flood-color="#0f085e" flood-opacity=".12"/>
    </filter>
    <filter id="tinyShadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#0f085e" flood-opacity=".10"/>
    </filter>
    <radialGradient id="tealGlow" cx="50%" cy="50%" r="50%">
      <stop stop-color="${C.teal}" stop-opacity=".38"/>
      <stop offset="1" stop-color="${C.teal}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="roseGlow" cx="50%" cy="50%" r="50%">
      <stop stop-color="${C.rose}" stop-opacity=".22"/>
      <stop offset="1" stop-color="${C.rose}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
      <stop stop-color="${C.gold}" stop-opacity=".18"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
  </defs>`;
}

function background() {
  return `
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <circle cx="250" cy="240" r="760" fill="url(#tealGlow)"/>
  <circle cx="1870" cy="255" r="860" fill="url(#roseGlow)"/>
  <circle cx="1710" cy="2440" r="760" fill="url(#goldGlow)"/>
  <path d="M-20 1660 C 450 1480, 800 1710, 1160 1530 S 1760 1250, 2210 1500" fill="none" stroke="${C.teal}" stroke-opacity=".14" stroke-width="3"/>
  <path d="M-80 1840 C 410 1660, 780 1880, 1110 1705 S 1740 1430, 2240 1690" fill="none" stroke="${C.rose}" stroke-opacity=".10" stroke-width="3"/>
  <circle cx="1080" cy="1340" r="420" fill="none" stroke="${C.teal}" stroke-opacity=".11" stroke-width="2"/>
  <circle cx="1080" cy="1340" r="650" fill="none" stroke="${C.teal}" stroke-opacity=".09" stroke-width="2"/>
  <circle cx="1080" cy="1340" r="850" fill="none" stroke="${C.teal}" stroke-opacity=".07" stroke-width="2"/>
  `;
}

function footer(slide) {
  return `
  <text x="142" y="2508" class="mono" font-size="26" font-weight="700" fill="${C.faint}">${slide.index} / 07</text>
  <rect x="142" y="2548" width="1876" height="3" rx="2" fill="${C.line}"/>
  <rect x="142" y="2548" width="${(1876 * Number(slide.index)) / 7}" height="3" rx="2" fill="url(#ruleGrad)"/>
  `;
}

function header(slide) {
  return `
  ${logo()}
  <text x="142" y="412" class="mono" font-size="28" font-weight="800" letter-spacing="4" fill="${C.tealDark}">${esc(slide.eyebrow)}</text>`;
}

function title(slide, y = 620, max = 18) {
  const titleWidth = 1500;
  const titleSize = 118;
  const titleLineHeight = 128;
  const primaryLines = wrapText(slide.title, Math.floor(titleWidth / (titleSize * 0.5)));
  const primary = primaryLines
    .map(
      (line, i) =>
        `<text x="142" y="${y + i * titleLineHeight}" class="sans" font-size="${titleSize}" font-weight="750" fill="${C.ink}">${esc(line)}</text>`,
    )
    .join("\n");
  const secondY = y + primaryLines.length * titleLineHeight + 40;
  const second = slide.title2
    ? `<text x="142" y="${secondY}" class="serif" font-size="132" font-weight="500" fill="${C.rose}">${esc(slide.title2)}</text>`
    : "";
  const bodyY = slide.title2 ? secondY + 178 : y + primaryLines.length * titleLineHeight + 170;
  return `${primary}\n${second}\n${textBlock(slide.body, 150, bodyY, 1420, 50, 72, C.muted, 450)}`;
}

function pill(x, y, label, color, width = 430) {
  return `
  <g filter="url(#tinyShadow)">
    <rect x="${x}" y="${y}" width="${width}" height="132" rx="38" fill="rgba(255,255,255,.62)" stroke="rgba(255,255,255,.82)" stroke-width="2"/>
    <circle cx="${x + 54}" cy="${y + 54}" r="14" fill="${color}"/>
    <text x="${x + 90}" y="${y + 62}" class="sans" font-size="34" font-weight="750" fill="${C.ink}">${esc(label)}</text>
    <rect x="${x + 48}" y="${y + 92}" width="${width - 96}" height="14" rx="7" fill="rgba(15,8,94,.10)"/>
    <rect x="${x + 48}" y="${y + 92}" width="${(width - 96) * 0.58}" height="14" rx="7" fill="${color}"/>
  </g>`;
}

function chartCard(x, y, w, h, children = "") {
  return `
  <g filter="url(#softShadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="54" fill="rgba(255,255,255,.64)" stroke="rgba(255,255,255,.85)" stroke-width="2"/>
    ${children}
  </g>`;
}

function visual(slide) {
  switch (slide.variant) {
    case "hero":
      return `
      ${pill(1450, 900, "Alegria", C.teal, 430)}
      ${pill(1540, 1128, "Raiva", C.rose, 390)}
      ${pill(210, 1830, "Neutro", "#9aacbd", 390)}
      ${chartCard(
        660,
        1420,
        1050,
        520,
        `
        <text x="730" y="1530" class="mono" font-size="24" font-weight="800" letter-spacing="3" fill="${C.faint}">SENTIMENTO AGORA</text>
        <path d="M760 1740 L930 1740 L1015 1620 L1120 1830 L1240 1530 L1350 1720 L1470 1660 L1600 1660" fill="none" stroke="${C.teal}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="1240" cy="1530" r="22" fill="${C.teal}"/>
        <circle cx="1120" cy="1830" r="20" fill="${C.rose}"/>
        <text x="760" y="1868" class="sans" font-size="40" font-weight="700" fill="${C.ink}">o primeiro sinal raramente grita</text>
        `,
      )}`;
    case "tone":
      return chartCard(
        142,
        1340,
        1876,
        680,
        `
        <text x="242" y="1460" class="mono" font-size="24" font-weight="800" letter-spacing="3" fill="${C.faint}">VIRADA DE TOM</text>
        <path d="M260 1800 C520 1660,760 1640,1010 1720 S1450 1880,1870 1560" fill="none" stroke="${C.rose}" stroke-width="14" stroke-linecap="round"/>
        <path d="M260 1710 C560 1660,810 1580,1060 1510 S1510 1480,1870 1440" fill="none" stroke="${C.teal}" stroke-width="14" stroke-linecap="round"/>
        <circle cx="1510" cy="1640" r="120" fill="${C.rose}" opacity=".10"/>
        <circle cx="1510" cy="1640" r="16" fill="${C.rose}"/>
        <text x="1386" y="1848" class="sans" font-size="38" font-weight="700" fill="${C.ink}">ponto de atencao</text>
        <text x="260" y="1942" class="sans" font-size="32" fill="${C.muted}">elogio</text>
        <text x="1712" y="1942" class="sans" font-size="32" fill="${C.muted}">pressão</text>
        `,
      );
    case "emotion":
      return `
      ${chartCard(
        236,
        1330,
        1688,
        720,
        `
        <text x="336" y="1455" class="mono" font-size="24" font-weight="800" letter-spacing="3" fill="${C.faint}">MESMA POLARIDADE, OUTRA LEITURA</text>
        ${emotionRow(360, 1580, "positivo", "elogio real", C.teal, 0.76)}
        ${emotionRow(360, 1742, "positivo", "sarcasmo", C.gold, 0.54)}
        ${emotionRow(360, 1904, "negativo", "dor acionavel", C.rose, 0.68)}
        `,
      )}`;
    case "radar":
      return chartCard(
        420,
        1240,
        1320,
        900,
        `
        <text x="520" y="1370" class="mono" font-size="24" font-weight="800" letter-spacing="3" fill="${C.faint}">MAPA EMOCIONAL</text>
        <g transform="translate(1080 1720)">
          <polygon points="0,-310 268,-155 268,155 0,310 -268,155 -268,-155" fill="none" stroke="${C.line}" stroke-width="3"/>
          <polygon points="0,-230 199,-115 199,115 0,230 -199,115 -199,-115" fill="none" stroke="${C.line}" stroke-width="3"/>
          <polygon points="0,-135 117,-67 117,67 0,135 -117,67 -117,-67" fill="none" stroke="${C.line}" stroke-width="3"/>
          <polygon points="0,-260 160,-92 220,126 0,180 -190,110 -120,-70" fill="${C.teal}" opacity=".18" stroke="${C.teal}" stroke-width="8" stroke-linejoin="round"/>
          <circle cx="0" cy="-260" r="12" fill="${C.teal}"/>
          <circle cx="220" cy="126" r="12" fill="${C.rose}"/>
          <text x="-58" y="-350" class="sans" font-size="34" font-weight="700" fill="${C.ink}">raiva</text>
          <text x="244" y="-128" class="sans" font-size="34" font-weight="700" fill="${C.ink}">medo</text>
          <text x="238" y="210" class="sans" font-size="34" font-weight="700" fill="${C.ink}">nojo</text>
          <text x="-58" y="390" class="sans" font-size="34" font-weight="700" fill="${C.ink}">alegria</text>
          <text x="-398" y="210" class="sans" font-size="34" font-weight="700" fill="${C.ink}">tristeza</text>
          <text x="-372" y="-128" class="sans" font-size="34" font-weight="700" fill="${C.ink}">surpresa</text>
        </g>`,
      );
    case "details":
      return `
      ${detailCard(260, 1290, "tema", "preco", C.gold)}
      ${detailCard(800, 1420, "emoção", "frustração", C.rose)}
      ${detailCard(1210, 1260, "tempo", "2h atrás", C.teal)}
      ${detailCard(600, 1740, "perfil", "cliente recorrente", "#9aacbd")}
      <path d="M550 1570 C720 1510,880 1580,980 1650 S1210 1760,1440 1580" fill="none" stroke="${C.teal}" stroke-width="8" stroke-opacity=".38" stroke-linecap="round"/>
      `;
    case "system":
      return chartCard(
        210,
        1230,
        1740,
        910,
        `
        <text x="310" y="1364" class="mono" font-size="24" font-weight="800" letter-spacing="3" fill="${C.faint}">FLUXO DE LEITURA</text>
        ${node(352, 1550, "coletar", C.teal)}
        ${node(770, 1550, "agrupar", C.gold)}
        ${node(1188, 1550, "priorizar", C.rose)}
        ${node(770, 1840, "decidir", C.ink)}
        <path d="M612 1638 H770" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>
        <path d="M1030 1638 H1188" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>
        <path d="M1415 1680 C1320 1810,1160 1888,1030 1902" fill="none" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>
        <path d="M770 1902 C600 1880,500 1788,456 1700" fill="none" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>
        `,
      );
    case "close":
      return `
      <g transform="translate(684 1310) scale(2.2)">
        <rect width="360" height="360" rx="100.8" fill="url(#logoGrad)" filter="url(#logoShadow)"/>
        <svg x="90" y="90" width="180" height="180" viewBox="0 0 24 24" fill="none">
          <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </g>
      <text x="142" y="2290" class="mono" font-size="28" font-weight="800" letter-spacing="4" fill="${C.tealDark}">WWW.SENTIMENTA.COM.BR</text>
      `;
    default:
      return "";
  }
}

function emotionRow(x, y, left, right, color, value) {
  return `
  <text x="${x}" y="${y}" class="sans" font-size="34" font-weight="700" fill="${C.ink}">${esc(left)}</text>
  <rect x="${x + 260}" y="${y - 34}" width="700" height="18" rx="9" fill="rgba(15,8,94,.09)"/>
  <rect x="${x + 260}" y="${y - 34}" width="${700 * value}" height="18" rx="9" fill="${color}"/>
  <text x="${x + 1040}" y="${y}" class="sans" font-size="34" font-weight="700" fill="${color}">${esc(right)}</text>`;
}

function detailCard(x, y, small, big, color) {
  return `
  <g filter="url(#tinyShadow)">
    <rect x="${x}" y="${y}" width="520" height="250" rx="48" fill="rgba(255,255,255,.64)" stroke="rgba(255,255,255,.85)" stroke-width="2"/>
    <text x="${x + 56}" y="${y + 82}" class="mono" font-size="22" font-weight="800" letter-spacing="3" fill="${color}">${esc(small)}</text>
    <text x="${x + 56}" y="${y + 164}" class="sans" font-size="48" font-weight="750" fill="${C.ink}">${esc(big)}</text>
  </g>`;
}

function node(x, y, label, color) {
  return `
  <g>
    <rect x="${x}" y="${y}" width="260" height="176" rx="42" fill="rgba(255,255,255,.70)" stroke="rgba(255,255,255,.9)" stroke-width="2"/>
    <circle cx="${x + 54}" cy="${y + 58}" r="16" fill="${color}"/>
    <text x="${x + 44}" y="${y + 122}" class="sans" font-size="38" font-weight="750" fill="${C.ink}">${esc(label)}</text>
  </g>`;
}

function svg(slide) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs()}
  <style>
    .sans { font-family: "Inter", "Segoe UI", Arial, sans-serif; }
    .brand { font-family: "Outfit", "Segoe UI", Arial, sans-serif; letter-spacing: -0.02em; }
    .mono { font-family: "Inter", "Segoe UI", Arial, sans-serif; }
    .serif { font-family: Georgia, "Times New Roman", serif; font-style: italic; }
  </style>
  ${background()}
  ${header(slide)}
  ${title(slide)}
  ${visual(slide)}
  ${footer(slide)}
</svg>`;
}

function previewHtml() {
  const cards = slides
    .map(
      (slide) => `
      <figure>
        <img src="./slide-${slide.index}-4320x5400.png" alt="Slide ${slide.index}: ${esc(slide.title)}" />
        <figcaption>${slide.index} - ${esc(slide.title)}</figcaption>
      </figure>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Sentimenta - Carrossel Premium</title>
  <style>
    body { margin: 0; background: #eef6f7; font-family: Inter, Segoe UI, Arial, sans-serif; color: ${C.ink}; }
    main { padding: 40px; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 28px; }
    figure { margin: 0; }
    img { width: 100%; display: block; border-radius: 18px; box-shadow: 0 24px 70px rgba(15,8,94,.12); }
    figcaption { margin-top: 12px; color: ${C.muted}; font-size: 14px; }
  </style>
</head>
<body><main>${cards}</main></body>
</html>`;
}

await fs.mkdir(outDir, { recursive: true });

for (const slide of slides) {
  const source = svg(slide);
  const base = `slide-${slide.index}`;
  await fs.writeFile(path.join(outDir, `${base}.svg`), source);
  await sharp(Buffer.from(source), { density: 288 })
    .resize(EXPORT_W, EXPORT_H)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(outDir, `${base}-4320x5400.png`));
}

await fs.writeFile(path.join(outDir, "index.html"), previewHtml());

console.log(`Rendered ${slides.length} slides to ${outDir}`);
