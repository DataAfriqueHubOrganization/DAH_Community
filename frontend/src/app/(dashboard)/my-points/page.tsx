"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ClipboardList, Clock, MessageSquareText, Sparkles, Trophy } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { PeriodSelector } from "@/features/engagement/PeriodSelector";
import { checkinPeriod, monthShort, todayIso } from "@/features/engagement/period";
import type { PeriodType, PointEntry } from "@/types/engagement.types";

/** « Mes points » : total par période, historique, points d'étape et retours.
 *  Jamais de classement (réservé aux responsables et au bureau). */
export default function MyPointsPage() {
  const { t, fmt, intl } = useI18n();
  const x = t.points;
  const [query, setQuery] = useState<{ period: PeriodType; date: string }>({ period: "month", date: todayIso() });

  const { data, isLoading } = useQuery({
    queryKey: ["my-points", query.period, query.date],
    queryFn: () => engagementService.myPoints(query).then((r) => r.data),
  });

  const pending = data?.checkins.filter((c) => c.status === "pending" || c.status === "submitted") ?? [];
  const feedbacks = data?.checkins.filter((c) => c.status === "confirmed") ?? [];
  const tasks = data?.entries.filter((e) => e.source === "task") ?? [];
  const onTimeKnown = tasks.filter((e) => e.on_time !== null);
  const onTimeRate = onTimeKnown.length ? Math.round((100 * onTimeKnown.filter((e) => e.on_time).length) / onTimeKnown.length) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t.sidebar.myPoints}</h1>
          <p className="text-fg-muted text-sm mt-1">{x.intro}</p>
        </div>
        <PeriodSelector period={query.period} date={query.date} start={data?.period.start} end={data?.period.end} onChange={setQuery} />
      </div>

      {/* Points d'étape à remplir */}
      {pending.map((c) => (
        <Link key={c.id} href={`/checkins/${c.id}`}
          className="flex items-center gap-4 rounded-2xl border border-brand-orange/40 bg-brand-orange/10 px-5 py-4 hover:bg-brand-orange/15 transition-colors">
          <ClipboardList size={22} className="text-orange-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-fg text-sm">{c.status === "pending" ? x.checkinTodo : x.checkinSent}</p>
            <p className="text-xs text-fg-muted">
              {c.department_name} · <span className="capitalize">{checkinPeriod(c, intl)}</span>
              {c.due_date && c.status === "pending" && ` · ${t.checkins.before} ${fmt.date(c.due_date)}`}
            </p>
          </div>
          <span className="text-xs font-semibold text-orange-800 shrink-0">{c.status === "pending" ? x.fill : x.edit} →</span>
        </Link>
      ))}

      {/* Chiffres clés */}
      {isLoading || !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 bg-surface rounded-2xl border border-line-soft animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-univers text-white rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/85">{x.total}</p>
            <p className="font-display text-4xl font-extrabold mt-2">{data.total}</p>
            <p className="text-xs text-white/85 mt-1">{x.pointsWord}</p>
          </div>
          <div className="bg-surface rounded-2xl border border-line-soft p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{x.tasksValidated}</p>
            <p className="font-display text-3xl font-bold text-fg mt-2">{tasks.length}</p>
          </div>
          <div className="bg-surface rounded-2xl border border-line-soft p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{x.onTime}</p>
            <p className="font-display text-3xl font-bold text-fg mt-2">{onTimeRate === null ? "—" : `${onTimeRate} %`}</p>
          </div>
        </div>
      )}

      {/* Points mois par mois sur l'année */}
      {data && <MonthlyChart monthly={data.monthly} highlight={query} year={Number(query.date.slice(0, 4))} intl={intl} title={x.monthlyTitle(query.date.slice(0, 4))} />}

      {/* Historique */}
      <section className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
        <h2 className="px-5 py-4 border-b border-line-soft font-semibold text-fg flex items-center gap-2"><Trophy size={16} className="text-brand-orange" /> {x.history}</h2>
        {!data || data.entries.length === 0 ? (
          <p className="py-10 text-center text-fg-subtle text-sm">{x.empty}</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {data.entries.map((e) => <EntryRow key={e.id} entry={e} />)}
          </ul>
        )}
      </section>

      {/* Retours des responsables */}
      {feedbacks.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-fg flex items-center gap-2"><MessageSquareText size={16} className="text-brand-blue" /> {x.feedbacks}</h2>
          {feedbacks.map((c) => (
            <Link key={c.id} href={`/checkins/${c.id}`} className="block bg-surface rounded-2xl border border-line-soft p-5 hover:border-brand-blue/40 transition-colors">
              <p className="text-xs text-fg-muted mb-2">{c.department_name} · <span className="capitalize">{checkinPeriod(c, intl)}</span></p>
              <p className="text-sm text-fg-soft whitespace-pre-line line-clamp-4">{c.feedback}</p>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}

function EntryRow({ entry }: { entry: PointEntry }) {
  const { t, fmt } = useI18n();
  const x = t.points;
  const icon = entry.source === "checkin"
    ? <ClipboardList size={16} className="text-brand-blue" />
    : entry.on_time === false
      ? <Clock size={16} className="text-orange-600" />
      : <CheckCircle2 size={16} className="text-green-600" />;
  const label = entry.source === "checkin" ? x.checkinLine : entry.source === "adjustment" ? x.adjustmentLine : entry.label;

  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <span className="w-8 h-8 rounded-lg bg-surface-muted flex items-center justify-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg truncate">{label}</p>
        <p className="text-xs text-fg-subtle">
          {fmt.date(entry.awarded_at)}
          {entry.source === "task" && entry.on_time !== null && ` · ${entry.on_time ? x.onTimeYes : x.onTimeNo}`}
        </p>
      </div>
      <span className={`font-display font-bold text-sm shrink-0 ${entry.points < 0 ? "text-red-600" : "text-brand-deep"}`}>
        {entry.points > 0 ? `+${entry.points}` : entry.points}
      </span>
    </li>
  );
}

/** Barres mensuelles (une seule série → une seule teinte, sans légende).
 *  Valeur au survol / focus ; tableau équivalent pour les lecteurs d'écran. */
function MonthlyChart({
  monthly, highlight, year, intl, title,
}: {
  monthly: { month: number; total: number }[];
  highlight: { period: PeriodType; date: string };
  year: number;
  intl: string;
  title: string;
}) {
  const { t } = useI18n();
  const max = Math.max(...monthly.map((m) => m.total), 1);
  const refMonth = Number(highlight.date.slice(5, 7));
  const inPeriod = (m: number) =>
    highlight.period === "year" ||
    (highlight.period === "month" ? m === refMonth : Math.floor((m - 1) / 3) === Math.floor((refMonth - 1) / 3));

  return (
    <section className="bg-surface rounded-2xl border border-line-soft p-5">
      <h2 className="font-semibold text-fg text-sm mb-4">{title}</h2>
      <div className="flex items-end gap-[2px] h-36" aria-hidden="true">
        {monthly.map((m) => (
          <div key={m.month} className="group relative flex-1 h-full flex flex-col justify-end items-center">
            <span className="pointer-events-none absolute -top-1 -translate-y-full rounded-md bg-ink text-white text-xs font-semibold px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {monthShort(m.month, intl)} {year} · {m.total}
            </span>
            <div
              className={`w-full max-w-[28px] rounded-t-[4px] bg-brand-blue dark:bg-blue-500 transition-opacity ${inPeriod(m.month) ? "" : "opacity-35"}`}
              style={{ height: `${m.total > 0 ? Math.max(4, (100 * m.total) / max) : 0}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[2px] mt-2 border-t border-line pt-1.5" aria-hidden="true">
        {monthly.map((m) => (
          <span key={m.month} className="flex-1 text-center text-[10px] text-fg-subtle capitalize">{monthShort(m.month, intl)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>{t.common.date}</th><th>{t.points.pointsWord}</th></tr></thead>
        <tbody>{monthly.map((m) => <tr key={m.month}><td>{monthShort(m.month, intl)} {year}</td><td>{m.total}</td></tr>)}</tbody>
      </table>
    </section>
  );
}
