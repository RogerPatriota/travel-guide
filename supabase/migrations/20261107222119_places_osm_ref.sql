-- Captura de ideias: lugar vindo da busca (OpenStreetMap/Photon) guarda a
-- referência OSM ("N340141702") para não duplicar o mesmo lugar.
-- Sem grant de UPDATE: a referência só é gravada no insert e fica imutável.
alter table public.places
  add column osm_ref text check (osm_ref ~ '^[NWR][0-9]+$');

create unique index places_osm_ref_key on public.places (osm_ref) where osm_ref is not null;
