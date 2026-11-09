import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { LiveRefresh } from "@/components/LiveRefresh";
import { NavTabs } from "@/components/NavTabs";
import { getMyName } from "@/lib/ideas";
import { fmtLong, trip } from "@/lib/trip";

/** Área logada: cabeçalho, abas e atualização ao vivo, iguais em todas as abas */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
            {trip.city} com meu amor
          </h1>
          <p className="mt-2 text-muted">
            {fmtLong(trip.start)} a {fmtLong(trip.end)}, em {trip.neighborhood}
          </p>
        </div>
        {/* Lê a sessão: fica atrás de Suspense para o resto da página sair na hora */}
        <Suspense>
          <UserMenu />
        </Suspense>
      </header>
      <div className="mb-8">
        <NavTabs />
      </div>
      {children}
    </main>
  );
}

async function UserMenu() {
  const name = await getMyName();
  return (
    <form action={signOut} className="flex items-center gap-3 text-sm">
      {/* Voto ou roteiro mudou no outro celular: recarrega a aba aberta */}
      <LiveRefresh />
      <span className="text-muted">{name}</span>
      <button
        type="submit"
        className="rounded-(--radius-control) border border-border bg-surface px-3 py-1.5 transition-[border-color] duration-150 hover:border-muted"
      >
        Sair
      </button>
    </form>
  );
}
