"use client";

import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { ContributionMonthInfo, MonthStatus } from "@/types/treasury.types";

/** « octobre 2026 » / « oct. » à partir d'un YYYY-MM-DD (fuseau local). */
export function monthName(iso: string, intl: string, style: "long" | "short" = "long", withYear = true): string {
  const [y, m] = iso.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(intl, withYear ? { month: style, year: "numeric" } : { month: style });
}

/** YYYY-MM du mois suivant / précédent. */
export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Couleurs des statuts de mois — identiques partout (membre, trésorier, saisie). */
export const MONTH_STYLE: Record<MonthStatus, { cell: string; dot: string; text: string }> = {
  paid: {
    cell: "bg-green-50 border-green-300 dark:bg-green-500/10 dark:border-green-500/40",
    dot: "bg-green-600",
    text: "text-green-700 dark:text-green-300",
  },
  late: {
    cell: "bg-brand-orange/10 border-brand-orange/55",
    dot: "bg-brand-orange",
    text: "text-orange-800 dark:text-orange-300",
  },
  due: {
    cell: "bg-surface border-2 border-brand-blue",
    dot: "bg-surface ring-2 ring-inset ring-brand-blue",
    text: "text-brand-deep",
  },
  upcoming: {
    cell: "bg-surface-muted border-line-soft",
    dot: "bg-surface-strong",
    text: "text-fg-subtle",
  },
  not_due: {
    cell: "bg-transparent border-dashed border-line",
    dot: "bg-transparent ring-1 ring-inset ring-line",
    text: "text-fg-faint",
  },
};

/** Douze petites cases (tableau du trésorier). Statut en title + texte masqué. */
export function MonthDots({ months }: { months: ContributionMonthInfo[] }) {
  const { t, intl } = useI18n();
  return (
    <div className="flex gap-[3px]">
      {months.map((m) => {
        const label = `${monthName(m.month, intl, "long", false)} : ${t.treasury.status[m.status]}`;
        return (
          <span key={m.month} title={label} className={cn("w-[18px] h-[18px] rounded-[4px] shrink-0", MONTH_STYLE[m.status].dot)}>
            <span className="sr-only">{label}</span>
          </span>
        );
      })}
    </div>
  );
}

export function MonthLegend({ withNotDue = false }: { withNotDue?: boolean }) {
  const { t } = useI18n();
  const x = t.treasury;
  const items: [MonthStatus, string][] = [
    ["paid", x.legendPaid], ["late", x.legendLate], ["due", x.legendDue], ["upcoming", x.legendUpcoming],
    ...(withNotDue ? [["not_due", x.legendNotDue] as [MonthStatus, string]] : []),
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
      {items.map(([status, label]) => (
        <li key={status} className="flex items-center gap-1.5">
          <span className={cn("w-3 h-3 rounded-[3px]", MONTH_STYLE[status].dot)} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

export function YearSelect({ value, onChange, years }: { value: number; onChange: (y: number) => void; years: number[] }) {
  const { t } = useI18n();
  return (
    <label className="inline-flex items-center gap-2 h-10 pl-3 pr-1 border border-line rounded-xl bg-surface text-sm">
      <span className="text-fg-muted">{t.treasury.year}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="bg-transparent font-semibold text-fg focus:outline-none pr-1">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </label>
  );
}

/** Années proposées : de 2025 à l'année prochaine. */
export function yearOptions(): number[] {
  const now = new Date().getFullYear();
  const years: number[] = [];
  for (let y = now + 1; y >= 2025; y -= 1) years.push(y);
  return years;
}
