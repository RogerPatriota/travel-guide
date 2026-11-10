// Agrupamento por bairro: o bairro vem do OSM (Photon `district`) e fica em places.neighborhood

export const SEM_BAIRRO = "Sem bairro";

/** Bairros de um conjunto de cards: decididos primeiro, depois os mais repetidos */
export function neighborhoodsOf<T extends { neighborhood: string | null; status: string }>(
  cards: T[],
): string[] {
  const score = new Map<string, number>();
  for (const c of cards) {
    if (!c.neighborhood) continue;
    score.set(c.neighborhood, (score.get(c.neighborhood) ?? 0) + (c.status === "decidido" ? 100 : 1));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
}

/** Agrupa por bairro em ordem alfabética; quem não tem bairro vai por último */
export function groupByNeighborhood<T extends { neighborhood: string | null }>(
  cards: T[],
): [bairro: string, cards: T[]][] {
  const groups = new Map<string, T[]>();
  for (const c of cards) {
    const key = c.neighborhood ?? SEM_BAIRRO;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  return [...groups.entries()].sort(([a], [b]) =>
    a === SEM_BAIRRO ? 1 : b === SEM_BAIRRO ? -1 : a.localeCompare(b, "pt-BR"),
  );
}
