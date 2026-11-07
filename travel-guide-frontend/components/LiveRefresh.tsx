"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Tabelas que o outro celular pode mudar e que aparecem na home
const TABLES = ["votes", "suggestions", "events"] as const;

/**
 * Escuta mudanças no banco (Supabase Realtime, respeitando o RLS) e recarrega
 * os dados da home. É assim que o voto de um aparece na tela do outro.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Um voto mexe em até 3 tabelas de uma vez: junta tudo num refresh só
    const refreshSoon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 300);
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled || !data.session) return;
      // O realtime precisa do token do usuário para aplicar o RLS
      supabase.realtime.setAuth(data.session.access_token);
      channel = supabase.channel("home");
      for (const table of TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, refreshSoon);
      }
      channel.subscribe();
    });

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
