"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, FolderKanban, GitBranch, Pencil, Plus, Trash2, X } from "lucide-react";
import { projectsService } from "@/services/projects.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { TaskReviewControls } from "@/features/tasks/TaskReviewControls";
import { TaskDescription } from "@/features/tasks/TaskDescription";
import { RichTextEditor } from "@/components/RichTextEditor";
import { apiError } from "@/features/treasury/shared";
import type {
  Project, ProjectStatus, ProjectTask, ProjectTaskWritePayload, ProjectWritePayload, TaskWeight,
} from "@/types/projects.types";
import { Avatar, inputClass, isLate, type Assignee, type ViewerMode } from "./shared";
import { NewProjectWizard } from "./NewProjectWizard";

const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ["idea", "active", "paused", "completed", "archived"];
export const PROJECT_STATUS_VARIANT: Record<ProjectStatus, "blue" | "orange" | "green" | "gray"> = {
  idea: "gray", active: "blue", paused: "orange", completed: "green", archived: "gray",
};
const FINISHED: ProjectStatus[] = ["completed", "archived"];

/** Colonnes du tableau d'un projet : ce qui reste, ce qui avance, ce qui attend
 *  le responsable, ce qui est fait. Une tâche bloquée reste « En cours ». */
type Column = "todo" | "doing" | "review" | "done";
const COLUMNS: Column[] = ["todo", "doing", "review", "done"];
const columnOf = (task: ProjectTask): Column =>
  task.status === "todo" ? "todo"
    : task.status === "submitted" ? "review"
      : task.status === "done" ? "done" : "doing";
const DONE_LIMIT = 5;

