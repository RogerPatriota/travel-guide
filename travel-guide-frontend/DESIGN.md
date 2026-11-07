# DESIGN.md: Buenos Aires 2027

> Brief vivo do design. Seções 1 e 2 são a verdade do produto; 3 a 12 são o sistema visual.
> Ordem de leitura: tokens no código (`app/globals.css`) → este arquivo → skill antiwebslop.

## 1. Product truth
- **Users:** duas pessoas (o casal) planejando a viagem pra Buenos Aires de 27/02 a 07/03/2027. Desktop em casa pra planejar; celular durante a viagem.
- **Purpose:** um lugar só pra datas, gastos, mapa e ideias, e pra decidir junto o que entra no roteiro.
- **Constraints:** uso privado, sem marca. Interface em português. Mapa sem chave paga (OpenFreeMap). Precisa ficar legível no celular com sol na rua.
- **Success means:** abrir a home e saber em 5 segundos quanto falta, o que tem no dia escolhido e quanto já foi gasto.
- **Real content available:** passagens e hospedagem (Palermo) já pagas; horários e valores ainda não lançados (`TODO(content)` em `lib/trip.ts`). Referência visual em `../assets/reference-travo.png`, esboço da home em `../assets/sketch-home.png`.

## 2. Design Read and surface types
Reading this as: painel da viagem pra duas pessoas, uma surface operate com linguagem de caderno de campo (bege, curvas de nível, tinta escura), em Next.js 16 + Tailwind 4.

| Surface | Type | V | M | D |
|---|---|---|---|---|
| Home (dashboard) | operate | 4 | 2 | 6 |
| Telas de edição (ideias, gastos) | operate | 3 | 2 | 6 |

## 3. Visual direction and project bans
- Papel de mapa: fundo bege claro com curvas de nível finas (`public/topo.svg`), painéis quase brancos por cima.
- A informação manda. O número grande da contagem é o único momento "display" da tela.
- Cor de destaque só pra estado atual (dia selecionado, hoje). O verde escuro é a cor do caminho (rotas, pins, foco).
- Bans: sombra em painel; terracota com o bege (vira o template "AI editorial"); emoji na interface; ícone decorativo em título de painel; satélite no mapa.
- Exceção: o bege é próximo dos tons do anti-pattern "cream + terracotta". Fica porque foi pedido (papel topográfico) e porque o acento é lima/verde, não terracota.

## 4. Color tokens

```design-tokens
fonts: Bricolage Grotesque, Geist, Geist Mono
colors: #f5f2ea, #fffefb, #ece8dd, #1d1f1b, #5f625a, #e2ddd0, #c6e35a, #3e6b1f, #e6e0d0, #dcd4c0, #8a5f00, #22706a, #a3406f, #7b2d52, #2a5f99, #4f5d68, #4a3d8a
radii: 0, 8px, 16px, 9999px
```

| Token | Value | Job |
|---|---|---|
| `--color-bg` | #f5f2ea | fundo da página (bege papel) |
| `--color-surface` | #fffefb | painéis |
| `--color-sunken` | #ece8dd | pills de status, fundo do mapa enquanto carrega |
| `--color-fg` | #1d1f1b | texto |
| `--color-muted` | #5f625a | texto secundário (5.6:1 no bg) |
| `--color-border` | #e2ddd0 | hairlines |
| `--color-accent` | #c6e35a | estado atual: dia selecionado, hoje. Sempre com texto `--color-fg` em cima |
| `--color-route` | #3e6b1f | rotas e pins do mapa, anel de foco |
| `--color-topo` / `--color-topo-strong` | #e6e0d0 / #dcd4c0 | curvas de nível (fixas dentro do SVG, mudar nos dois lugares) |

**Momentos do dia** (`:root` em `app/globals.css`; ligação momento → token em `lib/trip.ts` `momentColorVar`). Cada cor tem dois usos: cheia no pin do mapa e no número da parada (texto branco), e clara no fundo da etiqueta (`.moment-chip`: 14% da cor sobre `--color-surface`, texto na cor cheia). Todas passam AA nos dois usos.

| Token | Value | Momento |
|---|---|---|
| `--color-moment-cafe-da-manha` | #8a5f00 | café da manhã (mostarda) |
| `--color-moment-almoco` | #22706a | almoço (verde-azulado) |
| `--color-moment-lanche` | #a3406f | lanche da tarde (rosa) |
| `--color-moment-jantar` | #7b2d52 | jantar (vinho) |
| `--color-moment-passeio` | #2a5f99 | passeio (azul) |
| `--color-moment-mercado` | #4f5d68 | mercado (cinza-azulado) |
| `--color-moment-noite` | #4a3d8a | noite (índigo) |
| `--color-moment-outro` | #5f625a | outro (= muted) |
| `--color-route` | #3e6b1f | voo e hospedagem usam a cor do caminho |

