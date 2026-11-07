"use client";

import { useOptimistic, useState, useTransition } from "react";
import { vote } from "@/app/actions/vote";
import type { VoteValue } from "@/lib/data";

const OPTIONS: { value: VoteValue; label: string }[] = [
  // Primeira pessoa: é o meu voto (o do outro aparece embaixo como "curtiu")
  { value: "curtiu", label: "Curti" },
  { value: "tanto_faz", label: "Tanto faz" },
  { value: "nao_curtiu", label: "Não curti" },
];

const LABEL: Record<VoteValue, string> = {
  curtiu: "curtiu",
  tanto_faz: "tanto faz",
  nao_curtiu: "não curtiu",
};

export function VoteButtons({
  suggestionId,
  placeName,
  myVote,
  partnerVote,
  partnerName,
}: {
  suggestionId: number;
  placeName: string;
  myVote: VoteValue | null;
  partnerVote: VoteValue | null;
  partnerName: string | null;
}) {
  const [optimisticVote, setOptimisticVote] = useOptimistic(myVote);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const choose = (value: VoteValue) => {
    if (value === optimisticVote) return;
    setError(null);
    startTransition(async () => {
      setOptimisticVote(value);
      const result = await vote(suggestionId, value);
      if (result.error) setError(result.error);
    });
  };

  const partner = partnerName ?? "O outro voto";
  const partnerStatus = partnerVote
    ? `${partner}: ${LABEL[partnerVote]}`
    : partnerName
      ? `${partnerName} ainda não votou`
      : "Falta o outro voto";

  return (
    <div className="mt-2 space-y-1.5">
      <div
        role="group"
        aria-label={`Seu voto em ${placeName}`}
        aria-busy={pending || undefined}
        className="grid grid-cols-3 gap-1"
      >
        {OPTIONS.map((o) => {
          const on = optimisticVote === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => choose(o.value)}
              className={`whitespace-nowrap rounded-(--radius-control) border px-1 py-1.5 text-xs font-medium transition-[background-color,border-color] duration-150 ${
                on
                  ? "border-fg bg-accent text-accent-fg"
                  : "border-border bg-surface text-fg hover:border-muted"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {error ?? partnerStatus}
      </p>
    </div>
  );
}
