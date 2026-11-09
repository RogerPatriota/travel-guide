import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { VoteValue } from "@/lib/data";
import type { IdeaStatus } from "@/lib/ideas";
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
};

export async function getRoteiroData(): Promise<RoteiroData> {
  await connection();
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const [profiles, suggestions, events] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase
      .from("suggestions")
      .select("id, moment, date, status, place:places!inner(name, neighborhood), votes(user_id, value)")
      .in("status", ["ideia", "decidido"])
      .order("created_at"),
    supabase
      .from("events")
      .select("id, date, title, time")
      .in("moment", ["voo", "hospedagem"])
      .order("date")
      .order("sort_order"),
  ]);
  for (const r of [profiles, suggestions, events]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const cards: RoteiroCard[] = (suggestions.data ?? []).map((s) => ({
    id: s.id,
    name: s.place.name,
    neighborhood: s.place.neighborhood,
    moment: s.moment,
    date: s.date as ISODate | null,
    status: s.status,
    myVote: s.votes.find((v) => v.user_id === userId)?.value ?? null,
    partnerVote: s.votes.find((v) => v.user_id !== userId)?.value ?? null,
  }));

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
  };
}
