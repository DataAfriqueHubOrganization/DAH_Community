"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, ChevronDown, FolderKanban, GitBranch, Pencil, Plus, Trash2, X,
} from "lucide-react";
import { projectsService } from "@/services/projects.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { TaskReviewControls } from "@/features/tasks/TaskReviewControls";
import { TaskDescription } from "@/features/tasks/TaskDescription";
import { RichTextEditor } from "@/components/RichTextEditor";
import { apiError } from "@/features/treasury/shared";
import type {
  Project, ProjectStatus, ProjectTask, ProjectTaskStatus, ProjectTaskWritePayload, ProjectWritePayload, TaskSize,
} from "@/types/projects.types";
import {
  Avatar, FilterChip, GroupTitle, inputClass, isLate, type Assignee, type ViewerMode,
} from "./shared";

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ["idea", "active", "paused", "completed", "archived"];
export const PROJECT_STATUS_VARIANT: Record<ProjectStatus, "blue" | "orange" | "green" | "gray"> = {
  idea: "gray", active: "blue", paused: "orange", completed: "green", archived: "gray",
};
const FINISHED: ProjectStatus[] = ["completed", "archived"];
/** Ordre d'affichage des groupes : ce qui demande une action d'abord. */
const GROUP_ORDER: ProjectTaskStatus[] = ["submitted", "in_progress", "todo", "blocked", "done"];
const GROUP_LIMIT = 5;

type TaskFilter = "all" | ProjectTaskStatus;

