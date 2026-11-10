"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addIdea, resolveMapsLink, searchPlaces } from "@/app/actions/ideas";
import { MomentChip } from "@/components/MomentChip";
import type { PlaceHit } from "@/lib/places";
import { fmtLong, momentLabel, tripDays, type DayMoment } from "@/lib/trip";

const MOMENTS: DayMoment[] = [
  "cafe_da_manha", "almoco", "lanche", "jantar", "passeio", "mercado", "noite", "outro",
];

const isLink = (s: string) => /^https?:\/\//i.test(s.trim());

const field =
  "block w-full rounded-(--radius-control) border border-border bg-surface px-3 py-2.5 text-base transition-[border-color] duration-150 hover:border-muted";

export function AddIdea() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [place, setPlace] = useState<PlaceHit | null>(null);
  const [moment, setMoment] = useState<DayMoment>("passeio");
  const [date, setDate] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [saving, startSave] = useTransition();

  // Sugestões enquanto digita (espera a pessoa parar 350 ms); link é resolvido no botão
  const canSearch = !place && !isLink(query) && query.trim().length >= 2;
  useEffect(() => {
    if (!canSearch) return;
    const t = setTimeout(() => startSearch(async () => setHits(await searchPlaces(query))), 350);
    return () => clearTimeout(t);
  }, [query, canSearch]);
  // Fora do modo busca não mostra resultado velho
  const visibleHits = canSearch ? hits : [];

  const pick = (hit: PlaceHit) => {
    setPlace(hit);
    setMoment(hit.suggestedMoment);
    setError(null);
  };

  const useLink = () =>
    startSearch(async () => {
      const r = await resolveMapsLink(query);
      if ("error" in r) setError(r.error);
      else pick(r);
    });

  const reset = () => {
    setQuery("");
    setPlace(null);
    setDate("");
    setNote("");
    setError(null);
  };

  const save = () =>
    place &&
    startSave(async () => {
      const r = await addIdea({ place, moment, date: date || null, note });
      if (r.error) {
        setError(r.error);
        return;
      }
      reset();
      dialog.current?.close();
    });

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="whitespace-nowrap rounded-(--radius-control) border border-fg bg-fg px-3 py-1.5 text-sm font-medium text-surface"
      >
        + Ideia
      </button>

      <dialog
        ref={dialog}
        onClose={reset}
        aria-labelledby="add-idea-title"
        className="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-(--radius-panel) border border-border bg-surface p-5 text-fg backdrop:bg-fg/40 sm:my-auto sm:max-w-md sm:rounded-(--radius-panel) sm:p-6"
      >
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 id="add-idea-title" className="font-display text-xl font-medium">
            Nova ideia
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="text-sm text-muted hover:text-fg"
          >
            Fechar
          </button>
        </div>

        {!place ? (
          <div className="space-y-3">
            <label htmlFor="idea-query" className="block text-sm font-medium">
              Lugar ou link do Google Maps
            </label>
            <input
              id="idea-query"
              autoFocus
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setError(null);
              }}
              placeholder="Ex.: Café Tortoni"
              className={field}
            />
            {isLink(query) && (
              <button
                type="button"
                onClick={useLink}
                disabled={searching}
                className="w-full rounded-(--radius-control) border border-fg bg-fg px-4 py-2.5 font-medium text-surface disabled:opacity-60"
              >
                {searching ? "Lendo o link…" : "Usar este link"}
              </button>
            )}
            {searching && !isLink(query) && <p className="text-sm text-muted">Buscando…</p>}
            {visibleHits.length > 0 && (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-(--radius-control) border border-border">
                {visibleHits.map((h) => (
                  <li key={h.osmRef ?? `${h.lat},${h.lng}`}>
                    <button
                      type="button"
                      onClick={() => pick(h)}
                      className="block w-full px-3 py-2.5 text-left transition-[background-color] duration-150 hover:bg-sunken"
                    >
                      <span className="block font-medium">{h.name}</span>
                      <span className="block text-sm text-muted">
                        {[h.category, h.address, h.neighborhood].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!searching && !isLink(query) && query.trim().length >= 2 && visibleHits.length === 0 && (
              <p className="text-sm text-muted text-pretty">
                Nada em Buenos Aires com esse nome. Tenta outro jeito, ou cola o link do Maps.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-(--radius-control) border border-border p-3">
              <p className="font-medium">{place.name}</p>
              <p className="text-sm text-muted">
                {[place.category, place.address, place.neighborhood].filter(Boolean).join(" · ") ||
                  "Do link do Google Maps"}
              </p>
              <button
                type="button"
                onClick={() => setPlace(null)}
                className="mt-1 text-sm text-muted underline underline-offset-2 hover:text-fg"
              >
                Trocar lugar
              </button>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Para que momento?</legend>
              <div className="flex flex-wrap gap-1.5">
                {MOMENTS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={moment === m}
                    onClick={() => setMoment(m)}
                    className="rounded-full"
                  >
                    {m === "outro" ? (
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition-[background-color,color] duration-150 ${
                          moment === m ? "bg-fg text-surface" : "bg-sunken text-muted"
                        }`}
                      >
                        Sem momento
                      </span>
                    ) : (
                      <MomentChip moment={m} selected={moment === m} />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="idea-date" className="mb-1.5 block text-sm font-medium">
                Dia
              </label>
              <select
                id="idea-date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              >
                <option value="">Algum dia</option>
                {tripDays().map((d) => (
                  <option key={d} value={d}>
                    {fmtLong(d)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="idea-note" className="mb-1.5 block text-sm font-medium">
                Nota <span className="font-normal text-muted">(opcional)</span>
              </label>
              <textarea
                id="idea-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Link do reel, o que pedir, horário…"
                className={field}
              />
            </div>

            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="w-full rounded-(--radius-control) border border-fg bg-fg px-4 py-2.5 font-medium text-surface disabled:opacity-60"
            >
              {saving
                ? "Salvando…"
                : moment === "outro"
                  ? "Salvar ideia"
                  : `Salvar como ${momentLabel[moment].toLowerCase()}`}
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-pretty">
            {error}
          </p>
        )}
      </dialog>
    </>
  );
}
