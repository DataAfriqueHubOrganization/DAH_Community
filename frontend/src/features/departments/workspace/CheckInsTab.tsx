"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, Plus, Search, X } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { CRITERIA, type CheckInManager, type CheckInStatus } from "@/types/engagement.types";
import { checkinPeriod, todayIso } from "@/features/engagement/period";
import { CheckInDrawer } from "./CheckInDrawer";
import {
  Avatar, CHECKIN_PILL, FilterChip, Pagination, Pill, inputClass, paginate, type Assignee,
} from "./shared";

const PAGE_SIZE = 12;
type StatusFilter = "all" | "submitted" | "pending" | "confirmed";

function monthKey(c: CheckInManager): string | null {
  return c.period_start ? c.period_start.slice(0, 7) : null;
}

function selfAverage(c: CheckInManager): number | null {
  const values = CRITERIA.map((k) => c.self_scores[k]).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/** Résumé d'un ensemble de points d'étape (hors annulés). */
export function summarize(list: CheckInManager[]) {
  const counts: Record<Exclude<CheckInStatus, "cancelled">, number> = { pending: 0, submitted: 0, confirmed: 0 };
  list.forEach((c) => { if (c.status !== "cancelled") counts[c.status] += 1; });
  const total = counts.pending + counts.submitted + counts.confirmed;
  return { ...counts, total, filled: counts.submitted + counts.confirmed };
}

export function CheckInsTab({
  departmentId, checkins, members, isLoading,
}: {
  departmentId: number;
  checkins: CheckInManager[];
  members: Assignee[];
  isLoading: boolean;
}) {
  const { t, intl, fmt } = useI18n();
  const w = t.workspace;
  const x = t.checkins;
  const qc = useQueryClient();

  const active = useMemo(() => checkins.filter((c) => c.status !== "cancelled"), [checkins]);
  const thisMonth = todayIso().slice(0, 7);
  const thisYear = Number(thisMonth.slice(0, 4));

  // Années disponibles : celles des points d'étape + l'année en cours.
  const years = useMemo(() => {
    const set = new Set<number>([thisYear]);
    active.forEach((c) => { const k = monthKey(c); if (k) set.add(Number(k.slice(0, 4))); });
    return [...set].sort((a, b) => b - a);
  }, [active, thisYear]);

  // Mois par défaut : le plus récent ayant des points d'étape, sinon le mois en cours.
  const latestMonth = useMemo(
    () => active.map(monthKey).filter((k): k is string => !!k).sort().at(-1) ?? thisMonth,
    [active, thisMonth],
  );
  const [year, setYear] = useState(() => Number(latestMonth.slice(0, 4)));
  const [month, setMonth] = useState<string | "all">(latestMonth);
  const [status, setStatus] = useState<StatusFilter | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [showLaunch, setShowLaunch] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const lastMonthOfYear = year === thisYear ? Number(thisMonth.slice(5, 7)) : 12;
  const months = Array.from({ length: lastMonthOfYear }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const inMonth = month === "all"
    ? active.filter((c) => monthKey(c)?.startsWith(String(year)) || (!c.period_start && year === thisYear))
    : active.filter((c) => monthKey(c) === month);
  const summary = summarize(inMonth);
  // Par défaut on montre ce qui demande une action.
  const effectiveStatus: StatusFilter = status ?? (summary.submitted > 0 ? "submitted" : "all");

  const q = query.trim().toLowerCase();
  const filtered = inMonth
    .filter((c) => effectiveStatus === "all" || c.status === effectiveStatus)
    .filter((c) => !q || c.member_name.toLowerCase().includes(q))
    .sort((a, b) =>
      (b.period_start ?? "").localeCompare(a.period_start ?? "")
      || a.member_name.localeCompare(b.member_name, intl));
  const rows = paginate(filtered, page, PAGE_SIZE);

  const remind = useMutation({
    mutationFn: () => engagementService.checkins.remind({ department: departmentId, month: `${month}-01` }),
    onSuccess: ({ data }) => setNotice(w.reminded(data.reminded)),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => engagementService.checkins.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkins", departmentId] }),
  });

  const pickMonth = (m: string | "all") => { setMonth(m); setStatus(null); setPage(1); setNotice(null); };
  const pickYear = (y: number) => {
    setYear(y);
    const candidates = active.map(monthKey).filter((k): k is string => !!k && k.startsWith(String(y))).sort();
    pickMonth(candidates.at(-1) ?? (y === thisYear ? thisMonth : `${y}-12`));
  };

  return (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-fg-muted">{w.evaluatedMonth}</span>
          <label className="sr-only" htmlFor="ci-year">{w.year}</label>
          <select id="ci-year" value={year} onChange={(e) => pickYear(Number(e.target.value))} className={cn(inputClass, "py-1.5")}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {month !== "all" && summary.pending > 0 && (
            <button onClick={() => remind.mutate()} disabled={remind.isPending}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-line text-sm font-semibold text-fg-soft hover:bg-surface-muted disabled:opacity-50">
              <BellRing size={15} /> {w.remind(summary.pending)}
            </button>
          )}
          <button onClick={() => setShowLaunch(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep">
            <Plus size={15} /> {w.launchForMonth}
          </button>
        </div>
      </div>
      {notice && <p className="text-xs text-green-600" role="status">{notice}</p>}

      {/* Filtre par mois : une case par mois, avec son état */}
      <nav aria-label={w.monthFilter} className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <MonthCell
          label={w.allMonths} active={month === "all"} onClick={() => pickMonth("all")}
          summary={summarize(active.filter((c) => monthKey(c)?.startsWith(String(year))))} hideBar
        />
        {months.map((m) => (
          <MonthCell
            key={m}
            label={new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1).toLocaleDateString(intl, { month: "short" })}
            active={month === m}
            onClick={() => pickMonth(m)}
            summary={summarize(active.filter((c) => monthKey(c) === m))}
          />
        ))}
      </nav>

      {/* Statuts (compteurs = filtres) + recherche */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={effectiveStatus === "all"} onClick={() => { setStatus("all"); setPage(1); }}>
            {w.statusAll} <b>{summary.total}</b>
          </FilterChip>
          <FilterChip active={effectiveStatus === "submitted"} tone="orange" onClick={() => { setStatus("submitted"); setPage(1); }}>
            {x.status.submitted} <b>{summary.submitted}</b>
          </FilterChip>
          <FilterChip active={effectiveStatus === "pending"} onClick={() => { setStatus("pending"); setPage(1); }}>
            {x.status.pending} <b>{summary.pending}</b>
          </FilterChip>
          <FilterChip active={effectiveStatus === "confirmed"} onClick={() => { setStatus("confirmed"); setPage(1); }}>
            {x.status.confirmed} <b>{summary.confirmed}</b>
          </FilterChip>
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">{w.searchMember}</span>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            placeholder={w.searchMember} className={cn(inputClass, "w-full pl-9")} />
        </label>
      </div>

      {/* Tableau paginé */}
      <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
        {isLoading ? (
          <div className="h-48 animate-pulse" />
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-subtle">{active.length === 0 ? x.none : w.noResult}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left">
                <tr className="text-[11px] uppercase tracking-wider text-fg-muted">
                  <th scope="col" className="px-4 py-2.5 font-bold">{w.colMember}</th>
                  {month === "all" && <th scope="col" className="px-4 py-2.5 font-bold">{w.colMonth}</th>}
                  <th scope="col" className="px-4 py-2.5 font-bold">{w.colStatus}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{w.colFilled}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{w.colSelf}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold text-right">{w.colAction}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const avg = selfAverage(c);
                  return (
                    <tr key={c.id} className="border-t border-line-soft">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={c.member_name} />
                          <span className="font-medium text-fg truncate">{c.member_name}</span>
                        </div>
                      </td>
                      {month === "all" && <td className="px-4 py-2.5 text-fg-muted capitalize whitespace-nowrap">{checkinPeriod(c, intl)}</td>}
                      <td className="px-4 py-2.5">
                        <Pill className={CHECKIN_PILL[c.status]}>{x.status[c.status]}</Pill>
                        {c.status === "confirmed" && c.points !== null && (
                          <span className="ml-2 text-xs font-semibold text-brand-deep">{t.tasks.points(c.points)}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted hidden md:table-cell whitespace-nowrap">
                        {c.submitted_at ? fmt.date(c.submitted_at) : c.due_date ? `${x.before} ${fmt.date(c.due_date)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {avg !== null ? <><b className="font-display">{avg.toFixed(1)}</b><span className="text-fg-muted"> / 5</span></> : <span className="text-fg-subtle">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {c.status === "submitted" ? (
                          <button onClick={() => setDrawerId(c.id)}
                            className="text-xs font-semibold text-white bg-brand-blue rounded-lg px-3 py-1.5 hover:bg-brand-deep">
                            {x.review}
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <button onClick={() => setDrawerId(c.id)} className="text-xs font-medium text-brand-blue hover:underline">{w.view}</button>
                            {c.status === "pending" && (
                              <button onClick={() => { if (confirm(x.confirmCancel)) cancel.mutate(c.id); }}
                                aria-label={x.cancel} title={x.cancel} className="p-1 text-fg-faint hover:text-red-500">
                                <X size={14} />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>

      {drawerId !== null && (
        <CheckInDrawer queue={filtered} startId={drawerId} onClose={() => setDrawerId(null)} />
      )}
      {showLaunch && (
        <LaunchCheckInModal
          departmentId={departmentId}
          members={members}
          defaultMonth={month === "all" ? thisMonth : month}
          onClose={() => setShowLaunch(false)}
          onLaunched={(message, launchedMonth) => {
            setNotice(message);
            setShowLaunch(false);
            setYear(Number(launchedMonth.slice(0, 4)));
            setMonth(launchedMonth);
            setStatus(null);
          }}
        />
      )}
    </div>
  );
}

function MonthCell({
  label, active, onClick, summary, hideBar = false,
}: {
  label: string; active: boolean; onClick: () => void; summary: ReturnType<typeof summarize>; hideBar?: boolean;
}) {
  const { t } = useI18n();
  const w = t.workspace;
  const status = summary.total === 0
    ? { text: w.notLaunched, cls: "text-fg-subtle" }
    : summary.submitted > 0
      ? { text: w.nToConfirm(summary.submitted), cls: "text-orange-700 dark:text-orange-300" }
      : summary.pending > 0
        ? { text: w.nPending(summary.pending), cls: "text-fg-muted" }
        : { text: w.closed, cls: "text-green-700 dark:text-green-400" };
  const pct = summary.total ? Math.round((summary.filled / summary.total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "min-w-[96px] flex-1 text-left rounded-xl border px-3 py-2 transition-colors",
        active ? "bg-fg border-fg text-surface shadow-md" : "bg-surface border-line-soft hover:border-line text-fg",
      )}
    >
      <span className="block font-display font-bold text-sm capitalize">{label.replace(".", "")}</span>
      <span className={cn("block text-[11px] font-semibold truncate", active ? "text-surface/80" : status.cls)}>{status.text}</span>
      {!hideBar && (
        <span className={cn("mt-1.5 block h-1 rounded-full overflow-hidden", active ? "bg-surface/25" : "bg-surface-strong")} aria-hidden="true">
          <span
            className={cn("block h-full rounded-full", active ? "bg-surface" : summary.total > 0 && summary.pending === 0 && summary.submitted === 0 ? "bg-green-500" : "bg-brand-blue")}
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
    </button>
  );
}

function LaunchCheckInModal({
  departmentId, members, defaultMonth, onClose, onLaunched,
}: {
  departmentId: number;
  members: Assignee[];
  defaultMonth: string;
  onClose: () => void;
  onLaunched: (message: string, month: string) => void;
}) {
  const { t } = useI18n();
  const x = t.checkins;
  const qc = useQueryClient();
  const [month, setMonth] = useState(defaultMonth);
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]); // vide = tous
  const [query, setQuery] = useState("");

  const launch = useMutation({
    mutationFn: () => engagementService.checkins.launch({
      department: departmentId, members: selected, month: `${month}-01`, due_date: dueDate || null,
    }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["checkins", departmentId] });
      onLaunched(x.launched(data.created, data.skipped), month);
    },
  });

  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));
  const q = query.trim().toLowerCase();
  const shown = members.filter((m) => !q || m.name.toLowerCase().includes(q));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="launch-title">
      <div className="bg-surface rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="launch-title" className="font-semibold text-fg">{x.launch}</h2>
            <p className="text-sm text-fg-muted mt-1">{x.launchIntro}</p>
          </div>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft shrink-0"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="launch-month" className="block text-xs text-fg-muted mb-1">{x.periodLabel}</label>
            <input id="launch-month" type="month" value={month} max={todayIso().slice(0, 7)} onChange={(e) => setMonth(e.target.value)} className={cn(inputClass, "w-full")} />
            <p className="text-[11px] text-fg-subtle mt-1">{x.monthHint}</p>
          </div>
          <div>
            <label htmlFor="launch-due" className="block text-xs text-fg-muted mb-1">{x.dueDate}</label>
            <input id="launch-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cn(inputClass, "w-full")} />
          </div>
        </div>
        <fieldset className="space-y-2">
          <legend className="text-xs text-fg-muted mb-2">{x.who}</legend>
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={selected.length === 0} onClick={() => setSelected([])}>{x.everyone} · {members.length}</FilterChip>
            {selected.length > 0 && <span className="text-xs text-fg-muted">{selected.length} ✓</span>}
          </div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.workspace.searchMember} aria-label={t.workspace.searchMember} className={cn(inputClass, "w-full")} />
          <div className="max-h-52 overflow-y-auto border border-line-soft rounded-xl divide-y divide-line-soft">
            {shown.map((m) => (
              <label key={m.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-surface-muted">
                <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} className="accent-brand-blue" />
                {m.name}
              </label>
            ))}
          </div>
        </fieldset>
        {launch.isError && <p className="text-xs text-red-500">{t.common.error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => launch.mutate()} disabled={!month || launch.isPending}
            className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
            {launch.isPending ? t.common.sending : x.launchSubmit}
          </button>
        </div>
      </div>
    </div>
  );
}