export function projectProgress(tasks: ProjectTask[]) {
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

export function ProjectsTab({
  departmentId, projects, tasks, isLoading, viewerMode, assignees, currentUserId, canManageProjects,
  selectedId, onSelect, onTasksChanged,
}: {
  departmentId: number;
  projects: Project[];
  tasks: ProjectTask[];
  isLoading: boolean;
  viewerMode: ViewerMode;
  assignees: Assignee[];
  currentUserId: number | undefined;
  /** Responsable, gestionnaire de projets ou section Départements. */
  canManageProjects: boolean;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onTasksChanged: () => void;
}) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const qc = useQueryClient();
  const [showFinished, setShowFinished] = useState(false);
  const [formProject, setFormProject] = useState<Project | "new" | null>(null);

  const ongoing = projects.filter((p) => !FINISHED.includes(p.status));
  const finished = projects.filter((p) => FINISHED.includes(p.status));
  const visible = showFinished ? [...ongoing, ...finished] : ongoing;
  // Par défaut : premier projet en cours (ou le premier tout court).
  const selected = projects.find((p) => p.id === selectedId) ?? ongoing[0] ?? projects[0] ?? null;
  const tasksOf = (projectId: number) => tasks.filter((task) => task.project === projectId);

  const deleteProject = useMutation({
    mutationFn: (projectId: number) => projectsService.delete(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", "by-department", departmentId] });
      onSelect(null);
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 bg-surface rounded-2xl border border-line-soft animate-pulse" />)}</div>
        <div className="h-96 bg-surface rounded-2xl border border-line-soft animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
      {/* Liste des projets */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-fg">{d.projects}</h2>
          {canManageProjects && (
            <button onClick={() => setFormProject("new")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-brand-deep">
              <Plus size={14} /> {d.newProject}
            </button>
          )}
        </div>
        {projects.length === 0 ? (
          <div className="text-center py-12 bg-surface rounded-2xl border border-line-soft">
            <FolderKanban size={36} className="mx-auto text-fg-faint mb-3" />
            <p className="text-fg-muted text-sm">{d.noProjects}</p>
          </div>
        ) : (
          <>
            {visible.map((project) => {
              const pTasks = tasksOf(project.id);
              const progress = projectProgress(pTasks);
              const toValidate = pTasks.filter((task) => task.status === "submitted").length;
              const late = pTasks.filter(isLate).length;
              const isSelected = selected?.id === project.id;
              return (
                <button
                  key={project.id}
                  onClick={() => onSelect(project.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    "w-full text-left bg-surface rounded-2xl border p-4 transition-shadow hover:shadow-md",
                    isSelected ? "border-brand-blue ring-3 ring-brand-blue/15" : "border-line-soft",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display font-bold text-sm text-fg">{project.title}</span>
                    <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{d.projectStatus[project.status]}</Badge>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-surface-strong overflow-hidden" aria-hidden="true">
                    <div className="h-full rounded-full bg-brand-blue" style={{ width: `${progress.pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2 text-xs">
                    <span className="text-fg-muted">{w.tasksValidated(progress.done, progress.total)}</span>
                    {toValidate > 0 ? (
                      <span className="font-semibold text-orange-700 dark:text-orange-300">{w.nToValidate(toValidate)}</span>
                    ) : late > 0 ? (
                      <span className="font-semibold text-red-600">{w.nLate(late)}</span>
                    ) : null}
                  </div>
                  {project.deadline && (
                    <p className="text-xs text-fg-subtle mt-1">{d.deadline} : {fmt.date(project.deadline)}</p>
                  )}
                </button>
              );
            })}
            {finished.length > 0 && (
              <button onClick={() => setShowFinished((v) => !v)} className="text-sm text-fg-muted hover:text-brand-blue px-1 py-1">
                {showFinished ? w.hideFinished : w.showFinished(finished.length)}
              </button>
            )}
          </>
        )}
      </div>

      {/* Projet sélectionné */}
      {selected ? (
        <ProjectDetail
          key={selected.id}
          project={selected}
          tasks={tasksOf(selected.id)}
          viewerMode={viewerMode}
          assignees={assignees}
          currentUserId={currentUserId}
          canManageProjects={canManageProjects}
          onEdit={() => setFormProject(selected)}
          onDelete={() => { if (confirm(d.confirmDeleteProject(selected.title))) deleteProject.mutate(selected.id); }}
          onTasksChanged={onTasksChanged}
        />
      ) : projects.length > 0 ? (
        <p className="text-sm text-fg-muted bg-surface rounded-2xl border border-line-soft p-8 text-center">{w.selectProject}</p>
      ) : null}

      {formProject && (
        <ProjectFormModal
          project={formProject === "new" ? null : formProject}
          departmentId={departmentId}
          onClose={() => setFormProject(null)}
          onSaved={(saved) => { setFormProject(null); onSelect(saved.id); }}
        />
      )}
    </div>
  );
}

function ProjectDetail({
  project, tasks, viewerMode, assignees, currentUserId, canManageProjects, onEdit, onDelete, onTasksChanged,
}: {
  project: Project;
  tasks: ProjectTask[];
  viewerMode: ViewerMode;
  assignees: Assignee[];
  currentUserId: number | undefined;
  canManageProjects: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTasksChanged: () => void;
}) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [assignee, setAssignee] = useState<string>("");
  const [showAssign, setShowAssign] = useState(false);
  const [editing, setEditing] = useState<ProjectTask | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const canManageProject = canManageProjects || project.owner_id === currentUserId;
  // Valider (et donc donner les points) : responsable / section Départements, jamais un gestionnaire de projets.
  const canValidate = viewerMode === "manager";
  const progress = projectProgress(tasks);
  const involved = new Set(tasks.map((task) => task.assigned_to).filter(Boolean)).size;

  const byAssignee = assignee ? tasks.filter((task) => String(task.assigned_to ?? "") === assignee) : tasks;
  const count = (s: ProjectTaskStatus) => byAssignee.filter((task) => task.status === s).length;
  const groups = GROUP_ORDER
    .filter((s) => filter === "all" || filter === s)
    .map((s) => ({
      status: s,
      items: byAssignee.filter((task) => task.status === s)
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")),
    }))
    .filter((g) => g.items.length > 0);

  const toggle = (key: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  return (
    <section className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-line-soft space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold text-fg">{project.title}</h2>
              <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{d.projectStatus[project.status]}</Badge>
            </div>
            {project.description && <p className="text-sm text-fg-muted mt-1.5 max-w-2xl">{project.description}</p>}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-fg-muted">
              {project.deadline && <span className="inline-flex items-center gap-1"><CalendarDays size={12} /> {d.deadline} : <b className="text-fg">{fmt.date(project.deadline)}</b></span>}
              <span>{w.tasksValidated(progress.done, progress.total)}</span>
              {involved > 0 && <span>{w.involved(involved)}</span>}
              {project.owner_name && <span>{d.ownedBy} {project.owner_name}</span>}
              {project.repository_url && (
                <a href={project.repository_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-blue hover:underline">
                  <GitBranch size={12} /> {d.repository}
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canManageProject && (
              <>
                <button onClick={onEdit} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line text-xs font-semibold text-fg-soft hover:bg-surface-muted">
                  <Pencil size={13} /> {t.common.edit}
                </button>
                <button onClick={onDelete} aria-label={t.common.delete} title={t.common.delete}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-line text-fg-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 size={14} />
                </button>
                <button onClick={() => { setEditing(null); setShowAssign((v) => !v); }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-brand-deep">
                  <Plus size={14} /> {d.assignTask}
                </button>
              </>
            )}
          </div>
        </div>

        {(showAssign || editing) && canManageProject && (
          <TaskForm
            key={editing?.id ?? "new"}
            projectId={project.id}
            task={editing}
            assignees={assignees}
            onDone={() => { setShowAssign(false); setEditing(null); onTasksChanged(); }}
            onCancel={() => { setShowAssign(false); setEditing(null); }}
          />
        )}

        {tasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>{w.filterAll} · {byAssignee.length}</FilterChip>
            {GROUP_ORDER.filter((s) => count(s) > 0 || s !== "blocked").map((s) => (
              <FilterChip key={s} active={filter === s} tone={s === "submitted" && count(s) > 0 ? "orange" : "default"} onClick={() => setFilter(s)}>
                {d.taskStatus[s]} · {count(s)}
              </FilterChip>
            ))}
            {canManageProject && (
              <label className="sm:ml-auto inline-flex items-center gap-2 h-8 pl-3 pr-1 border border-line rounded-full text-xs">
                <span className="text-fg-muted">{w.assigneeFilter}</span>
                <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="bg-transparent font-semibold text-fg focus:outline-none">
                  <option value="">{w.everyone}</option>
                  {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-subtle">{d.noTasks}</p>
        ) : groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-subtle">{w.noResult}</p>
        ) : (
          groups.map((g) => {
            const highlight = g.status === "submitted";
            // « Validées » repliées par défaut (sauf si on filtre dessus).
            const collapsed = g.status === "done" && filter !== "done" && !expanded.has("done");
            const showAll = expanded.has(`all-${g.status}`) || filter === g.status;
            const items = showAll ? g.items : g.items.slice(0, GROUP_LIMIT);
            return (
              <div key={g.status} className={cn("rounded-xl border overflow-hidden",
                highlight ? "border-brand-orange/45 bg-brand-orange/[0.04]" : "border-line-soft")}>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <GroupTitle count={g.items.length} tone={highlight ? "orange" : "default"}>{d.taskStatus[g.status]}</GroupTitle>
                  {g.status === "done" && filter !== "done" && (
                    <button onClick={() => toggle("done")} className="text-xs text-fg-muted hover:text-brand-blue inline-flex items-center gap-1">
                      {collapsed ? w.show : w.hide} <ChevronDown size={12} className={collapsed ? "" : "rotate-180"} />
                    </button>
                  )}
                </div>
                {!collapsed && (
                  <>
                    {items.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        highlight={highlight}
                        canValidate={canValidate && task.assigned_to !== currentUserId}
                        isAssignee={task.assigned_to === currentUserId}
                        canManage={canManageProject}
                        onEdit={() => { setShowAssign(false); setEditing(task); }}
                        onChanged={onTasksChanged}
                      />
                    ))}
                    {!showAll && g.items.length > GROUP_LIMIT && (
                      <button onClick={() => toggle(`all-${g.status}`)}
                        className="block w-full text-left px-4 py-2.5 border-t border-line-soft text-sm text-brand-blue hover:bg-surface-muted">
                        {w.showMore(g.items.length - GROUP_LIMIT)}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function TaskRow({
  task, highlight, canValidate, isAssignee, canManage, onEdit, onChanged,
}: {
  task: ProjectTask;
  highlight: boolean;
  canValidate: boolean;
  isAssignee: boolean;
  /** Modifier / réaffecter / supprimer la tâche. */
  canManage: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const qc = useQueryClient();
  const late = isLate(task);

  const remove = useMutation({
    mutationFn: () => projectsService.tasks.delete(task.project, task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", task.project, "tasks"] });
      onChanged();
    },
  });

  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3 border-t text-sm",
      highlight ? "border-brand-orange/25" : "border-line-soft")}>
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {task.assigned_to_name ? <Avatar name={task.assigned_to_name} size={28} /> : <span className="w-7 h-7 rounded-full bg-surface-strong shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", task.status === "done" ? "text-fg-muted" : "text-fg")}>{task.title}</p>
          <p className="text-xs text-fg-muted mt-0.5">
            {task.assigned_to_name ?? d.unassigned}
            {task.status === "submitted" && task.submitted_at
              ? ` · ${w.submittedOn(fmt.date(task.submitted_at))}`
              : task.due_date ? <> · <span className={late ? "font-semibold text-red-600" : ""}>{w.dueOn(fmt.date(task.due_date))}</span></> : null}
            {` · ${t.tasks.size[task.size]}`}
          </p>
          <TaskDescription description={task.description} />
        </div>
      </div>
      <div className="flex items-start gap-1 sm:justify-end pl-10 sm:pl-0">
        <TaskReviewControls task={task} canValidate={canValidate} isAssignee={isAssignee} onChanged={onChanged} />
        {canManage && task.status !== "done" && (
          <button onClick={onEdit} aria-label={d.editTask} title={d.editTask}
            className="p-1.5 text-fg-faint hover:text-brand-blue rounded-lg hover:bg-surface-muted shrink-0">
            <Pencil size={14} />
          </button>
        )}
        {canManage && (
          <button onClick={() => { if (confirm(d.confirmDeleteTask)) remove.mutate(); }}
            aria-label={t.common.delete} title={t.common.delete}
            className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 shrink-0">
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function TaskForm({
  projectId, task, assignees, onDone, onCancel,
}: {
  projectId: number;
  /** Tâche à modifier ; null = nouvelle tâche. */
  task: ProjectTask | null;
  assignees: Assignee[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const d = t.deptDetail;
  const qc = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ? String(task.assigned_to) : "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [size, setSize] = useState<TaskSize>(task?.size ?? "medium");
  // La personne affectée (si elle a changé) reçoit un email.
  const notifies = !!assignedTo && assignedTo !== String(task?.assigned_to ?? "");

  const save = useMutation({
    mutationFn: () => {
      const payload: ProjectTaskWritePayload = {
        title, description, assigned_to: assignedTo ? Number(assignedTo) : null, due_date: dueDate || null, size,
      };
      return task ? projectsService.tasks.update(projectId, task.id, payload) : projectsService.tasks.create(projectId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "tasks"] });
      onDone();
    },
  });

  return (
    <div className="bg-surface-muted rounded-xl p-4 space-y-3">
      {task && <p className="text-xs font-semibold text-fg-soft">{d.editTask}</p>}
      <input placeholder={d.taskTitle} aria-label={d.taskTitle} value={title} onChange={(e) => setTitle(e.target.value)} className={cn(inputClass, "w-full")} />
      <RichTextEditor value={description} onChange={setDescription} minHeight={110}
        placeholder={d.taskDescriptionPlaceholder} label={d.descriptionOptional} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor={`assign-to-${projectId}`} className="block text-xs text-fg-muted mb-1">{d.assignedTo}</label>
          <select id={`assign-to-${projectId}`} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={cn(inputClass, "w-full")}>
            <option value="">{d.unassigned}</option>
            {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`assign-due-${projectId}`} className="block text-xs text-fg-muted mb-1">{d.deadlineOptional}</label>
          <input id={`assign-due-${projectId}`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={cn(inputClass, "w-full")} />
        </div>
        <div>
          <label htmlFor={`assign-size-${projectId}`} className="block text-xs text-fg-muted mb-1">{t.tasks.sizeLabel}</label>
          <select id={`assign-size-${projectId}`} value={size} onChange={(e) => setSize(e.target.value as TaskSize)} className={cn(inputClass, "w-full")}>
            {(["small", "medium", "large"] as TaskSize[]).map((v) => <option key={v} value={v}>{t.tasks.sizeOption[v]}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-fg-subtle">{t.tasks.sizeHint}{notifies && <> · {d.assigneeNotified}</>}</p>
      {save.isError && <p className="text-red-500 text-xs">{apiError(save.error, d.assignError)}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface">{t.common.cancel}</button>
        <button onClick={() => save.mutate()} disabled={!title.trim() || save.isPending}
          className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
          {save.isPending ? t.common.saving : task ? t.common.save : d.assign}
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
  onSaved: (saved: Project) => void;
}) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const d = t.deptDetail;
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "idea");
  const [deadline, setDeadline] = useState(project?.deadline ?? "");
  const [repositoryUrl, setRepositoryUrl] = useState(project?.repository_url ?? "");

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ProjectWritePayload = {
        title, description, status, department: departmentId, deadline: deadline || null, repository_url: repositoryUrl,
      };
      return project ? projectsService.update(project.id, payload) : projectsService.create(payload);
    },
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["projects", "by-department", departmentId] });
      onSaved(data);
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="project-form-title">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 id="project-form-title" className="font-semibold text-fg">{project ? d.editProject : d.newProject}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="pf-title" className="text-xs text-fg-muted mb-1 block">{t.manageEvents.title}</label>
            <input id="pf-title" value={title} onChange={(e) => setTitle(e.target.value)} className={cn(inputClass, "w-full")} />
          </div>
          <div>
            <label htmlFor="pf-desc" className="text-xs text-fg-muted mb-1 block">{t.myProfile.description}</label>
            <textarea id="pf-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={cn(inputClass, "w-full resize-none")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pf-status" className="text-xs text-fg-muted mb-1 block">{t.common.status}</label>
              <select id="pf-status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} className={cn(inputClass, "w-full")}>
                {PROJECT_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{d.projectStatus[o]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="pf-deadline" className="text-xs text-fg-muted mb-1 block">{d.deadline}</label>
              <input id="pf-deadline" type="date" value={deadline ?? ""} onChange={(e) => setDeadline(e.target.value)} className={cn(inputClass, "w-full")} />
            </div>
          </div>
          <div>
            <label htmlFor="pf-repo" className="text-xs text-fg-muted mb-1 block">{d.repositoryOptional}</label>
            <input id="pf-repo" value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} placeholder="https://github.com/..." className={cn(inputClass, "w-full")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => mutation.mutate()} disabled={!title || !description || mutation.isPending}
            className="px-4 py-2 text-sm bg-brand-blue text-white rounded-xl font-semibold hover:bg-brand-deep disabled:opacity-50">
            {mutation.isPending ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
