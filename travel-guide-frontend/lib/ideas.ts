import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { MapPin, VoteValue } from "@/lib/data";
import { metersBetween } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import type { DayMoment, ISODate } from "@/lib/trip";

export type IdeaStatus = Enums<"suggestion_status">;

export type IdeaDetail = {
  id: number;
  name: string;
  category: string | null;
  neighborhood: string | null;
  address: string | null;
  url: string | null;
  placeId: number;
  lat: number | null;
  lng: number | null;
  /** Em linha reta até a hospedagem (null sem coordenada ou sem hospedagem no banco) */
  metersFromStay: number | null;
  moment: DayMoment;
  date: ISODate | null;
  status: IdeaStatus;
  note: string | null;
  /** Nome de quem sugeriu (null = veio do sistema/agente) */
  suggestedBy: string | null;
  myVote: VoteValue | null;
  partnerVote: VoteValue | null;
};

export type IdeasData = {
  ideas: IdeaDetail[];
  partnerName: string | null;
  /** Hospedagem: aparece no mapa dos detalhes de cada ideia */
  stays: MapPin[];
};

/** Todas as sugestões (qualquer status) com votos, para a aba Ideias */
export async function getIdeasData(): Promise<IdeasData> {
  await connection(); // lê a sessão: só em tempo de request
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [profiles, suggestions, stayRows] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase
      .from("suggestions")
      .select(
        "id, moment, date, status, note, created_by, place:places!inner(id, name, category, neighborhood, notes, url, lat, lng), votes(user_id, value)",
      )
      .order("date", { nullsFirst: false })
      .order("moment")
      .order("created_at", { ascending: false }),
    supabase.from("places").select("id, name, lat, lng").eq("category", "hospedagem").not("lat", "is", null),
  ]);
  for (const r of [profiles, suggestions, stayRows]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));
  const stays: MapPin[] = (stayRows.data ?? []).map((s) => ({
    placeId: s.id,
    name: s.name,
    lat: s.lat!,
    lng: s.lng!,
  }));
  const fromStay = (lat: number | null, lng: number | null) =>
    stays[0] && lat !== null && lng !== null ? Math.round(metersBetween(stays[0], { lat, lng })) : null;

  return {
    partnerName: (profiles.data ?? []).find((p) => p.id !== userId)?.display_name ?? null,
    stays,
    ideas: (suggestions.data ?? []).map((s) => ({
      id: s.id,
      name: s.place.name,
      category: s.place.category,
      neighborhood: s.place.neighborhood,
      address: s.place.notes,
      url: s.place.url,
      placeId: s.place.id,
      lat: s.place.lat,
      lng: s.place.lng,
      metersFromStay: fromStay(s.place.lat, s.place.lng),
      moment: s.moment,
      date: s.date as ISODate | null,
      status: s.status,
      note: s.note,
      suggestedBy: s.created_by ? (names.get(s.created_by) ?? null) : null,
      myVote: s.votes.find((v) => v.user_id === userId)?.value ?? null,
      partnerVote: s.votes.find((v) => v.user_id !== userId)?.value ?? null,
    })),
  };
}

/** Nome de quem está logado (cabeçalho) */
export async function getMyName(): Promise<string> {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");
  const { data } = await supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle();
  return data?.display_name ?? "";
}
