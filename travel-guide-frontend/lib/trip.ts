// Dados da viagem. Por enquanto fixos aqui; na fase 2 vêm do Supabase.

export type ISODate = `${number}-${number}-${number}`;

export type TripEvent = {
  id: string;
  date: ISODate;
  /** "HH:mm" quando souberem */
  time?: string;
  title: string;
  detail: string;
  status: "pago" | "pendente" | "ideia";
};

export const trip = {
  city: "Buenos Aires",
  neighborhood: "Palermo",
  start: "2027-02-27" as ISODate,
  end: "2027-03-07" as ISODate,
  /** Centro de Palermo [lng, lat] */
  stay: { lng: -58.4245, lat: -34.58, label: "Hospedagem em Palermo" },
};

export const events: TripEvent[] = [
  {
    id: "voo-ida",
    date: "2027-02-27",
    title: "Voo de ida",
    detail: "Companhia e horário a preencher", // TODO(content)
    status: "pago",
  },
  {
    id: "check-in",
    date: "2027-02-27",
    title: "Check-in em Palermo",
    detail: "Endereço e horário a preencher", // TODO(content)
    status: "pago",
  },
  {
    id: "check-out",
    date: "2027-03-07",
    title: "Check-out",
    detail: "Horário limite a preencher", // TODO(content)
    status: "pago",
  },
  {
    id: "voo-volta",
    date: "2027-03-07",
    title: "Voo de volta",
    detail: "Companhia e horário a preencher", // TODO(content)
    status: "pago",
  },
];

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
