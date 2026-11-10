-- Rotas do dia: ordem das paradas, como se chega em cada uma e os trechos
-- (pelas ruas) já calculados, guardados para não depender do serviço de rotas
-- a cada visita e para funcionar offline na viagem.

-- Novos tipos de evento (não usados nesta migration: ADD VALUE só vale após o commit)
alter type public.event_kind add value if not exists 'comida';
alter type public.event_kind add value if not exists 'compras';

create type public.travel_mode as enum ('carro', 'a_pe', 'transporte', 'bicicleta');

-- ---------------------------------------------------------------------------
-- events: ordem no dia + como chegar
-- ---------------------------------------------------------------------------
alter table public.events
  add column sort_order smallint not null default 0,
  add column travel_mode public.travel_mode;

comment on column public.events.sort_order is
  'Ordem da parada dentro do dia (antes do horário, que pode ser nulo).';
comment on column public.events.travel_mode is
  'Como se chega nesta parada vindo da anterior do mesmo dia. Nulo = sem trecho desenhado.';

grant update (sort_order, travel_mode) on table public.events to authenticated;

drop index if exists public.events_date_time_idx;
create index events_date_order_idx on public.events (date, sort_order, time);

-- ---------------------------------------------------------------------------
-- route_legs: trecho entre dois lugares por um modo, calculado uma vez
-- ---------------------------------------------------------------------------
create table public.route_legs (
  id bigint generated always as identity primary key,
  from_place_id bigint not null references public.places (id) on delete cascade,
  to_place_id bigint not null references public.places (id) on delete cascade,
  mode public.travel_mode not null,
  -- coordenadas de uma LineString GeoJSON: [[lng, lat], ...]
  geometry jsonb not null check (
    jsonb_typeof(geometry) = 'array' and jsonb_array_length(geometry) between 2 and 5000
  ),
  distance_m integer not null check (distance_m >= 0),
  duration_s integer not null check (duration_s >= 0),
  -- coordenadas usadas no cálculo: se não baterem mais com o lugar, o trecho
  -- é ignorado e recalculado (cobre a corrida entre calcular e mover o lugar)
  from_lat double precision not null,
  from_lng double precision not null,
  to_lat double precision not null,
  to_lng double precision not null,
  created_at timestamptz not null default now(),
  constraint route_legs_unique unique (from_place_id, to_place_id, mode),
  constraint route_legs_distinct_places check (from_place_id <> to_place_id)
);
create index route_legs_to_place_id_idx on public.route_legs (to_place_id);

revoke all on table public.route_legs from public, anon, authenticated;
-- Sem UPDATE: trecho velho é apagado e recalculado
grant select, insert, delete on table public.route_legs to authenticated;

alter table public.route_legs enable row level security;

create policy "membros veem trechos" on public.route_legs
  for select to authenticated
  using ((select private.is_member()));
create policy "membros gravam trechos" on public.route_legs
  for insert to authenticated
  with check ((select private.is_member()));
create policy "membros apagam trechos" on public.route_legs
  for delete to authenticated
  using ((select private.is_member()));

-- Lugar mudou de posição: os trechos dele ficam velhos. Roda como quem editou
-- (membro tem DELETE em route_legs; painel/MCP rodam como postgres).
create function private.invalidate_route_legs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.route_legs
   where from_place_id = new.id or to_place_id = new.id;
  return new;
end;
$$;
revoke execute on function private.invalidate_route_legs() from public, anon, authenticated;

create trigger places_invalidate_route_legs
  after update of lat, lng on public.places
  for each row
  when (old.lat is distinct from new.lat or old.lng is distinct from new.lng)
  execute function private.invalidate_route_legs();