## 5. Typography
- Display: a fonte Bricolage Grotesque 500/600. Por quê: grotesca com personalidade sem virar enfeite; segura o número da contagem e os títulos.
- Text: a fonte Geist 400/500.
- Mono/data: a fonte Geist Mono, só pra datas, valores e números de dia (sempre `tabular-nums`).
- Scale (ratio 1.25, base 16): 12 · 14 · 16 · 18 · 20 · 30 · 48 · clamp(72–96) para a contagem.
- Títulos com `text-balance`, descrições com `text-pretty`.

## 6. Spacing and layout
- Scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48.
- Grid desktop (lg): 12 colunas, max-width 1280px. Mapa 5 col (duas linhas), gastos/datas 4 col, contagem/ideias 3 col.
- Mobile: uma coluna na ordem contagem → dias + mapa → datas → gastos → ideias. Gutter 16px.

## 7. Components
- Radius por papel: controles 8px · painéis e mapa 16px · status pill 9999px.
- Elevation: nenhuma em painel. Só o pin do mapa tem anel.
- Seletor de dias: botões com `aria-pressed`; ativo = `--color-accent` + borda `--color-fg`.
- Status (`pago`, `pendente`, `ideia`): pill `--color-sunken`, texto muted. Sem cor semântica até existir um estado de erro de verdade.
- Etiqueta de momento (`components/MomentChip.tsx`): pill na cor do momento, **antes** do nome do lugar (em "Próximas datas" e "Ideias"). Voo, hospedagem e outro não levam etiqueta (o título já diz). É a única cor categórica da interface; não usar a paleta de momentos para mais nada.
- Número da parada (lista e pin do mapa): círculo na cor cheia do momento, número branco em mono. A linha da rota continua sempre `--color-route`.
- Voto (`components/VoteButtons.tsx`): três botões em primeira pessoa ("Curti · Tanto faz · Não curti"); o marcado usa o estado de seleção (`--color-accent` + borda `--color-fg`), igual ao seletor de dias.
- Kit: nenhum por enquanto. Se entrar shadcn/ui, ele se adapta a estes tokens, não o contrário.

## 8. Motion
- Só troca de cor em hover/seleção, 150ms, propriedades nomeadas. Scroll suave no seletor de dias. Nada de entrada animada.

## 9. Imagery and content
- Mapa real (OpenFreeMap, estilo positron) no lugar de ilustração.
- Fotos só quando forem de lugares de verdade salvos por vocês.
- Voz: curta, de casal, em português. Estado vazio explica o próximo passo em uma frase.

## 10. Do / Don't
| Do | Don't |
|---|---|
| Número grande só na contagem | Linha de "stats" grandes inventados |
| Valor desconhecido = "a preencher" | Valor fake pra preencher o painel |
| Verde escuro pra caminho, lima pra seleção | Lima em linha fina sobre o mapa (some) |
| Cor de momento = etiqueta + pin + número da mesma parada | Cor de momento em botão, fundo de painel ou texto corrido |

## 11. Decision log

### 2026-11-05: Fundo topográfico e paleta bege + lima
- **Context:** Home da viagem; pedido de fundo topográfico bege claro com linhas finas.
- **Decision:** `--color-bg` #f5f2ea + `public/topo.svg` gerado por `scripts/gen-topo.mjs` (d3-contour, seed fixa). Acento lima #c6e35a para estado; verde #3e6b1f para rotas.
- **Why:** Combina com o tema mapa/viagem e mantém a referência (lima) sem cair no bege + terracota.
- **Do not:** Terracota como acento; sombra nos painéis; linhas topo mais escuras que `--color-topo-strong` (brigam com o texto).
- **Surfaces:** product-ui
- **Refs:** `../assets/reference-travo.png`, `../assets/sketch-home.png`

### 2026-11-07: Cores por momento do dia
- **Context:** o momento (jantar, mercado...) aparecia como eyebrow cinza de 12px e ninguém via; o usuário pediu etiqueta com cor, refletida no pin do mapa.
- **Decision:** paleta categórica de 7 cores (tabela da seção 4), usada só em etiqueta, número da parada e pin. Etiqueta antes do nome. Voo/hospedagem ficam no verde da rota.
- **Why:** escanear a lista e o mapa pela cor; ligar pin ↔ item da lista. Contraste AA conferido nos dois usos.
- **Do not:** terracota ou laranja-avermelhado (briga com o bege); oliva no mercado (confunde com a rota); usar essas cores fora de momento.
- **Surfaces:** product-ui (home: Próximas datas, Ideias, mapa)

## 12. References
- Referência visual: `../assets/reference-travo.png` (layout de cards, lima como destaque).
- Esboço da home: `../assets/sketch-home.png`.
