import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar · Buenos Aires 2027",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <section className="w-full max-w-sm rounded-(--radius-panel) border border-border bg-surface p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.02em] text-balance">
          Buenos Aires 2027
        </h1>
        <p className="mt-2 mb-6 text-sm text-muted text-pretty">
          Painel só nosso. Coloca teu email que chega um link pra entrar, sem senha.
        </p>
        {/* useSearchParams lê a URL: precisa de Suspense com Cache Components */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  );
}
