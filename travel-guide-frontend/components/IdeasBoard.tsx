"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AddIdea } from "@/components/AddIdea";
import { IdeaDetails } from "@/components/IdeaDetails";
import { MomentChip } from "@/components/MomentChip";
import { VoteButtons } from "@/components/VoteButtons";
import type { IdeaDetail, IdeaStatus, IdeasData } from "@/lib/ideas";
import { fmtLong, momentLabel, tripDays, type DayMoment } from "@/lib/trip";

const STATUS_TABS: { value: IdeaStatus; label: string }[] = [
  { value: "ideia", label: "Para votar" },
  { value: "decidido", label: "Decididas" },
  { value: "descartado", label: "Descartadas" },
];

const pill =
  "rounded-(--radius-control) border px-3 py-1.5 text-sm transition-[background-color,border-color] duration-150";
const on = "border-fg bg-accent text-accent-fg";
const off = "border-border bg-surface hover:border-muted";

export function IdeasBoard({ data }: { data: IdeasData }) {
  const [status, setStatus] = useState<IdeaStatus>("ideia");
  const [moment, setMoment] = useState<DayMoment | "all">("all");
  const [day, setDay] = useState<string>("all"); // "all" | "none" | ISODate

  const byStatus = data.ideas.filter((i) => i.status === status);
  const moments = [...new Set(byStatus.map((i) => i.moment))];
  const list = byStatus.filter(
    (i) =>
      (moment === "all" || i.moment === moment) &&
      (day === "all" || (day === "none" ? i.date === null : i.date === day)),
  );
  const waiting = data.ideas.filter((i) => i.status === "ideia" && !i.myVote).length;

  // A ideia aberta mora na URL (?ideia=12): recarregar ou mandar o link mantém os detalhes
  const params = useSearchParams();
  const selectedId = Number(params.get("ideia")) || null;
  const selected = selectedId ? (data.ideas.find((i) => i.id === selectedId) ?? null) : null;
  const panel = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const isMobile = () => window.matchMedia("(max-width: 1023px)").matches;

  const setIdea = (id: number | null) => {
    const next = new URLSearchParams(params.toString());
    if (id === null) next.delete("ideia");
    else next.set("ideia", String(id));
    const qs = next.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    // Abrir entra no histórico (o voltar do navegador fecha); trocar de ideia ou fechar não empilha
    if (id !== null && !selected) {
      listScroll.current = window.scrollY;
      window.history.pushState(null, "", url);
    } else {
      window.history.replaceState(null, "", url);
    }
  };

  // Celular: os detalhes ocupam o lugar da lista, então sobe até eles; ao fechar, volta onde estava
  const openId = selected?.id ?? null;
  useEffect(() => {
    if (!isMobile()) return;
    if (openId !== null) panel.current?.scrollIntoView({ block: "start" });
    else if (listScroll.current > 0) window.scrollTo({ top: listScroll.current });
  }, [openId]);

  return (
    <div
      className={
        selected ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-6" : undefined
      }
    >
      {/* No celular, com uma ideia aberta, a lista sai da frente */}
      <section aria-labelledby="ideas-title" className={selected ? "hidden lg:block" : undefined}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            {/* A aba já diz "Ideias": o título fica só para leitor de tela */}
            <h2 id="ideas-title" className="sr-only">
              Ideias
            </h2>
            <p className="text-muted">
              {waiting > 0
                ? `${waiting} esperando o seu voto. Os dois curtiram, entra no roteiro.`
                : "Nada esperando o seu voto."}
            </p>
          </div>
          <AddIdea />
        </div>

        <div className="mb-6 space-y-3">
          <div role="group" aria-label="Situação" className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => {
              const count = data.ideas.filter((i) => i.status === t.value).length;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={status === t.value}
                  onClick={() => {
                    setStatus(t.value);
                    setMoment("all");
                  }}
                  className={`${pill} ${status === t.value ? on : off}`}
                >
                  {t.label} <span className="tabular text-current/70">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {moments.length > 1 && (
              <div role="group" aria-label="Momento" className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  aria-pressed={moment === "all"}
                  onClick={() => setMoment("all")}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-[background-color,color] duration-150 ${
                    moment === "all" ? "bg-fg text-surface" : "bg-sunken text-muted hover:text-fg"
                  }`}
                >
                  Todos
                </button>
                {moments.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={moment === m}
                    aria-label={`Só ${momentLabel[m].toLowerCase()}`}
                    onClick={() => setMoment(moment === m ? "all" : m)}
                    className="rounded-full"
                  >
                    <MomentChip moment={m} selected={moment === m} />
                  </button>
                ))}
              </div>
            )}
            <label className="ml-auto flex items-center gap-2 text-sm text-muted">
              Dia
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-(--radius-control) border border-border bg-surface px-2 py-1.5 text-fg"
              >
                <option value="all">Todos</option>
                <option value="none">Algum dia</option>
                {tripDays().map((d) => (
                  <option key={d} value={d}>
                    {fmtLong(d)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="rounded-(--radius-panel) border border-dashed border-border p-6">
            <p className="font-medium text-balance">
              {byStatus.length === 0
                ? status === "ideia"
                  ? "Nenhuma ideia para votar."
                  : status === "decidido"
                    ? "Nada decidido ainda."
                    : "Nada descartado."
                : "Nenhuma ideia com esse filtro."}
            </p>
            {status === "ideia" && byStatus.length === 0 && (
              <p className="mt-1 text-sm text-muted text-pretty">
                Viu um lugar num reel? Toca em + Ideia e cola o link do Maps.
              </p>
            )}
          </div>
        ) : (
          <ul className={`grid gap-4 sm:grid-cols-2 ${selected ? "" : "lg:grid-cols-3"}`}>
            {list.map((idea) => (
              <IdeaCardView
                key={idea.id}
                idea={idea}
                partnerName={data.partnerName}
                open={selected?.id === idea.id}
                onOpen={() => setIdea(idea.id)}
              />
            ))}
          </ul>
        )}
      </section>

      {/* Detalhes à direita, como o mapa no Roteiro */}
      {selected && (
        <div ref={panel} className="scroll-mt-4 lg:sticky lg:top-6">
          <IdeaDetails
            idea={selected}
            partnerName={data.partnerName}
            stays={data.stays}
            onClose={() => setIdea(null)}
          />
        </div>
      )}
    </div>
  );
}

function IdeaCardView({
  idea,
  partnerName,
  open,
  onOpen,
}: {
  idea: IdeaDetail;
  partnerName: string | null;
  open: boolean;
  onOpen: () => void;
}) {
  const details = [idea.category, idea.address].filter(Boolean).join(" · ");
  return (
    <li
      // O card todo abre os detalhes; voto e links continuam com o clique deles.
      // No teclado, quem abre é o botão do nome.
      onClick={(e) => {
        if (!(e.target as Element).closest("a, button")) onOpen();
      }}
      aria-current={open || undefined}
      className={`flex cursor-pointer flex-col rounded-(--radius-panel) border bg-surface p-4 transition-[border-color] duration-150 ${
        open ? "border-fg" : "border-border hover:border-muted"
      }`}
    >
      <p className="flex min-w-0 items-center gap-2">
        {idea.moment !== "outro" && <MomentChip moment={idea.moment} />}
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Ver detalhes de ${idea.name}`}
          className="min-w-0 truncate rounded-sm text-left font-medium underline-offset-2 hover:underline"
        >
          {idea.name}
        </button>
      </p>
      <p className="mt-1 text-sm text-muted">
        {idea.date ? fmtLong(idea.date) : "Algum dia"}
        {idea.neighborhood && ` · ${idea.neighborhood}`}
      </p>
      {details && <p className="mt-0.5 truncate text-sm text-muted">{details}</p>}
      {idea.note && <p className="mt-2 text-sm text-pretty break-words">{idea.note}</p>}

      <p className="mt-2 text-xs text-muted">
        {idea.suggestedBy ? `Sugerido por ${idea.suggestedBy}` : "Sugestão da pesquisa"}
        {idea.url && (
          <>
            {" · "}
            <a
              href={idea.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-fg"
            >
              abrir no mapa
            </a>
          </>
        )}
      </p>

      <div className="mt-auto pt-3">
        {idea.status === "ideia" ? (
          <VoteButtons
            suggestionId={idea.id}
            placeName={idea.name}
            myVote={idea.myVote}
            partnerVote={idea.partnerVote}
            partnerName={partnerName}
          />
        ) : (
          <p className="text-sm text-muted">
            {idea.status === "decidido"
              ? `Entrou no roteiro${idea.date ? ` de ${fmtLong(idea.date)}` : ""}.`
              : "Descartada por um dos dois."}
          </p>
        )}
      </div>
    </li>
  );
}
