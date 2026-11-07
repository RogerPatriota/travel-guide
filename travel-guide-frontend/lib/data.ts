import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getLegs, type Leg, type Stop } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import type { DayMoment, ISODate, TripEvent } from "@/lib/trip";

export type Currency = Enums<"currency">;
export type { Leg } from "@/lib/routes";

/** Sugestão = um lugar num momento (e talvez num dia). É nela que se vota. */
export type IdeaCard = {
  id: number;
  name: string;
  neighborhood: string | null;
  moment: DayMoment;
  /** null = "algum dia" */
  date: ISODate | null;
};

export type MapPin = { placeId: number; name: string; lat: number; lng: number };
export type MapStop = MapPin & { eventId: number; title: string; time?: string };

export type MapData = {
  /** Hospedagem: aparece em qualquer dia */
  stays: MapPin[];
  /** Paradas com coordenada, por dia, já na ordem */
  stops: Partial<Record<ISODate, MapStop[]>>;
  legs: Leg[];
};

export type HomeData = {
  me: { name: string };
  events: TripEvent[];
  ideas: IdeaCard[];
  ideasTotal: number;
  /** Soma dos gastos reais (não previsões), por moeda. Sem conversão até a fase 5. */
  spent: { currency: Currency; total: number }[];
  map: MapData;
};

/**
 * Tudo que a home precisa, numa ida só ao banco. Lê a sessão (cookies), então
 * precisa rodar dentro de um <Suspense>. O RLS garante que só os dois veem.
 */
export async function getHomeData(): Promise<HomeData> {
  // O cliente do Supabase lê o relógio (expiração do token). Sem isso o Next
  // tenta prerenderizar e acusa "unstable value Date.now()".
  await connection();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [profile, events, ideas, expenses, stays] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("events")
      .select(
        "id, date, time, title, detail, status, moment, travel_mode, place:places(id, name, lat, lng)",
      )
      .order("date")
      .order("sort_order")
      .order("time", { nullsFirst: false })
      .order("id"),
    supabase
      .from("suggestions")
      .select("id, moment, date, place:places!inner(name, neighborhood)", { count: "exact" })
      .eq("status", "ideia")
      .order("date", { nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("expenses").select("amount, currency").eq("is_planned", false),
    supabase
      .from("places")
      .select("id, name, lat, lng")
      .eq("category", "hospedagem")
      .not("lat", "is", null),
  ]);

  for (const r of [profile, events, ideas, expenses, stays]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const totals = new Map<Currency, number>();
  for (const e of expenses.data ?? []) {
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + Number(e.amount));
  }

  // Paradas do mapa: eventos ligados a um lugar com coordenada, na ordem do dia
  const stops: MapData["stops"] = {};
  const stopsForRoutes: Record<string, Stop[]> = {};
  for (const e of events.data ?? []) {
    const p = e.place;
    if (!p || p.lat === null || p.lng === null) continue;
    const date = e.date as ISODate;
    (stops[date] ??= []).push({
      placeId: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      eventId: e.id,
      title: e.title,
      time: e.time?.slice(0, 5),
    });
    (stopsForRoutes[date] ??= []).push({
      eventId: e.id,
      placeId: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      mode: e.travel_mode,
    });
  }

  const legs = await getLegs(supabase, stopsForRoutes);
  const legToEvent = new Map(
    legs.map((l) => [stopsForRoutes[l.date][l.toIndex].eventId, l] as const),
  );

  return {
    me: { name: profile.data?.display_name ?? "" },
    events: (events.data ?? []).map((e) => {
      const leg = legToEvent.get(e.id);
      return {
        id: String(e.id),
        date: e.date as ISODate,
        time: e.time?.slice(0, 5),
        title: e.title,
        detail: e.detail ?? "",
        status: e.status,
        moment: e.moment,
        arrival: e.travel_mode
          ? {
              mode: e.travel_mode,
              distanceM: leg?.distanceM ?? null,
              durationS: leg?.durationS ?? null,
            }
          : undefined,
      };
    }),
    ideas: (ideas.data ?? []).map((s) => ({
      id: s.id,
      name: s.place.name,
      neighborhood: s.place.neighborhood,
      moment: s.moment,
      date: s.date as ISODate | null,
    })),
    ideasTotal: ideas.count ?? 0,
    spent: [...totals].map(([currency, total]) => ({ currency, total })),
    map: {
      stays: (stays.data ?? []).map((s) => ({
        placeId: s.id,
        name: s.name,
        lat: s.lat!,
        lng: s.lng!,
      })),
      stops,
      legs,
    },
  };
}
