import type { PeriodType } from "@/types/engagement.types";

/** Date du jour au format YYYY-MM-DD (fuseau local). */
export function todayIso(): string {
  const d = new Date();
  return toIso(d);
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Décale une date de référence d'une période (±1 mois / trimestre / année). */
export function shiftPeriod(period: PeriodType, iso: string, direction: -1 | 1): string {
  const d = parseIso(iso);
  const months = period === "month" ? 1 : period === "quarter" ? 3 : 12;
  return toIso(new Date(d.getFullYear(), d.getMonth() + direction * months, 1));
}

/** La période contenant la date de référence inclut-elle aujourd'hui (ou plus tard) ? */
export function isCurrentOrFuture(endExclusive: string): boolean {
  return parseIso(endExclusive) > new Date();
}

/** Libellé lisible d'une période : « octobre 2026 », « T4 2026 », « 2026 ». */
export function periodTitle(period: PeriodType, startIso: string, intl: string): string {
  const start = parseIso(startIso);
  if (period === "month") {
    return start.toLocaleDateString(intl, { month: "long", year: "numeric" });
  }
  if (period === "quarter") {
    const quarter = Math.floor(start.getMonth() / 3) + 1;
    return `${intl.startsWith("fr") ? "T" : "Q"}${quarter} ${start.getFullYear()}`;
  }
  return String(start.getFullYear());
}

export function monthShort(month: number, intl: string): string {
  return new Date(2026, month - 1, 1).toLocaleDateString(intl, { month: "short" }).replace(".", "");
}
