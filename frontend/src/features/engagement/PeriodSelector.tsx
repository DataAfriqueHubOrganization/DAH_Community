"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { PeriodType } from "@/types/engagement.types";
import { isCurrentOrFuture, periodTitle, shiftPeriod } from "./period";

const TYPES: PeriodType[] = ["month", "quarter", "year"];

/** Choix du type de période + navigation précédente / suivante. */
export function PeriodSelector({
  period, date, start, end, onChange,
}: {
  period: PeriodType;
  date: string;
  start?: string;
  end?: string;
  onChange: (next: { period: PeriodType; date: string }) => void;
}) {
  const { t, intl } = useI18n();
  const x = t.points;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label={x.periodType} className="flex bg-surface-strong rounded-lg p-1 gap-1">
        {TYPES.map((type) => (
          <button key={type} role="tab" aria-selected={period === type} onClick={() => onChange({ period: type, date })}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${period === type ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}>
            {x.periods[type]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange({ period, date: shiftPeriod(period, date, -1) })} aria-label={t.common.previous}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line text-fg-soft hover:bg-surface-muted">
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-[130px] text-center font-display font-semibold text-fg capitalize">
          {start ? periodTitle(period, start, intl) : "…"}
        </span>
        <button onClick={() => onChange({ period, date: shiftPeriod(period, date, 1) })} aria-label={t.common.next}
          disabled={!end || isCurrentOrFuture(end)}
          className="w-9 h-9 inline-flex items-center justify-center rounded-lg border border-line text-fg-soft hover:bg-surface-muted disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