export function projectProgress(tasks: ProjectTask[]) {
  const done = tasks.filter((t) => t.status === "done").length;
  return { done, total: tasks.length, pct: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}

/** Texte brut d'une description (HTML de l'éditeur) pour un aperçu d'une ligne. */
const preview = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

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
  const [showArchives, setShowArchives] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const deleteProject = useMutation({
    mutationFn: (projectId: number) => projectsService.delete(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", "by-department", departmentId] });
      onSelect(null);
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 bg-surface rounded-2xl border border-line-soft animate-pulse" />)}
      </div>
    );
  }

  const tasksOf = (projectId: number) => tasks.filter((task) => task.project === projectId);
  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const modals = (
    <>
      {creating && (
        <NewProjectWizard
          departmentId={departmentId}
          assignees={assignees}
          onClose={() => setCreating(false)}
          onCreated={(project) => { setCreating(false); onTasksChanged(); onSelect(project.id); }}
        />
      )}
      {editing && (
        <ProjectFormModal
          project={editing}
          departmentId={departmentId}
          onClose={() => setEditing(null)}
          onSaved={() => setEditing(null)}
        />
      )}
    </>
  );

  // ── Un projet : son tableau de tâches ──
  if (selected) {
    return (
      <>
        <ProjectBoard
          project={selected}
          tasks={tasksOf(selected.id)}
          viewerMode={viewerMode}
          assignees={assignees}
          currentUserId={currentUserId}
          canManageProjects={canManageProjects}
          onBack={() => onSelect(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => { if (confirm(d.confirmDeleteProject(selected.title))) deleteProject.mutate(selected.id); }}
          onTasksChanged={onTasksChanged}
        />
        {modals}
      </>
    );
  }

  // ── Tous les projets ──
  const ongoing = projects.filter((p) => !FINISHED.includes(p.status));
  const finished = projects.filter((p) => FINISHED.includes(p.status));
  const visible = showArchives ? [...ongoing, ...finished] : ongoing;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold text-lg text-fg">{w.projectsInProgress(ongoing.length)}</h2>
        {canManageProjects && (
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep">
            <Plus size={16} aria-hidden="true" /> {d.newProject}
          </button>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-14 bg-surface rounded-2xl border border-line-soft">
          <FolderKanban size={36} className="mx-auto text-fg-faint mb-3" aria-hidden="true" />
          <p className="text-fg-muted text-sm">{d.noProjects}</p>
          {canManageProjects && (
            <button onClick={() => setCreating(true)} className="mt-3 text-sm font-semibold text-brand-blue hover:underline">{w.createFirstProject}</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((project) => {
            const pTasks = tasksOf(project.id);
            const progress = projectProgress(pTasks);
            const toValidate = pTasks.filter((task) => task.status === "submitted").length;
            const late = pTasks.filter(isLate).length;
            const goal = preview(project.description);
            return (
              <button key={project.id} onClick={() => onSelect(project.id)}
                className="text-left bg-surface rounded-2xl border border-line-soft p-5 flex flex-col gap-3 hover:border-brand-blue/40 hover:shadow-md transition">
                <span className="flex items-start justify-between gap-2">
                  <span className="font-display font-bold text-fg">{project.title}</span>
                  {FINISHED.includes(project.status) && <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{d.projectStatus[project.status]}</Badge>}
                </span>
                {goal && <span className="text-[13px] text-fg-soft line-clamp-2">{goal}</span>}
                <span aria-hidden="true" className="h-1.5 rounded-full bg-surface-strong overflow-hidden mt-auto">
                  <span className="block h-full rounded-full bg-brand-blue" style={{ width: `${progress.pct}%` }} />
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
                  <span>{w.tasksValidated(progress.done, progress.total)}</span>
                  {toValidate > 0 ? <span className="font-semibold text-orange-700 dark:text-orange-300">{w.nToValidate(toValidate)}</span>
                    : late > 0 ? <span className="font-semibold text-red-600">{w.nLate(late)}</span>
                      : project.deadline ? <span>{d.deadline} : {fmt.date(project.deadline)}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {finished.length > 0 && (
        <button onClick={() => setShowArchives((v) => !v)} className="text-sm text-fg-muted hover:text-brand-blue">
          {showArchives ? w.hideFinished : w.showFinished(finished.length)}
        </button>
      )}
      {modals}
    </div>
  );
}

function ProjectBoard({
  project, tasks, viewerMode, assignees, currentUserId, canManageProjects, onBack, onEdit, onDelete, onTasksChanged,
}: {
  project: Project;
  tasks: ProjectTask[];
  viewerMode: ViewerMode;
  assignees: Assignee[];
  currentUserId: number | undefined;
  canManageProjects: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTasksChanged: () => void;
}) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const [openId, setOpenId] = useState<number | null>(null);
  const [showAllDone, setShowAllDone] = useState(false);
  const canManage = canManageProjects || project.owner_id === currentUserId;
  // Valider (et donc donner les points) : responsable / section Départements, jamais un gestionnaire.
  const canValidate = viewerMode === "manager";
  const progress = projectProgress(tasks);
  const open = tasks.find((task) => task.id === openId) ?? null;

  const byColumn = (c: Column) => tasks.filter((task) => columnOf(task) === c)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-brand-blue">
          <ArrowLeft size={14} aria-hidden="true" /> {w.backToProjects}
        </button>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-extrabold text-fg">{project.title}</h2>
              <Badge variant={PROJECT_STATUS_VARIANT[project.status]}>{d.projectStatus[project.status]}</Badge>
            </div>
            {project.description && <div className="mt-1"><TaskDescription description={project.description} /></div>}
          </div>
          {canManage && (
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onEdit} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line text-sm font-medium text-fg-soft hover:bg-surface-muted">
                <Pencil size={14} aria-hidden="true" /> {d.editProject}
              </button>
              <button onClick={onDelete} aria-label={t.common.delete} title={t.common.delete}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-line text-fg-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-fg-soft">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="w-40 h-1.5 rounded-full bg-surface-strong overflow-hidden">
              <span className="block h-full rounded-full bg-brand-blue" style={{ width: `${progress.pct}%` }} />
            </span>
            <b className="text-fg">{w.tasksValidated(progress.done, progress.total)}</b>
          </span>
          {project.deadline && <span className="inline-flex items-center gap-1"><CalendarDays size={13} aria-hidden="true" /> {d.deadline} : <b className="text-fg">{fmt.date(project.deadline)}</b></span>}
          {project.owner_name && <span>{d.ownedBy} {project.owner_name}</span>}
          {project.repository_url && (
            <a href={project.repository_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-blue hover:underline">
              <GitBranch size={13} aria-hidden="true" /> {d.repository}
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((c) => {
          const items = byColumn(c);
          const shown = c === "done" && !showAllDone ? items.slice(0, DONE_LIMIT) : items;
          return (
            <section key={c} aria-label={w.columns[c]}
              className={cn("rounded-2xl p-3.5 space-y-2.5",
                c === "review" ? "bg-brand-orange/[0.07] border border-brand-orange/35" : "bg-surface-strong/70 border border-transparent")}>
              <h3 className="flex items-center justify-between px-1 text-xs font-bold uppercase tracking-wider text-fg-soft">
                {w.columns[c]} <span>{items.length}</span>
              </h3>
              {c === "todo" && canManage && <QuickAdd projectId={project.id} onAdded={onTasksChanged} />}
              {shown.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setOpenId(task.id)} />)}
              {c === "done" && items.length > DONE_LIMIT && (
                <button onClick={() => setShowAllDone((v) => !v)} className="w-full text-xs font-medium text-brand-blue hover:underline py-1">
                  {showAllDone ? w.hide : w.showMore(items.length - DONE_LIMIT)}
                </button>
              )}
              {items.length === 0 && c !== "todo" && <p className="px-1 py-2 text-xs text-fg-subtle">{w.columnEmpty}</p>}
            </section>
          );
        })}
      </div>

      {open && (
        <TaskPanel
          task={open}
          assignees={assignees}
          canManage={canManage && open.status !== "done"}
          canDelete={canManage}
          canValidate={canValidate && open.assigned_to !== currentUserId}
          isAssignee={open.assigned_to === currentUserId}
          onClose={() => setOpenId(null)}
          onChanged={onTasksChanged}
        />
      )}
    </div>
  );
}

/** Ajout rapide : un titre, Entrée, la tâche est créée (3 points, sans personne). */
function QuickAdd({ projectId, onAdded }: { projectId: number; onAdded: () => void }) {
  const { t } = useI18n();
  const w = t.workspace;
  const [title, setTitle] = useState("");
  const add = useMutation({
    mutationFn: () => projectsService.tasks.create(projectId, { title: title.trim(), weight: 3 }),
    onSuccess: () => { setTitle(""); onAdded(); },
  });
  const submit = () => { if (title.trim() && !add.isPending) add.mutate(); };
  return (
    <div className="space-y-1">
      <label className="block">
        <span className="sr-only">{w.quickAdd}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={w.quickAdd}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          className="w-full h-10 px-3 rounded-xl border border-dashed border-fg-subtle bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      </label>
      {title.trim() ? (
        <button onClick={submit} disabled={add.isPending}
          className="w-full h-9 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
          {add.isPending ? t.common.saving : t.common.add}
        </button>
      ) : <p className="px-1 text-[11px] text-fg-muted">{w.quickAddHint}</p>}
      {add.isError && <p className="text-xs text-red-600">{apiError(add.error, t.common.error)}</p>}
    </div>
  );
}

function TaskCard({ task, onOpen }: { task: ProjectTask; onOpen: () => void }) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const late = isLate(task);
  return (
    <button onClick={onOpen} aria-label={w.openTask(task.title)}
      className="w-full text-left bg-surface rounded-xl border border-line-soft p-3 space-y-2.5 hover:border-brand-blue/40 hover:shadow-sm transition">
      <span className={cn("block text-sm font-semibold leading-snug", task.status === "done" ? "text-fg-muted" : "text-fg")}>{task.title}</span>
      {(task.status === "blocked" || (task.status === "in_progress" && task.return_reason)) && (
        <span className="inline-block px-2 py-0.5 rounded-full bg-surface-strong text-[11px] font-semibold text-fg-soft">
          {task.status === "blocked" ? d.taskStatus.blocked : w.returnedTag}
        </span>
      )}
      <span className="flex items-center gap-2 text-xs text-fg-soft">
        {task.assigned_to_name ? <Avatar name={task.assigned_to_name} size={22} />
          : <span aria-hidden="true" className="w-[22px] h-[22px] rounded-full bg-surface-strong shrink-0" />}
        <span className="flex-1 truncate">{task.assigned_to_name ?? d.unassigned}</span>
        <span className="px-2 py-0.5 rounded-full bg-brand-blue/10 text-brand-deep font-bold">
          {task.status === "done" && task.points_awarded !== null ? t.tasks.points(task.points_awarded) : t.tasks.weightShort(task.weight)}
        </span>
      </span>
      {task.due_date && task.status !== "done" && (
        <span className={cn("block text-xs font-medium", late ? "text-red-600" : "text-fg-muted")}>{w.dueOn(fmt.date(task.due_date))}</span>
      )}
    </button>
  );
}

/** Détail d'une tâche dans un panneau latéral : description, validation, modification. */
function TaskPanel({
  task, assignees, canManage, canDelete, canValidate, isAssignee, onClose, onChanged,
}: {
  task: ProjectTask;
  assignees: Assignee[];
  canManage: boolean;
  canDelete: boolean;
  canValidate: boolean;
  isAssignee: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, fmt } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const [editing, setEditing] = useState(false);
  const remove = useMutation({
    mutationFn: () => projectsService.tasks.delete(task.project, task.id),
    onSuccess: () => { onChanged(); onClose(); },
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="task-panel-title" onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 w-full max-w-xl bg-surface shadow-2xl flex flex-col">
        <header className="flex items-start justify-between gap-3 px-6 py-5 border-b border-line-soft">
          <div className="min-w-0">
            <p className="text-xs text-fg-muted">{task.project_title}</p>
            <h2 id="task-panel-title" className="font-display font-extrabold text-xl text-fg">{task.title}</h2>
          </div>
          <button onClick={onClose} aria-label={t.common.close} className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-muted shrink-0"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {editing ? (
            <TaskForm projectId={task.project} task={task} assignees={assignees}
              onDone={() => { setEditing(false); onChanged(); }} onCancel={() => setEditing(false)} />
          ) : (
            <>
              <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-fg-muted">{d.assignedTo}</dt><dd className="text-fg font-medium">{task.assigned_to_name ?? d.unassigned}</dd>
                <dt className="text-fg-muted">{t.tasks.weightLabel}</dt><dd className="text-fg font-medium">{t.tasks.weightShort(task.weight)}</dd>
                <dt className="text-fg-muted">{d.deadline}</dt><dd className="text-fg font-medium">{task.due_date ? fmt.date(task.due_date) : "—"}</dd>
                <dt className="text-fg-muted">{t.common.status}</dt><dd className="text-fg font-medium">{d.taskStatus[task.status]}</dd>
              </dl>
              {task.return_reason && task.status !== "done" && (
                <p className="rounded-xl bg-brand-orange/10 px-4 py-3 text-sm text-fg"><b>{t.tasks.returned}</b> {task.return_reason}</p>
              )}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-1.5">{t.myProfile.description}</h3>
                {task.description ? <TaskDescription description={task.description} expanded />
                  : <p className="text-sm text-fg-subtle">{w.noDescription}</p>}
              </div>
              <TaskReviewControls task={task} canValidate={canValidate} isAssignee={isAssignee} onChanged={onChanged} />
            </>
          )}
        </div>
        {!editing && (canManage || canDelete) && (
          <footer className="flex items-center justify-between gap-2 px-6 py-4 border-t border-line">
            {canDelete ? (
              <button onClick={() => { if (confirm(d.confirmDeleteTask)) remove.mutate(); }}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-medium text-fg-subtle hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                <Trash2 size={15} aria-hidden="true" /> {t.common.delete}
              </button>
            ) : <span />}
            {canManage && (
              <button onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep">
                <Pencil size={14} aria-hidden="true" /> {d.editTask}
              </button>
            )}
          </footer>
        )}
      </aside>
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
  const formRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // Le formulaire s'ouvre là où l'on a cliqué : on l'amène à l'écran.
  useEffect(() => {
    formRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assigned_to ? String(task.assigned_to) : "");
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [weight, setWeight] = useState<TaskWeight>(task?.weight ?? 3);
  // La personne affectée (si elle a changé) reçoit un email.
  const notifies = !!assignedTo && assignedTo !== String(task?.assigned_to ?? "");

  const save = useMutation({
    mutationFn: () => {
      const payload: ProjectTaskWritePayload = {
        title, description, assigned_to: assignedTo ? Number(assignedTo) : null, due_date: dueDate || null, weight,
      };
      return task ? projectsService.tasks.update(projectId, task.id, payload) : projectsService.tasks.create(projectId, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId, "tasks"] });
      onDone();
    },
  });

  return (
    <div ref={formRef} className="bg-surface-muted rounded-xl p-4 space-y-3 scroll-mt-24">
      {task && <p className="text-xs font-semibold text-fg-soft">{d.editTask}</p>}
      <input ref={titleRef} placeholder={d.taskTitle} aria-label={d.taskTitle} value={title} onChange={(e) => setTitle(e.target.value)} className={cn(inputClass, "w-full")} />
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
          <label htmlFor={`assign-weight-${projectId}`} className="block text-xs text-fg-muted mb-1">{t.tasks.weightLabel}</label>
          <select id={`assign-weight-${projectId}`} value={weight} onChange={(e) => setWeight(Number(e.target.value) as TaskWeight)} className={cn(inputClass, "w-full")}>
            {([1, 2, 3, 4, 5] as TaskWeight[]).map((v) => <option key={v} value={v}>{t.tasks.weightOption[v]}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[11px] text-fg-subtle">{t.tasks.weightHint}{notifies && <> · {d.assigneeNotified}</>}</p>
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
          <button onClick={() => mutation.mutate()} disabled={!title.trim() || mutation.isPending}
            className="px-4 py-2 text-sm bg-brand-blue text-white rounded-xl font-semibold hover:bg-brand-deep disabled:opacity-50">
            {mutation.isPending ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
