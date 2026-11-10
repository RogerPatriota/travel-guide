import "server-only";
import { cacheLife } from "next/cache";
import { metersBetween } from "@/lib/routes";

// Informações extras de um lugar, só de fontes gratuitas:
// OpenStreetMap (Nominatim), Wikipedia/Wikidata e YouTube Data API.
// Cada busca fica em cache por uma semana ("use cache"): um lugar consulta as APIs uma vez.
// Falha de rede lança erro de propósito, para o erro não ficar guardado no cache.

const UA = { "User-Agent": "travel-guide-private-app/0.1" };
const TIMEOUT_MS = 6000;
/** Busca por nome: até aqui do ponto salvo ainda é o mesmo lugar */
const SAME_PLACE_METERS = 100;

export type OsmInfo = {
  osmUrl: string;
  /** "Avenida de Mayo 829" */
  address: string | null;
  /** Sub-bairro, quando o OSM tem ("Palermo Soho") */
  area: string | null;
  /** Horário já em português, uma regra por linha */
  hours: string[];
  phones: string[];
  website: string | null;
  instagram: string | null;
  cuisine: string | null;
  /** Frases curtas: "Só dinheiro", "Mesas na calçada"… */
  facts: string[];
};

export type WikiInfo = {
  extract: string;
  url: string;
  lang: "pt" | "es" | "en";
  image: { src: string; width: number; height: number } | null;
};

export type Video = { id: string; title: string; channel: string; year: string };

export type Source<T> = { state: "ok"; data: T } | { state: "vazio" } | { state: "erro" };

export type PlaceExtras = {
  osm: Source<OsmInfo>;
  wiki: WikiInfo | null;
  /** sem_chave = falta YOUTUBE_API_KEY · pulado = não faz sentido buscar (mercado) */
  videos: Source<Video[]> | { state: "sem_chave" } | { state: "pulado" };
  youtubeSearchUrl: string;
};

/* ------------------------------------------------------------------ OSM */

type NominatimRow = {
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
};

type OsmHit = { info: OsmInfo; wikidata: string | null; wikipedia: string | null };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");

/** "Aeroparque Jorge Newbery (AEP)" → "Aeroparque Jorge Newbery" */
const cleanName = (name: string) => name.replace(/\([^)]*\)/g, "").trim() || name;

function sameName(a: string | undefined, b: string) {
  if (!a) return false;
  const x = norm(a);
  const y = norm(cleanName(b));
  return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x));
}

const DAY: Record<string, string> = {
  Mo: "seg", Tu: "ter", We: "qua", Th: "qui", Fr: "sex", Sa: "sáb", Su: "dom", PH: "feriados",
};
const DAY_RE = "Mo|Tu|We|Th|Fr|Sa|Su|PH";

/** "Mo-Th 11:00-00:00; Su off" → ["Seg a qui 11:00 às 00:00", "Dom fechado"] */
export function humanizeHours(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  if (s === "24/7") return ["Aberto 24 horas"];
  // Só o formato simples (dias + horários). Regras com meses, nascer do sol ou
  // comentários ficam como vieram: melhor cru do que traduzido errado.
  const simple = /^[\sA-Za-z0-9:,;+-]+$/.test(s);
  const exotic = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week|sunrise|sunset|dawn|dusk|SH|easter)\b/.test(s);
  if (!simple || exotic) return [s];

  return s
    .split(new RegExp(`;\\s*|,\\s+(?=(?:${DAY_RE})\\b)`))
    .map((rule) => rule.trim())
    .filter(Boolean)
    .map((rule) => {
      const text = rule
        .replace(new RegExp(`\\b(${DAY_RE})-(${DAY_RE})\\b`, "g"), (_m, a: string, b: string) =>
          a === "Mo" && b === "Su" ? "todos os dias" : `${DAY[a]} a ${DAY[b]}`,
        )
        .replace(new RegExp(`\\b(${DAY_RE})\\b`, "g"), (d) => DAY[d])
        .replace(/\b00:00-24:00\b/g, "24 horas")
        .replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?/g, "$1 às $2")
        .replace(/\b(off|closed)\b/g, "fechado")
        .replace(/,(?=\S)/g, ", ");
      return text.charAt(0).toUpperCase() + text.slice(1);
    });
}

const CUISINE: Record<string, string> = {
  pizza: "pizza", empanada: "empanadas", argentinian: "argentina", steak_house: "parrilla",
  barbecue: "parrilla", grill: "parrilla", coffee_shop: "café", burger: "hambúrguer",
  sandwich: "sanduíches", ice_cream: "sorvete", italian: "italiana", pasta: "massas",
  japanese: "japonesa", sushi: "sushi", chinese: "chinesa", peruvian: "peruana",
  mexican: "mexicana", spanish: "espanhola", french: "francesa", regional: "regional",
  international: "internacional", vegetarian: "vegetariana", vegan: "vegana", fish: "peixes",
  seafood: "frutos do mar", chicken: "frango", dessert: "sobremesas", cake: "bolos",
  bagel: "bagels", breakfast: "café da manhã", tapas: "tapas", wine: "vinhos",
  beer: "cervejas", cocktails: "drinques", bakery: "padaria", pastry: "confeitaria",
};

function httpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function instagramUrl(value: string | undefined): string | null {
  if (!value) return null;
  const handle = value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");
  return /^[\w.]{1,30}$/.test(handle) ? `https://www.instagram.com/${handle}/` : null;
}

function factsFrom(t: Record<string, string>): string[] {
  const facts: string[] = [];
  const yes = (key: string) => t[key] === "yes";
  const cards = yes("payment:credit_cards") || yes("payment:debit_cards") || yes("payment:cards");
  if (cards) facts.push("Aceita cartão");
  else if (yes("payment:cash") && (t["payment:credit_cards"] === "no" || t["payment:debit_cards"] === "no")) {
    facts.push("Só dinheiro");
  }
  if (t.reservation === "required") facts.push("Precisa reservar");
  else if (t.reservation === "yes" || t.reservation === "recommended") facts.push("Aceita reserva");
  if (yes("outdoor_seating")) facts.push("Mesas do lado de fora");
  if (t.takeaway === "only") facts.push("Só para levar");
  if (yes("delivery")) facts.push("Faz entrega");
  if (t.internet_access === "wlan" || t.internet_access === "yes") facts.push("Wi-Fi");
  if (t["diet:vegetarian"] === "yes" || t["diet:vegetarian"] === "only") facts.push("Opções vegetarianas");
  if (t["diet:vegan"] === "yes" || t["diet:vegan"] === "only") facts.push("Opções veganas");
  if (t["diet:gluten_free"] === "yes" || t["diet:gluten_free"] === "only") facts.push("Opções sem glúten");
  if (t.wheelchair === "yes") facts.push("Acessível para cadeira de rodas");
  else if (t.wheelchair === "limited") facts.push("Acesso parcial para cadeira de rodas");
  const since = t.start_date?.match(/^\d{4}/)?.[0];
  if (since) facts.push(`Desde ${since}`);
  if (t.fee === "no") facts.push("Entrada grátis");
  else if (t.fee === "yes") facts.push("Entrada paga");
  return facts;
}

function parseOsm(row: NominatimRow): OsmHit {
  const t = row.extratags ?? {};
  const a = row.address ?? {};
  const type = { node: "node", way: "way", relation: "relation" }[row.osm_type ?? ""] ?? "node";
  const phones = (t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? "")
    .split(/[;,]/)
    .map((p) => p.trim())
    .filter((p) => /^\+?[\d\s()-]{6,25}$/.test(p))
    .slice(0, 2);
  const cuisine = (t.cuisine ?? "")
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => CUISINE[c] ?? c.replaceAll("_", " "))
    .slice(0, 4)
    .join(", ");

  return {
    info: {
      osmUrl: `https://www.openstreetmap.org/${type}/${row.osm_id}`,
      address: [a.road, a.house_number].filter(Boolean).join(" ") || null,
      area: a.neighbourhood ?? a.quarter ?? null,
      hours: t.opening_hours ? humanizeHours(t.opening_hours.slice(0, 300)) : [],
      phones,
      website: httpUrl(t.website ?? t["contact:website"]),
      instagram: instagramUrl(t["contact:instagram"]),
      cuisine: cuisine || null,
      facts: factsFrom(t),
    },
    wikidata: t.wikidata && /^Q\d+$/.test(t.wikidata) ? t.wikidata : null,
    wikipedia: t.wikipedia ?? null,
  };
}

async function osmLookup(osmRef: string | null, name: string, lat: number, lng: number): Promise<OsmHit | null> {
  "use cache";
  cacheLife("weeks");

  const common = "format=jsonv2&extratags=1&addressdetails=1&accept-language=pt-BR,es";
  const byRef = osmRef !== null && /^[NWR]\d+$/.test(osmRef);
  // Sem referência (veio de link do Maps): busca pelo nome numa caixa de ~300 m
  const d = 0.003;
  const url = byRef
    ? `https://nominatim.openstreetmap.org/lookup?osm_ids=${osmRef}&${common}`
    : `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanName(name))}` +
      `&limit=5&bounded=1&viewbox=${lng - d},${lat + d},${lng + d},${lat - d}&${common}`;

  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const rows = (await res.json()) as NominatimRow[];
  if (byRef) return rows[0]?.osm_id ? parseOsm(rows[0]) : null;

  // Rede com várias filiais por perto (Carrefour Express): vale a mais próxima do ponto
  // salvo, e só se estiver colada nele. Longe disso é outra loja, e o horário seria o dela.
  const nearest = rows
    .filter((r) => r.osm_id && sameName(r.name, name))
    .map((r) => ({ r, meters: metersBetween({ lat, lng }, { lat: Number(r.lat), lng: Number(r.lon) }) }))
    .filter((c) => Number.isFinite(c.meters) && c.meters <= SAME_PLACE_METERS)
    .sort((a, b) => a.meters - b.meters)[0];
  return nearest ? parseOsm(nearest.r) : null;
}

