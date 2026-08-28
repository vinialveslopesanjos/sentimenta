import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("output/sentimenta-refined-carousel/lughy-final");
await mkdir(outDir, { recursive: true });

const S = 4;
const W = 1080 * S;
const H = 1350 * S;

function esc(text) {
  return text.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[ch]));
}

async function svgBuffer(svg) {
  return Buffer.from(svg);
}

async function basePoster() {
  const icon = await readFile("output/sentimenta-refined-carousel/site-icon.svg", "utf8");
  const iconData = `data:image/svg+xml;base64,${Buffer.from(icon).toString("base64")}`;
  const lines = ["O que você", "não vê pode", "estar travando", "sua empresa"];
  const lineHeight = 148 * S;
  const startY = 474 * S;
  const headline = lines.map((line, index) =>
    `<text x="${94 * S}" y="${startY + index * lineHeight}" class="headline">${esc(line)}</text>`
  ).join("");

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f8f8f7"/>
    <image href="${iconData}" x="${98 * S}" y="${79 * S}" width="${41 * S}" height="${41 * S}"/>
    <text x="${151 * S}" y="${117 * S}" class="brand">sentimenta</text>
    ${headline}
    <text x="${98 * S}" y="${1259 * S}" class="foot">Sentimenta</text>
    <text x="${792 * S}" y="${1259 * S}" class="foot">@sentimenta</text>
    <style>
      .brand { font-family: Arial, Helvetica, sans-serif; font-size: ${42 * S}px; font-weight: 400; fill: #050505; letter-spacing: 0; }
      .headline { font-family: Arial, Helvetica, sans-serif; font-size: ${134 * S}px; font-weight: 400; fill: #050505; letter-spacing: 0; }
      .foot { font-family: Arial, Helvetica, sans-serif; font-size: ${26 * S}px; font-weight: 400; fill: #050505; letter-spacing: 0; }
    </style>
  </svg>`;
  return sharp(await svgBuffer(svg)).png().toBuffer();
}

function metaballMask({ width, height, balls, threshold = 2.18, feather = 0.28 }) {
  const pixels = Buffer.alloc(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let f = 0;
      for (const b of balls) {
        const dx = (x - b.x) / b.rx;
        const dy = (y - b.y) / b.ry;
        f += b.power / (dx * dx + dy * dy + 0.16);
      }
      const t = Math.max(0, Math.min(1, (f - (threshold - feather)) / (feather * 2)));
      const a = t * t * (3 - 2 * t);
      pixels[y * width + x] = Math.round(a * 255);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 1 } }).blur(1.2 * S).png().toBuffer();
}

function blobOverlaySvg({ width, height, accents, opacity = 0.45 }) {
  const accentEls = accents.map((a) => `
    <radialGradient id="${a.id}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff6418" stop-opacity="${a.strength}"/>
      <stop offset="48%" stop-color="#ff9b38" stop-opacity="${a.strength * 0.32}"/>
      <stop offset="100%" stop-color="#ff9b38" stop-opacity="0"/>
    </radialGradient>
    <ellipse cx="${a.x}" cy="${a.y}" rx="${a.rx}" ry="${a.ry}" fill="url(#${a.id})" filter="url(#blurAccent)"/>
  `).join("");

  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <filter id="blurAccent"><feGaussianBlur stdDeviation="${15 * S}"/></filter>
      <radialGradient id="milk" cx="48%" cy="44%" r="64%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity=".82"/>
        <stop offset="58%" stop-color="#f8f5ef" stop-opacity=".52"/>
        <stop offset="100%" stop-color="#dfddda" stop-opacity=".28"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#milk)" opacity="${opacity}"/>
    ${accentEls}
  </svg>`);
}

async function rimFromMask(mask, color = "#ffb05c", alphaScale = 1) {
  const meta = await sharp(mask).metadata();
  const alpha = await sharp(mask).greyscale().raw().toBuffer();
  const edgeAlpha = Buffer.alloc(alpha.length);
  for (let i = 0; i < alpha.length; i += 1) {
    const a = alpha[i] / 255;
    const edge = a > 0.08 && a < 0.92 ? Math.sin(a * Math.PI) : 0;
    edgeAlpha[i] = Math.round(Math.min(255, edge * 182 * alphaScale));
  }
  const edge = await sharp(edgeAlpha, { raw: { width: meta.width, height: meta.height, channels: 1 } }).blur(0.7 * S).png().toBuffer();
  const solid = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${meta.width}" height="${meta.height}">
    <rect width="100%" height="100%" fill="${color}" fill-opacity=".76"/>
  </svg>`);
  return withAlpha(solid, edge, meta.width, meta.height);
}

async function withAlpha(image, mask, width, height) {
  const rgba = await sharp(image).ensureAlpha().raw().toBuffer();
  const alpha = await sharp(mask).greyscale().raw().toBuffer();
  for (let i = 0, p = 0; i < width * height; i += 1, p += 4) {
    rgba[p + 3] = alpha[i];
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

async function darkRefractionFromCrop(crop, mask, width, height, strength = 1.08, blur = 2.8 * S) {
  const rgba = await sharp(crop).ensureAlpha().raw().toBuffer();
  const alpha = await sharp(mask).greyscale().raw().toBuffer();
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i += 1, p += 4) {
    const luminance = (rgba[p] * 0.2126 + rgba[p + 1] * 0.7152 + rgba[p + 2] * 0.0722) / 255;
    const dark = Math.max(0, 1 - luminance);
    const a = Math.min(1, dark * (alpha[i] / 255) * strength);
    out[p] = 0;
    out[p + 1] = 0;
    out[p + 2] = 0;
    out[p + 3] = Math.round(a * 255);
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).blur(blur).png().toBuffer();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function refractedCrop(base, { x, y, width, height, scale = 1.12, shiftX = 0, shiftY = 0, blur = 7 * S }) {
  const srcW = Math.round(width / scale);
  const srcH = Math.round(height / scale);
  const left = clamp(Math.round(x + width / 2 - srcW / 2 + shiftX), 0, W - srcW);
  const top = clamp(Math.round(y + height / 2 - srcH / 2 + shiftY), 0, H - srcH);
  return sharp(base)
    .extract({ left, top, width: srcW, height: srcH })
    .resize(width, height, { fit: "fill" })
    .blur(blur)
    .modulate({ brightness: 1.1, saturation: 0.08 })
    .png()
    .toBuffer();
}

async function compositeBlob({
  base,
  x,
  y,
  width,
  height,
  balls,
  accents,
  name,
  threshold = 2.18,
  feather = 0.28,
  overlayOpacity = 0.39,
  rimAlpha = 1,
  refraction = {},
  darkStrength = 1.08,
  darkBlur = 2.8 * S,
}) {
  const mask = await metaballMask({ width, height, balls, threshold, feather });
  const crop = await refractedCrop(base, { x, y, width, height, ...refraction });
  const glassedText = await withAlpha(crop, mask, width, height);
  const overlay = await withAlpha(blobOverlaySvg({ width, height, accents, opacity: overlayOpacity }), mask, width, height);
  const darkRefraction = await darkRefractionFromCrop(crop, mask, width, height, darkStrength, darkBlur);
  const rim = await rimFromMask(mask, "#ffb05c", rimAlpha);
  await sharp(mask).toFile(path.join(outDir, `${name}-mask.png`));
  await sharp(overlay).toFile(path.join(outDir, `${name}-overlay.png`));
  return [
    { input: glassedText, left: x, top: y },
    { input: overlay, left: x, top: y },
    { input: darkRefraction, left: x, top: y, blend: "over" },
    { input: rim, left: x, top: y, blend: "over" },
  ];
}

const base = await basePoster();
await sharp(base).toFile(path.join(outDir, "base-poster.png"));

const topBlob = await compositeBlob({
  base,
  name: "top",
  x: 58 * S,
  y: 560 * S,
  width: 478 * S,
  height: 196 * S,
  threshold: 2.05,
  feather: 0.31,
  overlayOpacity: 0.34,
  rimAlpha: 1.16,
  refraction: { scale: 1.24, shiftX: -18 * S, shiftY: 8 * S, blur: 4.2 * S },
  darkStrength: 1.42,
  darkBlur: 1.9 * S,
  balls: [
    { x: 54 * S, y: 124 * S, rx: 64 * S, ry: 52 * S, power: 1.03 },
    { x: 154 * S, y: 78 * S, rx: 74 * S, ry: 66 * S, power: 1.1 },
    { x: 266 * S, y: 105 * S, rx: 82 * S, ry: 58 * S, power: 1.04 },
    { x: 370 * S, y: 92 * S, rx: 88 * S, ry: 76 * S, power: 1.08 },
  ],
  accents: [
    { id: "a1", x: 42 * S, y: 132 * S, rx: 30 * S, ry: 30 * S, strength: 0.72 },
    { id: "a2", x: 164 * S, y: 72 * S, rx: 28 * S, ry: 28 * S, strength: 0.58 },
    { id: "a3", x: 358 * S, y: 66 * S, rx: 31 * S, ry: 31 * S, strength: 0.58 },
  ],
});

const bottomBlob = await compositeBlob({
  base,
  name: "bottom",
  x: 240 * S,
  y: 814 * S,
  width: 704 * S,
  height: 330 * S,
  threshold: 2.0,
  feather: 0.32,
  overlayOpacity: 0.32,
  rimAlpha: 1.22,
  refraction: { scale: 1.14, shiftX: 4 * S, shiftY: -6 * S, blur: 7.4 * S },
  darkStrength: 1.28,
  darkBlur: 3.2 * S,
  balls: [
    { x: 96 * S, y: 224 * S, rx: 122 * S, ry: 122 * S, power: 1.22 },
    { x: 214 * S, y: 166 * S, rx: 92 * S, ry: 76 * S, power: 1.06 },
    { x: 328 * S, y: 176 * S, rx: 94 * S, ry: 70 * S, power: 1.02 },
    { x: 448 * S, y: 166 * S, rx: 96 * S, ry: 74 * S, power: 1.05 },
    { x: 592 * S, y: 94 * S, rx: 82 * S, ry: 96 * S, power: 1.15 },
  ],
  accents: [
    { id: "b1", x: 60 * S, y: 268 * S, rx: 40 * S, ry: 40 * S, strength: 0.66 },
    { id: "b2", x: 178 * S, y: 122 * S, rx: 34 * S, ry: 34 * S, strength: 0.52 },
    { id: "b3", x: 262 * S, y: 250 * S, rx: 32 * S, ry: 32 * S, strength: 0.6 },
    { id: "b4", x: 392 * S, y: 152 * S, rx: 30 * S, ry: 30 * S, strength: 0.46 },
    { id: "b5", x: 586 * S, y: 110 * S, rx: 37 * S, ry: 37 * S, strength: 0.64 },
  ],
});

const final = await sharp(base)
  .composite([...topBlob, ...bottomBlob])
  .png()
  .toBuffer();

await sharp(final).toFile(path.join(outDir, "sentimenta-lughy-glass-template-4320x5400.png"));
await sharp(final).resize(1080, 1350).png().toFile(path.join(outDir, "sentimenta-lughy-glass-template-1080x1350.png"));
console.log(`Rendered ${path.join(outDir, "sentimenta-lughy-glass-template-4320x5400.png")}`);
