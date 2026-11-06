-- Teste de fumaça do RLS, dos grants e do hook de cadastro.
--
-- Roda numa transação e SEMPRE termina com RAISE EXCEPTION: a mensagem traz
-- "OK (n checagens)" ou a lista do que falhou, e nada fica gravado.
-- Uso: colar no SQL Editor (ou MCP execute_sql) com o schema já aplicado.

begin;

create temp table t_results (name text, got text, expected text);
grant all on t_results to authenticated, anon;

-- Executa um SQL e devolve 'ok' ou o SQLSTATE do erro
create function pg_temp.try(q text) returns text language plpgsql as $$
begin
  execute q;
  return 'ok';
exception when others then
  return sqlstate;
end $$;

-- Executa um SQL que devolve um número (ex.: count de linhas afetadas)
create function pg_temp.num(q text) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n;
  return n::text;
exception when others then
  return sqlstate;
end $$;

create function pg_temp.chk(name text, got text, expected text) returns void
language sql as $$ insert into pg_temp.t_results values (name, got, expected) $$;

grant execute on all functions in schema pg_temp to authenticated, anon;

-- SQLSTATEs: 42501 sem permissão/RLS · 23503 FK · 23514 check

-- ---------------------------------------------------------------------------
-- Setup (como postgres)
-- ---------------------------------------------------------------------------
insert into private.allowed_emails (email) values ('membro1@teste.local'), ('membro2@teste.local');
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'membro1@teste.local'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'Membro2@Teste.local'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'intruso@teste.local');

