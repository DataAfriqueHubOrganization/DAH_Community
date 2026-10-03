"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award as AwardIcon, Medal, SlidersHorizontal, X } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { avatarUrl } from "@/lib/utils";
import { PeriodSelector } from "@/features/engagement/PeriodSelector";
import { periodTitle, todayIso } from "@/features/engagement/period";
import type { AwardKind, PeriodType, RankingRow } from "@/types/engagement.types";

const MEDAL = ["text-brand-orange", "text-fg-subtle", "text-orange-700"];

/** Classement des membres — responsables (leur département) et bureau. */
export default function RankingPage() {
  const { t, intl } = useI18n();
  const x = t.ranking;
  const qc = useQueryClient();
  const [query, setQuery] = useState<{ period: PeriodType; date: string }>({ period: "month", date: todayIso() });
  const [department, setDepartment] = useState<number | undefined>(undefined);
  const [adjusting, setAdjusting] = useState<RankingRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["ranking", query.period, query.date, department ?? "all"],
    queryFn: () => engagementService.ranking({ ...query, department }).then((r) => r.data),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["ranking"] });
  const awardKind: AwardKind | null = query.period === "month" ? "month" : query.period === "year" ? "year" : null;
  const canAward = !!data?.scopes.global && !data?.department && awardKind !== null;
  const currentAward = data?.awards.find((a) => a.kind === awardKind);

  const designate = useMutation({
    mutationFn: (userId: number) => engagementService.awards.designate({ user: userId, kind: awardKind!, date: query.date }),
    onSuccess: refresh,
  });
  const removeAward = useMutation({
    mutationFn: (id: number) => engagementService.awards.remove(id),
    onSuccess: refresh,
  });

  if (isError) {
    return <p className="text-center py-20 text-fg-subtle">{x.restricted}</p>;
  }

  const periodName = data ? periodTitle(query.period, data.period.start, intl) : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t.sidebar.ranking}</h1>
          <p className="text-fg-muted text-sm mt-1">{x.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data && (data.scopes.global || data.scopes.departments.length > 1) && (
            <select
              aria-label={x.scope}
              value={department ?? (data.scopes.global ? "" : data.department?.id ?? "")}
              onChange={(e) => setDepartment(e.target.value ? Number(e.target.value) : undefined)}
              className="text-sm border border-line rounded-lg px-3 py-2 bg-surface"
            >
              {data.scopes.global && <option value="">{x.community}</option>}
              {data.scopes.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <PeriodSelector period={query.period} date={query.date} start={data?.period.start} end={data?.period.end} onChange={setQuery} />
        </div>
      </div>

      {canAward && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-orange/40 bg-brand-orange/10 px-5 py-3.5 text-sm">
          <AwardIcon size={18} className="text-orange-700 shrink-0" />
          {currentAward ? (
            <>
              <span className="text-fg">{x.awardCurrent(awardKind === "month" ? x.memberOfMonth : x.memberOfYear, periodName, currentAward.user_name)}</span>
              <button onClick={() => { if (confirm(x.confirmRemoveAward)) removeAward.mutate(currentAward.id); }}
                className="text-xs font-medium text-fg-muted hover:text-red-600 underline ml-auto">{x.removeAward}</button>
            </>
          ) : (
            <span className="text-fg-soft">{x.awardHint(awardKind === "month" ? x.memberOfMonth : x.memberOfYear, periodName)}</span>
          )}
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-line-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-fg-muted bg-surface-muted">
              <th className="px-4 py-3 w-14">#</th>
              <th className="px-4 py-3">{x.member}</th>
              <th className="px-4 py-3 text-right">{x.total}</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">{x.tasks}</th>
              <th className="px-4 py-3 text-right hidden md:table-cell">{x.checkins}</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">{x.validated}</th>
              <th className="px-4 py-3 text-right hidden lg:table-cell">{x.onTime}</th>
              {data?.scopes.global && <th className="px-4 py-3 w-px"><span className="sr-only">{t.common.actions}</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {isLoading || !data ? (
              [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-6 bg-surface-strong rounded animate-pulse" /></td></tr>)
            ) : data.rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-fg-subtle">{x.empty}</td></tr>
            ) : (
              data.rows.map((row) => {
                const isAwarded = currentAward?.user === row.user_id;
                return (
                  <tr key={row.user_id} className={row.rank <= 3 && row.total > 0 ? "bg-brand-blue/[0.03]" : undefined}>
                    <td className="px-4 py-3 font-display font-bold text-fg">
                      <span className="inline-flex items-center gap-1">
                        {row.rank <= 3 && row.total > 0 && <Medal size={16} className={MEDAL[row.rank - 1]} aria-hidden="true" />}
                        {row.rank}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={row.avatar ?? avatarUrl(row.full_name, 36)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-fg truncate flex items-center gap-1.5">
                            {row.full_name}
                            {isAwarded && <AwardIcon size={14} className="text-brand-orange" aria-label={x.awarded} />}
                          </p>
                          {row.department_name && !data.department && <p className="text-xs text-fg-subtle truncate">{row.department_name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-display text-base font-bold text-brand-deep">{row.total}</td>
                    <td className="px-4 py-3 text-right text-fg-soft hidden md:table-cell">{row.task_points}</td>
                    <td className="px-4 py-3 text-right text-fg-soft hidden md:table-cell">{row.checkin_points}</td>
                    <td className="px-4 py-3 text-right text-fg-soft hidden lg:table-cell">{row.tasks_validated}</td>
                    <td className="px-4 py-3 text-right text-fg-soft hidden lg:table-cell">{row.on_time_rate === null ? "—" : `${row.on_time_rate} %`}</td>
                    {data.scopes.global && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canAward && !isAwarded && (
                            <button onClick={() => designate.mutate(row.user_id)} disabled={designate.isPending}
                              title={x.designate(awardKind === "month" ? x.memberOfMonth : x.memberOfYear)}
                              aria-label={x.designate(awardKind === "month" ? x.memberOfMonth : x.memberOfYear)}
                              className="p-1.5 rounded-lg text-fg-subtle hover:text-brand-orange hover:bg-brand-orange/10">
                              <AwardIcon size={16} />
                            </button>
                          )}
                          <button onClick={() => setAdjusting(row)} title={x.adjust} aria-label={x.adjust}
                            className="p-1.5 rounded-lg text-fg-subtle hover:text-brand-blue hover:bg-brand-blue/10">
                            <SlidersHorizontal size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-fg-subtle">{x.legend}</p>

      {adjusting && (
        <AdjustModal row={adjusting} department={data?.department?.id} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); refresh(); }} />
      )}
    </div>
  );
}

function AdjustModal({
  row, department, onClose, onSaved,
}: {
  row: RankingRow; department?: number; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useI18n();
  const x = t.ranking;
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => engagementService.adjust({ user: row.user_id, points: Number(points), reason, department: department ?? null }),
    onSuccess: onSaved,
  });
  const valid = points !== "" && Number(points) !== 0 && Number.isInteger(Number(points)) && reason.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="adjust-title">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="adjust-title" className="font-semibold text-fg">{x.adjustTitle(row.full_name)}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
        </div>
        <p className="text-xs text-fg-muted">{x.adjustHint}</p>
        <div>
          <label htmlFor="adjust-points" className="block text-xs text-fg-muted mb-1">{x.adjustPoints}</label>
          <input id="adjust-points" type="number" step={1} value={points} onChange={(e) => setPoints(e.target.value)}
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface" />
        </div>
        <div>
          <label htmlFor="adjust-reason" className="block text-xs text-fg-muted mb-1">{x.adjustReason}</label>
          <textarea id="adjust-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            className="w-full border border-line rounded-xl px-3 py-2 text-sm bg-surface resize-none" />
        </div>
        {save.isError && <p className="text-xs text-red-500">{t.common.error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending}
            className="px-4 py-2 text-sm bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-deep disabled:opacity-50">{t.common.save}</button>
        </div>
      </div>
    </div>
  );
}
