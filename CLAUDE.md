# travel-guide

Painel privado para um casal (Roger e Nathalia) planejar e acompanhar a viagem a **Buenos Aires, de 27/02 a 07/03/2027**, com hospedagem num Airbnb em **Palermo**. Só os dois usam. Não é produto comercial (por enquanto). Converse e escreva a interface em **português (pt-BR)**.

## Fatos da viagem
- Passagens e hospedagem **compradas**. Voos (ida 27/02 GRU→AEP, volta 07/03 AEP→GRU), check-in e check-out estão no banco (`events`, momento `voo`/`hospedagem`). Deslocamentos de Uber.
- **O endereço do Airbnb fica só no banco** (`places`, categoria `hospedagem`), nunca no código ou no repo. `trip.center` em `lib/trip.ts` é só um centro aproximado de Palermo.
- Valores e o resto do roteiro: desconhecido = `TODO(content)`. Nunca invente dados da viagem.

## Estrutura
- `travel-guide-frontend/`: app Next.js **16.4** (App Router, sem `src/`), React 19, Tailwind 4, Cache Components ligado. Leia `travel-guide-frontend/AGENTS.md`: essa versão do Next tem mudanças grandes, consulte `node_modules/next/dist/docs/` antes de escrever código.
- `travel-guide-frontend/DESIGN.md`: sistema visual (tokens, fontes, layout, paleta dos momentos, decisões). Fonte da verdade para UI, junto com `app/globals.css`.
- `supabase/`: migrations, seed e teste de RLS (ver `supabase/README.md`).
- `assets/reference-travo.png` (referência visual) e `assets/sketch-home.png` (esboço da home).
- `.claude/skills/`: `antiwebslop` (design de front), `supabase` e `supabase-postgres-best-practices`.
- `.claude/agents/`: `buenos-aires-scout` (pesquisa lugares), `design-reviewer` e `db-reviewer` (revisores só-leitura).
- `.mcp.json`: MCP oficial do Supabase travado no projeto `bkztexprtuozfqmnlluz`.

## App hoje (abas no topo: Hoje · Ideias · Roteiro)
- **Layout** `app/(app)/layout.tsx`: cabeçalho (`UserMenu` em Suspense, `LiveRefresh` com realtime em votes/suggestions/events → `router.refresh()`) e `NavTabs`.
- **Hoje** `app/(app)/page.tsx` → `Dashboard.tsx`: seletor de dias, mapa do dia (`TripMap.tsx`) com rota, próximas datas, contagem, resumo de ideias (link pra /ideias). Dados: `lib/data.ts`.
- **Ideias** `app/(app)/ideias` → `IdeasBoard.tsx`: todas as sugestões, filtros por status/momento/dia, voto "Curti · Tanto faz · Não curti" (`VoteButtons.tsx`). `AddIdea.tsx` (dialog): busca no Photon (bbox de CABA) ou link do Google Maps, escolhe momento, dia ("algum dia" = sem data) e nota. Ao escolher um lugar, o bairro aparece em destaque e `daysInNeighborhood` (ações em `ideas.ts`) mostra os dias que já têm ideia no mesmo bairro, para encaixar junto. Actions em `app/actions/ideas.ts` e `vote.ts`. Dados: `lib/ideas.ts`.
- **Roteiro** `app/(app)/roteiro` → `RoteiroBoard.tsx` (dados `lib/roteiro.ts`, actions `app/actions/roteiro.ts`):
  - 3 painéis: ideias soltas (recolhível) · grade momento × dia (9 dias) · mapa do dia em foco (recolhível). Estado de recolher em localStorage (`roteiro:ideias`, `roteiro:mapa`). No celular: botões "Ideias soltas"/"Mapa do dia" e um dia por vez.
  - Bairros: o cabeçalho de cada dia mostra os bairros dos cards daquele dia (decididos primeiro); o mapa mostra os bairros do dia em foco; as ideias soltas são agrupadas por bairro (`lib/bairros.ts`); o card encaixado mostra o bairro. A grade é um painel branco com linhas entre dias e momentos; a primeira coluna fica fixa ao rolar.
  - Arrastar (dnd-kit, também clique-e-clique no toque) uma ideia para uma célula chama a RPC `place_idea` (conta como o "curti" de quem encaixou); "Devolver" chama `unplace_idea`. No mouse, o card inteiro é a alça de arrasto; no teclado, só o nome.
  - **Sem voto no Roteiro**: cada card mostra só a situação (✓ Decidido · relógio "Falta você · votar" → /ideias · "Falta {parceiro}").
  - No mapa, rota e numeração **só entre decididos**; pendentes são bolinhas vazadas sem número (são alternativas, não sequência).
- **Rotas** `lib/routes.ts`: OSRM público (`routing.openstreetmap.de`, carro/a pé/bike), trechos cacheados em `route_legs`. Sem `travel_mode`: ≤1200 m a pé, senão carro.

