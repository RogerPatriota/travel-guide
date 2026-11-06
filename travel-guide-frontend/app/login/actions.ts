"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string; email: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!EMAIL.test(email)) {
    return { status: "error", message: "Esse email não parece certo.", email };
  }

  // Volta para o mesmo endereço em que o link foi pedido (localhost ou Vercel).
  // O Supabase só aceita se estiver em Authentication → URL Configuration.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // O hook do banco recusa quem não está na lista
      shouldCreateUser: true,
      emailRedirectTo: `${proto}://${host}/auth/confirm`,
    },
  });

  if (error) {
    if (error.status === 429) {
      return {
        status: "error",
        message: "Muitos pedidos seguidos. Espera um minuto e tenta de novo.",
        email,
      };
    }
    // Email padrão do Supabase só entrega para quem está no time do projeto
    if (/not authorized/i.test(error.message)) {
      return {
        status: "error",
        message: "O Supabase ainda não pode mandar email pra esse endereço. Falta configurar o envio.",
        email,
      };
    }
    if (error.status === 403 || /acesso/i.test(error.message)) {
      return { status: "error", message: "Esse email não tem acesso a este painel.", email };
    }
    console.error("signInWithOtp", error.status, error.code);
    return { status: "error", message: "Não deu pra mandar o link agora. Tenta de novo.", email };
  }

  return { status: "sent", email };
}
