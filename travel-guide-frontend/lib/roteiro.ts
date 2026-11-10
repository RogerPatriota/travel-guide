import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { MapData, MapStop, VoteValue } from "@/lib/data";
import type { IdeaStatus } from "@/lib/ideas";
import { getLegs, inferMode, type Stop } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { DayMoment, ISODate } from "@/lib/trip";

export type RoteiroCard = {
  id: number;
  name: string;
  neighborhood: string | null;
  moment: DayMoment;
  date: ISODate | null;
  status: IdeaStatus;
  myVote: VoteValue | null;
  partnerVote: VoteValue | null;
};

/** Voo e hospedagem do dia: só leitura no topo da grade */
export type LogisticsItem = { id: number; date: ISODate; title: string; time: string | null };

export type RoteiroData = {
  /** Ideias soltas ("algum dia"), ainda em votação */
  bank: RoteiroCard[];
  /** Cards já encaixados em algum dia (em votação ou decididos) */
  placed: RoteiroCard[];
  logistics: LogisticsItem[];
  partnerName: string | null;
  /** Mapa do plano: decididos e pendentes (pendente = pin vazado) */
  map: MapData;
};

// Mesma ordem das linhas da grade (e de private.moment_rank no banco)
const RANK: Record<DayMoment, number> = {
  voo: 0, hospedagem: 0, cafe_da_manha: 10, passeio: 20, almoco: 30,
  lanche: 40, mercado: 50, jantar: 60, noite: 70, outro: 80,
};

export async function getRoteiroData(): Promise<RoteiroData> {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [profiles, suggestions, events, stays] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase
      .from("suggestions")
      .select(
        "id, moment, date, status, place:places!inner(id, name, neighborhood, lat, lng), votes(user_id, value)",
      )
      .in("status", ["ideia", "decidido"])
      .order("created_at"),
    supabase
      .from("events")
      .select("id, date, title, time, sort_order, moment, travel_mode, place:places(id, name, lat, lng)")
      .in("moment", ["voo", "hospedagem"])
      .order("date")
      .order("sort_order"),
    supabase.from("places").select("id, name, lat, lng").eq("category", "hospedagem").not("lat", "is", null),
  ]);
  for (const r of [profiles, suggestions, events, stays]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const rows = suggestions.data ?? [];
  const cards: RoteiroCard[] = rows.map((s) => ({
    id: s.id,
    name: s.place.name,
    neighborhood: s.place.neighborhood,
    moment: s.moment,
    date: s.date as ISODate | null,
    status: s.status,
    myVote: s.votes.find((v) => v.user_id === userId)?.value ?? null,
    partnerVote: s.votes.find((v) => v.user_id !== userId)?.value ?? null,
  }));

  // Paradas por dia: voo/hospedagem (ordem do banco) + cards encaixados (ordem do momento)
  type Planned = MapStop & { order: number; explicitMode: Stop["mode"] };
  const byDay: Record<string, Planned[]> = {};
  for (const e of events.data ?? []) {
    const p = e.place;
    if (!p || p.lat === null || p.lng === null) continue;
    (byDay[e.date] ??= []).push({
      placeId: p.id, name: p.name, lat: p.lat, lng: p.lng,
      eventId: e.id, title: e.title, time: e.time?.slice(0, 5), moment: e.moment,
      order: e.sort_order, explicitMode: e.travel_mode,
    });
  }
  for (const s of rows) {
    const p = s.place;
    if (!s.date || p.lat === null || p.lng === null) continue;
    (byDay[s.date] ??= []).push({
      placeId: p.id, name: p.name, lat: p.lat, lng: p.lng,
      eventId: s.id, title: p.name, moment: s.moment,
      pending: s.status !== "decidido",
      order: RANK[s.moment], explicitMode: null,
    });
  }

  const stops: MapData["stops"] = {};
  const stopsForRoutes: Record<string, Stop[]> = {};
  for (const [date, list] of Object.entries(byDay)) {
    list.sort((a, b) => a.order - b.order);
    stops[date as ISODate] = list.map((s) => ({
      placeId: s.placeId, name: s.name, lat: s.lat, lng: s.lng,
      eventId: s.eventId, title: s.title, time: s.time, moment: s.moment, pending: s.pending,
    }));
    // Rota só entre o que está decidido: pendentes do mesmo momento são
    // alternativas (4 opções de jantar), não uma sequência
    const firm = list.filter((s) => !s.pending);
    stopsForRoutes[date] = firm.map((s, i) => ({
      eventId: s.eventId,
      placeId: s.placeId,
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      mode: s.explicitMode ?? (i > 0 ? inferMode(firm[i - 1], s) : null),
    }));
  }

  const legs = await getLegs(supabase, stopsForRoutes);

  return {
    bank: cards.filter((c) => c.date === null && c.status === "ideia"),
    placed: cards.filter((c) => c.date !== null),
    logistics: (events.data ?? []).map((e) => ({
      id: e.id,
      date: e.date as ISODate,
      title: e.title,
      time: e.time?.slice(0, 5) ?? null,
    })),
    partnerName: (profiles.data ?? []).find((p) => p.id !== userId)?.display_name ?? null,
    map: {
      stays: (stays.data ?? []).map((s) => ({ placeId: s.id, name: s.name, lat: s.lat!, lng: s.lng! })),
      stops,
      legs,
    },
  };
}
