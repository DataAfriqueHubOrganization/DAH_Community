"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { projectsService } from "@/services/projects.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { apiError } from "@/features/treasury/shared";
import type { Project, TaskWeight } from "@/types/projects.types";
import type { Assignee } from "./shared";

type Template = "blank" | "data" | "event" | "training";
const TEMPLATES: Template[] = ["blank", "data", "event", "training"];
interface Row { key: number; title: string; assignee: string; weight: TaskWeight }

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Nouveau projet en 3 étapes : l'essentiel (modèle, nom, objectif, échéance),
 *  les premières tâches (facultatives), puis vérification et création. */
export function NewProjectWizard({ departmentId, assignees, onClose, onCreated }: {
  departmentId: number;
  assignees: Assignee[];
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const { t } = useI18n();
  const x = t.newProject;
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [template, setTemplate] = useState<Template>("blank");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const pickTemplate = (tpl: Template) => {
    setTemplate(tpl);
    const titles = x.templates[tpl].tasks;
    setRows(titles.map((title, i) => ({ key: nextKey + i, title, assignee: "", weight: 3 as TaskWeight })));
    setNextKey((k) => k + titles.length);
  };
  const updateRow = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => { setRows((rs) => [...rs, { key: nextKey, title: "", assignee: "", weight: 3 }]); setNextKey((k) => k + 1); };

  const tasks = rows.filter((r) => r.title.trim());
  const notified = new Set(tasks.filter((r) => r.assignee).map((r) => r.assignee)).size;

  const create = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: project } = await projectsService.create({
        title: name.trim(),
        description: goal.trim() ? `<p>${escape(goal.trim())}</p>` : "",
        status: "active",
        department: departmentId,
        deadline: deadline || null,
        repository_url: "",
      });
      // Les tâches une par une : chaque personne affectée reçoit son email.
      for (const r of tasks) {
        await projectsService.tasks.create(project.id, {
          title: r.title.trim(), assigned_to: r.assignee ? Number(r.assignee) : null, weight: r.weight,
        });
      }
      qc.invalidateQueries({ queryKey: ["projects", "by-department", departmentId] });
      onCreated(project);
    } catch (err) {
      setError(apiError(err, t.common.error));
      setSaving(false);
    }
  };

  const steps = [x.step1, x.step2, x.step3];
  const fieldClass = "w-full h-11 px-3.5 rounded-xl border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20";

  return (
    <div className="fixed inset-0 z-50 bg-black/45" onMouseDown={() => { if (!saving) onClose(); }}>
      <aside role="dialog" aria-modal="true" aria-labelledby="np-title" onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 w-full max-w-xl bg-surface shadow-2xl flex flex-col">
        <header className="px-6 pt-5 pb-4 border-b border-line-soft space-y-4">
          <div className="flex items-center justify-between">
            <h2 id="np-title" className="font-display font-extrabold text-xl text-fg">{t.deptDetail.newProject}</h2>
            <button onClick={onClose} disabled={saving} aria-label={t.common.close}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-muted"><X size={18} /></button>
          </div>
          <ol aria-label={x.stepsLabel} className="grid grid-cols-3 gap-2">
            {steps.map((label, i) => (
              <li key={label} aria-current={step === i + 1 ? "step" : undefined} className="space-y-1.5">
                <span aria-hidden="true" className={cn("block h-1 rounded-full", step >= i + 1 ? "bg-brand-blue" : "bg-line")} />
                <span className={cn("block text-xs", step === i + 1 ? "font-bold text-fg" : "text-fg-muted")}>{i + 1}. {label}</span>
              </li>
            ))}
          </ol>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {step === 1 && (
            <>
              <fieldset className="space-y-2.5">
                <legend className="text-sm font-semibold text-fg mb-2.5">{x.templateLabel}</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TEMPLATES.map((tpl) => (
                    <button key={tpl} type="button" aria-pressed={template === tpl} onClick={() => pickTemplate(tpl)}
                      className={cn("text-left rounded-xl px-3.5 py-3 transition-colors",
                        template === tpl ? "border-2 border-brand-blue bg-brand-blue/[0.06]" : "border border-line-strong hover:bg-surface-muted")}>
                      <span className="block text-sm font-semibold text-fg">{x.templates[tpl].label}</span>
                      <span className="block text-xs text-fg-muted">{x.templates[tpl].hint}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="np-name" className="block text-sm font-semibold text-fg mb-1.5">{x.name}</label>
                <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={x.namePlaceholder} className={fieldClass} />
              </div>
              <div>
                <label htmlFor="np-goal" className="block text-sm font-semibold text-fg mb-1.5">{x.goal} <span className="font-normal text-fg-muted">({t.common.optional})</span></label>
                <input id="np-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder={x.goalPlaceholder} className={fieldClass} />
              </div>
              <div className="max-w-xs">
                <label htmlFor="np-due" className="block text-sm font-semibold text-fg mb-1.5">{t.deptDetail.deadline} <span className="font-normal text-fg-muted">({t.common.optional})</span></label>
                <input id="np-due" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={fieldClass} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-fg-soft">{x.tasksIntro}</p>
              {rows.length > 0 && (
                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_150px_90px_36px] gap-2 text-xs font-semibold text-fg-muted">
                    <span>{x.task}</span><span>{x.person}</span><span>{x.points}</span><span />
                  </div>
                  {rows.map((r) => (
                    <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_36px] sm:grid-cols-[minmax(0,1fr)_150px_90px_36px] gap-2 items-center">
                      <input aria-label={x.task} value={r.title} onChange={(e) => updateRow(r.key, { title: e.target.value })}
                        className="h-10 px-3 rounded-lg border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 col-span-1" />
                      <select aria-label={x.person} value={r.assignee} onChange={(e) => updateRow(r.key, { assignee: e.target.value })}
                        className="h-10 px-2 rounded-lg border border-line-strong bg-surface text-sm order-3 sm:order-none col-span-1">
                        <option value="">{t.deptDetail.unassigned}</option>
                        {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      <select aria-label={x.points} value={r.weight} onChange={(e) => updateRow(r.key, { weight: Number(e.target.value) as TaskWeight })}
                        className="h-10 px-2 rounded-lg border border-line-strong bg-surface text-sm order-4 sm:order-none">
                        {([1, 2, 3, 4, 5] as TaskWeight[]).map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <button type="button" onClick={() => setRows((rs) => rs.filter((x2) => x2.key !== r.key))}
                        aria-label={x.removeTask(r.title || x.task)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 order-2 sm:order-none">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addRow}
                className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-dashed border-fg-subtle text-sm font-semibold text-brand-deep hover:bg-surface-muted">
                <Plus size={15} aria-hidden="true" /> {x.addTask}
              </button>
            </>
          )}

          {step === 3 && (
            <dl className="grid grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-xl bg-surface-muted px-5 py-4 text-sm">
              <dt className="text-fg-muted">{x.summaryProject}</dt><dd className="font-semibold text-fg">{name}</dd>
              {goal.trim() && (<><dt className="text-fg-muted">{x.goal}</dt><dd className="text-fg">{goal}</dd></>)}
              <dt className="text-fg-muted">{x.summaryTasks}</dt><dd className="font-semibold text-fg">{x.tasksCount(tasks.length)}</dd>
              <dt className="text-fg-muted">{x.summaryEmails}</dt><dd className="text-fg">{x.notified(notified)}</dd>
            </dl>
          )}
          {error && <p role="status" className="text-sm text-red-600">{error}</p>}
        </div>

        <footer className="flex items-center gap-2 px-6 py-4 border-t border-line">
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as 1 | 2)} disabled={saving}
              className="h-11 px-4 rounded-xl border border-line-strong text-sm font-medium text-fg hover:bg-surface-muted">{t.common.back}</button>
          )}
          <span className="flex-1" />
          {step === 2 && (
            <button onClick={() => { setRows([]); setStep(3); }} className="h-11 px-3 text-sm text-fg-soft hover:text-fg">{x.skip}</button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep((s) => (s + 1) as 2 | 3)} disabled={!name.trim()}
              className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-deep disabled:opacity-50">{x.continue}</button>
          ) : (
            <button onClick={create} disabled={saving || !name.trim()}
              className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-deep disabled:opacity-50">
              {saving ? t.common.saving : x.create}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}
