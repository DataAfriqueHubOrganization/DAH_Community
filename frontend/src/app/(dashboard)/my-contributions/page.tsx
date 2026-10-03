"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { MONTH_STYLE, MonthLegend, YearSelect, monthName, yearOptions } from "@/features/treasury/shared";
import type { MemberContributions } from "@/types/treasury.types";
import { todayIso } from "@/features/engagement/period";

/** Le membre suit ses cotisations : situation, mois de l'année, historique. */
export default function MyContributionsPage() {
  const { t } = useI18n();
  const x = t.treasury;
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["my-contributions", year],
    queryFn: () => treasuryService.mine(year).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-9 w-64 bg-surface-strong rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-32 bg-surface rounded-2xl border border-line-soft" />)}</div>
        <div className="h-64 bg-surface rounded-2xl border border-line-soft" />
      </div>
    );
  }
  if (!data) return null;

  if (!data.liable) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-fg">{x.myTitle}</h1>
        <p className="bg-surface rounded-2xl border border-line-soft p-6 text-sm text-fg-muted flex gap-3">
          <Wallet size={18} className="text-fg-subtle shrink-0" /> {x.notLiable}
        </p>
      </div>
    );
  }

  return <MyContributionsView data={data} year={year} onYear={setYear} />;
}

function MyContributionsView({ data, year, onYear }: { data: MemberContributions; year: number; onYear: (y: number) => void }) {
  const { t, fmt, intl } = useI18n();
  const x = t.treasury;
  const fcfa = x.fcfa;
  const isLead = data.rate >= 1000;
  // Mois dus : retards + mois en cours s'il n'est pas réglé (indépendant de l'année affichée).
  const currentMonthDue = data.owed > data.late_months.length * data.rate;
  const owedMonths = [...data.late_months, ...(currentMonthDue ? [`${todayIso().slice(0, 7)}-01`] : [])];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{x.myTitle}</h1>
          <p className="text-sm text-fg-muted mt-1">
            {x.rateLine(fcfa(data.rate))} <span className="text-fg-subtle">({isLead ? x.rateKind.lead : x.rateKind.member})</span>
            {" · "}{x.pointsRule(data.points_per_month)}
          </p>
        </div>
        <YearSelect value={year} onChange={onYear} years={yearOptions()} />
      </div>

      {/* Situation */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr] gap-4">
        <section className="bg-univers-brand text-white rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">{x.mySituation}</p>
          <p className="font-display text-2xl font-extrabold">
            {data.paid_until ? x.upToDateUntil(monthName(data.paid_until, intl)) : x.neverPaid}
          </p>
          <p className="inline-flex items-center gap-2 text-sm bg-white/15 rounded-xl px-3 py-2 w-fit">
            <span className={cn("w-2 h-2 rounded-[2px]", data.owed > 0 ? "bg-brand-orange" : "bg-green-400")} aria-hidden="true" />
            {data.owed > 0
              ? x.owedLine(fcfa(data.owed), owedMonths.map((m) => monthName(m, intl, "long", false)).join(", "))
              : x.nothingOwed}
          </p>
        </section>
        <section className="bg-surface rounded-2xl border border-line-soft p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{x.paidInYear(year)}</p>
          <p className="font-display text-3xl font-extrabold text-fg mt-2">{fcfa(data.paid_in_year)}</p>
          <p className="text-sm text-fg-muted mt-1">{x.monthsPaid(data.months_paid_in_year)}</p>
        </section>
        <section className="bg-surface rounded-2xl border border-line-soft p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{x.contributionPoints}</p>
          <p className="font-display text-3xl font-extrabold text-brand-deep mt-2">+{data.points_in_year} <span className="text-base font-semibold text-fg-muted">pts</span></p>
          <p className="text-sm text-fg-muted mt-1">{x.pointsHint}</p>
        </section>
      </div>

      {/* Mois de l'année */}
      <section className="bg-surface rounded-2xl border border-line-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-bold text-fg">{x.myMonths(year)}</h2>
          <MonthLegend withNotDue={data.months.some((m) => m.status === "not_due")} />
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mt-4">
          {data.months.map((m) => {
            const style = MONTH_STYLE[m.status];
            return (
              <li key={m.month} className={cn("rounded-xl border p-3 min-h-[84px] flex flex-col gap-1", style.cell)}>
                <span className={cn("font-display font-bold text-sm capitalize", m.status === "upcoming" || m.status === "not_due" ? "text-fg-muted" : "text-fg")}>
                  {monthName(m.month, intl, "long", false)}
                </span>
                <span className={cn("text-xs font-semibold", style.text)}>{x.status[m.status]}</span>
                {m.status !== "not_due" && (
                  <span className="text-[11px] text-fg-muted">
                    {fcfa(m.amount)}{m.status === "paid" && ` · +${data.points_per_month} pts`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-fg-muted mt-4">{x.howToPay}</p>
      </section>

      {/* Historique */}
      <section className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
        <h2 className="font-display font-bold text-fg px-5 py-4">{x.history}</h2>
        {data.history.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-fg-subtle">{x.noHistory}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wider text-fg-muted">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-bold">{x.colDate}</th>
                  <th scope="col" className="px-5 py-2.5 font-bold">{x.colPeriod}</th>
                  <th scope="col" className="px-5 py-2.5 font-bold text-right">{x.colAmount}</th>
                  <th scope="col" className="px-5 py-2.5 font-bold hidden sm:table-cell">{x.colMethod}</th>
                  <th scope="col" className="px-5 py-2.5 font-bold hidden md:table-cell">{x.colRecordedBy}</th>
                  <th scope="col" className="px-5 py-2.5 font-bold text-right">{x.colPoints}</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((c) => (
                  <tr key={c.id} className="border-t border-line-soft">
                    <td className="px-5 py-3 text-fg-muted whitespace-nowrap">{fmt.date(c.paid_on)}</td>
                    <td className="px-5 py-3 font-medium text-fg">
                      <span className="capitalize">{monthName(c.period_start, intl)}</span>
                      {c.months > 1 && <> → <span>{monthName(c.period_end, intl)}</span></>}
                      <span className="text-fg-muted font-normal"> ({x.monthsCount(c.months)})</span>
                    </td>
                    <td className="px-5 py-3 text-right font-display font-bold whitespace-nowrap">{fcfa(c.amount)}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-surface-strong text-fg-soft">{x.methods[c.method]}</span>
                    </td>
                    <td className="px-5 py-3 text-fg-muted hidden md:table-cell">{c.recorded_by_name ?? "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-brand-deep whitespace-nowrap">+{c.points} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
