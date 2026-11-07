// Fatos fixos da viagem e helpers de data. O que muda (datas, gastos, lugares)
// fica no Supabase e é lido em lib/data.ts.

export type ISODate = `${number}-${number}-${number}`;

export type TravelMode = "carro" | "a_pe" | "transporte" | "bicicleta";

/** Para que a parada serve no dia (fica na parada e na sugestão, não no lugar) */
export type DayMoment =
  | "voo"
  | "hospedagem"
  | "cafe_da_manha"
  | "almoco"
  | "lanche"
  | "jantar"
  | "passeio"
  | "mercado"
  | "noite"
  | "outro";

export const momentLabel: Record<DayMoment, string> = {
  voo: "Voo",
  hospedagem: "Hospedagem",
  cafe_da_manha: "Café da manhã",
  almoco: "Almoço",
  lanche: "Lanche da tarde",
  jantar: "Jantar",
  passeio: "Passeio",
  mercado: "Mercado",
  noite: "Noite",
  outro: "Outro",
};

export type TripEvent = {
  id: string;
  date: ISODate;
  /** "HH:mm" quando souberem */
  time?: string;
  title: string;
  detail: string;
  status: "pago" | "pendente" | "ideia";
  moment: DayMoment;
  /** Como se chega aqui vindo da parada anterior do dia */
  arrival?: { mode: TravelMode; distanceM: number | null; durationS: number | null };
};

export const travelModeLabel: Record<TravelMode, string> = {
  carro: "de carro",
  a_pe: "a pé",
  transporte: "de transporte",
  bicicleta: "de bike",
};

export const trip = {
  city: "Buenos Aires",
  neighborhood: "Palermo",
  start: "2027-02-27" as ISODate,
  end: "2027-03-07" as ISODate,
  /** Centro aproximado de Palermo, só para enquadrar o mapa. O endereço da
   * hospedagem fica no banco (places, categoria "hospedagem"), não no código. */
  center: { lng: -58.4245, lat: -34.58 },
};

// As datas (voos, hotel, passeios) vêm da tabela public.events: ver lib/data.ts.

/** Converte "YYYY-MM-DD" em Date local (meia-noite), sem fuso UTC no meio */
export function toLocalDate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function tripDays(): ISODate[] {
  const days: ISODate[] = [];
  const cur = toLocalDate(trip.start);
  const last = toLocalDate(trip.end);
  while (cur <= last) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    days.push(`${y}-${m}-${d}` as ISODate);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });
const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" });

/** "sáb" */
export const fmtWeekday = (iso: ISODate) => weekday.format(toLocalDate(iso)).replace(".", "");
/** "27/02" */
export const fmtDayMonth = (iso: ISODate) => dayMonth.format(toLocalDate(iso));
/** "sáb., 27 de fev." → limpo para "sáb, 27 fev" */
export const fmtLong = (iso: ISODate) =>
  longDate.format(toLocalDate(iso)).replaceAll(".", "").replace(" de ", " ");
