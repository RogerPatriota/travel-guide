"use client";

import { useState } from "react";
import { AddIdea } from "@/components/AddIdea";
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

  return (
    <section aria-labelledby="ideas-title">
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
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  moment === "all" ? "border-fg" : "border-border text-muted hover:border-muted"
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
                  className={`rounded-full border p-0.5 ${moment === m ? "border-fg" : "border-transparent"}`}
                >
                  <MomentChip moment={m} />
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((idea) => (
            <IdeaCardView key={idea.id} idea={idea} partnerName={data.partnerName} />
          ))}
        </ul>
      )}
    </section>
  );
}

function IdeaCardView({ idea, partnerName }: { idea: IdeaDetail; partnerName: string | null }) {
  const details = [idea.category, idea.address].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-col rounded-(--radius-panel) border border-border bg-surface p-4">
      <p className="flex min-w-0 items-center gap-2">
        {idea.moment !== "outro" && <MomentChip moment={idea.moment} />}
        <span className="truncate font-medium">{idea.name}</span>
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
