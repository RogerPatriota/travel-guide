import type { CSSProperties } from "react";
import { momentColorVar, momentLabel, type DayMoment } from "@/lib/trip";

/** Etiqueta do momento do dia, na mesma cor do pin no mapa */
export function MomentChip({ moment }: { moment: DayMoment }) {
  return (
    <span
      style={{ "--moment": `var(${momentColorVar[moment]})` } as CSSProperties}
      className="moment-chip inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium"
    >
      {momentLabel[moment]}
    </span>
  );
}
