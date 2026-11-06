// O MapLibre 6 procura o worker ao lado do próprio bundle, e o Turbopack move esse bundle.
// Então servimos o worker de public/vendor e apontamos pra ele com setWorkerUrl (components/TripMap.tsx).
// Roda sozinho no postinstall.
import { copyFileSync, mkdirSync } from "node:fs";

const from = new URL("../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url);
const dir = new URL("../public/vendor/", import.meta.url);

mkdirSync(dir, { recursive: true });
copyFileSync(from, new URL("maplibre-gl-worker.mjs", dir));
console.log("maplibre worker copiado para public/vendor/");
