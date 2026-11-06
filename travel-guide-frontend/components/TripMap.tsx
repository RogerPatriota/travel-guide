"use client";

import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { trip } from "@/lib/trip";

// Estilo claro e neutro, grátis e sem chave (OpenFreeMap)
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** Lê um token de cor do CSS (as rotas usam --color-route) */
function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function TripMap() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    // Import dinâmico: maplibre só existe no browser
    import("maplibre-gl").then(({ Map, Marker, NavigationControl }) => {
      if (disposed || !container.current) return;

      const map = new Map({
        container: container.current,
        style: STYLE_URL,
        center: [trip.stay.lng, trip.stay.lat],
        zoom: 12.6,
        attributionControl: { compact: true },
      });
      map.addControl(new NavigationControl({ showCompass: false }), "top-right");

      const pin = document.createElement("div");
      pin.className = "trip-pin";
      pin.setAttribute("aria-label", trip.stay.label);
      pin.style.cssText = `width:18px;height:18px;border-radius:9999px;background:${token(
        "--color-route",
      )};border:3px solid ${token("--color-surface")};box-shadow:0 0 0 1px ${token("--color-route")}`;
      new Marker({ element: pin }).setLngLat([trip.stay.lng, trip.stay.lat]).addTo(map);

      cleanup = () => map.remove();
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={container} className="absolute inset-0" />;
}
