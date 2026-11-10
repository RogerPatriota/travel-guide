import type { CSSProperties } from "react";
import { momentColorVar, momentLabel, type DayMoment } from "@/lib/trip";

/**
 * Etiqueta do momento do dia, na mesma cor do pin no mapa. Em seletores,
 * `selected` deixa a etiqueta cheia (cor do momento, texto branco).
 */
export function MomentChip({ moment, selected = false }: { moment: DayMoment; selected?: boolean }) {
  return (
    <span
      data-selected={selected || undefined}
      style={{ "--moment": `var(${momentColorVar[moment]})` } as CSSProperties}
      className="moment-chip inline-flex shrink-0 transition-[background-color,color] duration-150 items-center rounded-full px-2 py-0.5 text-xs font-medium"
    >
      {momentLabel[moment]}
    </span>
  );
}
