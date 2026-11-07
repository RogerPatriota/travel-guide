import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/database.types";

export type TravelMode = Enums<"travel_mode">;
export type LngLat = [number, number];

export type Stop = {
  eventId: number;
  placeId: number;
  name: string;
  lat: number;
  lng: number;
  /** Como se chega aqui vindo da parada anterior do dia */
  mode: TravelMode | null;
};

export type Leg = {
  date: string;
  /** Índice (no dia) da parada de destino */
  toIndex: number;
  mode: TravelMode;
  coordinates: LngLat[];
  distanceM: number | null;
  durationS: number | null;
  /** true = linha reta (sem rota pelas ruas: transporte público ou serviço fora) */
  approximate: boolean;
};

// Servidores OSRM da FOSSGIS (OpenStreetMap Alemanha): grátis, sem chave, uso justo.
// O demo oficial (router.project-osrm.org) só roteia carro.
const OSRM_PROFILE: Partial<Record<TravelMode, string>> = {
  carro: "routed-car",
  a_pe: "routed-foot",
  bicicleta: "routed-bike",
};

type Pair = { date: string; toIndex: number; from: Stop; to: Stop; mode: TravelMode };

/**
 * Trechos de cada dia, pelas ruas. Lê os já calculados em route_legs e calcula
 * (uma vez só) os que faltam. Se o serviço falhar, devolve linha reta e não
 * grava, para tentar de novo na próxima visita.
 */
export async function getLegs(
  supabase: SupabaseClient<Database>,
  stopsByDay: Record<string, Stop[]>,
): Promise<Leg[]> {
  const pairs: Pair[] = [];
  for (const [date, stops] of Object.entries(stopsByDay)) {
    stops.forEach((to, i) => {
      const from = stops[i - 1];
      // Mesmo lugar duas vezes seguidas (ex.: check-out → sair de casa) não tem trecho
      if (from && to.mode && from.placeId !== to.placeId) {
        pairs.push({ date, toIndex: i, from, to, mode: to.mode });
      }
    });
  }
  if (pairs.length === 0) return [];

  const placeIds = [...new Set(pairs.flatMap((p) => [p.from.placeId, p.to.placeId]))];
  const { data: cached, error } = await supabase
    .from("route_legs")
    .select("from_place_id, to_place_id, mode, geometry, distance_m, duration_s, from_lat, from_lng, to_lat, to_lng")
    .in("from_place_id", placeIds)
    .in("to_place_id", placeIds);
  if (error) throw new Error(`Supabase: ${error.message}`);

  const key = (from: number, to: number, mode: string) => `${from}>${to}>${mode}`;
  const byKey = new Map((cached ?? []).map((c) => [key(c.from_place_id, c.to_place_id, c.mode), c]));

  return Promise.all(
    pairs.map(async (p): Promise<Leg> => {
      const hit = byKey.get(key(p.from.placeId, p.to.placeId, p.mode));
      // Só vale se foi calculado com as coordenadas atuais dos dois lugares
      if (
        hit &&
        hit.from_lat === p.from.lat &&
        hit.from_lng === p.from.lng &&
        hit.to_lat === p.to.lat &&
        hit.to_lng === p.to.lng
      ) {
        return {
          date: p.date,
          toIndex: p.toIndex,
          mode: p.mode,
          coordinates: hit.geometry as LngLat[],
          distanceM: hit.distance_m,
          durationS: hit.duration_s,
          approximate: false,
        };
      }

      const route = await fetchRoute(p.mode, p.from, p.to);
      if (!route) {
        return {
          date: p.date,
          toIndex: p.toIndex,
          mode: p.mode,
          coordinates: [
            [p.from.lng, p.from.lat],
            [p.to.lng, p.to.lat],
          ],
          distanceM: null,
          durationS: null,
          approximate: true,
        };
      }

      // Trecho velho (coordenada mudou) sai antes do novo entrar
      if (hit) {
        await supabase
          .from("route_legs")
          .delete()
          .eq("from_place_id", p.from.placeId)
          .eq("to_place_id", p.to.placeId)
          .eq("mode", p.mode);
      }
      // ignoreDuplicates: dois renders ao mesmo tempo calculam igual; o segundo só não grava
      const { error: saveError } = await supabase.from("route_legs").upsert(
        {
          from_place_id: p.from.placeId,
          to_place_id: p.to.placeId,
          mode: p.mode,
          geometry: route.coordinates,
          distance_m: Math.round(route.distance),
          duration_s: Math.round(route.duration),
          from_lat: p.from.lat,
          from_lng: p.from.lng,
          to_lat: p.to.lat,
          to_lng: p.to.lng,
        },
        { onConflict: "from_place_id,to_place_id,mode", ignoreDuplicates: true },
      );
      if (saveError) console.error("route_legs upsert", saveError.code, saveError.message);

      return {
        date: p.date,
        toIndex: p.toIndex,
        mode: p.mode,
        coordinates: route.coordinates,
        distanceM: Math.round(route.distance),
        durationS: Math.round(route.duration),
        approximate: false,
      };
    }),
  );
}

async function fetchRoute(mode: TravelMode, from: Stop, to: Stop) {
  const profile = OSRM_PROFILE[mode];
  if (!profile) return null;

  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://routing.openstreetmap.de/${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "travel-guide-private-app/0.1" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      code: string;
      routes?: { distance: number; duration: number; geometry: { coordinates: LngLat[] } }[];
    };
    const route = body.code === "Ok" ? body.routes?.[0] : undefined;
    if (!route || route.geometry.coordinates.length < 2) return null;
    // Arredonda para ~1 m: geometria menor no banco, sem diferença no mapa
    const coordinates = route.geometry.coordinates.map(
      ([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as LngLat,
    );
    return { coordinates, distance: route.distance, duration: route.duration };
  } catch (err) {
    console.error("OSRM", mode, err instanceof Error ? err.message : err);
    return null;
  }
}
