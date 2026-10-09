"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ClipboardList, ListChecks } from "lucide-react";
import { projectsService } from "@/services/projects.service";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { TaskReviewControls } from "@/features/tasks/TaskReviewControls";
import { TaskDescription } from "@/features/tasks/TaskDescription";
import { checkinPeriod, periodTitle } from "@/features/engagement/period";
import type { DepartmentDetail } from "@/types/departments.types";
import type { Project, ProjectTask } from "@/types/projects.types";
import { Avatar, GroupTitle, OPEN_STATUSES, isLate } from "./shared";

/** « Mes tâches » d'un membre dans son département, groupées par ce qu'il doit faire. */
export function MemberTasksTab({ department, projects }: { department: DepartmentDetail; projects: Project[] }) {
  const { t, fmt, intl } = useI18n();
  const w = t.workspace;
  const qc = useQueryClient();
  const [showValidated, setShowValidated] = useState(false);

  const { data: allTasks = [], isLoading } = useQuery({
    queryKey: ["projects", "my-tasks"],
    queryFn: () => projectsService.myTasks().then((r) => r.data),
  });
  const { data: myPoints } = useQuery({
    queryKey: ["my-points", "month", "department-workspace"],
    queryFn: () => engagementService.myPoints({ period: "month" }).then((r) => r.data),
  });

  const projectIds = new Set(projects.map((p) => p.id));
  const tasks = allTasks.filter((task) => projectIds.has(task.project));
  const byDue = (a: ProjectTask, b: ProjectTask) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
  const returned = tasks.filter((task) => OPEN_STATUSES.includes(task.status) && task.return_reason).sort(byDue);
  const toHandIn = tasks.filter((task) => OPEN_STATUSES.includes(task.status) && !task.return_reason).sort(byDue);
  const awaiting = tasks.filter((task) => task.status === "submitted");
  const validated = tasks.filter((task) => task.status === "done")
    .sort((a, b) => (b.validated_at ?? "").localeCompare(a.validated_at ?? ""));

  const myCheckins = (myPoints?.checkins ?? []).filter((c) => c.department_name === department.name);
  const pendingCheckin = myCheckins.find((c) => c.status === "pending");
  const lastFeedback = myCheckins.find((c) => c.status === "confirmed" && c.feedback);

  const entries = myPoints?.entries ?? [];
  const sum = (source: string) => entries.filter((e) => e.source === source).reduce((acc, e) => acc + e.points, 0);
  const hasCheckinPoints = entries.some((e) => e.source === "checkin");
  const adjustments = sum("adjustment");
  const monthLabel = myPoints ? periodTitle("month", myPoints.period.start, intl) : "";

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["projects", "my-tasks"] });
    qc.invalidateQueries({ queryKey: ["department-tasks", department.id] });
  };

  const leads = [
    department.lead_id && { id: department.lead_id, name: department.lead_name ?? "", role: t.deptDetail.lead },
    department.co_lead_id && { id: department.co_lead_id, name: department.co_lead_name ?? "", role: t.deptDetail.deputy },
  ].filter(Boolean) as { id: number; name: string; role: string }[];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="space-y-4">
        {pendingCheckin && (
          <div className="bg-univers-brand text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <ClipboardList size={28} className="shrink-0 opacity-90" aria-hidden="true" />
            <div className="flex-1">
              <p className="font-display font-bold">{w.checkinBanner(checkinPeriod(pendingCheckin, intl))}</p>
              <p className="text-sm text-white/85 mt-0.5">
                {w.checkinBannerText}
                {pendingCheckin.due_date && ` ${w.checkinBannerDue(fmt.date(pendingCheckin.due_date))}`}
              </p>
            </div>
            <Link href={`/checkins/${pendingCheckin.id}`}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand-orange text-ink text-sm font-semibold hover:brightness-95 shrink-0">
              {w.fillNow}
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="h-48 bg-surface rounded-2xl border border-line-soft animate-pulse" />
        ) : tasks.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-line-soft">
            <ListChecks size={36} className="mx-auto text-fg-faint mb-3" />
            <p className="text-sm text-fg-muted">{w.noTasks}</p>
          </div>
        ) : (
          <>
            {returned.length > 0 && (
              <TaskGroup title={w.returned} count={returned.length} tone="orange">
                {returned.map((task) => <MemberTaskRow key={task.id} task={task} onChanged={refresh} />)}
              </TaskGroup>
            )}
            {toHandIn.length > 0 && (
              <TaskGroup title={w.toHandIn} count={toHandIn.length}>
                {toHandIn.map((task) => <MemberTaskRow key={task.id} task={task} onChanged={refresh} />)}
              </TaskGroup>
            )}
            {awaiting.length > 0 && (
              <TaskGroup title={w.awaitingValidation} count={awaiting.length}>
                {awaiting.map((task) => <MemberTaskRow key={task.id} task={task} onChanged={refresh} />)}
              </TaskGroup>
            )}
            {validated.length > 0 && (
              <TaskGroup
                title={w.validated}
                count={validated.length}
                action={
                  <button onClick={() => setShowValidated((v) => !v)} className="text-xs text-fg-muted hover:text-brand-blue inline-flex items-center gap-1">
                    {showValidated ? w.hide : w.show} <ChevronDown size={12} className={showValidated ? "rotate-180" : ""} />
                  </button>
                }
              >
                {showValidated && validated.map((task) => <MemberTaskRow key={task.id} task={task} onChanged={refresh} />)}
              </TaskGroup>
            )}
          </>
        )}
      </div>

      <aside className="space-y-4">
        <section className="bg-surface rounded-2xl border border-line-soft p-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{w.myPointsMonth(monthLabel)}</p>
          <p className="font-display text-4xl font-extrabold text-brand-deep mt-2">
            {myPoints?.total ?? "—"} <span className="text-base font-semibold text-fg-muted">pts</span>
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt className="text-fg-muted">{w.fromTasks}</dt><dd className="font-semibold text-fg">{sum("task")}</dd></div>
            <div className="flex justify-between">
              <dt className="text-fg-muted">{w.fromCheckin}</dt>
              <dd className={hasCheckinPoints ? "font-semibold text-fg" : "text-fg-subtle"}>{hasCheckinPoints ? sum("checkin") : w.pendingWord}</dd>
            </div>
            {adjustments !== 0 && (
              <div className="flex justify-between"><dt className="text-fg-muted">{w.adjustments}</dt><dd className="font-semibold text-fg">{adjustments}</dd></div>
            )}
          </dl>
          <Link href="/my-points" className="inline-block mt-4 text-xs font-semibold text-brand-blue hover:underline">{w.myHistory} →</Link>
        </section>

        {lastFeedback && (
          <section className="bg-surface rounded-2xl border border-line-soft p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{w.lastFeedback}</p>
            <p className="text-sm text-fg-soft leading-relaxed mt-2 whitespace-pre-line line-clamp-6">{lastFeedback.feedback}</p>
            <Link href={`/checkins/${lastFeedback.id}`} className="block text-xs text-fg-muted mt-2 hover:text-brand-blue capitalize">
              {t.checkins.pageTitle} · {checkinPeriod(lastFeedback, intl)}
            </Link>
          </section>
        )}

        {leads.length > 0 && (
          <section className="bg-surface rounded-2xl border border-line-soft p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{w.leads}</p>
            <ul className="mt-3 space-y-3">
              {leads.map((l) => (
                <li key={l.id} className="flex items-center gap-3">
                  <Avatar name={l.name} size={30} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{l.name}</p>
                    <p className="text-xs text-fg-muted">{l.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}

function TaskGroup({
  title, count, tone = "default", action, children,
}: {
  title: string; count: number; tone?: "default" | "orange"; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className={cn("bg-surface rounded-2xl border overflow-hidden",
      tone === "orange" ? "border-brand-orange/45" : "border-line-soft")}>
      <div className="flex items-center justify-between px-5 py-3">
        <GroupTitle count={count} tone={tone}>{title}</GroupTitle>
        {action}
      </div>
      {children}
    </section>
  );
}

function MemberTaskRow({ task, onChanged }: { task: ProjectTask; onChanged: () => void }) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const late = isLate(task);
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3 px-5 py-3.5 border-t border-line-soft">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-fg">{task.title}</p>
        <p className="text-xs text-fg-muted mt-0.5">
          {task.project_title}
          {task.due_date && <> · <span className={late ? "font-semibold text-red-600" : ""}>{w.dueOn(fmt.date(task.due_date))}</span></>}
          {` · ${t.tasks.size[task.size]}`}
        </p>
        <TaskDescription description={task.description} />
      </div>
      <TaskReviewControls task={task} canValidate={false} isAssignee onChanged={onChanged} />
    </div>
  );
}
