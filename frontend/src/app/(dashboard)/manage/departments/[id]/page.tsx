"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { departmentsService } from "@/services/departments.service";
import { projectsService } from "@/services/projects.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { isBureau } from "@/types/auth.types";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { MemberSearchSelect } from "@/components/MemberSearchSelect";
import { Badge } from "@/components/ui/Badge";
import {
  ArrowLeft, Users, UserPlus, CircleX, Trash2, FolderKanban, Plus, X,
  CalendarDays, GitBranch, ListChecks, Pencil, ChevronDown, ArrowUpDown,
} from "lucide-react";
import type { Project, ProjectStatus, ProjectTask, ProjectTaskStatus, ProjectWritePayload, ProjectTaskWritePayload } from "@/types/projects.types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type SortDir = "asc" | "desc";

/** Trie par échéance — les tâches sans échéance restent toujours en fin de liste,
 * quel que soit le sens du tri. */
function sortByDueDate(tasks: ProjectTask[], dir: SortDir): ProjectTask[] {
  return [...tasks].sort((a, b) => {
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    const diff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    return dir === "asc" ? diff : -diff;
  });
}

function SortToggle({ dir, onToggle }: { dir: SortDir; onToggle: () => void }) {
  const { t: tr } = useI18n();
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-brand-blue transition-colors shrink-0"
      title={tr.deptDetail.changeSort}
    >
      <ArrowUpDown size={12} />
      {dir === "asc" ? tr.deptDetail.sortNearest : tr.deptDetail.sortFurthest}
    </button>
  );
}

interface DateRange { from: string; to: string; }
const EMPTY_RANGE: DateRange = { from: "", to: "" };

/** Ne garde que les tâches dont l'échéance tombe dans la période — tant que la
 * période est vide, aucun filtre n'est appliqué (les tâches sans échéance restent
 * visibles ; dès qu'une borne est posée, elles sortent de la liste). */
function filterByDateRange(tasks: ProjectTask[], range: DateRange): ProjectTask[] {
  if (!range.from && !range.to) return tasks;
  return tasks.filter((t) => {
    if (!t.due_date) return false;
    if (range.from && t.due_date < range.from) return false;
    if (range.to && t.due_date > range.to) return false;
    return true;
  });
}

function DateRangeFilter({ range, onChange }: { range: DateRange; onChange: (range: DateRange) => void }) {
  const active = !!range.from || !!range.to;
  const { t: tr } = useI18n();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label className="text-xs text-fg-subtle">{tr.deptDetail.from}</label>
      <input
        type="date"
        aria-label={tr.deptDetail.from}
        value={range.from}
        onChange={(e) => onChange({ ...range, from: e.target.value })}
        className="border border-line rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      <label className="text-xs text-fg-subtle">{tr.deptDetail.to}</label>
      <input
        type="date"
        aria-label={tr.deptDetail.to}
        value={range.to}
        onChange={(e) => onChange({ ...range, to: e.target.value })}
        className="border border-line rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      {active && (
        <button onClick={() => onChange(EMPTY_RANGE)} className="text-xs text-fg-subtle hover:text-brand-blue underline">
          {tr.portfolio.reset}
        </button>
      )}
    </div>
  );
}

// Libellés : t.deptDetail.projectStatus / taskStatus
const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ["idea", "active", "paused", "completed", "archived"];
const PROJECT_STATUS_VARIANT: Record<ProjectStatus, "blue" | "orange" | "green" | "gray"> = {
  idea: "gray", active: "blue", paused: "orange", completed: "green", archived: "gray",
};

const TASK_STATUS_OPTIONS: ProjectTaskStatus[] = ["todo", "in_progress", "done", "blocked"];
const TASK_STATUS_VARIANT: Record<ProjectTaskStatus, "blue" | "green" | "red" | "gray"> = {
  todo: "gray", in_progress: "blue", done: "green", blocked: "red",
};