select pg_temp.chk('trigger cria profiles só para a lista',
  (select string_agg(display_name, ',' order by display_name collate "C") from public.profiles
    where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b1')),
  'Membro2,membro1');

-- ---------------------------------------------------------------------------
-- Hook. O SQL Editor não pode virar supabase_auth_admin, então a lógica roda
-- como postgres e os privilégios de que o Auth depende são checados à parte
-- (a policy "auth lê a lista de emails" cobre o RLS de allowed_emails).
-- ---------------------------------------------------------------------------
select pg_temp.chk('hook aceita membro (espaços/maiúsculas)',
  public.hook_before_user_created('{"user":{"email":" Membro1@Teste.local "}}')::text, '{}');
select pg_temp.chk('hook recusa intruso',
  public.hook_before_user_created('{"user":{"email":"intruso@teste.local"}}') -> 'error' ->> 'http_code', '403');
select pg_temp.chk('hook recusa sem email',
  public.hook_before_user_created('{"user":{}}') -> 'error' ->> 'http_code', '403');
select pg_temp.chk('auth_admin: execute hook / usage private / select allowed_emails / policy',
  concat_ws(',',
    has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
    has_schema_privilege('supabase_auth_admin', 'private', 'usage'),
    has_table_privilege('supabase_auth_admin', 'private.allowed_emails', 'select'),
    exists (select 1 from pg_policies where schemaname = 'private' and tablename = 'allowed_emails'
            and 'supabase_auth_admin' = any (roles) and cmd = 'SELECT')),
  't,t,t,t');
select pg_temp.chk('auth_admin não tem bypassrls (policy é necessária)',
  (select rolbypassrls::text from pg_roles where rolname = 'supabase_auth_admin'), 'false');

-- ---------------------------------------------------------------------------
-- Membro 1
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select pg_temp.chk('m1 cria lugar', pg_temp.try($q$ insert into public.places (name) values ('Lugar teste') $q$), 'ok');
select pg_temp.chk('m1 vota', pg_temp.try($q$ insert into public.votes (place_id, value) select id, 'curtiu' from public.places where name = 'Lugar teste' $q$), 'ok');
select pg_temp.chk('m1 cria data', pg_temp.try($q$ insert into public.events (date, title, kind, status) values ('2027-02-27', 'Voo teste', 'voo', 'pago') $q$), 'ok');
select pg_temp.chk('m1 lança gasto pago por m2', pg_temp.try($q$ insert into public.expenses (amount, category, paid_by, spent_on) values (10, 'comida', '00000000-0000-0000-0000-0000000000a2', '2027-02-28') $q$), 'ok');
select pg_temp.chk('m1 lança previsão sem pagador', pg_temp.try($q$ insert into public.expenses (amount, category, spent_on, is_planned) values (500, 'passeios', '2027-03-01', true) $q$), 'ok');
select pg_temp.chk('gasto real sem pagador', pg_temp.try($q$ insert into public.expenses (amount, category, spent_on) values (5, 'café', '2027-03-01') $q$), '23514');
select pg_temp.chk('gasto pago por intruso', pg_temp.try($q$ insert into public.expenses (amount, category, paid_by, spent_on) values (5, 'café', '00000000-0000-0000-0000-0000000000b1', '2027-03-01') $q$), '23503');
select pg_temp.chk('url javascript:', pg_temp.try($q$ insert into public.places (name, url) values ('x', 'javascript:alert(1)') $q$), '23514');
select pg_temp.chk('m1 vota como m2', pg_temp.try($q$ insert into public.votes (place_id, user_id, value) select id, '00000000-0000-0000-0000-0000000000a2', 'curtiu' from public.places $q$), '42501');
select pg_temp.chk('m1 cria lugar assinando como m2', pg_temp.try($q$ insert into public.places (name, created_by) values ('Forjado', '00000000-0000-0000-0000-0000000000a2') $q$), '42501');
select pg_temp.chk('m1 troca created_by num update', pg_temp.try($q$ update public.places set created_by = '00000000-0000-0000-0000-0000000000a2' $q$), '42501');
select pg_temp.chk('m1 troca place_id do voto', pg_temp.try($q$ update public.votes set place_id = place_id $q$), '42501');
select pg_temp.chk('m1 muda nome de m2 (linhas)', pg_temp.num($q$ with u as (update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-0000000000a2' returning 1) select count(*) from u $q$), '0');
select pg_temp.chk('m1 muda o próprio nome (linhas)', pg_temp.num($q$ with u as (update public.profiles set display_name = 'Eu' where id = '00000000-0000-0000-0000-0000000000a1' returning 1) select count(*) from u $q$), '1');
select pg_temp.chk('m1 vê (profiles,places,votes,events,expenses)',
  concat_ws(',', (select count(*) from public.profiles), (select count(*) from public.places), (select count(*) from public.votes), (select count(*) from public.events), (select count(*) from public.expenses)),
  '2,1,1,1,2');

-- JWT anônimo com o sub de um membro não passa
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated","is_anonymous":true}', true);
select pg_temp.chk('sessão anônima vê lugares', (select count(*)::text from public.places), '0');

-- ---------------------------------------------------------------------------
-- Membro 2
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select pg_temp.chk('m2 vê lugares', (select count(*)::text from public.places), '1');
select pg_temp.chk('m2 altera voto de m1 (linhas)', pg_temp.num($q$ with u as (update public.votes set value = 'nao_curtiu' where user_id = '00000000-0000-0000-0000-0000000000a1' returning 1) select count(*) from u $q$), '0');
select pg_temp.chk('m2 apaga voto de m1 (linhas)', pg_temp.num($q$ with u as (delete from public.votes where user_id = '00000000-0000-0000-0000-0000000000a1' returning 1) select count(*) from u $q$), '0');
select pg_temp.chk('m2 edita lugar de m1 (linhas)', pg_temp.num($q$ with u as (update public.places set notes = 'editado por m2' returning 1) select count(*) from u $q$), '1');
select pg_temp.chk('apagar lugar (linhas)', pg_temp.num($q$ with d as (delete from public.places returning 1) select count(*) from d $q$), '1');
select pg_temp.chk('votos do lugar apagado somem', (select count(*)::text from public.votes), '0');

-- ---------------------------------------------------------------------------
-- Intruso (tem sessão, mas não é membro)
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","email":"membro1@teste.local","role":"authenticated"}', true);
select pg_temp.chk('intruso (mesmo com email de membro no JWT) vê',
  concat_ws(',', (select count(*) from public.profiles), (select count(*) from public.events), (select count(*) from public.expenses)), '0,0,0');
select pg_temp.chk('intruso cria lugar', pg_temp.try($q$ insert into public.places (name) values ('Invasão') $q$), '42501');
select pg_temp.chk('authenticated lê allowed_emails', pg_temp.try($q$ select 1 from private.allowed_emails $q$), '42501');

-- ---------------------------------------------------------------------------
-- Anônimo (sem login)
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.chk('anon lê places', pg_temp.try($q$ select 1 from public.places $q$), '42501');
select pg_temp.chk('anon lê profiles', pg_temp.try($q$ select 1 from public.profiles $q$), '42501');
select pg_temp.chk('anon chama is_member', pg_temp.try($q$ select private.is_member() $q$), '42501');
select pg_temp.chk('anon chama o hook', pg_temp.try($q$ select public.hook_before_user_created('{}') $q$), '42501');
reset role;

-- ---------------------------------------------------------------------------
-- Resultado
-- ---------------------------------------------------------------------------
do $$
declare
  failures text;
  total int;
begin
  select count(*) into total from pg_temp.t_results;
  select string_agg(format('%s: veio %s, esperado %s', name, coalesce(got, 'null'), expected), E'\n')
    into failures
    from pg_temp.t_results
   where got is distinct from expected;
  if failures is null then
    raise exception 'OK (% checagens)', total;
  else
    raise exception E'FALHOU\n%', failures;
  end if;
end $$;

rollback;