/* ------------------------------------------------------------ Wikipedia */

const WIKI_LANGS = ["pt", "es", "en"] as const;
type WikiLang = (typeof WIKI_LANGS)[number];

async function wikiSummary(wikidata: string | null, wikipedia: string | null): Promise<WikiInfo | null> {
  "use cache";
  cacheLife("weeks");

  let pick: [WikiLang, string] | null = null;

  // Wikidata diz em quais idiomas existe artigo: português primeiro
  if (wikidata) {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidata}&props=sitelinks` +
        `&sitefilter=ptwiki%7Ceswiki%7Cenwiki&format=json`,
      { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`wikidata ${res.status}`);
    const json = (await res.json()) as {
      entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
    };
    const links = json.entities?.[wikidata]?.sitelinks ?? {};
    for (const lang of WIKI_LANGS) {
      const title = links[`${lang}wiki`]?.title;
      if (title) {
        pick = [lang, title];
        break;
      }
    }
  }
  if (!pick && wikipedia) {
    const m = wikipedia.match(/^([a-z]{2}):(.+)$/);
    const lang = WIKI_LANGS.find((l) => l === m?.[1]);
    if (m && lang) pick = [lang, m[2]];
  }
  if (!pick) return null;

  const [lang, title] = pick;
  const res = await fetch(
    `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
    { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`wikipedia ${res.status}`);
  const json = (await res.json()) as {
    type?: string;
    extract?: string;
    thumbnail?: { source?: string; width?: number; height?: number };
    content_urls?: { desktop?: { page?: string } };
  };
  if (json.type !== "standard" || !json.extract) return null;

  const src = httpUrl(json.thumbnail?.source);
  const fromWikimedia = src !== null && new URL(src).hostname.endsWith("wikimedia.org");
  return {
    extract: json.extract.slice(0, 900),
    url: httpUrl(json.content_urls?.desktop?.page) ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    lang,
    image:
      src && fromWikimedia && json.thumbnail?.width && json.thumbnail?.height
        ? { src, width: json.thumbnail.width, height: json.thumbnail.height }
        : null,
  };
}

/* -------------------------------------------------------------- YouTube */

const decodeEntities = (s: string) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");

// Cada busca custa 100 unidades da cota diária (10 mil): por isso o cache de uma semana
async function youtubeSearch(query: string): Promise<Video[]> {
  "use cache";
  cacheLife("weeks");

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("youtube sem chave");
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "6",
    q: query,
    relevanceLanguage: "pt",
    safeSearch: "moderate",
    videoEmbeddable: "true",
    key,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`youtube ${res.status}`);
  const json = (await res.json()) as {
    items?: {
      id?: { videoId?: string };
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string };
    }[];
  };
  return (json.items ?? [])
    .filter((i) => /^[\w-]{11}$/.test(i.id?.videoId ?? ""))
    .map((i) => ({
      id: i.id!.videoId!,
      title: decodeEntities(i.snippet?.title ?? "Vídeo").slice(0, 140),
      channel: decodeEntities(i.snippet?.channelTitle ?? "").slice(0, 80),
      year: i.snippet?.publishedAt?.slice(0, 4) ?? "",
    }));
}

/* ----------------------------------------------------------- Orquestra */

const failed = (source: string, error: unknown) =>
  console.error("place-extras", source, error instanceof Error ? error.message : "erro");

export async function getPlaceExtras(place: {
  name: string;
  lat: number | null;
  lng: number | null;
  osmRef: string | null;
  /** Mercado e afins: vídeo com esse nome não ajuda e gasta cota */
  skipVideos: boolean;
}): Promise<PlaceExtras> {
  const query = `${cleanName(place.name)} Buenos Aires`;
  const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  const osmAndWiki = async (): Promise<Pick<PlaceExtras, "osm" | "wiki">> => {
    if (place.lat === null || place.lng === null) return { osm: { state: "vazio" }, wiki: null };
    let hit: OsmHit | null;
    try {
      hit = await osmLookup(place.osmRef, place.name, place.lat, place.lng);
    } catch (e) {
      failed("osm", e);
      return { osm: { state: "erro" }, wiki: null };
    }
    if (!hit) return { osm: { state: "vazio" }, wiki: null };
    let wiki: WikiInfo | null = null;
    try {
      wiki = await wikiSummary(hit.wikidata, hit.wikipedia);
    } catch (e) {
      failed("wiki", e);
    }
    return { osm: { state: "ok", data: hit.info }, wiki };
  };

  const videos = async (): Promise<PlaceExtras["videos"]> => {
    if (place.skipVideos) return { state: "pulado" };
    if (!process.env.YOUTUBE_API_KEY) return { state: "sem_chave" };
    try {
      const list = await youtubeSearch(query);
      return list.length > 0 ? { state: "ok", data: list } : { state: "vazio" };
    } catch (e) {
      failed("youtube", e);
      return { state: "erro" };
    }
  };

  const [place_, vids] = await Promise.all([osmAndWiki(), videos()]);
  return { ...place_, videos: vids, youtubeSearchUrl };
}
