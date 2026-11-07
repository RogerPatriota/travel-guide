"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { VoteValue } from "@/lib/data";

const VALUES: VoteValue[] = ["curtiu", "tanto_faz", "nao_curtiu"];

/**
 * Grava (ou troca) o meu voto numa sugestão. A decisão (decidido/descartado e
 * a parada no roteiro) é do trigger no banco, não daqui.
 */
export async function vote(suggestionId: number, value: VoteValue): Promise<{ error?: string }> {
  if (!Number.isInteger(suggestionId) || !VALUES.includes(value)) {
    return { error: "Voto inválido." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  // Sem upsert: o upsert reescreveria suggestion_id/user_id, que não têm grant
  // de UPDATE. Troca o voto se existir; senão cria.
  const { data: changed, error: updateError } = await supabase
    .from("votes")
    .update({ value })
    .eq("suggestion_id", suggestionId)
    .eq("user_id", userId)
    .select("suggestion_id");

  if (updateError) return fail(updateError);

  if (!changed?.length) {
    const { error: insertError } = await supabase
      .from("votes")
      .insert({ suggestion_id: suggestionId, value });
    if (insertError) return fail(insertError);
  }

  refresh();
  return {};
}

function fail(error: { code?: string; message: string }) {
  console.error("vote", error.code, error.message);
  return { error: "Não deu pra salvar o voto. Tenta de novo." };
}
