-- Votação: cada voto recalcula o status da sugestão e mexe no roteiro.
--
-- Regra (com N = número de emails da lista, hoje 2):
--   * todos votaram, ninguém "não curtiu" e alguém "curtiu"  → decidido
--   * todos votaram e alguém "não curtiu" (veto)             → descartado
--   * faltando voto, ou todo mundo "tanto faz"               → ideia
-- Mudar o voto recalcula. Efeito no roteiro (events):
--   * decidido   → cria a parada no fim do dia (ou marca a já ligada como pendente)
--   * descartado → tira do roteiro a parada ligada (se ainda não foi paga)
--   * ideia      → parada ligada, se houver, volta para "ideia"
-- SECURITY DEFINER porque o status da sugestão não é editável pelos membros
-- (só este trigger escreve "decidido"); mexe apenas na sugestão do voto.

create function private.resolve_suggestion()
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
  -- Trava a sugestão antes de contar: se os dois votam ao mesmo tempo, o
  -- segundo espera o primeiro e enxerga os dois votos. "no key update" não
  -- conflita com o key share que a FK do voto já segura (sem deadlock).
  perform 1 from public.suggestions where id = sid for no key update;
  if not found then
    return null; -- sugestão apagada (cascade): nada a recalcular
  end if;

  -- Casal: nunca menos de 2 votos para decidir
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

  -- Sem dia não dá para entrar no roteiro: fica como ideia até ganhar um dia
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
    -- Parada nova entra no fim do dia; se já existe (ligada antes), só confirma
    insert into public.events as ev
      (date, title, moment, place_id, suggestion_id, status, sort_order, created_by)
    select s.date, s.place_name, s.moment, s.place_id, sid, 'pendente',
           coalesce(max(e.sort_order), 0) + 1, s.created_by
      from public.events e
     where e.date = s.date
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
revoke execute on function private.resolve_suggestion() from public, anon, authenticated;

create trigger votes_resolve_suggestion
  after insert or update of value or delete on public.votes
  for each row execute function private.resolve_suggestion();

-- O roteiro muda por causa do voto do outro: os dois veem ao vivo
alter publication supabase_realtime add table public.events;
