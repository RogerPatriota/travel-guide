"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  // "local": sai só deste aparelho; o outro celular continua logado
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
