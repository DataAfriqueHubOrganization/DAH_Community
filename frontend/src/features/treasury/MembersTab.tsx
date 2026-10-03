"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, ChevronLeft, ChevronRight, Clock, Plus, Search, X } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { todayIso } from "@/features/engagement/period";
import { Avatar, Pagination, paginate } from "@/features/departments/workspace/shared";
import type { ContributionRow, ContributionsOverview, MonthStatus } from "@/types/treasury.types";
import { PaymentModal } from "./PaymentModal";
import { MONTH_STYLE, Segmented, apiError, monthName } from "./shared";

const PAGE_SIZE = 20;
type Bucket = "unpaid" | "pending" | "paid";
type Filter = Bucket | "all";

/** Statut d'un mois → catégorie de la liste (null = pas concerné ce mois-là). */
function bucketOf(status: MonthStatus): Bucket | null {
  if (status === "paid") return "paid";
  if (status === "pending") return "pending";
  if (status === "late" || status === "due") return "unpaid";
  return null;
}

function monthStats(rows: ContributionRow[], index: number) {
  let paid = 0, pending = 0, unpaid = 0, collected = 0, expected = 0;
  for (const r of rows) {
    const m = r.months[index];
    const b = bucketOf(m.status);
    if (!b) continue;
    expected += m.amount;
    if (b === "paid") { paid += 1; collected += m.amount; }
    else if (b === "pending") pending += 1;
    else unpaid += 1;
  }
  const total = paid + pending + unpaid;
  return { paid, pending, unpaid, total, collected, expected, pct: total ? Math.round((paid / total) * 100) : 0 };
}

