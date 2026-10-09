"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { eventsService } from "@/services/events.service";
import { membershipsService } from "@/services/memberships.service";
import { engagementService } from "@/services/engagement.service";
import { projectsService } from "@/services/projects.service";
import { treasuryService } from "@/services/treasury.service";
import { checkinPeriod } from "@/features/engagement/period";
import { isLate } from "@/features/departments/workspace/shared";
import { hasSection, isContributor } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import type { Event } from "@/types/events.types";
import type { CandidatureList } from "@/types/memberships.types";
import type { PointSource } from "@/types/engagement.types";

type Tone = "blue" | "orange" | "gray";
interface Todo { key: string; title: string; meta: string; action: string; href: string; tone: Tone }

const TONE: Record<Tone, string> = { blue: "bg-brand-blue", orange: "bg-brand-orange", gray: "bg-fg-subtle" };
const SOURCES: PointSource[] = ["task", "checkin", "contribution", "adjustment"];
const TASKS_SHOWN = 4;

/** Réponse paginée ou simple liste. */
function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  return ((data as { results?: T[] } | undefined)?.results) ?? [];
}

/** Accueil : ce que la personne a à faire, ses points du mois, le prochain événement. */
export function DashboardHome() {
  const { data: user, isLoading } = useCurrentUser();
  const { t, fmt, intl, label } = useI18n();
  const d = t.dashboardHome;
  const isMember = !!user && user.role !== "visiteur" && user.role !== "candidat";
  const contributor = isContributor(user);

  const { data: myTasks = [] } = useQuery({
    queryKey: ["projects", "my-tasks"],
    queryFn: () => projectsService.myTasks().then((r) => r.data),
    enabled: isMember,
  });
  const { data: myPoints } = useQuery({
    queryKey: ["my-points", "month", "home"],
    queryFn: () => engagementService.myPoints({ period: "month" }).then((r) => r.data),
    enabled: isMember,
  });
  const { data: contributions } = useQuery({
    queryKey: ["contributions", "mine", "home"],
    queryFn: () => treasuryService.mine().then((r) => r.data),
    enabled: contributor,
  });
  const { data: eventsData } = useQuery({
    queryKey: ["events", "published"],
    queryFn: () => eventsService.list({ is_published: "true" }).then((r) => r.data),
    enabled: !!user,
  });
  const { data: applications } = useQuery({
    queryKey: ["candidatures", "pending"],
    queryFn: () => membershipsService.listCandidatures({ status: "pending" }).then((r) => r.data),
    enabled: hasSection(user, "applications"),
  });

  if (isLoading || !user) {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true">
        <div className="h-16 w-72 rounded-xl bg-surface-strong" />
        <div className="h-72 rounded-2xl bg-surface" />
      </div>
    );
  }

  // ── À faire ──
  const todos: Todo[] = [];
  const open = myTasks.filter((task) => ["todo", "in_progress", "blocked"].includes(task.status));
  open.filter((task) => task.return_reason).forEach((task) => todos.push({
    key: `r${task.id}`, title: task.title, meta: d.returnedMeta(task.project_title, task.return_reason),
    action: d.fix, href: "/my-department?tab=tasks", tone: "orange",
  }));
  open.filter((task) => !task.return_reason)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, TASKS_SHOWN)
    .forEach((task) => todos.push({
      key: `t${task.id}`, title: task.title,
      meta: d.taskMeta(task.project_title, task.due_date ? (isLate(task) ? d.lateSince(fmt.date(task.due_date)) : d.dueOn(fmt.date(task.due_date))) : d.noDue),
      action: d.open, href: "/my-department?tab=tasks", tone: isLate(task) ? "orange" : "blue",
    }));
  myPoints?.checkins.filter((c) => c.status === "pending").forEach((c) => todos.push({
    key: `c${c.id}`, title: d.checkinTitle(checkinPeriod(c, intl)), meta: d.checkinMeta,
    action: d.fill, href: `/checkins/${c.id}`, tone: "blue",
  }));
  if (contributions?.liable) {
    const thisMonth = new Date().toISOString().slice(0, 7);
    const current = contributions.months.find((m) => m.month.startsWith(thisMonth));
    if (current && (current.status === "due" || current.status === "late")) {
      todos.push({
        key: "contribution", title: d.contributionTitle(new Date(current.month).toLocaleDateString(intl, { month: "long" })),
        meta: d.contributionMeta(contributions.rate), action: d.declare, href: "/my-contributions", tone: "gray",
      });
    }
  }
  const pendingApplications = asList<CandidatureList>(applications);
  if (pendingApplications.length > 0) {
    todos.push({ key: "apps", title: d.applicationsTitle(pendingApplications.length), meta: d.applicationsMeta,
      action: d.review, href: "/memberships", tone: "orange" });
  }
  if (user.capabilities?.leads_department) {
    todos.push({ key: "lead", title: d.leadTitle, meta: d.leadMeta, action: d.see, href: "/my-department?tab=today", tone: "blue" });
  }

  // ── Points du mois ──
  const bySource = SOURCES.map((s) => ({
    source: s,
    total: (myPoints?.entries ?? []).filter((e) => e.source === s).reduce((sum, e) => sum + e.points, 0),
  })).filter((s) => s.total !== 0);
  const monthName = new Date().toLocaleDateString(intl, { month: "long" });

  // ── Prochain événement ──
  const events = asList<Event>(eventsData);
  const next = events.filter((e) => new Date(e.start_date) > new Date())
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const role = user.poste || user.role !== "membre" ? label.position(user) : t.labels.role.membre;
  const subtitle = [role, user.department?.name, todos.length ? d.thingsToDo(todos.length) : d.allClearShort].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6 max-w-6xl">
      <header>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{d.greeting(user.first_name)}</h1>
        <p className="text-sm text-fg-soft mt-1">{subtitle}</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <section aria-labelledby="todo-title" className="flex-1 min-w-0 w-full space-y-3">
          <h2 id="todo-title" className="font-display font-bold text-lg text-fg">{d.todoTitle}</h2>
          {todos.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-line-soft px-6 py-10 text-center">
              <p className="font-display font-bold text-fg">{d.allClear}</p>
              <p className="text-sm text-fg-muted mt-1">{d.allClearHint}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {todos.map((item) => (
                <li key={item.key} className="flex items-center gap-3.5 bg-surface rounded-2xl border border-line-soft px-5 py-4">
                  <span aria-hidden="true" className={cn("w-2.5 h-2.5 rounded-[3px] shrink-0", TONE[item.tone])} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold text-fg truncate">{item.title}</span>
                    <span className="block text-[13px] text-fg-soft truncate">{item.meta}</span>
                  </span>
                  <Link href={item.href}
                    className="shrink-0 inline-flex items-center h-10 px-4 rounded-xl bg-brand-blue text-white text-[13px] font-semibold hover:bg-brand-deep">
                    {item.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="w-full lg:w-[340px] shrink-0 space-y-4">
          {isMember && (
            <section aria-labelledby="points-title" className="bg-surface rounded-2xl border border-line-soft p-5 space-y-3">
              <h2 id="points-title" className="font-display font-bold text-fg">{d.pointsTitle(monthName)}</h2>
              <p className="font-display text-4xl font-extrabold text-fg">{myPoints?.total ?? 0}</p>
              {bySource.length > 0 && (
                <ul className="space-y-1.5 text-[13px] text-fg-soft">
                  {bySource.map((s) => (
                    <li key={s.source} className="flex justify-between"><span>{d.sources[s.source]}</span><b className="text-fg">{s.total}</b></li>
                  ))}
                </ul>
              )}
              <Link href="/my-points" className="inline-block text-[13px] font-semibold text-brand-blue hover:underline">{d.pointsDetail} →</Link>
            </section>
          )}
          <section aria-labelledby="event-title" className="bg-surface rounded-2xl border border-line-soft p-5 space-y-2">
            <h2 id="event-title" className="font-display font-bold text-fg">{d.nextEvent}</h2>
            {next ? (
              <>
                <p className="text-sm font-semibold text-fg">{next.title}</p>
                <p className="text-[13px] text-fg-soft">{fmt.dateTime(next.start_date)}{next.location ? ` · ${next.location}` : ""}</p>
                <Link href={`/events/${next.id}`} className="inline-block text-[13px] font-semibold text-brand-blue hover:underline">{d.seeEvent} →</Link>
              </>
            ) : <p className="text-sm text-fg-muted">{d.noUpcoming}</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
