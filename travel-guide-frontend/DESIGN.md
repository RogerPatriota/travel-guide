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
colors: #f5f2ea, #fffefb, #ece8dd, #1d1f1b, #5f625a, #e2ddd0, #c6e35a, #3e6b1f, #e6e0d0, #dcd4c0
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

## 11. Decision log

### 2026-11-05: Fundo topográfico e paleta bege + lima
- **Context:** Home da viagem; pedido de fundo topográfico bege claro com linhas finas.
- **Decision:** `--color-bg` #f5f2ea + `public/topo.svg` gerado por `scripts/gen-topo.mjs` (d3-contour, seed fixa). Acento lima #c6e35a para estado; verde #3e6b1f para rotas.
- **Why:** Combina com o tema mapa/viagem e mantém a referência (lima) sem cair no bege + terracota.
- **Do not:** Terracota como acento; sombra nos painéis; linhas topo mais escuras que `--color-topo-strong` (brigam com o texto).
- **Surfaces:** product-ui
- **Refs:** `../assets/reference-travo.png`, `../assets/sketch-home.png`

## 12. References
- Referência visual: `../assets/reference-travo.png` (layout de cards, lima como destaque).
- Esboço da home: `../assets/sketch-home.png`.
