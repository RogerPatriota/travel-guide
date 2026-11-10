"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MomentChip } from "@/components/MomentChip";
import { TripMap } from "@/components/TripMap";
import { VoteButtons } from "@/components/VoteButtons";
import type { MapData, MapPin } from "@/lib/data";
import type { IdeaDetail } from "@/lib/ideas";
import type { PlaceExtras, Video } from "@/lib/place-extras";
import { fmtLong, tripDays } from "@/lib/trip";

// Extras já buscados nesta aba: voltar para uma ideia não busca de novo.
// Só guarda resposta sem erro, para um tropeço de rede não ficar preso aqui.
const cache = new Map<number, PlaceExtras>();

type Loaded = { id: number; data: PlaceExtras | "erro" };

function useExtras(id: number) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (cache.has(id)) return;
    const abort = new AbortController();
    fetch(`/api/ideias/detalhes?id=${id}`, { signal: abort.signal })
      .then((r) => (r.ok ? (r.json() as Promise<PlaceExtras>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (data.osm.state !== "erro" && data.videos.state !== "erro") cache.set(id, data);
        setLoaded({ id, data });
      })
      .catch(() => {
        if (!abort.signal.aborted) setLoaded({ id, data: "erro" });
      });
    return () => abort.abort();
  }, [id, attempt]);

  const current = cache.get(id) ?? (loaded?.id === id ? loaded.data : null);
  return {
    extras: current === "erro" ? null : current,
    failed: current === "erro",
    retry: () => {
      setLoaded(null);
      setAttempt((n) => n + 1);
    },
  };
}

const link = "underline underline-offset-2 hover:text-fg";
const heading = "text-sm font-medium";

const fmtDistance = (m: number) =>
  m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** A nota costuma ter o link do reel: vira link clicável */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={`${link} break-all`}>
            {hostOf(part)}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </>
  );
}

