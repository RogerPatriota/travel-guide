"use client";

import { useState, useSyncExternalStore, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { placeIdea, unplaceIdea } from "@/app/actions/roteiro";
import { AddIdea } from "@/components/AddIdea";
import { MomentChip } from "@/components/MomentChip";
import { TripMap } from "@/components/TripMap";
import type { RoteiroCard, RoteiroData } from "@/lib/roteiro";
import {
  fmtDayMonth,
  fmtWeekday,
  momentColorVar,
  momentLabel,
  tripDays,
  type DayMoment,
  type ISODate,
} from "@/lib/trip";

// Linhas na ordem do dia (é também a ordem das paradas no mapa)
const ROWS: DayMoment[] = [
  "cafe_da_manha", "passeio", "almoco", "lanche", "mercado", "jantar", "noite",
];

const cellId = (date: ISODate, moment: DayMoment) => `cell|${date}|${moment}`;

/* Painel aberto/fechado lembrado no navegador (conveniência local; sem storage, abre) */
const PREF_EVENT = "roteiro-pref";
function usePanelOpen(key: string) {
  const open = useSyncExternalStore(
    (cb) => {
      window.addEventListener(PREF_EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(PREF_EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      try {
        return localStorage.getItem(key) !== "0";
      } catch {
        return true;
      }
    },
    () => true,
  );
  const setOpen = (value: boolean) => {
    try {
      localStorage.setItem(key, value ? "1" : "0");
    } catch {
      /* sem storage: só não lembra */
    }
    window.dispatchEvent(new Event(PREF_EVENT));
  };
  return [open, setOpen] as const;
}

export function RoteiroBoard({ data }: { data: RoteiroData }) {
  const days = tripDays();
  const [day, setDay] = useState<ISODate>(days[0]);
  const [picked, setPicked] = useState<RoteiroCard | null>(null);
  const [dragging, setDragging] = useState<RoteiroCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mobileMap, setMobileMap] = useState(false);
  const [bankOpen, setBankOpen] = usePanelOpen("roteiro:ideias");
  const [mapOpen, setMapOpen] = usePanelOpen("roteiro:mapa");
  const [pending, startTransition] = useTransition();

  // Mouse: arrasta só depois de 6 px (clique continua clique). Teclado: espaço pega e solta.
  // Toque não arrasta (briga com a rolagem): no celular é tocar na ideia e depois no "+".
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const all = [...data.bank, ...data.placed];
  const rows = data.placed.some((c) => c.moment === "outro") ? [...ROWS, "outro" as const] : ROWS;

  const place = (card: RoteiroCard, date: ISODate, moment: DayMoment) => {
    if (card.date === date && card.moment === moment) return;
    setPicked(null);
    setMessage(null);
    setDay(date); // o mapa acompanha o dia onde você está montando
    startTransition(async () => {
      const r = await placeIdea(card.id, date, moment);
      if (r.error) setMessage(r.error);
    });
  };

  const unplace = (card: RoteiroCard) => {
    if (card.date === null) return;
    setPicked(null);
    startTransition(async () => {
      const r = await unplaceIdea(card.id);
      if (r.error) setMessage(r.error);
    });
  };

  // Leitor de tela em português, com o nome do lugar e do bloco
  const nameOf = (id: UniqueIdentifier) => all.find((c) => `card|${c.id}` === id)?.name ?? "card";
  const whereOf = (id: UniqueIdentifier | undefined) => {
    if (!id) return "fora de um bloco";
    if (id === "bank") return "a lista de ideias soltas";
    const [, date, moment] = String(id).split("|");
    return `${momentLabel[moment as DayMoment].toLowerCase()} de ${fmtDayMonth(date as ISODate)}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Pegou ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => `${nameOf(active.id)} sobre ${whereOf(over?.id)}.`,
    onDragEnd: ({ active, over }) => `${nameOf(active.id)} solto em ${whereOf(over?.id)}.`,
    onDragCancel: ({ active }) => `Cancelou. ${nameOf(active.id)} ficou onde estava.`,
  };

  const onDragStart = (e: DragStartEvent) =>
    setDragging(all.find((c) => `card|${c.id}` === e.active.id) ?? null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const card = all.find((c) => `card|${c.id}` === active.id);
    if (!card || !over) return;
    if (over.id === "bank") return unplace(card);
    const [, date, moment] = String(over.id).split("|");
    place(card, date as ISODate, moment as DayMoment);
  };

  const tapPlaceholder = (date: ISODate, moment: DayMoment) => {
    if (picked) place(picked, date, moment);
    else setMessage("Escolha uma ideia na lista (ou arraste uma até aqui).");
  };

  const mapPanel = (
    <div className="relative h-full min-h-[320px] overflow-hidden rounded-(--radius-panel) border border-border bg-sunken">
      <TripMap data={data.map} selected={day} />
    </div>
  );

  return (
    <DndContext
      // id fixo: sem ele o dnd-kit gera ids de acessibilidade diferentes no servidor e no navegador
      id="roteiro-dnd"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Para mover: espaço para pegar, setas para escolher o bloco, espaço para soltar, Esc para cancelar.",
        },
      }}
    >
      {/* Celular: abre/fecha ideias e mapa por cima da grade */}
      <div className="mb-3 flex gap-2 lg:hidden">
        <button
          type="button"
          aria-pressed={bankOpen}
          onClick={() => setBankOpen(!bankOpen)}
          className={`rounded-(--radius-control) border px-3 py-1.5 text-sm ${
            bankOpen ? "border-fg bg-accent text-accent-fg" : "border-border bg-surface"
          }`}
        >
          Ideias soltas <span className="tabular">{data.bank.length}</span>
        </button>
        <button
          type="button"
          aria-pressed={mobileMap}
          onClick={() => setMobileMap(!mobileMap)}
          className={`rounded-(--radius-control) border px-3 py-1.5 text-sm ${
            mobileMap ? "border-fg bg-accent text-accent-fg" : "border-border bg-surface"
          }`}
        >
          Mapa do dia
        </button>
      </div>
      {mobileMap && <div className="mb-4 h-[45vh] lg:hidden">{mapPanel}</div>}

      <div
        aria-busy={pending || undefined}
        className={`grid gap-6 transition-opacity duration-150 lg:grid-cols-[auto_minmax(0,1fr)_auto] ${pending ? "opacity-70" : ""}`}
      >
        {bankOpen ? (
          <Bank
            cards={data.bank}
            picked={picked}
            onPick={(c) => setPicked(picked?.id === c.id ? null : c)}
            onCollapse={() => setBankOpen(false)}
          />
        ) : (
          <Rail label={`Ideias soltas (${data.bank.length})`} onOpen={() => setBankOpen(true)} dropId="bank" />
        )}

        <section aria-label="Dias da viagem" className="min-w-0">
          <p className="mb-3 min-h-5 text-sm text-muted" aria-live="polite">
            {message ??
              (picked
                ? `Agora toque no + do bloco onde ${picked.name} entra.`
                : "Arraste uma ideia para o bloco do dia, ou toque nela e depois no +. Clique num dia para ver no mapa.")}
          </p>

          {/* Celular: um dia por vez (o mesmo dia do mapa) */}
          <div role="group" aria-label="Dia" className="no-scrollbar mb-3 flex gap-2 overflow-x-auto lg:hidden">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={day === d}
                onClick={() => setDay(d)}
                className={`shrink-0 rounded-(--radius-control) border px-3 py-2 text-left ${
                  day === d ? "border-fg bg-accent text-accent-fg" : "border-border bg-surface"
                }`}
              >
                <span className="block text-xs text-current/70">{fmtWeekday(d)}</span>
                <span className="tabular block font-mono text-sm font-medium">{fmtDayMonth(d)}</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3 lg:w-max lg:grid-cols-[110px_repeat(9,180px)]">
              {/* Cabeçalho dos dias (desktop): clicar põe o dia no mapa */}
              <div className="hidden lg:block" />
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={day === d}
                  onClick={() => setDay(d)}
                  className={`hidden rounded-(--radius-control) border px-2 py-1.5 text-left transition-[background-color,border-color] duration-150 lg:block ${
                    day === d ? "border-fg bg-accent text-accent-fg" : "border-transparent hover:border-border"
                  }`}
                >
                  <span className="block text-xs text-current/70">{fmtWeekday(d)}</span>
                  <span className="tabular font-mono text-sm font-medium">{fmtDayMonth(d)}</span>
                </button>
              ))}

              {/* Chegada/Saída: voo e hospedagem, só leitura */}
              <RowLabel>Chegada / saída</RowLabel>
              {days.map((d) => (
                <div key={d} className={d === day ? "" : "hidden lg:block"}>
                  {data.logistics
                    .filter((l) => l.date === d)
                    .map((l) => (
                      <p key={l.id} className="text-sm text-muted">
                        {l.time && <span className="tabular font-mono">{l.time} </span>}
                        {l.title}
                      </p>
                    ))}
                </div>
              ))}

              {rows.map((m) => (
                <Row
                  key={m}
                  moment={m}
                  days={days}
                  focusDay={day}
                  cards={data.placed}
                  partnerName={data.partnerName}
                  onTapPlaceholder={tapPlaceholder}
                  onUnplace={unplace}
                />
              ))}
            </div>
          </div>
        </section>

        {mapOpen ? (
          <aside aria-label="Mapa do dia" className="hidden w-[360px] self-start lg:sticky lg:top-6 lg:block">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="font-display text-lg font-medium">
                Mapa · <span className="tabular font-mono text-base">{fmtDayMonth(day)}</span>
              </h2>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="text-sm text-muted underline underline-offset-2 hover:text-fg"
              >
                Recolher
              </button>
            </div>
            <div className="h-[calc(100vh-7rem)]">{mapPanel}</div>
          </aside>
        ) : (
          <div className="hidden lg:block">
            <Rail label="Mapa" onOpen={() => setMapOpen(true)} />
          </div>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && <CardFace card={dragging} lifted />}
      </DragOverlay>
    </DndContext>
  );
}

/** Painel recolhido: uma faixa fina que reabre (e aceita card arrastado, no caso das ideias) */
function Rail({ label, onOpen, dropId }: { label: string; onOpen: () => void; dropId?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId ?? `rail|${label}`, disabled: !dropId });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${label.toLowerCase()}`}
      className={`hidden self-start rounded-(--radius-panel) border bg-surface px-2 py-4 text-sm font-medium transition-[border-color] duration-150 hover:border-muted lg:block ${
        isOver ? "border-fg" : "border-border"
      }`}
    >
      <span className="block [writing-mode:vertical-rl]">{label}</span>
    </button>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return <div className="pt-1 text-sm font-medium text-muted">{children}</div>;
}

function Row({
  moment,
  days,
  focusDay,
  cards,
  partnerName,
  onTapPlaceholder,
  onUnplace,
}: {
  moment: DayMoment;
  days: ISODate[];
  focusDay: ISODate;
  cards: RoteiroCard[];
  partnerName: string | null;
  onTapPlaceholder: (date: ISODate, moment: DayMoment) => void;
  onUnplace: (card: RoteiroCard) => void;
}) {
  return (
    <>
      <div className="pt-1">
        {moment === "outro" ? <RowLabel>Outro</RowLabel> : <MomentChip moment={moment} />}
      </div>
      {days.map((d) => (
        <Cell
          key={d}
          date={d}
          moment={moment}
          hiddenOnMobile={d !== focusDay}
          cards={cards.filter((c) => c.date === d && c.moment === moment)}
          partnerName={partnerName}
          onTapPlaceholder={onTapPlaceholder}
          onUnplace={onUnplace}
        />
      ))}
    </>
  );
}

function Cell({
  date,
  moment,
  hiddenOnMobile,
  cards,
  partnerName,
  onTapPlaceholder,
  onUnplace,
}: {
  date: ISODate;
  moment: DayMoment;
  hiddenOnMobile: boolean;
  cards: RoteiroCard[];
  partnerName: string | null;
  onTapPlaceholder: (date: ISODate, moment: DayMoment) => void;
  onUnplace: (card: RoteiroCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: cellId(date, moment) });
  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 rounded-(--radius-control) transition-[background-color] duration-150 ${
        isOver ? "bg-sunken" : ""
      } ${hiddenOnMobile ? "hidden lg:block" : ""}`}
    >
      {cards.map((c) => (
        <PlacedCard key={c.id} card={c} partnerName={partnerName} onUnplace={onUnplace} />
      ))}
      {/* Sempre sobra um encaixe vazio: dá para pôr mais de um no mesmo momento */}
      <button
        type="button"
        onClick={() => onTapPlaceholder(date, moment)}
        aria-label={`Encaixar em ${momentLabel[moment].toLowerCase()}, ${fmtDayMonth(date)}`}
        className={`grid h-10 w-full place-items-center rounded-(--radius-control) border border-dashed text-lg text-muted transition-[border-color,color] duration-150 hover:border-muted hover:text-fg ${
          isOver ? "border-fg text-fg" : "border-muted/50"
        }`}
      >
        +
      </button>
    </div>
  );
}

/** ✓ decidido · relógio = falta voto. Votar é na aba Ideias. */
function StatusLine({ card, partnerName }: { card: RoteiroCard; partnerName: string | null }) {
  const color = { color: `var(${momentColorVar[card.moment]})` } as CSSProperties;
  if (card.status === "decidido") {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={color}>
          <path d="M3 8.5l3.2 3L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Decidido
      </p>
    );
  }
  const mine = card.myVote === null;
  const text = mine
    ? "Falta você"
    : card.partnerVote === null
      ? `Falta ${partnerName ?? "o outro voto"}`
      : "Sem decisão";
  return (
    <p className={`mt-1 flex items-center gap-1.5 text-xs ${mine ? "font-medium text-fg" : "text-muted"}`}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.8V8l2.2 1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {text}
      {mine && (
        <Link href="/ideias" className="underline underline-offset-2">
          votar
        </Link>
      )}
    </p>
  );
}

function PlacedCard({
  card,
  partnerName,
  onUnplace,
}: {
  card: RoteiroCard;
  partnerName: string | null;
  onUnplace: (card: RoteiroCard) => void;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `card|${card.id}` });
  const waitingMe = card.status === "ideia" && card.myVote === null;
  return (
    <div
      ref={setNodeRef}
      className={`rounded-(--radius-control) border bg-surface px-2.5 py-2 ${
        card.status === "decidido" ? "border-fg" : waitingMe ? "border-muted" : "border-border"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        {/* Só o nome é a alça de arrastar */}
        <p
          {...attributes}
          {...listeners}
          aria-label={`Mover ${card.name}`}
          className="min-w-0 cursor-grab truncate text-sm font-medium"
        >
          {card.name}
        </p>
        {/* Sem arrastar (celular/teclado): devolve para a lista */}
        <button
          type="button"
          onClick={() => onUnplace(card)}
          className="shrink-0 text-xs text-muted underline underline-offset-2 hover:text-fg"
        >
          Devolver
        </button>
      </div>
      <StatusLine card={card} partnerName={partnerName} />
    </div>
  );
}

function Bank({
  cards,
  picked,
  onPick,
  onCollapse,
}: {
  cards: RoteiroCard[];
  picked: RoteiroCard | null;
  onPick: (c: RoteiroCard) => void;
  onCollapse: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "bank" });
  return (
    <aside
      ref={setNodeRef}
      aria-label="Ideias soltas"
      className={`self-start rounded-(--radius-panel) border bg-surface p-4 lg:sticky lg:top-6 lg:w-[240px] ${
        isOver ? "border-fg" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium">
          Ideias soltas <span className="tabular text-sm text-muted">{cards.length}</span>
        </h2>
        <button
          type="button"
          onClick={onCollapse}
          className="hidden text-sm text-muted underline underline-offset-2 hover:text-fg lg:inline"
        >
          Recolher
        </button>
      </div>
      <div className="mb-3">
        <AddIdea />
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted text-pretty">
          Nada solto. Salve uma ideia com + Ideia, ou arraste um card do dia de volta pra cá.
        </p>
      ) : (
        <ul className="space-y-2 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1">
          {cards.map((c) => (
            <li key={c.id}>
              <BankCard card={c} picked={picked?.id === c.id} onPick={() => onPick(c)} />
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function BankCard({ card, picked, onPick }: { card: RoteiroCard; picked: boolean; onPick: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `card|${card.id}` });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onPick}
      aria-pressed={picked}
      className={`cursor-grab ${isDragging ? "opacity-40" : ""}`}
    >
      <CardFace card={card} picked={picked} />
    </div>
  );
}

function CardFace({ card, picked = false, lifted = false }: { card: RoteiroCard; picked?: boolean; lifted?: boolean }) {
  return (
    <div
      className={`rounded-(--radius-control) border p-2.5 transition-[background-color,border-color] duration-150 ${
        picked ? "border-fg bg-accent text-accent-fg" : "border-border bg-surface"
      } ${lifted ? "w-[180px] border-fg" : ""}`}
    >
      <p className="flex min-w-0 items-center gap-2">
        {card.moment !== "outro" && <MomentChip moment={card.moment} />}
        <span className="truncate text-sm font-medium">{card.name}</span>
      </p>
      {card.neighborhood && <p className="mt-0.5 truncate text-xs text-current/70">{card.neighborhood}</p>}
    </div>
  );
}
