"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { describeKind, type PlaceHit } from "@/lib/places";
import { createClient } from "@/lib/supabase/server";
import { tripDays, type DayMoment } from "@/lib/trip";

const UA = { "User-Agent": "travel-guide-private-app/0.1" };
// Capital Federal: a busca não traz lugar homônimo do resto da Argentina
const CABA_BBOX = "-58.54,-34.71,-58.33,-34.52";

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    osm_value?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    locality?: string;
  };
};

function toHit(f: PhotonFeature, url: string | null = null): PlaceHit | null {
  const p = f.properties;
  if (!p.name) return null;
  const { category, moment } = describeKind(p.osm_value);
  const [lng, lat] = f.geometry.coordinates;
  return {
    osmRef: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : null,
    name: p.name,
    lat,
    lng,
    category,
    address: [p.street, p.housenumber].filter(Boolean).join(" ") || null,
    neighborhood: p.district ?? p.locality ?? null,
    suggestedMoment: moment,
    url,
  };
}

async function photon(path: string): Promise<PhotonFeature[]> {
  try {
    const res = await fetch(`https://photon.komoot.io${path}`, {
      headers: UA,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return ((await res.json()) as { features: PhotonFeature[] }).features ?? [];
  } catch {
    return [];
  }
}

/** Busca lugares em Buenos Aires pelo nome (sugestões enquanto digita) */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2 || q.length > 100) return [];
  const features = await photon(
    `/api/?q=${encodeURIComponent(q)}&bbox=${CABA_BBOX}&limit=6&lat=-34.58&lon=-58.42`,
  );
  return features.map((f) => toHit(f)).filter((h): h is PlaceHit => h !== null);
}

const GOOGLE_HOST = /^(www\.)?(google\.[a-z.]+|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl)$/;

/** Lê um link do Google Maps (inclusive o curto maps.app.goo.gl) e devolve o lugar */
export async function resolveMapsLink(link: string): Promise<PlaceHit | { error: string }> {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return { error: "Isso não parece um link." };
  }

  // Link curto: segue os redirecionamentos, só para hosts do Google (sem SSRF)
  for (let hops = 0; hops < 5 && url.hostname.endsWith("goo.gl"); hops++) {
    if (!GOOGLE_HOST.test(url.hostname)) break;
    try {
      const res = await fetch(url, { redirect: "manual", headers: UA, signal: AbortSignal.timeout(5000) });
      const next = res.headers.get("location");
      if (!next) break;
      url = new URL(next, url);
    } catch {
      return { error: "Não consegui abrir esse link." };
    }
  }
  if (!GOOGLE_HOST.test(url.hostname)) return { error: "Só links do Google Maps." };

  const text = decodeURIComponent(url.href);
  // !3d!4d = coordenada do lugar; @lat,lng = centro do mapa (menos exato)
  const exact = text.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  const center = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const query = url.searchParams.get("q")?.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
  const m = exact ?? query ?? center;
  if (!m) return { error: "Não achei a localização nesse link. Tenta buscar pelo nome." };
  const lat = Number(m[1]);
  const lng = Number(m[2]);

  const placeName = text.match(/\/place\/([^/@]+)/)?.[1]?.replaceAll("+", " ").trim() ?? null;

  // Completa bairro/tipo pelo OSM; só usa a referência OSM se o nome bater
  const near = await photon(`/reverse?lat=${lat}&lon=${lng}&limit=5&radius=0.1`);
  const sameName = placeName
    ? near.find((f) => f.properties.name?.toLowerCase().includes(placeName.toLowerCase().slice(0, 12)))
    : undefined;
  const base = sameName ? toHit(sameName, url.href) : null;

  return {
    osmRef: base?.osmRef ?? null,
    name: placeName ?? base?.name ?? "Lugar do link",
    lat,
    lng,
    category: base?.category ?? null,
    address: base?.address ?? null,
    neighborhood: base?.neighborhood ?? near[0]?.properties.district ?? null,
    suggestedMoment: base?.suggestedMoment ?? "passeio",
    url: url.href,
  };
}

const MOMENTS: DayMoment[] = [
  "cafe_da_manha", "almoco", "lanche", "jantar", "passeio", "mercado", "noite", "outro",
];

/** Salva o lugar (sem duplicar) e a sugestão "lugar num momento (e talvez num dia)" */
export async function addIdea(input: {
  place: PlaceHit;
  moment: DayMoment;
  date: string | null;
  note: string;
}): Promise<{ error?: string }> {
  const { place, moment, date } = input;
  const note = input.note.trim().slice(0, 500) || null;
  if (!MOMENTS.includes(moment)) return { error: "Momento inválido." };
  if (date !== null && !(tripDays() as string[]).includes(date)) {
    return { error: "Esse dia não é da viagem." };
  }
  if (!place.name || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
    return { error: "Lugar inválido." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect("/login");

  const placeId = await findOrCreatePlace(supabase, place);
  if (typeof placeId !== "number") return placeId;

  const { error } = await supabase
    .from("suggestions")
    .insert({ place_id: placeId, moment, date, note });
  if (error) {
    if (error.code === "23505") {
      return { error: "Essa ideia já está na lista (mesmo lugar, momento e dia)." };
    }
    console.error("addIdea suggestion", error.code, error.message);
    return { error: "Não deu pra salvar. Tenta de novo." };
  }

  refresh();
  return {};
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function findOrCreatePlace(supabase: Client, p: PlaceHit): Promise<number | { error: string }> {
  // Mesmo lugar: pela referência OSM, ou (link sem OSM) mesmo nome a ~30 m
  const existing = async () => {
    if (p.osmRef) {
      const { data } = await supabase.from("places").select("id").eq("osm_ref", p.osmRef).maybeSingle();
      return data?.id ?? null;
    }
    const d = 0.0003;
    const { data } = await supabase
      .from("places")
      .select("id")
      .ilike("name", p.name)
      .gte("lat", p.lat - d)
      .lte("lat", p.lat + d)
      .gte("lng", p.lng - d)
      .lte("lng", p.lng + d)
      .limit(1);
    return data?.[0]?.id ?? null;
  };

  const found = await existing();
  if (found) return found;

  const { data, error } = await supabase
    .from("places")
    .insert({
      name: p.name.slice(0, 200),
      neighborhood: p.neighborhood?.slice(0, 100) ?? null,
      category: p.category?.slice(0, 50) ?? null,
      lat: p.lat,
      lng: p.lng,
      url: p.url && /^https?:\/\//.test(p.url) ? p.url.slice(0, 2000) : null,
      notes: p.address,
      osm_ref: p.osmRef,
    })
    .select("id")
    .single();

  if (error) {
    // O outro salvou o mesmo lugar ao mesmo tempo
    if (error.code === "23505") {
      const again = await existing();
      if (again) return again;
    }
    console.error("addIdea place", error.code, error.message);
    return { error: "Não deu pra salvar o lugar. Tenta de novo." };
  }
  return data.id;
}
