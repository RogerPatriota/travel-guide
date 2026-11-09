import type { DayMoment } from "@/lib/trip";

/** Lugar encontrado na busca (Photon/OSM) ou num link do Google Maps */
export type PlaceHit = {
  /** "N340141702" quando veio do OpenStreetMap */
  osmRef: string | null;
  name: string;
  lat: number;
  lng: number;
  /** Rótulo em português do tipo de lugar ("café", "pizzaria") */
  category: string | null;
  address: string | null;
  neighborhood: string | null;
  suggestedMoment: DayMoment;
  /** Link original (Google Maps), quando a ideia veio de um */
  url: string | null;
};

// Tipo OSM (osm_value) → rótulo e momento sugerido. O que não estiver aqui vira passeio.
const KINDS: Record<string, [label: string, moment: DayMoment]> = {
  cafe: ["café", "cafe_da_manha"],
  bakery: ["padaria", "cafe_da_manha"],
  pastry: ["confeitaria", "lanche"],
  ice_cream: ["sorveteria", "lanche"],
  restaurant: ["restaurante", "jantar"],
  fast_food: ["lanchonete", "jantar"],
  food_court: ["praça de alimentação", "almoco"],
  pizza: ["pizzaria", "jantar"],
  bar: ["bar", "noite"],
  pub: ["bar", "noite"],
  biergarten: ["cervejaria", "noite"],
  nightclub: ["balada", "noite"],
  theatre: ["teatro", "noite"],
  cinema: ["cinema", "noite"],
  supermarket: ["supermercado", "mercado"],
  convenience: ["mercadinho", "mercado"],
  greengrocer: ["hortifruti", "mercado"],
  marketplace: ["feira", "passeio"],
  museum: ["museu", "passeio"],
  gallery: ["galeria", "passeio"],
  park: ["parque", "passeio"],
  garden: ["jardim", "passeio"],
  viewpoint: ["mirante", "passeio"],
  attraction: ["atração", "passeio"],
  zoo: ["zoológico", "passeio"],
  mall: ["shopping", "passeio"],
  books: ["livraria", "passeio"],
};

export function describeKind(osmValue: string | null | undefined): {
  category: string | null;
  moment: DayMoment;
} {
  if (!osmValue) return { category: null, moment: "passeio" };
  const hit = KINDS[osmValue];
  if (hit) return { category: hit[0], moment: hit[1] };
  return { category: osmValue.replaceAll("_", " "), moment: "passeio" };
}
