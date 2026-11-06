import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Enums } from "@/lib/supabase/database.types";
import type { ISODate, TripEvent } from "@/lib/trip";

export type Currency = Enums<"currency">;

export type IdeaCard = {
  id: number;
  name: string;
  neighborhood: string | null;
};

export type HomeData = {
  me: { name: string };
  events: TripEvent[];
  ideas: IdeaCard[];
  ideasTotal: number;
  /** Soma dos gastos reais (não previsões), por moeda. Sem conversão até a fase 5. */
  spent: { currency: Currency; total: number }[];
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

  const [profile, events, ideas, expenses] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("events")
      .select("id, date, time, title, detail, status")
      .order("date")
      .order("time", { nullsFirst: false })
      .order("id"),
    supabase
      .from("places")
      .select("id, name, neighborhood", { count: "exact" })
      .eq("status", "ideia")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("expenses").select("amount, currency").eq("is_planned", false),
  ]);

  for (const r of [profile, events, ideas, expenses]) {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
  }

  const totals = new Map<Currency, number>();
  for (const e of expenses.data ?? []) {
    totals.set(e.currency, (totals.get(e.currency) ?? 0) + Number(e.amount));
  }

  return {
    me: { name: profile.data?.display_name ?? "" },
    events: (events.data ?? []).map((e) => ({
      id: String(e.id),
      date: e.date as ISODate,
      time: e.time?.slice(0, 5),
      title: e.title,
      detail: e.detail ?? "",
      status: e.status,
    })),
    ideas: ideas.data ?? [],
    ideasTotal: ideas.count ?? 0,
    spent: [...totals].map(([currency, total]) => ({ currency, total })),
  };
}
