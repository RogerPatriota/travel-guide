"use client";

import { useSyncExternalStore } from "react";
import { fmtLong, toLocalDate, trip, tripDays } from "@/lib/trip";

const DAY = 86_400_000;

// Diferença em dias de calendário entre hoje e o embarque (negativo = já começou)
function daysUntilStart(): number {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((toLocalDate(trip.start).getTime() - today.getTime()) / DAY);
}

// Re-render a cada minuto para a virada do dia acontecer sozinha
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

export function Countdown() {
  // null no servidor: o número depende do relógio de quem está olhando
  const diff = useSyncExternalStore(subscribe, daysUntilStart, () => null);
  const total = tripDays().length;

  let figure = "...";
  let caption = `até ${trip.city}`;

  if (diff !== null) {
    if (diff > 0) {
      figure = String(diff);
      caption = diff === 1 ? `dia até ${trip.city}` : `dias até ${trip.city}`;
    } else if (-diff < total) {
      figure = `${-diff + 1}/${total}`;
      caption = "dia da viagem";
    } else {
      figure = "fim";
      caption = "já voltamos. Hora de rever as fotos";
    }
  }

  return (
    <div aria-live="polite">
      <p className="text-sm text-muted">Faltam</p>
      <p className="tabular font-display text-[clamp(4.5rem,9vw,6rem)] leading-none font-semibold tracking-[-0.03em]">
        {figure}
      </p>
      <p className="mt-2 font-display text-xl font-medium text-balance">{caption}</p>
      <p className="mt-1 text-sm text-muted">Embarque {fmtLong(trip.start)}</p>
    </div>
  );
}
