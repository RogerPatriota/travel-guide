-- Roteiro: encaixar ideias nos blocos do dia (dia × momento).
--
-- place_idea(origem, dia, momento): cria a sugestão "lugar naquele momento
-- daquele dia" (ou reaproveita, se já existe), já com o "curti" de quem
-- encaixou, e remove a origem (o card sai da lista ou do bloco antigo).
-- unplace_idea(id): devolve um card do dia para a lista ("algum dia").
-- As duas são SECURITY INVOKER: RLS e grants de quem chama continuam valendo.

create function public.place_idea(p_source bigint, p_date date, p_moment public.day_moment)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  src public.suggestions;
  target bigint;
begin
  select * into src from public.suggestions where id = p_source;
  if not found then
    raise exception 'sugestão % não encontrada', p_source using errcode = 'P0002';
  end if;

  -- Parada já paga não se move (ficaria órfã no dia antigo)
  if exists (select 1 from public.events where suggestion_id = src.id and status = 'pago') then
    raise exception 'parada já paga não pode sair do dia' using errcode = 'P0001';
  end if;

  insert into public.suggestions (place_id, moment, date, note)
  values (src.place_id, p_moment, p_date, src.note)
  on conflict on constraint suggestions_unique do nothing
  returning id into target;

  if target is null then
    select id into target from public.suggestions
     where place_id = src.place_id and moment = p_moment and date is not distinct from p_date;
  end if;

  -- Quem encaixa já conta como "curti"; o outro só confirma
  insert into public.votes (suggestion_id, value) values (target, 'curtiu')
  on conflict (suggestion_id, user_id) do update set value = 'curtiu';

  -- O card saiu de onde estava (lista ou outro bloco). Parada já paga fica.
  if src.id <> target then
    delete from public.events where suggestion_id = src.id and status <> 'pago';
    delete from public.suggestions where id = src.id;
  end if;

  return target;
end;
$$;

create function public.unplace_idea(p_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  src public.suggestions;
  target bigint;
begin
  select * into src from public.suggestions where id = p_id;
  if not found or src.date is null then
    return p_id; -- já está na lista
  end if;

  -- Parada já paga não se move (ficaria órfã no dia antigo)
  if exists (select 1 from public.events where suggestion_id = src.id and status = 'pago') then
    raise exception 'parada já paga não pode sair do dia' using errcode = 'P0001';
  end if;

  insert into public.suggestions (place_id, moment, date, note)
  values (src.place_id, src.moment, null, src.note)
  on conflict on constraint suggestions_unique do nothing
  returning id into target;
  if target is null then
    select id into target from public.suggestions
     where place_id = src.place_id and moment = src.moment and date is null;
  end if;

  delete from public.events where suggestion_id = src.id and status <> 'pago';
  delete from public.suggestions where id = src.id;
  return target;
end;
$$;

revoke execute on function public.place_idea(bigint, date, public.day_moment) from public, anon;
revoke execute on function public.unplace_idea(bigint) from public, anon;
grant execute on function public.place_idea(bigint, date, public.day_moment) to authenticated;
grant execute on function public.unplace_idea(bigint) to authenticated;

-- Parada decidida entra na posição do momento no dia (café → passeio →
-- almoço → lanche → mercado → jantar → noite), não no fim.
create or replace function private.moment_rank(m public.day_moment)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case m
    when 'cafe_da_manha' then 10 when 'passeio' then 20 when 'almoco' then 30
    when 'lanche' then 40 when 'mercado' then 50 when 'jantar' then 60
    when 'noite' then 70 else 80 end)::smallint;
$$;
revoke execute on function private.moment_rank(public.day_moment) from public, anon, authenticated;

create or replace function private.resolve_suggestion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid bigint := coalesce(new.suggestion_id, old.suggestion_id);
  required int;
  total int;
  likes int;
  vetoes int;
  next_status public.suggestion_status;
  s record;
begin
  perform 1 from public.suggestions where id = sid for no key update;
  if not found then
    return null;
  end if;

  select greatest(count(*), 2) into required from private.allowed_emails;
  select count(*),
         count(*) filter (where value = 'curtiu'),
         count(*) filter (where value = 'nao_curtiu')
    into total, likes, vetoes
    from public.votes
   where suggestion_id = sid;

  next_status := case
    when total >= required and vetoes > 0 then 'descartado'
    when total >= required and likes > 0 then 'decidido'
    else 'ideia'
  end;

  select su.*, p.name as place_name
    into s
    from public.suggestions su
    join public.places p on p.id = su.place_id
   where su.id = sid;
  if not found then
    return null;
  end if;
  if next_status = 'decidido' and s.date is null then
    next_status := 'ideia';
  end if;

  if s.status is distinct from next_status then
    update public.suggestions set status = next_status where id = sid;
  end if;

  if next_status = 'decidido' then
    insert into public.events as ev
      (date, title, moment, place_id, suggestion_id, status, sort_order, created_by)
    values (s.date, s.place_name, s.moment, s.place_id, sid, 'pendente',
            private.moment_rank(s.moment), s.created_by)
    on conflict (suggestion_id) where suggestion_id is not null
    do update set status = 'pendente'
     where ev.status = 'ideia';
  elsif next_status = 'descartado' then
    delete from public.events where suggestion_id = sid and status <> 'pago';
  else
    update public.events set status = 'ideia' where suggestion_id = sid and status = 'pendente';
  end if;

  return null;
end;
$$;