export function IdeaDetails({
  idea,
  partnerName,
  stays,
  onClose,
}: {
  idea: IdeaDetail;
  partnerName: string | null;
  stays: MapPin[];
  onClose: () => void;
}) {
  const { extras, failed, retry } = useExtras(idea.id);
  const osm = extras?.osm.state === "ok" ? extras.osm.data : null;
  const wiki = extras?.wiki ?? null;

  // O mapa do dia serve aqui: a hospedagem e este lugar como única parada
  const mapDay = idea.date ?? tripDays()[0];
  const { id, placeId, name, lat, lng, moment, status } = idea;
  const mapData = useMemo<MapData | null>(
    () =>
      lat === null || lng === null
        ? null
        : {
            stays,
            stops: {
              [mapDay]: [
                { placeId, name, lat, lng, eventId: id, title: name, moment, pending: status !== "decidido" },
              ],
            },
            legs: [],
          },
    [stays, mapDay, id, placeId, name, lat, lng, moment, status],
  );

  const infoStatus = failed
    ? "Não consegui buscar horário e contato agora."
    : !extras
      ? "Buscando horário, contato e vídeos…"
      : extras.osm.state === "vazio"
        ? "Esse lugar não está no OpenStreetMap, então fico sem horário e contato."
        : extras.osm.state === "erro"
          ? "O OpenStreetMap não respondeu."
          : osm && osm.hours.length === 0 && osm.phones.length === 0 && !osm.website
            ? "O OpenStreetMap conhece o lugar, mas sem horário nem contato."
            : null;

  const address = osm?.address ?? idea.address;
  const area = osm?.area && osm.area !== idea.neighborhood ? osm.area : null;
  // O link salvo pode ser do Google (veio de um link colado) ou de outro site (seed, OSM).
  // Só vale como "Google Maps" se for mesmo do Google; senão monto a busca de lá.
  const savedHost = idea.url ? hostOf(idea.url) : "";
  const savedIsGoogle = /(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/.test(savedHost);
  const shortAddress = address && address.length <= 60 ? address : null;
  const mapsUrl = savedIsGoogle
    ? idea.url
    : shortAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${shortAddress}, Buenos Aires`)}`
      : lat !== null && lng !== null
        ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
        : null;
  const otherSavedUrl = idea.url && !savedIsGoogle && !savedHost.endsWith("openstreetmap.org") ? idea.url : null;

  return (
    <aside
      aria-labelledby="idea-details-title"
      className="rounded-(--radius-panel) border border-border bg-surface lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto"
    >
      <div className="space-y-5 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {moment !== "outro" && <MomentChip moment={moment} />}
            <h2 id="idea-details-title" className="mt-1.5 font-display text-xl font-medium text-balance break-words">
              {name}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {[idea.neighborhood, idea.category].filter(Boolean).join(" · ") || "Buenos Aires"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm text-muted underline underline-offset-2 hover:text-fg"
          >
            Fechar
          </button>
        </header>

        {wiki?.image && (
          <figure>
            {/* Foto da Wikimedia: host externo, sem passar pelo otimizador do Next */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wiki.image.src}
              alt={`Foto de ${name}`}
              width={wiki.image.width}
              height={wiki.image.height}
              loading="lazy"
              className="h-44 w-full rounded-(--radius-control) bg-sunken object-cover"
            />
            <figcaption className="mt-1 text-xs text-muted">Foto: Wikimedia Commons</figcaption>
          </figure>
        )}

        <section aria-label="Plano" className="space-y-2">
          <p className="text-sm">
            {idea.date ? fmtLong(idea.date) : "Algum dia"}
            <span className="text-muted">
              {" · "}
              {status === "decidido"
                ? "entrou no roteiro"
                : status === "descartado"
                  ? "descartada por um dos dois"
                  : "em votação"}
            </span>
          </p>
          {idea.note && (
            <p className="text-sm text-pretty break-words">
              <NoteText text={idea.note} />
            </p>
          )}
          <p className="text-xs text-muted">
            {idea.suggestedBy ? `Sugerido por ${idea.suggestedBy}` : "Sugestão da pesquisa"}
          </p>
          {status === "ideia" && (
            <VoteButtons
              key={id}
              suggestionId={id}
              placeName={name}
              myVote={idea.myVote}
              partnerVote={idea.partnerVote}
              partnerName={partnerName}
            />
          )}
        </section>

        {wiki && (
          <section aria-labelledby="idea-about">
            <h3 id="idea-about" className={heading}>
              Sobre
            </h3>
            <p className="mt-1 text-sm text-pretty">{wiki.extract}</p>
            <p className="mt-1 text-xs text-muted">
              <a href={wiki.url} target="_blank" rel="noopener noreferrer" className={link}>
                Ler na Wikipedia
              </a>
              {wiki.lang !== "pt" && (wiki.lang === "es" ? " (em espanhol)" : " (em inglês)")}
            </p>
          </section>
        )}

        <section aria-labelledby="idea-info">
          <h3 id="idea-info" className={heading}>
            Informações
          </h3>
          <dl className="mt-2 grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            {address && <Row label="Endereço">{address}</Row>}
            {area && <Row label="Região">{area}</Row>}
            {idea.metersFromStay !== null && (
              <Row label="Distância">
                <span className="tabular">{fmtDistance(idea.metersFromStay)}</span> da hospedagem, em linha reta
                {idea.metersFromStay <= 1200 && ". Dá pra ir a pé"}
              </Row>
            )}
            {osm && osm.hours.length > 0 && (
              <Row label="Horário">
                <ul>
                  {osm.hours.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </Row>
            )}
            {osm?.cuisine && <Row label="Cozinha">{osm.cuisine}</Row>}
            {osm && osm.phones.length > 0 && (
              <Row label="Telefone">
                {osm.phones.map((phone, i) => (
                  <span key={phone}>
                    {i > 0 && " · "}
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className={`${link} tabular`}>
                      {phone}
                    </a>
                  </span>
                ))}
              </Row>
            )}
            {osm?.website && (
              <Row label="Site">
                <a href={osm.website} target="_blank" rel="noopener noreferrer" className={link}>
                  {hostOf(osm.website)}
                </a>
              </Row>
            )}
            {osm?.instagram && (
              <Row label="Instagram">
                <a href={osm.instagram} target="_blank" rel="noopener noreferrer" className={link}>
                  @{osm.instagram.replace(/^.*instagram\.com\//, "").replace(/\/$/, "")}
                </a>
              </Row>
            )}
          </dl>

          {osm && osm.facts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {osm.facts.map((fact) => (
                <li key={fact} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-muted">
                  {fact}
                </li>
              ))}
            </ul>
          )}

          {/* Sempre no DOM (aria-live); sem mensagem, não ocupa espaço */}
          <p className={infoStatus ? "mt-3 text-sm text-muted text-pretty" : "sr-only"} aria-live="polite">
            {infoStatus}
            {(failed || extras?.osm.state === "erro") && (
              <>
                {" "}
                <button type="button" onClick={retry} className={link}>
                  Tentar de novo
                </button>
              </>
            )}
          </p>
        </section>

        {mapData && (
          <div className="relative h-52 overflow-hidden rounded-(--radius-panel) border border-border bg-sunken">
            <TripMap data={mapData} selected={mapDay} />
          </div>
        )}

        {extras && extras.videos.state !== "pulado" && (
          <Videos key={id} name={name} videos={extras.videos} searchUrl={extras.youtubeSearchUrl} />
        )}

        <footer className="space-y-1 border-t border-border pt-4 text-sm">
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={link}>
                Abrir no Google Maps
              </a>
            )}
            {osm && (
              <a href={osm.osmUrl} target="_blank" rel="noopener noreferrer" className={link}>
                Ver no OpenStreetMap
              </a>
            )}
            {otherSavedUrl && (
              <a href={otherSavedUrl} target="_blank" rel="noopener noreferrer" className={link}>
                {savedHost}
              </a>
            )}
          </p>
          <p className="text-xs text-muted">
            Dados: © colaboradores do OpenStreetMap{wiki && ", Wikipedia"}
            {extras?.videos.state === "ok" && ", YouTube"}.
          </p>
        </footer>
      </div>
    </aside>
  );
}

function Videos({
  name,
  videos,
  searchUrl,
}: {
  name: string;
  videos: Exclude<PlaceExtras["videos"], { state: "pulado" }>;
  searchUrl: string;
}) {
  const [playing, setPlaying] = useState<Video | null>(null);
  const list = videos.state === "ok" ? videos.data : [];

  return (
    <section aria-labelledby="idea-videos">
      <h3 id="idea-videos" className={heading}>
        Vídeos
      </h3>

      {playing && (
        <iframe
          title={playing.title}
          src={`https://www.youtube-nocookie.com/embed/${playing.id}?autoplay=1`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="mt-2 aspect-video w-full rounded-(--radius-control) bg-sunken"
        />
      )}

      {list.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-3">
          {list.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                aria-pressed={playing?.id === v.id}
                onClick={() => setPlaying(v)}
                className="group block w-full rounded-(--radius-control) text-left"
              >
                {/* Miniatura do YouTube: host externo, sem passar pelo otimizador do Next */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                  alt=""
                  width={320}
                  height={180}
                  loading="lazy"
                  className={`aspect-video w-full rounded-(--radius-control) border bg-sunken object-cover transition-[border-color] duration-150 ${
                    playing?.id === v.id ? "border-fg" : "border-border group-hover:border-muted"
                  }`}
                />
                <span className="mt-1 line-clamp-2 block text-sm">{v.title}</span>
                <span className="block truncate text-xs text-muted">
                  {[v.channel, v.year].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-sm text-muted text-pretty">
        {videos.state === "sem_chave" && "A busca de vídeos ainda não foi ligada (falta a chave do YouTube). "}
        {videos.state === "vazio" && `Nenhum vídeo achado com "${name}". `}
        {videos.state === "erro" && "O YouTube não respondeu agora. "}
        <a href={searchUrl} target="_blank" rel="noopener noreferrer" className={link}>
          {list.length > 0 ? "Ver mais no YouTube" : "Buscar no YouTube"}
        </a>
      </p>
    </section>
  );
}
