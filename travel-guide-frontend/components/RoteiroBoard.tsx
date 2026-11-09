"use client";

import { useState, useTransition } from "react";
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
import { VoteButtons } from "@/components/VoteButtons";
import type { RoteiroCard, RoteiroData } from "@/lib/roteiro";
import {
  fmtDayMonth,
  fmtWeekday,
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

export function RoteiroBoard({ data }: { data: RoteiroData }) {
  const days = tripDays();
  const [mobileDay, setMobileDay] = useState<ISODate>(days[0]);
  const [picked, setPicked] = useState<RoteiroCard | null>(null);
  const [dragging, setDragging] = useState<RoteiroCard | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  return (
    <DndContext
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
      <div
        aria-busy={pending || undefined}
        className={`grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] ${pending ? "opacity-70" : ""} transition-opacity duration-150`}
      >
        <Bank
          cards={data.bank}
          picked={picked}
          onPick={(c) => setPicked(picked?.id === c.id ? null : c)}
        />

        <section aria-label="Dias da viagem" className="min-w-0">
          <p className="mb-3 min-h-5 text-sm text-muted" aria-live="polite">
            {message ??
              (picked
                ? `Agora toque no + do bloco onde ${picked.name} entra.`
                : "Arraste uma ideia para o bloco do dia, ou toque nela e depois no +.")}
          </p>

          {/* Celular: um dia por vez */}
          <div role="group" aria-label="Dia" className="no-scrollbar mb-3 flex gap-2 overflow-x-auto lg:hidden">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={mobileDay === d}
                onClick={() => setMobileDay(d)}
                className={`shrink-0 rounded-(--radius-control) border px-3 py-2 text-left ${
                  mobileDay === d ? "border-fg bg-accent text-accent-fg" : "border-border bg-surface"
                }`}
              >
                <span className="block text-xs text-current/70">{fmtWeekday(d)}</span>
                <span className="tabular block font-mono text-sm font-medium">{fmtDayMonth(d)}</span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-3 lg:w-max lg:grid-cols-[110px_repeat(9,212px)]">
              {/* Cabeçalho dos dias (só desktop) */}
              <div className="hidden lg:block" />
              {days.map((d) => (
                <div key={d} className="hidden border-b border-border pb-2 lg:block">
                  <span className="block text-xs text-muted">{fmtWeekday(d)}</span>
                  <span className="tabular font-mono text-sm font-medium">{fmtDayMonth(d)}</span>
                </div>
              ))}

              {/* Chegada/Saída: voo e hospedagem, só leitura */}
              <RowLabel>Chegada / saída</RowLabel>
              {days.map((d) => (
                <div key={d} className={d === mobileDay ? "" : "hidden lg:block"}>
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
                  mobileDay={mobileDay}
                  cards={data.placed}
                  partnerName={data.partnerName}
                  onTapPlaceholder={tapPlaceholder}
                  onUnplace={unplace}
                />
              ))}
            </div>
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging && <CardFace card={dragging} lifted />}
      </DragOverlay>
    </DndContext>
  );
}

function RowLabel({ children }: { children: React.ReactNode }) {
  return <div className="pt-1 text-sm font-medium text-muted">{children}</div>;
}

function Row({
  moment,
  days,
  mobileDay,
  cards,
  partnerName,
  onTapPlaceholder,
  onUnplace,
}: {
  moment: DayMoment;
  days: ISODate[];
  mobileDay: ISODate;
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
          hiddenOnMobile={d !== mobileDay}
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
  return (
    <div
      ref={setNodeRef}
      className={`rounded-(--radius-control) border bg-surface p-2.5 ${
        card.status === "decidido" ? "border-fg" : "border-border"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        {/* Só o nome é a alça: os botões de voto dentro do card não iniciam arrasto */}
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
      {card.status === "decidido" ? (
        <p className="mt-0.5 text-xs text-muted">Decidido · está no mapa</p>
      ) : (
        <VoteButtons
          suggestionId={card.id}
          placeName={card.name}
          myVote={card.myVote}
          partnerVote={card.partnerVote}
          partnerName={partnerName}
        />
      )}
    </div>
  );
}

function Bank({
  cards,
  picked,
  onPick,
}: {
  cards: RoteiroCard[];
  picked: RoteiroCard | null;
  onPick: (c: RoteiroCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "bank" });
  return (
    <aside
      ref={setNodeRef}
      aria-label="Ideias soltas"
      className={`self-start rounded-(--radius-panel) border bg-surface p-4 lg:sticky lg:top-6 ${
        isOver ? "border-fg" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-medium">
          Ideias soltas <span className="tabular text-sm text-muted">{cards.length}</span>
        </h2>
        <AddIdea />
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-muted text-pretty">
          Nada solto. Salve uma ideia com + Ideia, ou arraste um card do dia de volta pra cá.
        </p>
      ) : (
        <ul className="space-y-2 lg:max-h-[65vh] lg:overflow-y-auto lg:pr-1">
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
      } ${lifted ? "w-[212px] border-fg" : ""}`}
    >
      <p className="flex min-w-0 items-center gap-2">
        {card.moment !== "outro" && <MomentChip moment={card.moment} />}
        <span className="truncate text-sm font-medium">{card.name}</span>
      </p>
      {card.neighborhood && <p className="mt-0.5 truncate text-xs text-current/70">{card.neighborhood}</p>}
    </div>
  );
}
