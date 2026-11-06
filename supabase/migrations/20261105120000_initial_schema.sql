-- Fase 2: schema inicial do painel da viagem.
--
-- Quem entra:
--   1. private.allowed_emails guarda os dois emails (inseridos fora do repo,
--      ver supabase/README.md).
--   2. O hook "Before User Created" (public.hook_before_user_created) recusa
--      cadastro de qualquer email fora da lista. Ligar no painel:
--      Authentication → Hooks → Before User Created → Postgres function.
--   3. Um trigger em auth.users cria public.profiles para quem está na lista.
--      profiles É a lista de membros: toda policy passa por private.is_member(),
--      que compara auth.uid() com profiles.id (não depende do email no JWT).

-- ---------------------------------------------------------------------------
-- Schema privado (não exposto pela Data API)
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.allowed_emails (
  email text primary key check (email = lower(btrim(email)) and email like '%_@_%'),
  created_at timestamptz not null default now()
);
alter table private.allowed_emails enable row level security;
revoke all on table private.allowed_emails from public, anon, authenticated;

-- O Auth (supabase_auth_admin, sem bypassrls) lê a lista dentro do hook
grant usage on schema private to supabase_auth_admin;
grant select on table private.allowed_emails to supabase_auth_admin;
create policy "auth lê a lista de emails"
  on private.allowed_emails for select
  to supabase_auth_admin
  using (true);

-- updated_at automático
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke execute on function private.set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hook: bloqueia cadastro de email fora da lista
-- ---------------------------------------------------------------------------
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  user_email text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if user_email is not null
     and exists (select 1 from private.allowed_emails a where a.email = user_email) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Esse email não tem acesso a este painel.'
    )
  );
end;
$$;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------------
-- profiles: os dois membros
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usuário logado é um dos dois?
create function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(((select auth.jwt() ->> 'is_anonymous'))::boolean, false) = false
     and exists (select 1 from public.profiles p where p.id = (select auth.uid()));
$$;
revoke execute on function private.is_member() from public, anon;
-- As policies rodam como authenticated, que precisa enxergar o schema e a função
grant usage on schema private to authenticated;
grant execute on function private.is_member() to authenticated;

-- Cria o profile quando um email da lista vira usuário
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.allowed_emails a where a.email = lower(btrim(new.email))) then
    insert into public.profiles (id, display_name)
    values (new.id, split_part(new.email, '@', 1))
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.place_status as enum ('ideia', 'decidido', 'descartado');
create type public.vote_value as enum ('curtiu', 'nao_curtiu', 'tanto_faz');
create type public.event_kind as enum ('voo', 'hotel', 'passeio', 'outro');
create type public.event_status as enum ('pago', 'pendente', 'ideia');
create type public.currency as enum ('BRL', 'ARS', 'USD');

-- ---------------------------------------------------------------------------
-- places: ideias de lugares
-- ---------------------------------------------------------------------------
create table public.places (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  neighborhood text check (char_length(neighborhood) <= 100),
  category text check (char_length(category) <= 50),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  url text check (char_length(url) <= 2000 and url ~* '^https?://'),
  notes text check (char_length(notes) <= 4000),
  status public.place_status not null default 'ideia',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint places_coords_together check ((lat is null) = (lng is null))
);
create index places_created_by_idx on public.places (created_by);

-- ---------------------------------------------------------------------------
-- votes: um voto por pessoa por lugar
-- ---------------------------------------------------------------------------
create table public.votes (
  place_id bigint not null references public.places (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value public.vote_value not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index votes_user_id_idx on public.votes (user_id);

-- ---------------------------------------------------------------------------
-- events: datas da viagem (voos, hotel, passeios)
-- ---------------------------------------------------------------------------
create table public.events (
  id bigint generated always as identity primary key,
  date date not null,
  time time,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  detail text check (char_length(detail) <= 1000),
  kind public.event_kind not null default 'passeio',
  status public.event_status not null default 'pendente',
  place_id bigint references public.places (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index events_date_time_idx on public.events (date, time);
create index events_place_id_idx on public.events (place_id);
create index events_created_by_idx on public.events (created_by);

-- ---------------------------------------------------------------------------
-- expenses: gastos planejados e realizados
-- ---------------------------------------------------------------------------
create table public.expenses (
  id bigint generated always as identity primary key,
  amount numeric(12, 2) not null check (amount > 0),
  currency public.currency not null default 'BRL',
  category text not null check (char_length(btrim(category)) between 1 and 50),
  description text check (char_length(description) <= 500),
  -- quem pagou; vazio só em previsão
  paid_by uuid references public.profiles (id) on delete restrict,
  spent_on date not null,
  -- dividido meio a meio entre os dois?
  is_split boolean not null default true,
  -- true = previsão (orçamento); false = gasto de verdade
  is_planned boolean not null default false,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_paid_by_when_real check (is_planned or paid_by is not null)
);
create index expenses_spent_on_idx on public.expenses (spent_on);
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expenses_created_by_idx on public.expenses (created_by);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger places_set_updated_at before update on public.places
  for each row execute function private.set_updated_at();
create trigger votes_set_updated_at before update on public.votes
  for each row execute function private.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Privilégios: nada para anon; authenticated só nas colunas editáveis
-- (id, created_by, created_at e as chaves de votes não mudam por update)
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.places, public.votes, public.events, public.expenses
  from public, anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, insert, delete on table public.places, public.votes, public.events, public.expenses
  to authenticated;
grant update (name, neighborhood, category, lat, lng, url, notes, status)
  on table public.places to authenticated;
grant update (value) on table public.votes to authenticated;
grant update (date, time, title, detail, kind, status, place_id)
  on table public.events to authenticated;
grant update (amount, currency, category, description, paid_by, spent_on, is_split, is_planned)
  on table public.expenses to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.votes enable row level security;
alter table public.events enable row level security;
alter table public.expenses enable row level security;

-- profiles: os dois se veem; cada um muda só o próprio nome
create policy "membros veem perfis" on public.profiles
  for select to authenticated
  using ((select private.is_member()));
create policy "membro edita o próprio perfil" on public.profiles
  for update to authenticated
  using ((select private.is_member()) and id = (select auth.uid()))
  with check ((select private.is_member()) and id = (select auth.uid()));

-- places: os dois veem e editam tudo; quem cria assina como si mesmo
create policy "membros veem lugares" on public.places
  for select to authenticated
  using ((select private.is_member()));
create policy "membros criam lugares" on public.places
  for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "membros editam lugares" on public.places
  for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));
create policy "membros apagam lugares" on public.places
  for delete to authenticated
  using ((select private.is_member()));

-- votes: os dois veem todos os votos; cada um só mexe no próprio
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

-- events
create policy "membros veem datas" on public.events
  for select to authenticated
  using ((select private.is_member()));
create policy "membros criam datas" on public.events
  for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "membros editam datas" on public.events
  for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));
create policy "membros apagam datas" on public.events
  for delete to authenticated
  using ((select private.is_member()));

-- expenses: quem pagou pode ser qualquer um dos dois (FK em profiles)
create policy "membros veem gastos" on public.expenses
  for select to authenticated
  using ((select private.is_member()));
create policy "membros lançam gastos" on public.expenses
  for insert to authenticated
  with check ((select private.is_member()) and created_by = (select auth.uid()));
create policy "membros editam gastos" on public.expenses
  for update to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));
create policy "membros apagam gastos" on public.expenses
  for delete to authenticated
  using ((select private.is_member()));

-- ---------------------------------------------------------------------------
-- Realtime (fase 3: votação ao vivo). RLS vale para os eventos também.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.places, public.votes;
