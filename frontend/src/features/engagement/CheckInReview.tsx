"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { CRITERIA, type CheckInManager, type Scores } from "@/types/engagement.types";

/** Note de 1 à 5 : boutons radio (accessibles au clavier). Le repère orange
 *  signale le score proposé par le membre quand il diffère. */
export function ScoreInput({
  name, value, onChange, disabled = false, hint,
}: {
  name: string; value?: number; onChange?: (v: number) => void; disabled?: boolean; hint?: number;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex gap-1.5 shrink-0">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n} type="button" role="radio" aria-checked={value === n} disabled={disabled}
          onClick={() => onChange?.(n)}
          className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors relative ${
            value === n
              ? "bg-brand-blue text-white border-brand-blue"
              : "border-line text-fg-soft hover:bg-surface-muted disabled:hover:bg-transparent"
          }`}
        >
          {n}
          {hint === n && value !== n && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-[3px] bg-brand-orange" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}

/** Confirmation d'un point d'étape par le responsable : scores pré-remplis avec
 *  ceux du membre, réponses du membre, retour écrit (seul visible par le membre). */
export function CheckInReviewForm({
  checkin, compact = false, onConfirmed, submitLabel,
}: {
  checkin: CheckInManager;
  /** Mise en page resserrée (panneau latéral). */
  compact?: boolean;
  onConfirmed?: (updated: CheckInManager) => void;
  submitLabel?: string;
}) {
  const { t, fmt } = useI18n();
  const x = t.checkins;
  const qc = useQueryClient();
  const confirmed = checkin.status === "confirmed";
  const [scores, setScores] = useState<Partial<Scores>>(confirmed ? checkin.final_scores : checkin.self_scores);
  const [feedback, setFeedback] = useState(checkin.feedback || x.feedbackTemplate);

  const confirm = useMutation({
    mutationFn: () => engagementService.checkins.confirm(checkin.id, { final_scores: scores as Scores, feedback }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries({ queryKey: ["checkin", String(checkin.id)] });
      qc.invalidateQueries({ queryKey: ["checkins", checkin.department] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
      if (data.viewer === "manager") onConfirmed?.(data);
    },
  });

  const complete = CRITERIA.every((k) => scores[k]);
  const mean = complete ? CRITERIA.reduce((sum, k) => sum + (scores[k] ?? 0), 0) / CRITERIA.length : 0;
  // Même calcul que le serveur : moyenne des scores, 5 points au maximum.
  const preview = Math.round(mean);
  const card = compact ? "space-y-4" : "bg-surface rounded-2xl border border-line-soft p-6 space-y-5";

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold text-fg">{x.scoresTitle}</h3>
          {!confirmed && (
            <span className="text-xs text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-brand-orange" aria-hidden="true" />
              {x.proposedLegend}
            </span>
          )}
        </div>
        <p className="text-xs text-fg-muted -mt-2">{confirmed ? x.scoresConfirmed : x.scoresHint}</p>
        {CRITERIA.map((key) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-fg">{x.criteria[key]}</p>
              {!compact && <p className="text-xs text-fg-subtle">{x.memberProposed(checkin.self_scores[key] ?? "—")}</p>}
            </div>
            <ScoreInput name={x.criteria[key]} value={scores[key]} hint={checkin.self_scores[key]} disabled={confirmed}
              onChange={(v) => setScores((s) => ({ ...s, [key]: v }))} />
          </div>
        ))}
        <p className="text-sm font-semibold text-brand-deep">{x.pointsPreview(confirmed ? checkin.points ?? preview : preview)}</p>
      </section>

      <section className={compact ? "bg-surface-muted rounded-xl p-4 space-y-3" : "bg-surface rounded-2xl border border-line-soft p-6 space-y-4"}>
        <h3 className={compact ? "text-xs font-semibold text-fg-muted" : "font-semibold text-fg"}>{x.answersTitle}</h3>
        {[[x.improveSelf, checkin.improve_self], [x.departmentHelp, checkin.department_help], [x.remark, checkin.remark]].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs text-fg-muted mb-1">{label}</p>
            <p className="text-sm text-fg-soft whitespace-pre-line">{value || "—"}</p>
          </div>
        ))}
        {checkin.submitted_at && <p className="text-xs text-fg-subtle">{x.submittedOn(fmt.date(checkin.submitted_at))}</p>}
      </section>

      <section className={compact ? "space-y-2" : "bg-surface rounded-2xl border border-line-soft p-6 space-y-3"}>
        <label htmlFor={`ci-feedback-${checkin.id}`} className="font-semibold text-fg block">{x.feedbackTitle}</label>
        <p className="text-xs text-fg-muted">{x.feedbackHint}</p>
        <textarea id={`ci-feedback-${checkin.id}`} value={feedback} onChange={(e) => setFeedback(e.target.value)}
          rows={compact ? 7 : 8} disabled={confirmed}
          className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-y bg-surface" />
      </section>

      {confirm.isError && <p className="text-sm text-red-500">{t.common.error}</p>}
      {confirmed ? (
        <p className="text-sm text-green-600 flex items-center gap-2"><CheckCircle2 size={16} /> {x.confirmedText(checkin.confirmed_by_name ?? "")}</p>
      ) : (
        <div className="flex justify-end">
          <button onClick={() => confirm.mutate()} disabled={!complete || !feedback.trim() || confirm.isPending}
            className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors">
            {confirm.isPending ? t.common.sending : submitLabel ?? x.confirm}
          </button>
        </div>
      )}
    </div>
  );
}
