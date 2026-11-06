// Gera public/topo.svg: curvas de nível finas para o fundo da página.
// Rodar de novo com outra SEED para um relevo diferente:
//   node scripts/gen-topo.mjs [seed]
import { contours } from "d3-contour";
import { writeFileSync } from "node:fs";

const SEED = Number(process.argv[2] ?? 27022027);
const W = 180; // colunas da grade
const H = 112; // linhas da grade
const SCALE = 10; // px por célula no SVG final
const LEVELS = 26;

// PRNG determinístico (mulberry32) para o relevo não mudar a cada build
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const hills = Array.from({ length: 14 }, () => ({
  x: rand() * W,
  y: rand() * H,
  r: 10 + rand() * 34,
  h: (rand() < 0.75 ? 1 : -0.6) * (0.4 + rand()),
}));

const values = new Float64Array(W * H);
for (let j = 0; j < H; j++) {
  for (let i = 0; i < W; i++) {
    let v = 0.15 * Math.sin(i / 23 + 1.3) * Math.cos(j / 17);
    for (const p of hills) {
      const d2 = (i - p.x) ** 2 + (j - p.y) ** 2;
      v += p.h * Math.exp(-d2 / (2 * p.r * p.r));
    }
    values[j * W + i] = v;
  }
}

let min = Infinity;
let max = -Infinity;
for (const v of values) {
  if (v < min) min = v;
  if (v > max) max = v;
}
const step = (max - min) / (LEVELS + 1);
const thresholds = Array.from({ length: LEVELS }, (_, k) => min + step * (k + 1));

const fmt = (n) => (n * SCALE).toFixed(1).replace(/\.0$/, "");
const toPath = (geom) =>
  geom.coordinates
    .flatMap((poly) => poly.map((ring) => "M" + ring.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L") + "Z"))
    .join("");

const layers = contours().size([W, H]).thresholds(thresholds)(values);
const minor = [];
const major = [];
layers.forEach((g, k) => ((k + 1) % 5 === 0 ? major : minor).push(toPath(g)));

// As cores ficam no SVG porque ele é usado como background-image (CSS vars não chegam lá).
// Mantê-las em sincronia com --color-topo e --color-topo-strong em app/globals.css.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W * SCALE} ${H * SCALE}" preserveAspectRatio="xMidYMid slice" fill="none" stroke-linejoin="round">
<path stroke="#E6E0D0" stroke-width="1" d="${minor.join("")}"/>
<path stroke="#DCD4C0" stroke-width="1.4" d="${major.join("")}"/>
</svg>
`;

writeFileSync(new URL("../public/topo.svg", import.meta.url), svg);
console.log(`topo.svg: ${(svg.length / 1024).toFixed(0)} KB, ${layers.length} curvas`);