export function MembersTab({
  data, isLoading, year, onYear,
}: {
  data: ContributionsOverview | undefined;
  isLoading: boolean;
  year: number;
  onYear: (y: number) => void;
}) {
  const { t, intl } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const today = todayIso();
  const thisYear = Number(today.slice(0, 4));
  const lastMonth = year === thisYear ? Number(today.slice(5, 7)) : 12;
  const [monthIndex, setMonthIndex] = useState(lastMonth - 1);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [openUser, setOpenUser] = useState<number | null>(null);
  const [payFor, setPayFor] = useState<number | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  // Changement d'année : on se place sur le dernier mois disponible.
  useEffect(() => { setMonthIndex(lastMonth - 1); setPage(1); }, [year, lastMonth]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const stats = monthStats(rows, monthIndex);
  const selectedMonth = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const isCurrentMonth = selectedMonth.slice(0, 7) === today.slice(0, 7);
  const effective: Filter = filter ?? (stats.unpaid > 0 ? "unpaid" : "all");

  if (isLoading || !data) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-[62px] bg-surface rounded-2xl" />
        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-5"><div className="h-44 bg-surface rounded-3xl" /><div className="h-44 bg-surface rounded-3xl" /></div>
        <div className="h-96 bg-surface rounded-3xl" />
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const listed = rows
    .filter((r) => {
      const b = bucketOf(r.months[monthIndex].status);
      return effective === "all" ? b !== null : b === effective;
    })
    .filter((r) => !q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    .sort((a, b) => b.late_months.length - a.late_months.length || a.full_name.localeCompare(b.full_name, intl));
  const pageRows = paginate(listed, page, PAGE_SIZE);
  const monthLabel = monthName(selectedMonth, intl, "long", false);

  return (
    <div className="space-y-5">
      {/* Mois */}
      <div className="flex items-center gap-2">
        <button onClick={() => onYear(year - 1)} aria-label={v.previousYear} title={v.previousYear}
          className="h-[62px] w-9 shrink-0 rounded-2xl bg-surface shadow-sm text-fg-muted hover:text-fg flex items-center justify-center"><ChevronLeft size={18} /></button>
        <nav aria-label={v.chooseMonth} className="flex-1 flex gap-2 overflow-x-auto">
          {Array.from({ length: lastMonth }, (_, i) => {
            const s = monthStats(rows, i);
            const active = i === monthIndex;
            return (
              <button key={i} onClick={() => { setMonthIndex(i); setFilter(null); setPage(1); }} aria-current={active ? "true" : undefined}
                className={cn("min-w-[78px] flex-1 rounded-2xl px-3 py-2.5 text-left transition-all",
                  active ? "bg-fg text-surface shadow-lg" : "bg-surface shadow-sm hover:shadow-md text-fg")}>
                <span className="block font-display font-bold text-[13px] capitalize">
                  {monthName(`${year}-${String(i + 1).padStart(2, "0")}-01`, intl, "short", false).replace(".", "")}
                  {i === 0 && <span className={cn("font-normal ml-1", active ? "text-surface/60" : "text-fg-subtle")}>{year}</span>}
                </span>
                <span className={cn("block h-1 rounded-full mt-2 overflow-hidden", active ? "bg-surface/25" : "bg-surface-strong")} aria-hidden="true">
                  <span className={cn("block h-full rounded-full", active ? "bg-surface" : s.pct >= 90 ? "bg-green-500" : "bg-brand-blue")} style={{ width: `${s.pct}%` }} />
                </span>
              </button>
            );
          })}
        </nav>
        <button onClick={() => onYear(year + 1)} disabled={year >= thisYear} aria-label={v.nextYear} title={v.nextYear}
          className="h-[62px] w-9 shrink-0 rounded-2xl bg-surface shadow-sm text-fg-muted hover:text-fg disabled:opacity-30 flex items-center justify-center"><ChevronRight size={18} /></button>
      </div>

      {/* Le mois en un coup d'œil */}
      <div className={cn("grid grid-cols-1 gap-5", isCurrentMonth && "xl:grid-cols-[1.25fr_1fr]")}>
        <section className="bg-surface rounded-3xl shadow-sm p-6 flex flex-col sm:flex-row sm:items-center gap-6">
          <Ring paid={stats.paid} pending={stats.pending} total={stats.total} label={v.ringLabel} />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold text-fg">{v.headline(stats.paid, stats.total, monthLabel)}</h2>
            <p className="text-sm text-fg-muted mt-1.5">{v.amounts(x.fcfa(stats.collected), x.fcfa(stats.expected))}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              <StatPill tone="paid" label={`${v.st.paid} · ${stats.paid}`} />
              <StatPill tone="pending" label={`${v.st.pending} · ${stats.pending}`} />
              <StatPill tone="unpaid" label={`${v.st.unpaid} · ${stats.unpaid}`} />
            </div>
          </div>
        </section>
        {isCurrentMonth && <ReminderPanel />}
      </div>

      {notice && <p className="text-sm text-green-600" role="status">{notice}</p>}

      {/* Liste */}
      <section className="bg-surface rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-line-soft">
          <Segmented<Filter>
            label={v.chooseMonth}
            value={effective}
            onChange={(f) => { setFilter(f); setPage(1); }}
            options={[
              ["unpaid", `${v.st.unpaid} · ${stats.unpaid}`],
              ["pending", `${v.st.pending} · ${stats.pending}`],
              ["paid", `${v.st.paid} · ${stats.paid}`],
              ["all", `${v.st.all} · ${stats.total}`],
            ]}
          />
          <span className="flex-1" />
          <label className="relative w-full sm:w-64">
            <span className="sr-only">{x.search}</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={x.search}
              className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </label>
          <button onClick={() => setPayFor(null)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-line text-sm font-semibold text-fg-soft hover:bg-surface-muted whitespace-nowrap">
            <Plus size={15} /> {x.cashPayment}
          </button>
        </div>

        {listed.length === 0 ? (
          <p className="py-14 text-center text-sm text-fg-subtle">{v.noOneHere}</p>
        ) : (
          <ul>
            {pageRows.map((r) => {
              const status = r.months[monthIndex].status;
              const b = bucketOf(status) as Bucket;
              const note = r.status === "never_paid" ? x.filterNever
                : r.late_months.length > 0 ? x.monthsLate(r.late_months.length)
                  : r.paid_until ? x.upToDateUntil(monthName(r.paid_until, intl)) : "";
              return (
                <li key={r.user_id} className="border-b border-line-soft last:border-b-0">
                  <button onClick={() => setOpenUser(r.user_id)} className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-muted transition-colors">
                    <Avatar name={r.full_name} src={r.avatar} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-sm text-fg truncate">{r.full_name}</span>
                      <span className="block text-xs text-fg-muted truncate">
                        {r.department_name ? `${r.department_name} · ` : ""}{x.perMonth(x.fcfa(r.rate))}
                      </span>
                    </span>
                    <span className={cn("hidden md:block text-xs text-right w-44 truncate", r.late_months.length > 0 ? "text-orange-800 dark:text-orange-300" : "text-fg-muted")}>{note}</span>
                    <StatPill tone={b} label={v.st[b]} className="w-28 justify-center" />
                    <ChevronRight size={18} className="text-fg-faint shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between px-5 py-2 text-xs text-fg-muted">
          <span className="hidden sm:inline">{v.openHint}</span>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={listed.length} onChange={setPage} />
      </section>

      {openUser !== null && (
        <MemberDrawer userId={openUser} year={year} onClose={() => setOpenUser(null)} onCollect={() => setPayFor(openUser)} />
      )}
      {payFor !== undefined && (
        <PaymentModal
          rows={rows}
          initialUserId={payFor}
          onClose={() => setPayFor(undefined)}
          onSaved={(message) => { setNotice(message); setPayFor(undefined); }}
        />
      )}
    </div>
  );
}

const PILL: Record<Bucket, string> = {
  paid: "bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  pending: "bg-brand-blue/10 text-brand-deep",
  unpaid: "bg-brand-orange/15 text-orange-800 dark:text-orange-300",
};
const DOT: Record<Bucket, string> = { paid: "bg-green-500", pending: "bg-[#7BA6EF]", unpaid: "bg-brand-orange" };

function StatPill({ tone, label, className }: { tone: Bucket; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 whitespace-nowrap shrink-0", PILL[tone], className)}>
      <span className={cn("w-2 h-2 rounded-full", DOT[tone])} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Anneau : part réglée (vert) + en attente de validation (bleu clair). */
function Ring({ paid, pending, total, label }: { paid: number; pending: number; total: number; label: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const paidLen = total ? (paid / total) * c : 0;
  const pendingLen = total ? (pending / total) * c : 0;
  const pct = total ? Math.round((paid / total) * 100) : 0;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" className="shrink-0" role="img" aria-label={`${pct} % ${label}`}>
      <circle cx="66" cy="66" r={r} fill="none" className="stroke-surface-strong" strokeWidth="14" />
      {pendingLen > 0 && (
        <circle cx="66" cy="66" r={r} fill="none" stroke="#7BA6EF" strokeWidth="14"
          strokeDasharray={`${pendingLen} ${c}`} strokeDashoffset={-paidLen} transform="rotate(-90 66 66)" />
      )}
      {paidLen > 0 && (
        <circle cx="66" cy="66" r={r} fill="none" stroke="#16A34A" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${paidLen} ${c}`} transform="rotate(-90 66 66)" />
      )}
      <text x="66" y="66" textAnchor="middle" className="fill-fg font-display" fontWeight="800" fontSize="28">{pct} %</text>
      <text x="66" y="86" textAnchor="middle" className="fill-fg-muted" fontSize="12">{label}</text>
    </svg>
  );
}

/** Rappel du mois : carte d'action quand il peut partir, ligne discrète sinon. */
function ReminderPanel() {
  const { t, fmt, intl } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const qc = useQueryClient();
  const { data: status } = useQuery({
    queryKey: ["treasury", "reminder"],
    queryFn: () => treasuryService.reminders.status().then((r) => r.data),
  });
  const send = useMutation({
    mutationFn: () => treasuryService.reminders.send(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["treasury", "reminder"] }),
  });
  if (!status) return <div className="bg-surface rounded-3xl shadow-sm animate-pulse" />;

  const actionable = status.is_open && !status.sent && status.recipients > 0;
  if (!actionable) {
    const text = status.sent
      ? x.reminderSent(fmt.date(status.sent.sent_at), status.sent.sent_by ?? "", status.sent.recipients)
      : !status.is_open ? x.reminderClosed(fmt.date(status.window_opens)) : x.reminderNobody;
    return (
      <section className="bg-surface rounded-3xl shadow-sm p-6 flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-surface-strong text-fg-muted flex items-center justify-center shrink-0">
          {status.sent ? <Check size={20} /> : <Clock size={20} />}
        </span>
        <div>
          <p className="font-display font-bold text-fg">{x.reminderTitle(monthName(status.month, intl))}</p>
          <p className="text-sm text-fg-muted mt-1 leading-relaxed">{text}</p>
        </div>
      </section>
    );
  }

  const daysLeft = Math.max(1, Math.round((new Date(status.window_ends).getTime() - new Date(todayIso()).getTime()) / 86_400_000) + 1);
  return (
    <section className="rounded-3xl shadow-sm p-6 flex flex-col justify-between gap-5 bg-gradient-to-br from-brand-orange/15 via-surface to-surface border border-brand-orange/30">
      <div className="flex items-start gap-4">
        <span className="w-11 h-11 rounded-2xl bg-brand-orange text-ink flex items-center justify-center shrink-0"><BellRing size={20} /></span>
        <div>
          <p className="font-display text-lg font-extrabold text-fg">{v.reminderNow}</p>
          <p className="text-sm text-fg-muted mt-1 leading-relaxed">{v.reminderNowText(daysLeft, status.recipients)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => { if (confirm(x.reminderConfirm(status.recipients))) send.mutate(); }} disabled={send.isPending}
          className="h-11 px-5 rounded-xl bg-brand-orange text-ink text-sm font-bold hover:brightness-95 disabled:opacity-50">
          {v.reminderButton(status.recipients)}
        </button>
        <span className="text-xs text-fg-muted">{v.oncePerMonth}</span>
      </div>
      {send.isError && <p className="text-xs text-red-600" role="alert">{apiError(send.error, t.common.error)}</p>}
    </section>
  );
}

/** Fiche d'un membre : situation, calendrier de l'année, paiements. */
function MemberDrawer({ userId, year: initialYear, onClose, onCollect }: {
  userId: number; year: number; onClose: () => void; onCollect: () => void;
}) {
  const { t, intl, fmt } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const [year, setYear] = useState(initialYear);
  const { data: m } = useQuery({
    queryKey: ["treasury", "member", userId, year],
    queryFn: () => treasuryService.contributions.member(userId, year).then((r) => r.data),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const monthText: Record<MonthStatus, string> = {
    paid: x.monthPaid(m?.points_per_month ?? 5), pending: x.monthPending, late: x.monthUnpaid,
    due: x.monthDue, upcoming: x.monthUpcoming, not_due: x.monthNotDue,
  };
  const owedMonths = m ? Math.round(m.owed / Math.max(1, m.rate)) : 0;
  const timeline = m ? [
    ...m.history.map((c) => ({
      key: `c${c.id}`, date: c.paid_on, ok: true as const,
      period: c.months > 1 ? `${monthName(c.period_start, intl)} → ${monthName(c.period_end, intl)}` : monthName(c.period_start, intl),
      sub: `${fmt.date(c.paid_on)} · ${x.methods[c.method]} · ${c.via_declaration ? v.viaDeclaration : v.inHand}`,
      amount: x.fcfa(c.amount),
    })),
    ...m.declarations.map((d) => ({
      key: `d${d.id}`, date: d.created_at.slice(0, 10), ok: false as const, pending: d.status === "pending",
      period: d.months > 1 ? `${monthName(d.period_start, intl)} → ${monthName(d.period_end, intl)}` : monthName(d.period_start, intl),
      sub: `${fmt.date(d.created_at)} · ${d.status === "pending" ? v.waiting : v.refused(d.rejection_reason)}`,
      amount: "—",
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" aria-label={m?.full_name ?? x.member}
        className="relative w-full max-w-[500px] h-full bg-surface shadow-2xl flex flex-col overflow-hidden">
        <header className="bg-univers-brand text-white px-7 pt-6 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {m ? <Avatar name={m.full_name} size={56} /> : <span className="w-14 h-14 rounded-full bg-white/20" />}
              <div className="min-w-0">
                <p className="font-display text-xl font-extrabold truncate">{m?.full_name ?? "…"}</p>
                {m && <p className="text-sm text-white/85 capitalize-first">{v.since(monthName(m.joined_month, intl))}</p>}
              </div>
            </div>
            <button onClick={onClose} autoFocus aria-label={t.common.close} className="text-white/80 hover:text-white"><X size={22} /></button>
          </div>
          {m && (
            <div className="flex flex-wrap gap-2 mt-5">
              <span className="rounded-xl bg-white/15 px-3.5 py-2 text-sm"><b className="font-display">{x.fcfa(m.rate)}</b> / {x.monthsCount(1)}</span>
              {m.owed > 0 ? (
                <span className="rounded-xl bg-brand-orange text-ink px-3.5 py-2 text-sm font-semibold">{v.owedChip(owedMonths, x.fcfa(m.owed))}</span>
              ) : (
                <span className="rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold">{x.upToDate}</span>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{year}</p>
              <div className="flex gap-1">
                <button onClick={() => setYear((y) => y - 1)} aria-label={v.previousYear} className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-muted"><ChevronLeft size={16} /></button>
                <button onClick={() => setYear((y) => y + 1)} disabled={year >= new Date().getFullYear()} aria-label={v.nextYear}
                  className="p-1.5 rounded-lg text-fg-muted hover:bg-surface-muted disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
            <ul className="grid grid-cols-4 gap-2 mt-2.5">
              {(m?.months ?? []).map((mo) => (
                <li key={mo.month} className={cn("rounded-xl border p-2.5", MONTH_STYLE[mo.status].cell)}>
                  <span className={cn("block font-display font-bold text-[13px] capitalize", mo.status === "upcoming" || mo.status === "not_due" ? "text-fg-muted" : "text-fg")}>
                    {monthName(mo.month, intl, "short", false).replace(".", "")}
                  </span>
                  <span className={cn("block text-[11px] font-semibold mt-0.5 leading-tight", MONTH_STYLE[mo.status].text)}>{monthText[mo.status]}</span>
                </li>
              ))}
            </ul>
          </div>

          <button onClick={onCollect} className="w-full h-12 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep inline-flex items-center justify-center gap-2">
            <Plus size={16} /> {v.collectInHand}
          </button>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{v.payments}</p>
            {timeline.length === 0 ? (
              <p className="text-sm text-fg-subtle mt-3">{v.noPayments}</p>
            ) : (
              <ul className="mt-1">
                {timeline.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 py-3 border-b border-line-soft last:border-b-0">
                    <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      item.ok ? "bg-green-50 text-green-600 dark:bg-green-500/15"
                        : "pending" in item && item.pending ? "bg-brand-blue/10 text-brand-blue" : "bg-red-50 text-red-600 dark:bg-red-500/15")}>
                      {item.ok ? <Check size={16} /> : "pending" in item && item.pending ? <Clock size={16} /> : <X size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg capitalize-first truncate">{item.period}</span>
                      <span className="block text-xs text-fg-muted truncate">{item.sub}</span>
                    </span>
                    <span className="font-display font-extrabold text-sm text-fg whitespace-nowrap">{item.amount}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
