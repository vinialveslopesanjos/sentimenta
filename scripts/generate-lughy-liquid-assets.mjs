import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const outDir = path.resolve("output/sentimenta-refined-carousel/liquid-assets");
await mkdir(outDir, { recursive: true });

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function metaballField(x, y, balls) {
  let field = 0;
  for (const ball of balls) {
    const dx = (x - ball.x) / ball.rx;
    const dy = (y - ball.y) / ball.ry;
    field += ball.power / (dx * dx + dy * dy + 0.16);
  }
  return field;
}

function nearestSurfaceDistance(x, y, balls) {
  let best = Infinity;
  for (const ball of balls) {
    const dx = (x - ball.x) / ball.rx;
    const dy = (y - ball.y) / ball.ry;
    best = Math.min(best, Math.abs(Math.sqrt(dx * dx + dy * dy) - 1));
  }
  return best;
}

function makeLiquid({ width, height, balls, accents, name }) {
  const pixels = Buffer.alloc(width * height * 4);
  const threshold = 2.22;
  const feather = 0.34;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const field = metaballField(x, y, balls);
      const alphaShape = smoothstep(threshold - feather, threshold + feather, field);
      const surface = nearestSurfaceDistance(x, y, balls);
      const rim = smoothstep(0.18, 0.02, surface) * alphaShape;
      const inner = smoothstep(threshold + 1.2, threshold - 0.1, field) * alphaShape;

      let orange = 0;
      for (const accent of accents) {
        const dx = (x - accent.x) / accent.rx;
        const dy = (y - accent.y) / accent.ry;
        orange += accent.strength * Math.exp(-(dx * dx + dy * dy) * 2.2);
      }
      orange = Math.min(1, orange);

      const milky = 0.72 * alphaShape;
      const smoky = 0.28 * inner;
      const edgeWarmth = 0.65 * rim;

      const r = Math.round(255 * milky + 255 * orange * 0.38 + 255 * edgeWarmth * 0.45);
      const g = Math.round(255 * milky + 102 * orange * 0.28 + 172 * edgeWarmth * 0.30);
      const b = Math.round(255 * milky + 32 * orange * 0.18 + 64 * smoky);
      const a = Math.round(Math.min(1, alphaShape * 0.72 + rim * 0.26 + orange * 0.22) * 255);

      const i = (y * width + x) * 4;
      pixels[i] = Math.min(255, r);
      pixels[i + 1] = Math.min(255, g);
      pixels[i + 2] = Math.min(255, b);
      pixels[i + 3] = a;
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 4 } })
    .blur(1.15)
    .modulate({ saturation: 1.08, brightness: 1.03 })
    .png()
    .toFile(path.join(outDir, `${name}.png`));
}

await Promise.all([
  makeLiquid({
    name: "lughy-liquid-top-4k",
    width: 1900,
    height: 620,
    balls: [
      { x: 210, y: 330, rx: 210, ry: 150, power: 1.0 },
      { x: 520, y: 280, rx: 240, ry: 190, power: 1.08 },
      { x: 900, y: 330, rx: 250, ry: 155, power: 1.0 },
      { x: 1210, y: 260, rx: 230, ry: 210, power: 1.0 },
    ],
    accents: [
      { x: 190, y: 360, rx: 95, ry: 95, strength: 1.2 },
      { x: 725, y: 315, rx: 70, ry: 70, strength: 1.0 },
      { x: 1380, y: 220, rx: 80, ry: 80, strength: 0.86 },
    ],
  }),
  makeLiquid({
    name: "lughy-liquid-bottom-4k",
    width: 2500,
    height: 980,
    balls: [
      { x: 275, y: 560, rx: 270, ry: 300, power: 1.08 },
      { x: 680, y: 520, rx: 270, ry: 215, power: 1.0 },
      { x: 1040, y: 590, rx: 275, ry: 190, power: 1.0 },
      { x: 1410, y: 620, rx: 270, ry: 190, power: 0.98 },
      { x: 1760, y: 575, rx: 245, ry: 185, power: 0.98 },
      { x: 2100, y: 330, rx: 220, ry: 300, power: 1.04 },
    ],
    accents: [
      { x: 170, y: 760, rx: 110, ry: 110, strength: 1.0 },
      { x: 570, y: 390, rx: 88, ry: 88, strength: 0.85 },
      { x: 785, y: 710, rx: 82, ry: 82, strength: 0.95 },
      { x: 1220, y: 500, rx: 76, ry: 76, strength: 0.7 },
      { x: 1595, y: 740, rx: 88, ry: 88, strength: 0.85 },
      { x: 2195, y: 460, rx: 90, ry: 90, strength: 1.0 },
    ],
  }),
]);

console.log(`Liquid assets written to ${outDir}`);
