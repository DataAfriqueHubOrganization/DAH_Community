"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, BellRing, CheckCircle2, ClipboardCheck, ListChecks, Trophy, Users } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { TaskReviewControls } from "@/features/tasks/TaskReviewControls";
import { checkinPeriod } from "@/features/engagement/period";
import type { CheckInManager, RankingRow } from "@/types/engagement.types";
import type { ProjectTask } from "@/types/projects.types";
import { CheckInDrawer } from "./CheckInDrawer";
import { summarize } from "./CheckInsTab";
import { Avatar, GroupTitle, isLate, type WorkspaceTab } from "./shared";

const INBOX_LIMIT = 4;

export function OverviewTab({
  departmentId, memberCount, tasks, checkins, ranking, currentUserId, onNavigate, onTasksChanged,
}: {
  departmentId: number;
  memberCount: number;
  tasks: ProjectTask[];
  checkins: CheckInManager[];
  ranking: RankingRow[];
  currentUserId: number | undefined;
  onNavigate: (tab: WorkspaceTab) => void;
  onTasksChanged: () => void;
}) {
  const { t, intl, fmt } = useI18n();
  const w = t.workspace;
  const x = t.checkins;
  const qc = useQueryClient();
  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toValidate = tasks.filter((task) => task.status === "submitted")
    .sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? ""));
  const late = tasks.filter(isLate).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const toConfirm = checkins.filter((c) => c.status === "submitted")
    .sort((a, b) => (a.period_start ?? "").localeCompare(b.period_start ?? ""));

  // Mois le plus récent pour lequel des points d'étape ont été lancés.
  const active = checkins.filter((c) => c.status !== "cancelled" && c.period_start);
  const latestMonth = active.map((c) => c.period_start as string).sort().at(-1) ?? null;
  const monthCheckins = latestMonth ? active.filter((c) => c.period_start === latestMonth) : [];
  const monthSummary = summarize(monthCheckins);
  const monthLabel = latestMonth ? checkinPeriod({ period_start: latestMonth, period_label: "" }, intl) : "";

  const top = ranking.filter((r) => r.total > 0).slice(0, 3);

  const remind = useMutation({
    mutationFn: () => engagementService.checkins.remind({ department: departmentId, month: latestMonth as string }),
    onSuccess: ({ data }) => {
      setNotice(w.reminded(data.reminded));
      qc.invalidateQueries({ queryKey: ["checkins", departmentId] });
    },
  });

  const nothingToDo = toValidate.length === 0 && late.length === 0 && toConfirm.length === 0;

  return (
    <div className="space-y-5">
      {/* Indicateurs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Users size={18} />} label={w.kpiMembers} value={String(memberCount)} onClick={() => onNavigate("team")} />
        <Kpi icon={<ListChecks size={18} />} label={w.kpiToValidate} value={String(toValidate.length)}
          tone={toValidate.length > 0 ? "orange" : "default"} onClick={() => onNavigate("projects")} />
        <Kpi icon={<AlarmClock size={18} />} label={w.kpiLate} value={String(late.length)}
          tone={late.length > 0 ? "red" : "default"} onClick={() => onNavigate("projects")} />
        <Kpi icon={<ClipboardCheck size={18} />}
          label={latestMonth ? w.kpiCheckins(monthLabel) : t.checkins.title}
          value={latestMonth ? w.kpiFilled(monthSummary.filled, monthSummary.total) : "—"}
          sub={latestMonth ? undefined : w.noCheckinLaunched}
          onClick={() => onNavigate("checkins")} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5 items-start">
        {/* À traiter */}
        <section className="bg-surface rounded-2xl border border-line-soft">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-display font-bold text-fg">{w.inbox}</h2>
          </div>
          {nothingToDo ? (
            <p className="px-5 pb-8 pt-4 text-sm text-fg-muted flex items-center gap-2">
              <CheckCircle2 size={18} className="text-green-600" /> {w.inboxEmpty}
            </p>
          ) : (
            <div className="pb-2">
              {toValidate.length > 0 && (
                <InboxGroup title={w.tasksToValidate} count={toValidate.length} tone="orange"
                  more={toValidate.length > INBOX_LIMIT ? () => onNavigate("projects") : undefined}>
                  {toValidate.slice(0, INBOX_LIMIT).map((task) => (
                    <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3 border-t border-line-soft">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar name={task.assigned_to_name ?? "?"} size={30} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-fg truncate">{task.title}</p>
                          <p className="text-xs text-fg-muted truncate">
                            {task.assigned_to_name} · {task.project_title}
                            {task.submitted_at && ` · ${w.submittedOn(fmt.date(task.submitted_at))}`}
                          </p>
                        </div>
                      </div>
                      <TaskReviewControls
                        task={task}
                        canValidate={task.assigned_to !== currentUserId}
                        isAssignee={task.assigned_to === currentUserId}
                        onChanged={onTasksChanged}
                      />
                    </div>
                  ))}
                </InboxGroup>
              )}

              {toConfirm.length > 0 && (
                <InboxGroup title={w.checkinsToConfirm} count={toConfirm.length} tone="orange"
                  more={toConfirm.length > INBOX_LIMIT ? () => onNavigate("checkins") : undefined}>
                  {toConfirm.slice(0, INBOX_LIMIT).map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3 border-t border-line-soft">
                      <Avatar name={c.member_name} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate">{c.member_name}</p>
                        <p className="text-xs text-fg-muted">
                          <span className="capitalize">{checkinPeriod(c, intl)}</span>
                          {c.submitted_at && ` · ${x.submittedOn(fmt.date(c.submitted_at))}`}
                        </p>
                      </div>
                      <button onClick={() => setDrawerId(c.id)}
                        className="text-xs font-semibold text-white bg-brand-blue rounded-lg px-3 py-1.5 hover:bg-brand-deep shrink-0">
                        {x.review}
                      </button>
                    </div>
                  ))}
                </InboxGroup>
              )}

              {late.length > 0 && (
                <InboxGroup title={w.lateTasks} count={late.length}
                  more={late.length > INBOX_LIMIT ? () => onNavigate("projects") : undefined}>
                  {late.slice(0, INBOX_LIMIT).map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-5 py-3 border-t border-line-soft">
                      <Avatar name={task.assigned_to_name ?? "?"} size={30} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate">{task.title}</p>
                        <p className="text-xs text-fg-muted truncate">{task.assigned_to_name ?? t.deptDetail.unassigned} · {task.project_title}</p>
                      </div>
                      <span className="text-xs font-semibold text-red-600 shrink-0">{w.dueOn(fmt.date(task.due_date as string))}</span>
                    </div>
                  ))}
                </InboxGroup>
              )}
            </div>
          )}
        </section>

        <div className="space-y-5">
          {/* Avancement des points d'étape du mois */}
          <section className="bg-surface rounded-2xl border border-line-soft p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-display font-bold text-fg">{w.monthProgress}</h2>
              {latestMonth && <span className="text-xs text-fg-muted capitalize">{monthLabel}</span>}
            </div>
            {latestMonth ? (
              <>
                <p className="mt-3 font-display text-3xl font-extrabold text-fg">
                  {monthSummary.filled}<span className="text-base font-semibold text-fg-muted"> / {monthSummary.total}</span>
                </p>
                <ProgressStack summary={monthSummary} />
                {notice && <p className="text-xs text-green-600 mt-3" role="status">{notice}</p>}
                <div className="flex flex-wrap gap-2 mt-4">
                  {monthSummary.pending > 0 && (
                    <button onClick={() => remind.mutate()} disabled={remind.isPending}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-line text-xs font-semibold text-fg-soft hover:bg-surface-muted disabled:opacity-50">
                      <BellRing size={14} /> {w.remind(monthSummary.pending)}
                    </button>
                  )}
                  <button onClick={() => onNavigate("checkins")} className="h-9 px-3 text-xs font-semibold text-brand-blue hover:underline">
                    {t.checkins.title} →
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-fg-muted space-y-3">
                <p>{w.noCheckinLaunched}</p>
                <button onClick={() => onNavigate("checkins")} className="text-xs font-semibold text-brand-blue hover:underline">{w.launchForMonth} →</button>
              </div>
            )}
          </section>

          {/* Top du mois */}
          <section className="bg-surface rounded-2xl border border-line-soft p-5">
            <h2 className="font-display font-bold text-fg flex items-center gap-2"><Trophy size={16} className="text-brand-orange" /> {w.topMonth}</h2>
            {top.length === 0 ? (
              <p className="text-sm text-fg-muted mt-3">{w.noPointsYet}</p>
            ) : (
              <ol className="mt-3 space-y-2.5">
                {top.map((r) => (
                  <li key={r.user_id} className="flex items-center gap-3">
                    <span className={cn("w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
                      r.rank === 1 ? "bg-brand-orange text-ink" : "bg-surface-strong text-fg-soft")}>{r.rank}</span>
                    <Avatar name={r.full_name} src={r.avatar} size={28} />
                    <span className="text-sm text-fg flex-1 truncate">{r.full_name}</span>
                    <span className="font-display font-bold text-brand-deep text-sm">{r.total} pts</span>
                  </li>
                ))}
              </ol>
            )}
            <Link href={`/ranking?department=${departmentId}`} className="inline-block mt-4 text-xs font-semibold text-brand-blue hover:underline">{w.seeRanking} →</Link>
          </section>
        </div>
      </div>

      {drawerId !== null && <CheckInDrawer queue={toConfirm} startId={drawerId} onClose={() => setDrawerId(null)} />}
    </div>
  );
}

