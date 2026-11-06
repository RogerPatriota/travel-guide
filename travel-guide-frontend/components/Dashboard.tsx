"use client";

import { useEffect, useRef, useState } from "react";
import { Countdown } from "@/components/Countdown";
import { TripMap } from "@/components/TripMap";
import {
  events,
  fmtDayMonth,
  fmtLong,
  fmtWeekday,
  toLocalDate,
  trip,
  tripDays,
  type ISODate,
} from "@/lib/trip";

type Selection = ISODate | "all";

function Panel({
  title,
  aside,
  className = "",
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-(--radius-panel) border border-border bg-surface p-5 ${className}`}
    >
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-medium">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function DaySelector({
  value,
  onChange,
}: {
  value: Selection;
  onChange: (v: Selection) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const days = tripDays();

  // Liga/desliga as setas conforme o scroll chega nas pontas
  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 1,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
    });
  };
  useEffect(() => {
    updateEdges();
    window.addEventListener("resize", updateEdges);
    return () => window.removeEventListener("resize", updateEdges);
  }, []);

  const scroll = (dir: 1 | -1) =>
    scroller.current?.scrollBy({ left: 240 * dir, behavior: "smooth" });

  const pill =
    "shrink-0 rounded-(--radius-control) border px-3 py-2 text-left transition-[background-color,border-color] duration-150";
  const on = "border-fg bg-accent text-accent-fg";
  const off = "border-border bg-surface hover:border-muted";
  const arrow =
    "grid w-9 shrink-0 place-items-center rounded-(--radius-control) border border-border bg-surface transition-[border-color,opacity] duration-150 hover:border-muted disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label="Ver dias anteriores"
        disabled={edge.start}
        onClick={() => scroll(-1)}
        className={arrow}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <div
        ref={scroller}
        onScroll={updateEdges}
        role="group"
        aria-label="Filtrar por dia"
        className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto"
      >
        <button
          type="button"
          aria-pressed={value === "all"}
          onClick={() => onChange("all")}
          className={`${pill} ${value === "all" ? on : off}`}
        >
          <span className="block text-xs text-current/70">{days.length} dias</span>
          <span className="block text-sm font-medium">Todos</span>
        </button>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={value === d}
            onClick={() => onChange(d)}
            className={`${pill} ${value === d ? on : off}`}
          >
            <span className="block text-xs text-current/70">{fmtWeekday(d)}</span>
            <span className="tabular block font-mono text-sm font-medium">{fmtDayMonth(d)}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Ver próximos dias"
        disabled={edge.end}
        onClick={() => scroll(1)}
        className={arrow}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

function Upcoming({ selected }: { selected: Selection }) {
  const list = selected === "all" ? events : events.filter((e) => e.date === selected);

  return (
    <Panel
      title="Próximas datas"
      aside={
        selected !== "all" && <span className="text-sm text-muted">{fmtLong(selected)}</span>
      }
    >
      {list.length === 0 ? (
        <p className="text-sm text-muted text-pretty">
          Nada marcado pra esse dia. Dia livre, ou dia de decidir alguma coisa.
        </p>
      ) : (
        <ol className="divide-y divide-border">
          {list.map((e) => (
            <li key={e.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <div className="w-10 shrink-0 text-center">
                <span className="tabular block font-mono text-xl leading-none font-medium">
                  {toLocalDate(e.date).getDate()}
                </span>
                <span className="mt-1 block text-xs text-muted">{fmtWeekday(e.date)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.title}</p>
                <p className="truncate text-sm text-muted">
                  {e.time ? `${e.time} · ${e.detail}` : e.detail}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-xs text-muted">
                {e.status}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Expenses() {
  // TODO(content): valores reais de passagens e hospedagem (fase 5 lança pelo app)
  const paid = [
    { label: "Passagens", note: "pagas, valor a lançar" },
    { label: "Hospedagem", note: "paga, valor a lançar" },
  ];

  return (
    <Panel title="Gastos">
      <p className="text-sm text-muted">Lançado até agora</p>
      <p className="tabular mt-1 font-mono text-3xl font-medium">R$ 0</p>
      <ul className="mt-5 space-y-2">
        {paid.map((p) => (
          <li key={p.label} className="flex items-baseline justify-between gap-3 text-sm">
            <span>{p.label}</span>
            <span className="text-muted">{p.note}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function Ideas() {
  return (
    <Panel title="Ideias de lugares" className="flex flex-col">
      <div className="flex flex-1 flex-col justify-center rounded-(--radius-control) border border-dashed border-border p-5">
        <p className="font-medium text-balance">Nenhum lugar salvo ainda.</p>
        <p className="mt-1 text-sm text-muted text-pretty">
          Cada um joga aqui o que quer conhecer. Os dois curtiram, entra no roteiro.
        </p>
      </div>
    </Panel>
  );
}

export function Dashboard() {
  const [selected, setSelected] = useState<Selection>("all");

  return (
    <main className="mx-auto w-full max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">
          {trip.city}
        </h1>
        <p className="mt-2 text-muted">
          {fmtLong(trip.start)} a {fmtLong(trip.end)}, em {trip.neighborhood}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-6">
        <div className="px-1 py-2 lg:col-span-3 lg:col-start-10 lg:row-start-1">
          <Countdown />
        </div>

        <div className="flex flex-col gap-3 lg:col-span-5 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <DaySelector value={selected} onChange={setSelected} />
          <div className="relative min-h-[360px] flex-1 overflow-hidden rounded-(--radius-panel) border border-border bg-sunken lg:min-h-[560px]">
            <TripMap />
          </div>
        </div>

        <div className="lg:col-span-4 lg:col-start-6 lg:row-start-1">
          <Expenses />
        </div>

        <div className="lg:col-span-4 lg:col-start-6 lg:row-start-2">
          <Upcoming selected={selected} />
        </div>

        <div className="flex lg:col-span-3 lg:col-start-10 lg:row-start-2 [&>section]:flex-1">
          <Ideas />
        </div>
      </div>
    </main>
  );
}
