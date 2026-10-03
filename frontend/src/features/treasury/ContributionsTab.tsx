"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Avatar, FilterChip, Pagination, inputClass, paginate } from "@/features/departments/workspace/shared";
import type { ContributionsOverview, MemberStatus } from "@/types/treasury.types";
import { PaymentModal } from "./PaymentModal";
import { MonthDots, MonthLegend, monthName } from "./shared";

const PAGE_SIZE = 15;
type StatusFilter = "all" | MemberStatus;

export function ContributionsTab({ data, isLoading }: { data: ContributionsOverview | undefined; isLoading: boolean }) {
  const { t, intl, label } = useI18n();
  const x = t.treasury;
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rate, setRate] = useState<"all" | "500" | "1000">("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [payFor, setPayFor] = useState<number | null | undefined>(undefined); // undefined = fermé
  const [notice, setNotice] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 bg-surface rounded-2xl border border-line-soft" />)}</div>
        <div className="h-96 bg-surface rounded-2xl border border-line-soft" />
      </div>
    );
  }

  const count = (s: StatusFilter) => (s === "all" ? data.rows.length : data.rows.filter((r) => r.status === s).length);
  const q = query.trim().toLowerCase();
  const filtered = data.rows
    .filter((r) => status === "all" || r.status === status)
    .filter((r) => rate === "all" || String(r.rate) === rate)
    .filter((r) => !q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    // Les plus gros retards d'abord.
    .sort((a, b) => b.owed - a.owed || a.full_name.localeCompare(b.full_name, intl));
  const rows = paginate(filtered, page, PAGE_SIZE);
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label={x.kpiCollected(data.year)} value={x.fcfa(data.collected)} />
        <Kpi label={x.kpiExpected} value={x.fcfa(data.expected_to_date)} />
        <Kpi label={x.kpiRecovery} value={data.recovery_rate === null ? "—" : `${data.recovery_rate} %`}>
          {data.recovery_rate !== null && (
            <div className="h-1.5 rounded-full bg-surface-strong mt-2 overflow-hidden" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-blue" style={{ width: `${Math.min(100, data.recovery_rate)}%` }} />
            </div>
          )}
        </Kpi>
        <Kpi label={x.kpiLate} value={String(data.late_count)} tone={data.late_count > 0 ? "orange" : "default"}
          sub={data.late_count > 0 ? x.kpiLateAmount(x.fcfa(data.late_amount)) : undefined} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={status === "all"} onClick={() => reset(() => setStatus("all"))}>{x.filterAll} · {count("all")}</FilterChip>
          <FilterChip active={status === "up_to_date"} onClick={() => reset(() => setStatus("up_to_date"))}>{x.filterUpToDate} · {count("up_to_date")}</FilterChip>
          <FilterChip active={status === "late"} tone="orange" onClick={() => reset(() => setStatus("late"))}>{x.filterLate} · {count("late")}</FilterChip>
          <FilterChip active={status === "never_paid"} onClick={() => reset(() => setStatus("never_paid"))}>{x.filterNever} · {count("never_paid")}</FilterChip>
          <label className="inline-flex items-center gap-2 h-8 pl-3 pr-1 border border-line rounded-full text-xs bg-surface">
            <span className="text-fg-muted">{x.rateFilter}</span>
            <select value={rate} onChange={(e) => reset(() => setRate(e.target.value as typeof rate))} className="bg-transparent font-semibold text-fg focus:outline-none">
              <option value="all">{x.rateAll}</option>
              <option value="500">{x.perMonth(x.fcfa(500))}</option>
              <option value="1000">{x.perMonth(x.fcfa(1000))}</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <label className="relative flex-1 sm:w-60">
            <span className="sr-only">{x.search}</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => reset(() => setQuery(e.target.value))} placeholder={x.search}
              className={cn(inputClass, "w-full pl-9")} />
          </label>
          <button onClick={() => setPayFor(null)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep">
            <Plus size={15} /> {x.record}
          </button>
        </div>
      </div>
      {notice && <p className="text-sm text-green-600" role="status">{notice}</p>}

      <div className="bg-surface rounded-2xl border border-line-soft">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-subtle">{x.noMembers}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wider text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold rounded-tl-2xl">{x.colMember}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">{x.colRate}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden lg:table-cell">{x.colMonths} {data.year}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{x.colUpTo}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold text-right">{x.colOwed}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold text-right rounded-tr-2xl"><span className="sr-only">{x.colAction}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const late = r.status !== "up_to_date";
                  return (
                    <tr key={r.user_id} className="border-t border-line-soft">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={r.full_name} src={r.avatar} />
                          <div className="min-w-0">
                            <p className="font-medium text-fg truncate">{r.full_name}</p>
                            <p className="text-xs text-fg-muted truncate">
                              {label.position({ role: r.role, poste: r.poste })}
                              {r.department_name && ` · ${r.department_name}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap",
                          r.rate >= 1000 ? "bg-brand-orange/15 text-orange-800 dark:text-orange-300" : "bg-surface-strong text-fg-soft")}>
                          {x.perMonth(x.fcfa(r.rate))}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell"><MonthDots months={r.months} /></td>
                      <td className={cn("px-4 py-2.5 hidden md:table-cell whitespace-nowrap capitalize", late ? "text-orange-800 dark:text-orange-300 font-medium" : "text-fg")}>
                        {r.paid_until ? monthName(r.paid_until, intl) : x.paidUntilNone}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right font-display font-bold whitespace-nowrap", late ? "text-orange-800 dark:text-orange-300" : "text-fg")}>
                        {x.fcfa(r.owed)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => setPayFor(r.user_id)}
                          className="h-8 px-3 rounded-lg border border-line text-xs font-semibold text-fg-soft hover:bg-surface-muted whitespace-nowrap">
                          {x.collect}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-line-soft"><MonthLegend withNotDue /></div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>

      {payFor !== undefined && (
        <PaymentModal
          rows={data.rows}
          initialUserId={payFor}
          onClose={() => setPayFor(undefined)}
          onSaved={(message) => { setNotice(message); setPayFor(undefined); }}
        />
      )}
    </div>
  );
}

function Kpi({
  label, value, sub, tone = "default", children,
}: {
  label: string; value: string; sub?: string; tone?: "default" | "orange"; children?: React.ReactNode;
}) {
  return (
    <div className={cn("bg-surface rounded-2xl border p-4", tone === "orange" ? "border-brand-orange/50" : "border-line-soft")}>
      <p className={cn("text-[11px] font-bold uppercase tracking-wider", tone === "orange" ? "text-orange-800 dark:text-orange-300" : "text-fg-muted")}>{label}</p>
      <p className="font-display text-2xl font-extrabold text-fg mt-1.5">{value}</p>
      {sub && <p className="text-xs text-fg-muted mt-0.5">{sub}</p>}
      {children}
    </div>
  );
}
