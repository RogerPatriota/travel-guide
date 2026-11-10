"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tripDays, type DayMoment } from "@/lib/trip";

const PLACEABLE: DayMoment[] = [
  "cafe_da_manha", "passeio", "almoco", "lanche", "mercado", "jantar", "noite", "outro",
];

async function client() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  return supabase;
}

/** Encaixa uma ideia (da lista ou de outro bloco) no bloco dia × momento */
export async function placeIdea(
  sourceId: number,
  date: string,
  moment: DayMoment,
): Promise<{ error?: string }> {
  if (!Number.isInteger(sourceId) || !(tripDays() as string[]).includes(date) || !PLACEABLE.includes(moment)) {
    return { error: "Não deu pra encaixar aí." };
  }
  const supabase = await client();
  const { error } = await supabase.rpc("place_idea", {
    p_source: sourceId,
    p_date: date,
    p_moment: moment,
  });
  if (error) {
    console.error("place_idea", error.code, error.message);
    return { error: "Não deu pra encaixar. Tenta de novo." };
  }
  refresh();
  return {};
}

/** Devolve um card do dia para a lista de ideias ("algum dia") */
export async function unplaceIdea(id: number): Promise<{ error?: string }> {
  if (!Number.isInteger(id)) return { error: "Card inválido." };
  const supabase = await client();
  const { error } = await supabase.rpc("unplace_idea", { p_id: id });
  if (error) {
    console.error("unplace_idea", error.code, error.message);
    return { error: "Não deu pra tirar do dia. Tenta de novo." };
  }
  refresh();
  return {};
}
