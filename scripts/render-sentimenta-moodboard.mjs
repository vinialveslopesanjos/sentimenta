import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const outDir = path.resolve("output/sentimenta-moodboard");
const W = 1600;
const H = 1200;

const C = {
  ink: "#0f085e",
  muted: "#657982",
  paper: "#f7fbfb",
  teal: "#39b8c6",
  tealDark: "#1f8f9b",
  rose: "#b6496b",
  roseSoft: "#d9a0b2",
  gold: "#b88147",
  line: "rgba(15,8,94,0.12)",
};

const refs = [
  {
    id: "glass-signal",
    title: "Glass Signal",
    bestFor: "Slide de abertura: reputacao como sinal em tempo real",
    prompt:
      "A single premium glass-white editorial SaaS visual: one translucent analytics card floating over soft teal and rose light, no collage, no AI gloss.",
    art: "signal",
  },
  {
    id: "comment-quote",
    title: "Quiet Comment",
    bestFor: "Slides com frases fortes e comentario como protagonista",
    prompt:
      "A single refined social comment reference: one oversized comment bubble, elegant spacing, subtle human imperfection, glass-white background.",
    art: "quote",
  },
  {
    id: "emotion-radar",
    title: "Emotion Radar",
    bestFor: "Slides sobre emocao, urgencia e risco",
    prompt:
      "A single minimal emotion radar chart reference, soft data UI, glass-white card, teal and rose accents, no purple gradient.",
    art: "radar",
  },
  {
    id: "trend-shift",
    title: "Trend Shift",
    bestFor: "Slides que explicam mudanca de tom antes da crise",
    prompt:
      "A single elegant trend-line visual, editorial composition, one red inflection point, calm premium SaaS language.",
    art: "trend",
  },
  {
    id: "detail-stack",
    title: "Detail Stack",
    bestFor: "Slides sobre tema, perfil, emocao e tempo",
    prompt:
      "A single stacked-detail card visual: four clean data tags arranged as one designed object, airy glass-white treatment.",
    art: "stack",
  },
  {
    id: "brand-close",
    title: "Brand Close",
    bestFor: "Slide final com assinatura Sentimenta",
    prompt:
      "A single brand-led closing visual: Sentimenta logo tile as hero, deep indigo wordmark energy, soft white editorial finish.",
    art: "brand",
  },
];

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function defs() {
  return `
  <defs>
    <linearGradient id="logoGrad" x1="0" y1="72" x2="72" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${C.roseSoft}"/>
      <stop offset="1" stop-color="${C.teal}"/>
    </linearGradient>
    <radialGradient id="tealGlow" cx="50%" cy="50%" r="50%">
      <stop stop-color="${C.teal}" stop-opacity=".36"/>
      <stop offset="1" stop-color="${C.teal}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="roseGlow" cx="50%" cy="50%" r="50%">
      <stop stop-color="${C.rose}" stop-opacity=".22"/>
      <stop offset="1" stop-color="${C.rose}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldGlow" cx="50%" cy="50%" r="50%">
      <stop stop-color="${C.gold}" stop-opacity=".16"/>
      <stop offset="1" stop-color="${C.gold}" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dx="0" dy="28" stdDeviation="30" flood-color="#0f085e" flood-opacity=".12"/>
    </filter>
    <filter id="logoShadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="${C.teal}" flood-opacity=".30"/>
    </filter>
  </defs>`;
}