## Modelo de dados (migrations em `supabase/migrations/`)
- `places` (nome, bairro, categoria, lat/lng, `osm_ref`, link, notas), `suggestions` (lugar num **momento do dia** e numa data opcional; status `ideia` → `decidido`; é a unidade de voto), `votes` (por sugestão: curtiu / tanto faz / não curtiu), `events` (data, hora, momento, `travel_mode`, place opcional, `sort_order`), `route_legs` (cache de rotas), `expenses` (ainda sem UI), `profiles`.
- Momentos (`day_moment`): voo, hospedagem, café da manhã, passeio, almoço, lanche, mercado, jantar, noite, outro. Ordem no dia = `private.moment_rank()` (espelhada em `RANK` no `lib/roteiro.ts`).
- Os dois curtiram → trigger (SECURITY DEFINER) marca decidido e cria o evento. Encaixar/devolver são RPCs SECURITY INVOKER; parada `pago` não pode ser devolvida.
- RLS em tudo via `private.is_member()` (compara `auth.uid()` com `profiles`). UPDATE com grants por coluna: por isso o código faz update e depois insert, em vez de upsert do PostgREST.
- Colunas em inglês, valores de enum em português. Tipos em `lib/supabase/database.types.ts` (gerar pelo MCP e conferir).

## Estado das branches (09/11/2026)
- `main` (`037c045`) tem tudo que estava em `feat/abas`, `feat/roteiro` e `feat/bairros`, mesclado localmente pelo Claude e enviado ao GitHub. Essas três branches foram apagadas, local e remota.
- Não há branch de feature aberta. Ao começar uma nova, crie `feat/<feature>` a partir da `main`.
- Branches antigas que continuam no remoto e já estão dentro da `main`: `feat/momentos-do-dia`, `feat/rotas-do-dia`. Podem ser apagadas quando o usuário pedir.
- A migration `20261109162810_roteiro.sql` **já está aplicada no banco**.

## Próximos passos / radar (não começar sem o usuário pedir)
- Resumo por lugar com IA (adiado em 09/11/2026: o usuário escolheu seguir sem IA por enquanto). Quando for fazer: coluna `places.summary` (migration), geração no servidor ao salvar o lugar, chave `ANTHROPIC_API_KEY` no `.env.local` (criada na console.anthropic.com com limite mensal). Custo estimado: centavos por lugar com Haiku 5.5; a busca web cobra à parte.
- Aba "Viagem" com Hospedagem e Passagem.
- Gastos: lançar, converter moeda, acertar contas ("quem deve quanto pra quem").
- Polimento: mobile, PWA/offline para usar durante a viagem. Deploy na Vercel.

## Pendências
- **SMTP próprio (Resend) adiado pelo usuário em 06/11/2026.** Até lá: só o Roger recebe o magic link (SMTP padrão entrega só pro time da org, ~2 emails/h), templates travados, link só funciona no mesmo navegador. Depois do SMTP: trocar os templates Confirm sign up e Magic link (ver `supabase/README.md`).
- Se o MCP do Supabase cair, o OAuth precisa ser refeito num terminal interativo (`npx @anthropic-ai/claude-code` na pasta do projeto → `/mcp` → supabase → Authenticate); o `/mcp` do T3 Code não faz login.
- Configurações de Auth no painel do Supabase ficam com o usuário (lista em `supabase/README.md`).
- Repo no GitHub: `RogerPatriota/travel-guide`.

## Como trabalhar aqui
- **Commit e push só quando o usuário pedir.** Commits só com o nome do usuário: **sem `Co-Authored-By`** nem menção ao Claude. Mensagem no formato `feat: ...` / `fix: ...` em inglês.
- **Branch:** `feat/<feature>` (sem número de fase). Hotfix pequeno pode ir direto na `main` quando o usuário pedir.
- **Docs** (este arquivo, READMEs, DESIGN.md): só atualizar quando o usuário pedir.
- UI: siga `DESIGN.md` e a skill `antiwebslop`; rode `node .claude/skills/antiwebslop/scripts/slop-lint.mjs <arquivos>` em mudanças de front. Verifique no navegador (preview), não só no build.
- Banco: siga as skills do Supabase (testar com `execute_sql` numa transação com rollback, depois `apply_migration`; `get_advisors` antes de fechar) e passe migrations pelo `db-reviewer`. O `apply_migration` escolhe o timestamp: renomeie o arquivo local para a versão do banco (`list_migrations`). SQL destrutivo pede confirmação do usuário (expira em ~2 min).
- Segurança: emails do casal só em `private.allowed_emails` no banco; endereço do Airbnb só no banco; nunca expor a service_role; `.env.local` no gitignore; não mandar o email do usuário para serviços de terceiros (Photon, Nominatim, OSRM).

## Pegadinhas conhecidas
- Next 16: `proxy.ts` no lugar de middleware; com Cache Components, leitura de sessão fica dentro de `<Suspense>` e os loaders chamam `await connection()` antes do Supabase (senão erro de `Date.now()` no prerender). Em server actions, `refresh()` de `next/cache`.
- `.next/types` velho quebra o build depois de mover rotas: `rm -rf .next/types`.
- MapLibre: o CSS dele vence o Tailwind em `.maplibregl-map`, por isso o mapa fica num wrapper `absolute inset-0`; chamar `map.resize()` antes de `fitBounds` quando o container muda de tamanho.
- dnd-kit: `DndContext` precisa de `id` fixo (senão erro de hidratação). A ação de arrastar do preview não dispara o dnd-kit; para testar, disparar eventos de mouse reais.
- Git no Windows com `core.autocrlf=true`: arquivos em CRLF; scripts que fazem patch precisam normalizar quebras de linha. `gh` não está instalado (PRs pelo site: `https://github.com/RogerPatriota/travel-guide/pull/new/<branch>`).
