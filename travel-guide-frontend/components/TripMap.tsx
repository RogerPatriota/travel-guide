"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Leg, MapData, MapPin, MapStop } from "@/lib/data";
import { trip, type ISODate } from "@/lib/trip";

// Estilo claro e neutro, grátis e sem chave (OpenFreeMap)
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const DEFAULT_ZOOM = 12.6;

type MapLib = typeof import("maplibre-gl");

/** Lê um token de cor do CSS (rotas e pins usam --color-route) */
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Carro e bike: linha cheia · a pé: pontilhada · transporte ou sem rota: tracejada fina */
function legStyle(leg: Leg) {
  if (leg.approximate || leg.mode === "transporte") return "approx";
  return leg.mode === "a_pe" ? "dotted" : "solid";
}

function legsGeoJSON(legs: Leg[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: legs.map((leg) => ({
      type: "Feature",
      properties: { style: legStyle(leg) },
      geometry: { type: "LineString", coordinates: leg.coordinates },
    })),
  };
}

function pinElement(label: string, content: string | null) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("aria-label", label);
  el.title = label;
  const route = token("--color-route");
  const surface = token("--color-surface");
  if (content === null) {
    // Hospedagem: anel verde com miolo claro
    el.style.cssText = `width:20px;height:20px;border-radius:9999px;background:${surface};border:5px solid ${route};box-shadow:0 0 0 2px ${surface};cursor:pointer`;
  } else if (content === "") {
    // Visão de todos os dias: ponto sem número
    el.style.cssText = `width:16px;height:16px;border-radius:9999px;background:${route};border:2px solid ${surface};box-shadow:0 0 0 1px ${route};cursor:pointer;padding:0`;
  } else {
    el.textContent = content;
    el.style.cssText = `width:26px;height:26px;border-radius:9999px;background:${route};color:${surface};border:2px solid ${surface};box-shadow:0 0 0 1px ${route};font:600 12px/22px var(--font-mono);text-align:center;cursor:pointer;padding:0`;
  }
  return el;
}

function popupContent(title: string, sub?: string) {
  const root = document.createElement("div");
  const strong = document.createElement("p");
  strong.className = "font-medium";
  strong.textContent = title;
  root.append(strong);
  if (sub) {
    const small = document.createElement("p");
    small.className = "text-muted";
    small.textContent = sub;
    root.append(small);
  }
  return root;
}

export function TripMap({ data, selected }: { data: MapData | null; selected: ISODate | "all" }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [ready, setReady] = useState(false);

  // Cria o mapa uma vez
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    // Import dinâmico: maplibre só existe no browser
    import("maplibre-gl").then((lib) => {
      if (disposed || !container.current) return;
      libRef.current = lib;

      // Worker servido de public/vendor (ver scripts/copy-maplibre-worker.mjs); ?v= evita cache velho ao atualizar
      lib.setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${lib.getVersion()}`);

      const map = new lib.Map({
        container: container.current,
        style: STYLE_URL,
        center: [trip.center.lng, trip.center.lat],
        zoom: DEFAULT_ZOOM,
        attributionControl: { compact: true },
      });
      map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        const route = token("--color-route");
        const surface = token("--color-surface");
        map.addSource("legs", { type: "geojson", data: legsGeoJSON([]) });
        // Contorno claro por baixo: a rota não some sobre as ruas brancas do positron
        map.addLayer({
          id: "legs-casing",
          type: "line",
          source: "legs",
          filter: ["!=", ["get", "style"], "approx"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": surface, "line-width": 8 },
        });
        map.addLayer({
          id: "legs-solid",
          type: "line",
          source: "legs",
          filter: ["==", ["get", "style"], "solid"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": route, "line-width": 4 },
        });
        map.addLayer({
          id: "legs-dotted",
          type: "line",
          source: "legs",
          filter: ["==", ["get", "style"], "dotted"],
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": route, "line-width": 4, "line-dasharray": [0, 1.8] },
        });
        map.addLayer({
          id: "legs-approx",
          type: "line",
          source: "legs",
          filter: ["==", ["get", "style"], "approx"],
          layout: { "line-cap": "round" },
          paint: { "line-color": route, "line-width": 2.5, "line-opacity": 0.7, "line-dasharray": [2, 2] },
        });
        mapRef.current = map;
        setReady(true);
      });

      cleanup = () => {
        mapRef.current = null;
        map.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  // Desenha paradas e trechos do dia escolhido
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const allDays = selected === "all";
    const legs = data ? data.legs.filter((l) => allDays || l.date === selected) : [];
    (map.getSource("legs") as import("maplibre-gl").GeoJSONSource | undefined)?.setData(
      legsGeoJSON(legs),
    );

    const points: [number, number][] = [];
    const shown = new Set<number>();
    const add = (pin: MapPin, el: HTMLElement, popup: HTMLElement) => {
      const marker = new lib.Marker({ element: el })
        .setLngLat([pin.lng, pin.lat])
        .setPopup(new lib.Popup({ offset: 16, closeButton: false }).setDOMContent(popup))
        .addTo(map);
      markersRef.current.push(marker);
      points.push([pin.lng, pin.lat]);
      shown.add(pin.placeId);
    };

    if (data) {
      if (allDays) {
        // Visão geral: um pin por lugar, sem número (cada dia tem a sua ordem)
        const unique = new Map<number, MapStop>();
        Object.values(data.stops).forEach((day) => day?.forEach((s) => unique.set(s.placeId, s)));
        unique.forEach((s) => {
          if (data.stays.some((st) => st.placeId === s.placeId)) return;
          add(s, pinElement(s.name, ""), popupContent(s.name));
        });
      } else {
        (data.stops[selected] ?? []).forEach((s, i) => {
          const label = `${i + 1}. ${s.title}`;
          add(s, pinElement(label, String(i + 1)), popupContent(label, s.time));
        });
      }
      // Hospedagem sempre aparece, a menos que já seja uma parada numerada do dia
      data.stays.forEach((st) => {
        if (shown.has(st.placeId)) return;
        add(st, pinElement(st.name, null), popupContent(st.name, "Hospedagem"));
      });
    }

    legs.forEach((l) => points.push(...l.coordinates));
    // Trocar de dia muda a altura da lista ao lado e, com ela, a do mapa. O
    // MapLibre só percebe isso depois (ResizeObserver), então o enquadramento
    // sairia com o tamanho antigo. Mede agora, antes de enquadrar.
    map.resize();
    const duration = reducedMotion() ? 0 : 600;
    if (points.length >= 2) {
      const bounds = points.reduce(
        (b, p) => b.extend(p),
        new lib.LngLatBounds(points[0], points[0]),
      );
      map.fitBounds(bounds, { padding: 56, maxZoom: 16, duration });
    } else if (points.length === 1) {
      map.easeTo({ center: points[0], zoom: 14.5, duration });
    } else {
      map.easeTo({ center: [trip.center.lng, trip.center.lat], zoom: DEFAULT_ZOOM, duration });
    }
  }, [ready, data, selected]);

  // O CSS do MapLibre põe `position: relative` em .maplibregl-map, e por não estar
  // em @layer ele vence os utilitários do Tailwind. Por isso o `absolute` fica num
  // wrapper e o mapa só ocupa 100% dele.
  return (
    <div className="absolute inset-0">
      <div ref={container} className="size-full" />
    </div>
  );
}
