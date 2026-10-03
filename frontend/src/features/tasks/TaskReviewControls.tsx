"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, CornerUpLeft, Send, Sparkles } from "lucide-react";
import { projectsService } from "@/services/projects.service";
import { useI18n } from "@/i18n/I18nProvider";
import type { FreeTaskStatus, ProjectTask } from "@/types/projects.types";

export const FREE_STATUSES: FreeTaskStatus[] = ["todo", "in_progress", "blocked"];

const STATUS_PILL: Record<ProjectTask["status"], string> = {
  todo: "bg-surface-strong text-fg-soft",
  in_progress: "bg-blue-50 text-brand-blue",
  submitted: "bg-brand-orange/15 text-orange-800",
  done: "bg-green-50 text-green-600",
  blocked: "bg-red-50 text-red-500",
};

/** Cycle de validation d'une tâche : statut, soumission par l'assigné,
 *  validation / renvoi par le responsable, points gagnés. */
export function TaskReviewControls({
  task, canValidate, isAssignee, onChanged,
}: {
  task: ProjectTask;
  /** Responsable du département (ou bureau) — jamais l'assigné lui-même. */
  canValidate: boolean;
  isAssignee: boolean;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const x = t.tasks;
  const [panel, setPanel] = useState<"none" | "submit" | "validate" | "return">("none");
  const [note, setNote] = useState("");
  const [outstanding, setOutstanding] = useState(false);
  const [reason, setReason] = useState("");

  const done = () => { setPanel("none"); setNote(""); setReason(""); setOutstanding(false); onChanged(); };

  const updateStatus = useMutation({
    mutationFn: (status: FreeTaskStatus) => projectsService.tasks.updateStatus(task.project, task.id, status),
    onSuccess: onChanged,
  });
  const submit = useMutation({ mutationFn: () => projectsService.tasks.submit(task.project, task.id, note), onSuccess: done });
  const validate = useMutation({ mutationFn: () => projectsService.tasks.validate(task.project, task.id, outstanding), onSuccess: done });
  const sendBack = useMutation({ mutationFn: () => projectsService.tasks.sendBack(task.project, task.id, reason), onSuccess: done });

  const canEditStatus = (isAssignee || canValidate) && FREE_STATUSES.includes(task.status as FreeTaskStatus);
  const pill = `text-xs font-medium rounded-full px-3 py-1.5 ${STATUS_PILL[task.status]}`;
  const smallBtn = "inline-flex items-center gap-1 text-xs font-semibold rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-2 shrink-0 max-w-[260px]">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {canEditStatus ? (
          <select
            value={task.status}
            aria-label={t.common.status}
            onChange={(e) => updateStatus.mutate(e.target.value as FreeTaskStatus)}
            className={`${pill} border-0 focus:outline-none focus:ring-2 focus:ring-brand-blue/20`}
          >
            {FREE_STATUSES.map((s) => <option key={s} value={s}>{t.deptDetail.taskStatus[s]}</option>)}
          </select>
        ) : (
          <span className={pill}>{t.deptDetail.taskStatus[task.status]}</span>
        )}

        {task.status === "done" && task.points_awarded !== null && (
          <span className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2.5 py-1.5 bg-brand-blue/10 text-brand-deep">
            {task.is_outstanding && <Sparkles size={12} className="text-brand-orange" aria-label={x.outstanding} />}
            {x.points(task.points_awarded)}
          </span>
        )}

        {isAssignee && canEditStatus && panel === "none" && (
          <button onClick={() => setPanel("submit")} className={`${smallBtn} bg-brand-blue text-white hover:bg-brand-deep`}>
            <Send size={12} /> {x.submit}
          </button>
        )}
        {canValidate && task.status === "submitted" && panel === "none" && (
          <>
            <button onClick={() => setPanel("validate")} className={`${smallBtn} bg-green-600 text-white hover:bg-green-700`}>
              <Check size={12} /> {x.validate}
            </button>
            <button onClick={() => setPanel("return")} className={`${smallBtn} border border-line text-fg-soft hover:bg-surface-muted`}>
              <CornerUpLeft size={12} /> {x.sendBack}
            </button>
          </>
        )}
      </div>

      {isAssignee && task.status === "submitted" && (
        <p className="text-[11px] text-fg-subtle text-right">{x.awaiting}</p>
      )}
      {task.status === "submitted" && task.submission_note && canValidate && (
        <p className="text-[11px] text-fg-muted text-right">« {task.submission_note} »</p>
      )}
      {task.return_reason && task.status !== "submitted" && task.status !== "done" && (
        <p className="text-[11px] text-orange-800 bg-brand-orange/10 rounded-lg px-2 py-1 text-right">
          {x.returned} {task.return_reason}
        </p>
      )}

      {panel === "submit" && (
        <div className="w-full space-y-2 bg-surface-muted rounded-xl p-3">
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder={x.notePlaceholder} aria-label={x.notePlaceholder}
            className="w-full border border-line rounded-lg px-2.5 py-1.5 text-xs resize-none bg-surface"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setPanel("none")} className={`${smallBtn} text-fg-muted`}>{t.common.cancel}</button>
            <button onClick={() => submit.mutate()} disabled={submit.isPending} className={`${smallBtn} bg-brand-blue text-white`}>
              <Send size={12} /> {x.submit}
            </button>
          </div>
        </div>
      )}

      {panel === "validate" && (
        <div className="w-full space-y-2 bg-surface-muted rounded-xl p-3">
          <label className="flex items-center gap-2 text-xs text-fg">
            <input type="checkbox" checked={outstanding} onChange={(e) => setOutstanding(e.target.checked)} className="accent-[#FB7C2C]" />
            {x.outstanding}
          </label>
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setPanel("none")} className={`${smallBtn} text-fg-muted`}>{t.common.cancel}</button>
            <button onClick={() => validate.mutate()} disabled={validate.isPending} className={`${smallBtn} bg-green-600 text-white`}>
              <Check size={12} /> {x.confirmValidate}
            </button>
          </div>
        </div>
      )}

      {panel === "return" && (
        <div className="w-full space-y-2 bg-surface-muted rounded-xl p-3">
          <textarea
            value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
            placeholder={x.reasonPlaceholder} aria-label={x.reasonPlaceholder}
            className="w-full border border-line rounded-lg px-2.5 py-1.5 text-xs resize-none bg-surface"
          />
          <div className="flex justify-end gap-1.5">
            <button onClick={() => setPanel("none")} className={`${smallBtn} text-fg-muted`}>{t.common.cancel}</button>
            <button onClick={() => sendBack.mutate()} disabled={!reason.trim() || sendBack.isPending} className={`${smallBtn} bg-brand-orange text-ink`}>
              <CornerUpLeft size={12} /> {x.confirmReturn}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
