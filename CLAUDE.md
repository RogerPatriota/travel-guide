# travel-guide

Painel privado para um casal planejar e acompanhar a viagem a **Buenos Aires, de 27/02 a 07/03/2027**, com hospedagem em **Palermo**. Só os dois usam. Não é produto comercial (por enquanto). Converse e escreva a interface em **português (pt-BR)**.

## Fatos da viagem
- Passagens e hospedagem já estão **compradas**. Horários, companhia, endereço e valores ainda não foram passados (`TODO(content)` em `travel-guide-frontend/lib/trip.ts`).
- O roteiro (lugares, passeios) ainda não existe. Vai ser decidido em conjunto pelo app.

## Estrutura
- `travel-guide-frontend/`: app Next.js **16.4** (App Router, sem `src/`), React 19, Tailwind 4, Cache Components ligado. Leia `travel-guide-frontend/AGENTS.md`: essa versão do Next tem mudanças grandes, consulte `node_modules/next/dist/docs/` antes de escrever código.
- `travel-guide-frontend/DESIGN.md`: sistema visual (tokens, fontes, layout, decisões). Fonte da verdade para UI, junto com `app/globals.css`.
- `assets/reference-travo.png` (referência visual) e `assets/sketch-home.png` (esboço da home feito pelo usuário).
- `.claude/skills/`: `antiwebslop` (design de front), `supabase` e `supabase-postgres-best-practices`.
- `.claude/agents/`: `buenos-aires-scout` (pesquisa lugares), `design-reviewer` e `db-reviewer` (revisores só-leitura).
- `.mcp.json`: MCP oficial do Supabase travado no projeto `bkztexprtuozfqmnlluz`.

## Decisões tomadas
- **Stack:** Next.js + Supabase (Postgres, Auth, Realtime) + deploy na Vercel. Projeto "de verdade", não protótipo.
- **Tema:** só light por enquanto, mas cores sempre em tokens (dark fácil depois). Fundo bege com curvas de nível (`public/topo.svg`, gerado por `scripts/gen-topo.mjs`).
- **Login:** magic link por email, **restrito aos dois emails do casal** (pedir os emails ao usuário; não estão no repo). Sessão persistente: logou uma vez, fica logado no aparelho.
- **Mapa:** MapLibre 6 + OpenFreeMap (estilo positron), sem satélite. Rotas e pins usam o token `--color-route`, que deve combinar com o site. O worker do MapLibre é copiado para `public/vendor/` no `postinstall` (`scripts/copy-maplibre-worker.mjs`) e apontado com `setWorkerUrl`; sem isso o Turbopack quebra o mapa ("Worker failed to load").
- **Home** segue o esboço: seletor de dias (filtra mapa e datas) · mapa · gastos · próximas datas · contagem regressiva · ideias de lugares.

## Modelo de dados (aplicado: `supabase/migrations/`, detalhes em `supabase/README.md`)
- `places`: nome, bairro, categoria, lat/lng, link, notas, status (`ideia` → `decidido`), criado_por
- `votes`: place_id, user_id, valor (curtiu / não curtiu / tanto faz). Os dois curtiram → lugar vira decidido.
- `events`: data, hora, título, tipo (voo/hotel/passeio), place_id opcional, status
- `expenses`: valor `numeric`, moeda (BRL/ARS/USD), categoria, pago_por, data, dividido. Objetivo: planejado vs. gasto e "quem deve quanto pra quem".
- `profiles`: um por membro, criado por trigger no primeiro login de um email de `private.allowed_emails`. É a lista de membros: todo RLS passa por `private.is_member()` (compara `auth.uid()`).
- RLS em todas as tabelas; hook `before-user-created` bloqueia cadastro fora da lista. Colunas em inglês, valores de enum em português.
- Adiado: trigger "os dois curtiram → decidido" (fase 3), ordem/intervalo de eventos no dia (fase 4), cotação e acertos (fase 5).

## Fases
1. ~~Setup + home com dados fixos~~ (feito)
2. **Supabase:** tabelas, RLS, login magic link, home lendo dados reais ← **em andamento** (branch `feat/supabase-fase-2`; falta a configuração do painel, ver `supabase/README.md`)
3. Ideias de lugares + votação + realtime
4. Mapa com pontos por dia e rotas
5. Gastos: lançar, converter moeda, acertar contas
6. Polimento: mobile, PWA/offline para usar durante a viagem

## Pendências
- **SMTP próprio (Resend) adiado pelo usuário em 06/11/2026.** Até lá: só o Roger recebe o magic link (SMTP padrão entrega só pro time da org, ~2 emails/h), templates travados, link só funciona no mesmo navegador. Depois do SMTP: trocar os templates Confirm sign up e Magic link (ver `supabase/README.md`). Login do Roger testado e funcionando.
- MCP do Supabase autenticado (05/11/2026). Se cair, o OAuth precisa ser refeito num terminal interativo (`npx @anthropic-ai/claude-code` na pasta do projeto → `/mcp` → supabase → Authenticate); o `/mcp` do T3 Code não faz login.
- Configurações de Auth no painel do Supabase ficam com o usuário (lista em `supabase/README.md`). O SMTP padrão só entrega para membros do time da org e ~2 emails/hora.
- Repo no GitHub: `RogerPatriota/travel-guide`, `main` rastreando `origin/main`.

## Como trabalhar aqui
- Commit e push só quando o usuário pedir.
- UI: siga `DESIGN.md` e a skill `antiwebslop`; rode `node .claude/skills/antiwebslop/scripts/slop-lint.mjs <arquivos>` em mudanças de front.
- Banco: siga as skills do Supabase (testar com `execute_sql`, depois gerar migration; `get_advisors` antes de fechar) e passe migrations pelo `db-reviewer`.
- Nunca invente dados da viagem (horários, preços, lugares). Desconhecido = `TODO(content)`.