export default function DepartmentWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const departmentId = Number(id);
  const { t: tr, fmt } = useI18n();
  const d = tr.deptDetail;
  const qc = useQueryClient();
  const { data: currentUser } = useCurrentUser();

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [myTasksSort, setMyTasksSort] = useState<SortDir>("asc");
  const [myTasksRange, setMyTasksRange] = useState<DateRange>(EMPTY_RANGE);

  const { data: department, isLoading } = useQuery({
    queryKey: ["department", departmentId],
    queryFn: () => departmentsService.get(departmentId).then((r) => r.data),
  });

  const { data: membersData } = useQuery({
    queryKey: ["department", departmentId, "searchable-members"],
    queryFn: () => departmentsService.searchableMembers(departmentId).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
    enabled: !!department?.can_manage,
  });

  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ["projects", "by-department", departmentId],
    queryFn: () => projectsService.list(departmentId).then((r) => r.data),
    enabled: !!department,
  });

  const { data: myTasks } = useQuery({
    queryKey: ["projects", "my-tasks"],
    queryFn: () => projectsService.myTasks().then((r) => r.data),
    enabled: !!department?.is_member && !department?.can_manage,
  });

  const addMember = useMutation({
    mutationFn: () =>
      departmentsService.addMember(departmentId, {
        user_id: selectedUserId as number,
        start_date: startDate,
        end_date: endDate || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["department", departmentId] });
      setSelectedUserId(null);
      setEndDate("");
    },
  });

  const endMembership = useMutation({
    mutationFn: (membershipId: number) => departmentsService.endMembership(departmentId, membershipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["department", departmentId] }),
  });

  const removeMembership = useMutation({
    mutationFn: (membershipId: number) => departmentsService.removeMembership(departmentId, membershipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["department", departmentId] }),
  });

  const deleteProject = useMutation({
    mutationFn: (projectId: number) => projectsService.delete(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", "by-department", departmentId] });
      setSelectedProjectId(null);
    },
  });

  if (isLoading) {
    return <div className="h-40 bg-surface rounded-2xl border border-line-soft animate-pulse" />;
  }
  if (!department) {
    return <p className="text-fg-muted">{d.notFound}</p>;
  }

  const members = membersData ?? [];
  const memberships = department.memberships ?? [];
  const current = memberships.filter((m) => m.is_current);
  const history = memberships.filter((m) => !m.is_current);
  const projects: Project[] = Array.isArray(projectsData) ? projectsData : projectsData?.results ?? [];
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  const viewerMode: "manager" | "membre" | "visiteur" = department.can_manage
    ? "manager"
    : department.is_member
      ? "membre"
      : "visiteur";

  // Membres utilisables comme assignés de tâche : adhérents actuels + lead/co-lead
  // (nommer un lead ne crée pas forcément une adhésion datée).
  const assignees = current.map((m) => ({ id: m.user_id, name: m.user_full_name }));
  if (department.lead_id && !assignees.some((a) => a.id === department.lead_id)) {
    assignees.unshift({ id: department.lead_id, name: department.lead_name ?? d.lead });
  }
  if (department.co_lead_id && !assignees.some((a) => a.id === department.co_lead_id)) {
    assignees.unshift({ id: department.co_lead_id, name: department.co_lead_name ?? d.deputy });
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/manage/departments" className="flex items-center gap-1.5 text-sm text-fg-subtle hover:text-brand-blue mb-2 transition-colors">
          <ArrowLeft size={14} /> {d.backToList}
        </Link>
        <h1 className="text-2xl font-bold text-fg">{department.name}</h1>
        {department.description && <p className="text-fg-muted text-sm mt-1">{department.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {viewerMode === "manager" && <Badge variant="orange">{d.lead}</Badge>}
          {viewerMode === "membre" && <Badge variant="blue">{tr.labels.role.membre}</Badge>}
          <Badge variant="gray">{tr.departments.members(department.member_count)}</Badge>
        </div>
      </div>

      {viewerMode === "manager" && (
        <div className="bg-surface rounded-2xl border border-line-soft p-5">
          <h2 className="font-medium text-fg text-sm mb-3 flex items-center gap-2"><UserPlus size={16} /> {d.addMember}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <MemberSearchSelect members={members} value={selectedUserId} onChange={setSelectedUserId} allowClear={false} />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{d.sinceDate}</label>
              <input type="date" aria-label={d.sinceDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{d.untilDate}</label>
              <input type="date" aria-label={d.untilDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>
          {addMember.isError && (
            <p className="text-red-500 text-xs mt-2">
              {d.addMemberError}
            </p>
          )}
          <div className="flex justify-end mt-3">
            <button
              onClick={() => addMember.mutate()}
              disabled={!selectedUserId || addMember.isPending}
              className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {addMember.isPending ? d.adding : tr.common.add}
            </button>
          </div>
        </div>
      )}

      {/* Équipe */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">{d.team} · {current.length}</h2>
        <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
          {current.length === 0 ? (
            <div className="py-10 text-center text-fg-subtle text-sm">{d.noMembers}</div>
          ) : (
            <div className="divide-y divide-line-soft">
              {current.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                  <img src={avatarUrl(m.user_full_name, 36)} alt={m.user_full_name} className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-fg text-sm">
                      {m.user_full_name}
                      {m.user_id === department.lead_id && <span className="text-orange-600 text-xs font-medium"> · {d.lead}</span>}
                      {m.user_id === department.co_lead_id && <span className="text-orange-600 text-xs font-medium"> · {d.deputy}</span>}
                    </p>
                    <p className="text-fg-subtle text-xs">
                      {d.sinceDate} {fmt.date(m.start_date)}
                      {m.end_date && ` · ${d.until} ${fmt.date(m.end_date)}`}
                    </p>
                  </div>
                  {viewerMode === "manager" && (
                    <>
                      <button
                        onClick={() => endMembership.mutate(m.id)}
                        disabled={endMembership.isPending}
                        className="flex items-center gap-1.5 text-fg-subtle hover:text-brand-orange text-xs font-medium transition-colors"
                        title={d.endMembershipTitle}
                      >
                        <CircleX size={14} /> {d.end}
                      </button>
                      <button
                        onClick={() => { if (confirm(d.confirmDeleteMembership)) removeMembership.mutate(m.id); }}
                        className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title={tr.common.delete}
                        aria-label={tr.common.delete}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {viewerMode === "manager" && history.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">{d.history} · {history.length}</h2>
          <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden divide-y divide-line-soft">
            {history.map((m) => (
              <div key={m.id} className="flex items-center gap-4 px-5 py-4 opacity-70">
                <img src={avatarUrl(m.user_full_name, 36)} alt={m.user_full_name} className="w-9 h-9 rounded-full shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-fg text-sm">{m.user_full_name}</p>
                  <p className="text-fg-subtle text-xs">{d.fromTo(fmt.date(m.start_date), m.end_date ? fmt.date(m.end_date) : "?")}</p>
                </div>
                <button
                  onClick={() => { if (confirm(d.confirmDeleteMembership)) removeMembership.mutate(m.id); }}
                  className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                  title={tr.common.delete}
                        aria-label={tr.common.delete}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Projets */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">{d.projects} · {projects.length}</h2>
          {viewerMode === "manager" && (
            <button
              onClick={() => setShowProjectForm(true)}
              className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline"
            >
              <Plus size={14} /> {d.newProject}
            </button>
          )}
        </div>
        {isLoadingProjects ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(2)].map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-line-soft p-5 h-36 animate-pulse" />)}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-line-soft">
            <FolderKanban size={40} className="mx-auto text-fg-faint mb-3" />
            <p className="text-fg-muted text-sm">{d.noProjects}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setSelectedProjectId(project.id)}
                className={`text-left bg-surface rounded-2xl border p-5 hover:shadow-md transition-shadow flex flex-col gap-2 ${
                  selectedProjectId === project.id ? "border-brand-blue" : "border-line-soft"
                }`}
              >
                <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{d.projectStatus[project.status]}</Badge>
                <h3 className="font-semibold text-fg text-sm">{project.title}</h3>
                <p className="text-fg-muted text-xs line-clamp-2 flex-1">{project.description}</p>
                <div className="text-xs text-fg-subtle">
                  {project.owner_name && <span>{d.ownedBy} {project.owner_name}</span>}
                  {project.deadline && <span>{project.owner_name ? " · " : ""}{d.deadline} : {fmt.date(project.deadline)}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedProject && (
        <ProjectDetailPanel
          project={selectedProject}
          assignees={assignees}
          currentUserId={currentUser?.id}
          isBureauUser={!!currentUser && isBureau(currentUser)}
          viewerMode={viewerMode}
          onClose={() => setSelectedProjectId(null)}
          onEdit={() => setEditingProject(selectedProject)}
          onDelete={() => { if (confirm(d.confirmDeleteProject(selectedProject.title))) deleteProject.mutate(selectedProject.id); }}
        />
      )}

      {viewerMode === "membre" && myTasks && myTasks.length > 0 && (
        <section>
          <div className="flex flex-wrap items-center justify-between mb-2 gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted flex items-center gap-1.5">
              <ListChecks size={13} /> {d.myTasks} · {filterByDateRange(myTasks, myTasksRange).length}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <DateRangeFilter range={myTasksRange} onChange={setMyTasksRange} />
              <SortToggle dir={myTasksSort} onToggle={() => setMyTasksSort((d) => (d === "asc" ? "desc" : "asc"))} />
            </div>
          </div>
          <div className="bg-surface rounded-2xl border border-line-soft divide-y divide-line-soft">
            {sortByDueDate(filterByDateRange(myTasks, myTasksRange), myTasksSort).map((t) => (
              <MyTaskRow key={t.id} task={t} />
            ))}
            {filterByDateRange(myTasks, myTasksRange).length === 0 && (
              <div className="py-8 text-center text-fg-subtle text-sm">{d.noTasksInRange}</div>
            )}
          </div>
        </section>
      )}

      {(showProjectForm || editingProject) && (
        <ProjectFormModal
          project={editingProject}
          departmentId={departmentId}
          onClose={() => { setShowProjectForm(false); setEditingProject(null); }}
          onSaved={() => { setShowProjectForm(false); setEditingProject(null); }}
        />
      )}
    </div>
  );
}

function MyTaskRow({ task }: { task: ProjectTask }) {
  const qc = useQueryClient();
  const { t: tr, fmt } = useI18n();
  const updateStatus = useMutation({
    mutationFn: (taskStatus: ProjectTaskStatus) => projectsService.tasks.updateStatus(task.project, task.id, taskStatus),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects", "my-tasks"] }),
  });

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-fg text-sm">{task.title}</p>
        <p className="text-fg-subtle text-xs mt-0.5">
          {task.project_title}
          {task.due_date && ` · ${tr.deptDetail.dueLower} ${fmt.date(task.due_date)}`}
        </p>
      </div>
      <select
        value={task.status}
        onChange={(e) => updateStatus.mutate(e.target.value as ProjectTaskStatus)}
        className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 shrink-0 ${
          { todo: "bg-surface-strong text-fg-soft", in_progress: "bg-blue-50 text-brand-blue", done: "bg-green-50 text-green-600", blocked: "bg-red-50 text-red-500" }[task.status]
        }`}
      >
        {TASK_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{tr.deptDetail.taskStatus[o]}</option>)}
      </select>
    </div>
  );
}

function ProjectDetailPanel({
  project, assignees, currentUserId, isBureauUser, viewerMode, onClose, onEdit, onDelete,
}: {
  project: Project;
  assignees: { id: number; name: string }[];
  currentUserId: number | undefined;
  isBureauUser: boolean;
  viewerMode: "manager" | "membre" | "visiteur";
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const { t: tr, fmt } = useI18n();
  const d = tr.deptDetail;
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [expandedDesc, setExpandedDesc] = useState<Set<number>>(new Set());
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  const { data: tasks = [] } = useQuery({
    queryKey: ["project", project.id, "tasks"],
    queryFn: () => projectsService.tasks.list(project.id).then((r) => r.data),
  });

  const canManageProject = isBureauUser || project.owner_id === currentUserId;
  const showDescriptions = viewerMode !== "visiteur";

  const invalidateTasks = () => qc.invalidateQueries({ queryKey: ["project", project.id, "tasks"] });

  const deleteTask = useMutation({
    mutationFn: (taskId: number) => projectsService.tasks.delete(project.id, taskId),
    onSuccess: invalidateTasks,
  });

  const updateTaskStatus = useMutation({
    mutationFn: ({ taskId, taskStatus }: { taskId: number; taskStatus: ProjectTaskStatus }) =>
      projectsService.tasks.updateStatus(project.id, taskId, taskStatus),
    onSuccess: invalidateTasks,
  });

  function toggleDesc(taskId: number) {
    setExpandedDesc((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }

  return (
    <section className="bg-surface rounded-2xl border border-brand-blue/20 overflow-hidden">
      <div className="px-5 py-4 border-b border-line-soft flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-fg">{project.title}</h3>
          <p className="text-fg-muted text-xs mt-1">{project.description}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-fg-subtle">
            {project.deadline && <span className="flex items-center gap-1"><CalendarDays size={11} /> {d.deadline} : {fmt.date(project.deadline)}</span>}
            {project.repository_url && (
              <a href={project.repository_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-brand-blue hover:underline">
                <GitBranch size={11} /> {d.repository}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {canManageProject && (
            <>
              <button onClick={onEdit} title={tr.common.edit} aria-label={tr.common.edit} className="p-1.5 text-fg-faint hover:text-brand-blue rounded-lg hover:bg-brand-blue/5 transition-colors"><Pencil size={14} /></button>
              <button onClick={onDelete} title={tr.common.delete}
                        aria-label={tr.common.delete} className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
            </>
          )}
          <button onClick={onClose} title={tr.common.close} aria-label={tr.common.close} className="p-1.5 text-fg-faint hover:text-fg-soft rounded-lg hover:bg-surface-muted transition-colors"><X size={16} /></button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-8 text-center text-fg-subtle text-sm">{d.noTasks}</div>
      ) : (
        <>
          <div className="px-5 py-2.5 border-b border-line-soft flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-fg-subtle">{d.tasks(filterByDateRange(tasks, dateRange).length)}</span>
            <div className="flex flex-wrap items-center gap-3">
              <DateRangeFilter range={dateRange} onChange={setDateRange} />
              <SortToggle dir={sortDir} onToggle={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} />
            </div>
          </div>
          {filterByDateRange(tasks, dateRange).length === 0 && (
            <div className="py-8 text-center text-fg-subtle text-sm">{d.noTasksInRange}</div>
          )}
          <div className="divide-y divide-line-soft">
          {sortByDueDate(filterByDateRange(tasks, dateRange), sortDir).map((t) => {
            const canSetAnyStatus = canManageProject;
            const canSetOwnStatus = t.assigned_to === currentUserId;
            const isExpanded = expandedDesc.has(t.id);
            return (
              <div key={t.id} className="flex items-start gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${t.status === "done" ? "text-fg-subtle line-through" : "text-fg"}`}>{t.title}</p>
                  {showDescriptions && t.description && (
                    <div className="mt-1">
                      <p className={`text-fg-muted text-xs ${isExpanded ? "" : "line-clamp-2"}`}>{t.description}</p>
                      <button onClick={() => toggleDesc(t.id)} className="text-brand-blue text-xs font-medium mt-0.5 flex items-center gap-0.5 hover:underline">
                        {isExpanded ? tr.sidebar.collapse : d.moreDetails}
                        <ChevronDown size={12} className={isExpanded ? "rotate-180" : ""} />
                      </button>
                    </div>
                  )}
                  <p className="text-fg-subtle text-xs mt-1">
                    {t.assigned_to_name ?? d.unassigned} · {d.assignedOn} {fmt.date(t.created_at)}
                    {t.due_date && ` · ${d.dueLower} ${fmt.date(t.due_date)}`}
                  </p>
                </div>
                {canSetAnyStatus || canSetOwnStatus ? (
                  <select
                    value={t.status}
                    onChange={(e) => updateTaskStatus.mutate({ taskId: t.id, taskStatus: e.target.value as ProjectTaskStatus })}
                    className={`text-xs font-medium rounded-full px-3 py-1.5 border-0 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 shrink-0 ${
                      { todo: "bg-surface-strong text-fg-soft", in_progress: "bg-blue-50 text-brand-blue", done: "bg-green-50 text-green-600", blocked: "bg-red-50 text-red-500" }[t.status]
                    }`}
                  >
                    {TASK_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{tr.deptDetail.taskStatus[o]}</option>)}
                  </select>
                ) : (
                  <Badge variant={TASK_STATUS_VARIANT[t.status]}>{tr.deptDetail.taskStatus[t.status]}</Badge>
                )}
                {canManageProject && (
                  <button
                    onClick={() => { if (confirm(d.confirmDeleteTask)) deleteTask.mutate(t.id); }}
                    title={tr.common.delete}
                        aria-label={tr.common.delete}
                    className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </>
      )}

      {canManageProject && (
        <div className="p-5 pt-3">
          {!showAssignForm ? (
            <button
              onClick={() => setShowAssignForm(true)}
              className="w-full text-left border border-dashed border-line rounded-xl px-4 py-2.5 text-sm text-brand-blue font-medium hover:bg-brand-blue/5 hover:border-brand-blue/40 transition-colors flex items-center gap-2"
            >
              <Plus size={15} /> {d.assignTask}
            </button>
          ) : (
            <AssignTaskForm
              projectId={project.id}
              assignees={assignees}
              onDone={() => { setShowAssignForm(false); invalidateTasks(); }}
              onCancel={() => setShowAssignForm(false)}
            />
          )}
        </div>
      )}
    </section>
  );
}

function AssignTaskForm({
  projectId, assignees, onDone, onCancel,
}: {
  projectId: number;
  assignees: { id: number; name: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t: tr } = useI18n();
  const d = tr.deptDetail;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState("");

  const createTask = useMutation({
    mutationFn: () => {
      const payload: ProjectTaskWritePayload = {
        title,
        description,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        due_date: dueDate || null,
      };
      return projectsService.tasks.create(projectId, payload);
    },
    onSuccess: onDone,
  });

  return (
    <div className="bg-surface-muted rounded-xl p-4 space-y-3">
      <input
        placeholder={d.taskTitle}
        aria-label={d.taskTitle}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      <div>
        <label className="block text-xs text-fg-muted mb-1">{d.descriptionOptional}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder={d.taskDescriptionPlaceholder}
          aria-label={d.descriptionOptional}
          className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-fg-muted mb-1">{d.assignedTo}</label>
          <select aria-label={d.assignedTo} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface">
            <option value="">{d.unassigned}</option>
            {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-fg-muted mb-1">{d.deadlineOptional}</label>
          <input type="date" aria-label={d.deadlineOptional} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
        </div>
      </div>
      {createTask.isError && (
        <p className="text-red-500 text-xs">{d.assignError}</p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface">{tr.common.cancel}</button>
        <button
          onClick={() => createTask.mutate()}
          disabled={!title || createTask.isPending}
          className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {createTask.isPending ? tr.auth.creating : d.assign}
        </button>
      </div>
    </div>
  );
}

function ProjectFormModal({
  project, departmentId, onClose, onSaved,
}: {
  project: Project | null;
  departmentId: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { t: tr } = useI18n();
  const d = tr.deptDetail;
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "idea");
  const [deadline, setDeadline] = useState(project?.deadline ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState(project?.repository_url ?? "");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ProjectWritePayload = {
        title, description, status, department: departmentId,
        deadline: deadline || null, repository_url: repositoryUrl,
      };
      return project ? projectsService.update(project.id, payload) : projectsService.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", "by-department", departmentId] });
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-fg">{project ? d.editProject : d.newProject}</h2>
          <button onClick={onClose} aria-label={tr.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-fg-muted mb-1 block">{tr.manageEvents.title}</label>
            <input aria-label={tr.manageEvents.title} value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <label className="text-xs text-fg-muted mb-1 block">{tr.myProfile.description}</label>
            <textarea aria-label={tr.myProfile.description} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-fg-muted mb-1 block">{tr.common.status}</label>
              <select aria-label={tr.common.status} value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface">
                {PROJECT_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{tr.deptDetail.projectStatus[o]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-fg-muted mb-1 block">{d.deadline}</label>
              <input type="date" aria-label={d.deadline} value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value)} className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>
          <div>
            <label className="text-xs text-fg-muted mb-1 block">{d.repositoryOptional}</label>
            <input aria-label={d.repositoryOptional} value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} placeholder="https://github.com/..." className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface-muted">{tr.common.cancel}</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!title || !description || mutation.isPending}
            className="px-4 py-2 text-sm bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {mutation.isPending ? tr.common.saving : tr.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
