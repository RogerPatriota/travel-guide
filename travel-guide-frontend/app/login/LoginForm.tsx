"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type LoginState } from "./actions";

const LINK_ERRORS: Record<string, string> = {
  link: "Esse link expirou ou já foi usado. Pede outro.",
};

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });
  const linkError = LINK_ERRORS[useSearchParams().get("erro") ?? ""];

  if (state.status === "sent") {
    return (
      <div role="status" className="space-y-2">
        <p className="font-medium">Link enviado para {state.email}.</p>
        <p className="text-sm text-muted text-pretty">
          Abre o email neste aparelho e toca no link. Pode fechar esta aba depois.
        </p>
      </div>
    );
  }

  const message = state.status === "error" ? state.message : linkError;

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          defaultValue={state.status === "error" ? state.email : undefined}
          aria-invalid={state.status === "error" || undefined}
          aria-describedby={message ? "login-message" : undefined}
          className="block w-full rounded-(--radius-control) border border-border bg-surface px-3 py-2.5 text-base transition-[border-color] duration-150 hover:border-muted"
        />
      </div>

      {message && (
        <p id="login-message" role="alert" className="text-sm text-pretty">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-(--radius-control) border border-fg bg-fg px-4 py-2.5 font-medium text-surface transition-opacity duration-150 disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Mandar link de acesso"}
      </button>
    </form>
  );
}