function Kpi({
  icon, label, value, sub, tone = "default", onClick,
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "default" | "orange" | "red"; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="text-left bg-surface rounded-2xl border border-line-soft p-4 hover:shadow-md transition-shadow">
      <span className={cn("inline-flex w-9 h-9 rounded-xl items-center justify-center",
        tone === "orange" ? "bg-brand-orange/15 text-orange-700 dark:text-orange-300"
          : tone === "red" ? "bg-red-50 text-red-600 dark:bg-red-500/15"
            : "bg-brand-blue/10 text-brand-blue")}>{icon}</span>
      <p className="mt-3 font-display text-2xl font-extrabold text-fg">{value}</p>
      <p className="text-xs text-fg-muted mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-fg-subtle">{sub}</p>}
    </button>
  );
}

function InboxGroup({
  title, count, tone = "default", more, children,
}: {
  title: string; count: number; tone?: "default" | "orange"; more?: () => void; children: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between px-5 py-2">
        <GroupTitle count={count} tone={tone}>{title}</GroupTitle>
        {more && <button onClick={more} className="text-xs font-semibold text-brand-blue hover:underline">{t.workspace.seeAll(count)}</button>}
      </div>
      {children}
    </div>
  );
}

/** Barre empilée : confirmés / à confirmer / à remplir. */
function ProgressStack({ summary }: { summary: ReturnType<typeof summarize> }) {
  const { t } = useI18n();
  const w = t.workspace;
  const parts = [
    { key: "confirmed", value: summary.confirmed, label: w.legendConfirmed, cls: "bg-green-500" },
    { key: "submitted", value: summary.submitted, label: w.legendToConfirm, cls: "bg-brand-orange" },
    { key: "pending", value: summary.pending, label: w.legendPending, cls: "bg-surface-strong" },
  ];
  return (
    <div className="mt-3">
      <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-surface" aria-hidden="true">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} className={cn("h-full", p.cls)} style={{ width: `${(p.value / summary.total) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-[3px] border border-line-soft", p.cls)} aria-hidden="true" />
            <span className="text-fg-muted flex-1">{p.label}</span>
            <b className="text-fg">{p.value}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
