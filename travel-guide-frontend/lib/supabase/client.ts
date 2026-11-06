import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// Cliente do navegador (Client Components). Na fase 3 é ele que assina o realtime.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
