-- Momentos do dia + sugestões.
--
-- "Momento" = para que a parada serve no dia (café da manhã, jantar, passeio...).
-- Fica na parada (events) e na sugestão, não no lugar: a mesma pizzaria pode
-- ser almoço num dia e jantar em outro. O que o lugar É continua em places.category.
--
-- Sugestão = um lugar NUM momento (e opcionalmente num dia). É nela que o casal
-- vota: "Kentucky como jantar de sáb 27", não "Kentucky" solto.

create type public.day_moment as enum (
  'voo', 'hospedagem', 'cafe_da_manha', 'almoco', 'lanche', 'jantar',
  'passeio', 'mercado', 'noite', 'outro'
);

-- ---------------------------------------------------------------------------
-- events: momento substitui kind
-- ---------------------------------------------------------------------------
alter table public.events add column moment public.day_moment not null default 'outro';

update public.events set moment = (case kind::text
  when 'voo' then 'voo'
  when 'hotel' then 'hospedagem'
  when 'passeio' then 'passeio'
  when 'compras' then 'mercado'
  else 'outro'
end)::public.day_moment;

alter table public.events drop column kind;
drop type public.event_kind;

grant update (moment) on table public.events to authenticated;

-- ---------------------------------------------------------------------------
-- suggestions: lugar num momento (e talvez num dia), objeto da votação
-- ---------------------------------------------------------------------------
create type public.suggestion_status as enum ('ideia', 'decidido', 'descartado');

create table public.suggestions (
  id bigint generated always as identity primary key,
  place_id bigint not null references public.places (id) on delete cascade,
  moment public.day_moment not null,
  -- nulo = "algum dia"
  date date,
  status public.suggestion_status not null default 'ideia',
  note text check (char_length(note) <= 500),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- mesmo lugar no mesmo momento do mesmo dia (ou "algum dia") só uma vez
  constraint suggestions_unique unique nulls not distinct (place_id, moment, date),
  -- voo e hospedagem não são coisas que se votam
  constraint suggestions_votable_moment check (moment not in ('voo', 'hospedagem')),
  -- só vira parada do roteiro se tiver dia
  constraint suggestions_decided_has_date check (status <> 'decidido' or date is not null)
);
create index suggestions_date_moment_idx on public.suggestions (date, moment);
create index suggestions_created_by_idx on public.suggestions (created_by);

create trigger suggestions_set_updated_at before update on public.suggestions
  for each row execute function private.set_updated_at();

revoke all on table public.suggestions from public, anon, authenticated;
grant select, insert, delete on table public.suggestions to authenticated;
-- Só a nota é editável. Momento e dia são o que se vota: mudar = apagar e sugerir
-- de novo (senão o voto passa a valer para outra coisa). O status vai ser
-- escrito só pelo trigger da votação (os dois curtiram → decidido).
grant update (note) on table public.suggestions to authenticated;

alter table public.suggestions enable row level security;
create policy "membros veem sugestões" on public.suggestions
  for select to authenticated
  using ((select private.is_member()));
create policy "membros sugerem" on public.suggestions
  for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "membros editam sugestões" on public.suggestions
  for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));
create policy "membros apagam sugestões" on public.suggestions
  for delete to authenticated
  using ((select private.is_member()));

-- O status de "ideia" saía do lugar; agora é da sugestão. Lugares que eram
-- ideia viram sugestão sem momento definido ("outro", algum dia).
insert into public.suggestions (place_id, moment, status, created_by)
select id, 'outro', status::text::public.suggestion_status, created_by
  from public.places
 where status <> 'decidido';

alter table public.places drop column status;
drop type public.place_status;

-- Parada que nasceu de uma sugestão aponta para ela
alter table public.events
  add column suggestion_id bigint references public.suggestions (id) on delete set null;
-- Uma sugestão vira no máximo uma parada (o trigger da votação usa on conflict)
create unique index events_suggestion_id_key on public.events (suggestion_id)
  where suggestion_id is not null;
grant update (suggestion_id) on table public.events to authenticated;

-- ---------------------------------------------------------------------------
-- votes: agora na sugestão. A tabela estava vazia; recria com a chave nova.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.votes) then
    raise exception 'votes não está vazia: migrar os votos antes de recriar a tabela';
  end if;
end $$;

drop table public.votes;

create table public.votes (
  suggestion_id bigint not null references public.suggestions (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value public.vote_value not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (suggestion_id, user_id)
);
create index votes_user_id_idx on public.votes (user_id);

create trigger votes_set_updated_at before update on public.votes
  for each row execute function private.set_updated_at();

revoke all on table public.votes from public, anon, authenticated;
grant select, insert, delete on table public.votes to authenticated;
grant update (value) on table public.votes to authenticated;

alter table public.votes enable row level security;
create policy "membros veem votos" on public.votes
  for select to authenticated
  using ((select private.is_member()));
create policy "membro vota por si" on public.votes
  for insert to authenticated
  with check ((select private.is_member()) and user_id = (select auth.uid()));
create policy "membro muda o próprio voto" on public.votes
  for update to authenticated
  using ((select private.is_member()) and user_id = (select auth.uid()))
  with check ((select private.is_member()) and user_id = (select auth.uid()));
create policy "membro apaga o próprio voto" on public.votes
  for delete to authenticated
  using ((select private.is_member()) and user_id = (select auth.uid()));

-- Realtime da votação (fase de ideias): sugestões e votos
alter publication supabase_realtime add table public.suggestions, public.votes;