function logo(x = 96, y = 78, s = 1) {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect width="72" height="72" rx="20.16" fill="url(#logoGrad)" filter="url(#logoShadow)"/>
    <svg x="18" y="18" width="36" height="36" viewBox="0 0 24 24" fill="none">
      <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <text x="94" y="48" class="brand" font-size="34" font-weight="500" fill="${C.ink}">sentimenta</text>
  </g>`;
}

function base(ref) {
  return `
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <circle cx="80" cy="120" r="500" fill="url(#tealGlow)"/>
  <circle cx="1510" cy="90" r="520" fill="url(#roseGlow)"/>
  <circle cx="1370" cy="1120" r="500" fill="url(#goldGlow)"/>
  <circle cx="800" cy="610" r="285" fill="none" stroke="${C.teal}" stroke-opacity=".12" stroke-width="2"/>
  <circle cx="800" cy="610" r="430" fill="none" stroke="${C.teal}" stroke-opacity=".09" stroke-width="2"/>
  ${logo()}
  <text x="96" y="1060" class="mono" font-size="22" font-weight="800" letter-spacing="4" fill="${C.tealDark}">MOODBOARD / ${esc(ref.title.toUpperCase())}</text>
  `;
}

function card(x, y, w, h, content) {
  return `
  <g filter="url(#softShadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="46" fill="rgba(255,255,255,.68)" stroke="rgba(255,255,255,.88)" stroke-width="2"/>
    ${content}
  </g>`;
}

function art(ref) {
  switch (ref.art) {
    case "signal":
      return card(
        340,
        345,
        920,
        420,
        `
        <text x="425" y="460" class="mono" font-size="22" font-weight="800" letter-spacing="4" fill="${C.muted}">SENTIMENTO AGORA</text>
        <path d="M430 630 L560 630 L628 540 L710 700 L805 480 L906 620 L1010 575 L1165 575" fill="none" stroke="${C.teal}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="805" cy="480" r="18" fill="${C.teal}"/>
        <circle cx="710" cy="700" r="16" fill="${C.rose}"/>
        `,
      );
    case "quote":
      return card(
        290,
        330,
        1020,
        500,
        `
        <text x="380" y="500" class="sans" font-size="58" font-weight="720" fill="${C.ink}">"A conversa mudou</text>
        <text x="380" y="575" class="sans" font-size="58" font-weight="720" fill="${C.ink}">antes do numero subir."</text>
        <rect x="382" y="680" width="520" height="18" rx="9" fill="rgba(15,8,94,.10)"/>
        <rect x="382" y="680" width="350" height="18" rx="9" fill="${C.teal}"/>
        <circle cx="1030" cy="492" r="42" fill="${C.rose}" opacity=".18"/>
        `,
      );
    case "radar":
      return card(
        410,
        245,
        780,
        720,
        `
        <g transform="translate(800 620)">
          <polygon points="0,-260 225,-130 225,130 0,260 -225,130 -225,-130" fill="none" stroke="${C.line}" stroke-width="3"/>
          <polygon points="0,-175 151,-88 151,88 0,175 -151,88 -151,-88" fill="none" stroke="${C.line}" stroke-width="3"/>
          <polygon points="0,-235 122,-70 202,116 0,150 -174,100 -106,-62" fill="${C.teal}" opacity=".20" stroke="${C.teal}" stroke-width="8" stroke-linejoin="round"/>
          <circle cx="0" cy="-235" r="12" fill="${C.teal}"/>
          <circle cx="202" cy="116" r="12" fill="${C.rose}"/>
        </g>
        `,
      );
    case "trend":
      return card(
        240,
        360,
        1120,
        470,
        `
        <path d="M360 660 C520 560,680 555,830 610 S1130 780,1240 470" fill="none" stroke="${C.rose}" stroke-width="14" stroke-linecap="round"/>
        <path d="M360 575 C550 540,725 500,900 465 S1120 430,1240 405" fill="none" stroke="${C.teal}" stroke-width="14" stroke-linecap="round"/>
        <circle cx="1015" cy="610" r="84" fill="${C.rose}" opacity=".12"/>
        <circle cx="1015" cy="610" r="18" fill="${C.rose}"/>
        `,
      );
    case "stack":
      return `
      ${chip(310, 330, "tema", "preco", C.gold)}
      ${chip(810, 410, "emocao", "frustracao", C.rose)}
      ${chip(510, 675, "perfil", "cliente fiel", "#9aacbd")}
      ${chip(980, 720, "tempo", "2h atras", C.teal)}
      `;
    case "brand":
      return `
      <g transform="translate(538 305) scale(1.45)">
        <rect width="360" height="360" rx="100.8" fill="url(#logoGrad)" filter="url(#logoShadow)"/>
        <svg x="90" y="90" width="180" height="180" viewBox="0 0 24 24" fill="none">
          <path d="M3 17C3 17 7 22 12 19C17 16 18 10 22 8" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </g>
      <text x="460" y="940" class="brand" font-size="106" font-weight="500" fill="${C.ink}">sentimenta</text>
      `;
    default:
      return "";
  }
}

function chip(x, y, label, value, color) {
  return card(
    x,
    y,
    420,
    188,
    `
    <text x="${x + 46}" y="${y + 68}" class="mono" font-size="18" font-weight="800" letter-spacing="3" fill="${color}">${esc(label.toUpperCase())}</text>
    <text x="${x + 46}" y="${y + 130}" class="sans" font-size="38" font-weight="750" fill="${C.ink}">${esc(value)}</text>
    `,
  );
}

function svg(ref) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs()}
<style>
  .sans { font-family: "Inter", "Segoe UI", Arial, sans-serif; }
  .brand { font-family: "Outfit", "Segoe UI", Arial, sans-serif; letter-spacing: -0.02em; }
  .mono { font-family: "Inter", "Segoe UI", Arial, sans-serif; }
</style>
${base(ref)}
${art(ref)}
</svg>`;
}

await fs.mkdir(outDir, { recursive: true });

const manifest = [];
for (const ref of refs) {
  const source = svg(ref);
  const file = path.join(outDir, `${ref.id}.png`);
  await fs.writeFile(path.join(outDir, `${ref.id}.svg`), source);
  await sharp(Buffer.from(source)).png({ compressionLevel: 9 }).toFile(file);
  manifest.push({ ...ref, path: file });
}

await fs.writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ outDir, items: manifest }, null, 2));
