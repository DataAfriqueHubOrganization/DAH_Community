"use client";

import { use, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { departmentsService } from "@/services/departments.service";
import { projectsService } from "@/services/projects.service";
import { engagementService } from "@/services/engagement.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { hasSection } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import type { Project } from "@/types/projects.types";
import { todayIso } from "@/features/engagement/period";
import { OverviewTab } from "@/features/departments/workspace/OverviewTab";
import { ProjectsTab } from "@/features/departments/workspace/ProjectsTab";
import { TeamTab } from "@/features/departments/workspace/TeamTab";
import { CheckInsTab } from "@/features/departments/workspace/CheckInsTab";
import { MemberTasksTab } from "@/features/departments/workspace/MemberTasksTab";
import type { Assignee, ViewerMode, WorkspaceTab } from "@/features/departments/workspace/shared";

const TABS: Record<ViewerMode, WorkspaceTab[]> = {
  manager: ["today", "projects", "team"],
  membre: ["tasks", "projects", "team"],
  visiteur: ["team"],
};

/** Espace d'un département, organisé en onglets :
 *  responsable / bureau → Vue d'ensemble · Projets · Équipe · Points d'étape
 *  membre               → Mes tâches · Projets · Équipe */
export default function DepartmentWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const departmentId = Number(id);
  const { t } = useI18n();
  const d = t.deptDetail;
  const w = t.workspace;
  const qc = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const searchParams = useSearchParams();

  const { data: department, isLoading } = useQuery({
    queryKey: ["department", departmentId],
    queryFn: () => departmentsService.get(departmentId).then((r) => r.data),
  });

  const viewerMode: ViewerMode = !department ? "visiteur"
    : department.can_manage ? "manager"
      : department.is_member ? "membre" : "visiteur";
  const insider = viewerMode !== "visiteur";
  const manager = viewerMode === "manager";

  // Projets et tâches : réservés aux membres du département et au bureau.
  const { data: projectsData, isLoading: loadingProjects } = useQuery({
    queryKey: ["projects", "by-department", departmentId],
    queryFn: () => projectsService.list(departmentId).then((r) => r.data),
    enabled: insider,
  });
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["department-tasks", departmentId],
    queryFn: () => projectsService.departmentTasks(departmentId).then((r) => r.data),
    enabled: insider,
  });
  const { data: checkins = [], isLoading: loadingCheckins } = useQuery({
    queryKey: ["checkins", departmentId],
    queryFn: () => engagementService.checkins.list(departmentId).then((r) => r.data),
    enabled: manager,
  });
  const today = todayIso();
  const { data: ranking } = useQuery({
    queryKey: ["ranking", "month", today, departmentId],
    queryFn: () => engagementService.ranking({ period: "month", date: today, department: departmentId }).then((r) => r.data),
    enabled: manager,
  });

  const tabs = TABS[viewerMode];
  // Anciennes adresses (?tab=overview / ?tab=checkins) : redirigées vers les nouveaux onglets.
  const rawTab = searchParams.get("tab");
  const requested = (rawTab === "overview" ? "today" : rawTab === "checkins" ? "team" : rawTab) as WorkspaceTab | null;
  const teamView: "members" | "checkins" = rawTab === "checkins" || searchParams.get("view") === "checkins" ? "checkins" : "members";
  const tab: WorkspaceTab = requested && tabs.includes(requested) ? requested : tabs[0];
  const selectedProjectId = Number(searchParams.get("project")) || null;

  /** Onglet (et projet) dans l'URL : partageable et conservé au rechargement. */
  const navigate = useCallback((next: WorkspaceTab, project?: number | null, view?: "members" | "checkins") => {
    const sp = new URLSearchParams(window.location.search);
    sp.set("tab", next);
    if (project) sp.set("project", String(project)); else sp.delete("project");
    if (view === "checkins") sp.set("view", "checkins"); else sp.delete("view");
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, []);

  const onTasksChanged = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["department-tasks", departmentId] });
    qc.invalidateQueries({ queryKey: ["projects", "my-tasks"] });
    qc.invalidateQueries({ queryKey: ["ranking"] });
    qc.invalidateQueries({ queryKey: ["my-points"] });
  }, [qc, departmentId]);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-64 bg-surface-strong rounded-lg" />
        <div className="h-10 w-96 bg-surface-strong rounded-lg" />
        <div className="h-72 bg-surface rounded-2xl border border-line-soft" />
      </div>
    );
  }
  if (!department) {
    return <p className="text-fg-muted">{d.notFound}</p>;
  }

  const projects: Project[] = Array.isArray(projectsData) ? projectsData : projectsData?.results ?? [];
  const current = (department.memberships ?? []).filter((m) => m.is_current);

  // Membres utilisables comme assignés de tâche : adhérents actuels + lead/co-lead
  // (nommer un lead ne crée pas forcément une adhésion datée).
  const assignees: Assignee[] = current.map((m) => ({ id: m.user_id, name: m.user_full_name }));
  for (const [leadId, name] of [[department.lead_id, department.lead_name], [department.co_lead_id, department.co_lead_name]] as const) {
    if (leadId && !assignees.some((a) => a.id === leadId)) assignees.unshift({ id: leadId, name: name ?? d.lead });
  }
  const toConfirm = checkins.filter((c) => c.status === "submitted").length;
  const myOpenTasks = viewerMode === "membre"
    ? tasks.filter((task) => task.assigned_to === currentUser?.id && task.status !== "done").length
    : 0;

  // Compteurs d'onglet : uniquement ce qui demande une action.
  const toAct = tasks.filter((task) => task.status === "submitted").length + toConfirm;
  const count: Partial<Record<WorkspaceTab, React.ReactNode>> = {
    today: toAct || undefined,
    tasks: myOpenTasks || undefined,
  };

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <header className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 px-4 sm:px-6 pt-4 sm:pt-6 bg-surface border-b border-line-soft">
        {hasSection(currentUser, "departments") && (
          <Link href="/manage/departments" className="inline-flex items-center gap-1.5 text-sm text-fg-subtle hover:text-brand-blue mb-2 transition-colors">
            <ArrowLeft size={14} /> {d.backToList}
          </Link>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-fg">{department.name}</h1>
          {manager && <Badge variant="orange">{d.lead}</Badge>}
          {viewerMode === "membre" && <Badge variant="blue">{t.labels.role.membre}</Badge>}
        </div>
        <p className="text-sm text-fg-muted mt-1">
          {[
            department.lead_name && w.leadLine(department.lead_name),
            department.co_lead_name && w.deputyLine(department.co_lead_name),
            t.departments.members(department.member_count),
          ].filter(Boolean).join(" · ")}
        </p>
        {department.description && <p className="text-sm text-fg-soft mt-2 max-w-3xl">{department.description}</p>}

        {tabs.length > 1 ? (
          <nav aria-label={w.sectionsLabel} className="flex gap-6 mt-4 overflow-x-auto -mb-px">
            {tabs.map((key) => {
              const isActive = key === tab;
              const badge = count[key];
              return (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-2 py-3 text-sm whitespace-nowrap border-b-[3px] transition-colors",
                    isActive ? "border-brand-orange text-fg font-semibold" : "border-transparent text-fg-muted hover:text-fg font-medium",
                  )}
                >
                  {w.tabs[key]}
                  {badge !== undefined && (
                    <span className={cn(
                      "text-[11px] font-bold rounded-full px-2 py-0.5",
                      key === "today" ? "bg-brand-orange/15 text-orange-800 dark:text-orange-300" : "bg-surface-strong text-fg-soft",
                    )}>{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        ) : (
          <div className="h-4" />
        )}
      </header>

      {viewerMode === "visiteur" && (
        <p className="bg-surface rounded-2xl border border-line-soft p-4 flex items-center gap-3 text-sm text-fg-muted">
          <FolderKanban size={18} className="text-fg-subtle shrink-0" /> {d.projectsMembersOnly}
        </p>
      )}

      {tab === "today" && (
        loadingCheckins || loadingTasks ? <TabSkeleton /> : (
          <OverviewTab
            departmentId={departmentId}
            tasks={tasks}
            checkins={checkins}
            ranking={ranking?.rows ?? []}
            currentUserId={currentUser?.id}
            onNavigate={(next, view) => navigate(next, null, view)}
            onTasksChanged={onTasksChanged}
          />
        )
      )}

      {tab === "tasks" && <MemberTasksTab department={department} projects={projects} />}

      {tab === "projects" && (
        <ProjectsTab
          departmentId={departmentId}
          projects={projects}
          tasks={tasks}
          isLoading={loadingProjects || loadingTasks}
          viewerMode={viewerMode}
          assignees={assignees}
          currentUserId={currentUser?.id}
          canManageProjects={department.can_manage_projects}
          selectedId={selectedProjectId}
          onSelect={(projectId) => navigate("projects", projectId)}
          onTasksChanged={onTasksChanged}
        />
      )}

      {tab === "team" && (
        <div className="space-y-5">
          {/* Responsable : l'équipe et ses points d'étape, sous le même onglet. */}
          {manager && (
            <div role="tablist" aria-label={w.tabs.team} className="inline-flex gap-1 p-1 bg-surface-strong rounded-xl">
              {(["members", "checkins"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={teamView === v}
                  onClick={() => navigate("team", null, v)}
                  className={cn("h-9 px-4 rounded-lg text-sm transition-all",
                    teamView === v ? "bg-surface shadow-sm font-semibold text-fg" : "text-fg-soft hover:text-fg")}>
                  {v === "members" ? w.teamMembers : t.checkins.title}
                  {v === "checkins" && toConfirm > 0 && (
                    <span className="ml-2 text-[11px] font-bold rounded-full px-2 py-0.5 bg-brand-orange/15 text-orange-800 dark:text-orange-300">{toConfirm}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {manager && teamView === "checkins" ? (
            loadingCheckins ? <TabSkeleton /> : (
              <CheckInsTab
                departmentId={departmentId}
                checkins={checkins}
                members={assignees.filter((a) => a.id !== currentUser?.id)}
                isLoading={loadingCheckins}
              />
            )
          ) : (
            <TeamTab
              department={department}
              viewerMode={viewerMode}
              currentUserId={currentUser?.id}
              tasks={tasks}
              checkins={checkins}
              ranking={ranking?.rows ?? []}
              canLaunchCheckins={manager}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 bg-surface rounded-2xl border border-line-soft" />)}
      </div>
      <div className="h-80 bg-surface rounded-2xl border border-line-soft" />
    </div>
  );
}
