"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock, MessageSquareText } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { CRITERIA, type CheckInDetail, type Scores } from "@/types/engagement.types";
import { CheckInReviewForm, ScoreInput } from "@/features/engagement/CheckInReview";
import { checkinPeriod } from "@/features/engagement/period";

export default function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, intl } = useI18n();
  const x = t.checkins;

  const { data: checkin, isLoading, isError } = useQuery({
    queryKey: ["checkin", id],
    queryFn: () => engagementService.checkins.get(id).then((r) => r.data),
  });

  if (isLoading) {
    return <div className="max-w-2xl mx-auto space-y-4 animate-pulse"><div className="h-8 w-56 bg-surface-strong rounded-lg" /><div className="h-72 bg-surface-strong rounded-2xl" /></div>;
  }
  if (isError || !checkin) {
    return <p className="text-center py-20 text-fg-subtle">{x.notFound}</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={checkin.viewer === "manager" ? `/manage/departments/${checkin.department}` : "/my-points"}
          className="flex items-center gap-1.5 text-sm text-fg-subtle hover:text-brand-blue mb-2 transition-colors">
          <ArrowLeft size={14} /> {checkin.viewer === "manager" ? t.deptDetail.backToList : t.sidebar.myPoints}
        </Link>
        <h1 className="text-2xl font-bold text-fg">{x.pageTitle}</h1>
        <p className="text-fg-muted text-sm mt-1">
          {checkin.department_name} · <span className="capitalize">{checkinPeriod(checkin, intl)}</span>
          {checkin.viewer === "manager" && ` · ${checkin.member_name}`}
        </p>
      </div>
      {checkin.viewer === "manager" ? <ManagerView checkin={checkin} /> : <MemberView checkin={checkin} />}
    </div>
  );
}

function MemberView({ checkin }: { checkin: Extract<CheckInDetail, { viewer: "member" }> }) {
  const { t, fmt } = useI18n();
  const x = t.checkins;
  const qc = useQueryClient();
  const editable = checkin.status === "pending" || checkin.status === "submitted";
  const [scores, setScores] = useState<Partial<Scores>>(checkin.self_scores);
  const [improveSelf, setImproveSelf] = useState(checkin.improve_self);
  const [departmentHelp, setDepartmentHelp] = useState(checkin.department_help);
  const [remark, setRemark] = useState(checkin.remark);
  const complete = CRITERIA.every((k) => scores[k]);

  const submit = useMutation({
    mutationFn: () => engagementService.checkins.submit(checkin.id, {
      self_scores: scores as Scores, improve_self: improveSelf, department_help: departmentHelp, remark,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checkin", String(checkin.id)] });
      qc.invalidateQueries({ queryKey: ["my-points"] });
    },
  });

  if (checkin.status === "confirmed") {
    return (
      <div className="bg-surface rounded-2xl border border-line-soft p-6 space-y-3">
        <h2 className="font-semibold text-fg flex items-center gap-2"><MessageSquareText size={18} className="text-brand-blue" /> {x.feedbackTitle}</h2>
        <p className="text-fg-soft text-sm leading-relaxed whitespace-pre-line">{checkin.feedback}</p>
        {checkin.confirmed_at && <p className="text-xs text-fg-subtle">{fmt.date(checkin.confirmed_at)}</p>}
      </div>
    );
  }
  if (checkin.status === "cancelled") {
    return <p className="text-fg-subtle text-sm">{x.cancelledText}</p>;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="space-y-6">
      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-2xl p-5 text-sm text-fg-soft leading-relaxed">
        {x.memberIntro}
        {checkin.due_date && <span className="block mt-2 text-xs text-fg-muted flex items-center gap-1"><Clock size={12} /> {x.before} {fmt.date(checkin.due_date)}</span>}
      </div>

      {checkin.status === "submitted" && (
        <p className="text-sm text-green-600 flex items-center gap-2"><CheckCircle2 size={16} /> {x.submittedText}</p>
      )}

      <section className="bg-surface rounded-2xl border border-line-soft p-6 space-y-5">
        <div>
          <h2 className="font-semibold text-fg">{x.part1}</h2>
          <p className="text-xs text-fg-muted mt-1">{x.scaleHint}</p>
        </div>
        {CRITERIA.map((key) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p className="text-sm text-fg">{x.criteria[key]}</p>
            <ScoreInput name={x.criteria[key]} value={scores[key]} disabled={!editable}
              onChange={(v) => setScores((s) => ({ ...s, [key]: v }))} />
          </div>
        ))}
      </section>

      <section className="bg-surface rounded-2xl border border-line-soft p-6 space-y-4">
        <h2 className="font-semibold text-fg">{x.part2}</h2>
        {([
          ["improve", x.improveSelf, improveSelf, setImproveSelf],
          ["help", x.departmentHelp, departmentHelp, setDepartmentHelp],
          ["remark", x.remark, remark, setRemark],
        ] as const).map(([fieldId, label, value, setter]) => (
          <div key={fieldId}>
            <label htmlFor={`ci-${fieldId}`} className="block text-sm text-fg mb-1.5">{label}</label>
            <textarea id={`ci-${fieldId}`} value={value} onChange={(e) => setter(e.target.value)} rows={3} disabled={!editable}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none bg-surface" />
          </div>
        ))}
      </section>

      {submit.isError && <p className="text-sm text-red-500">{t.common.error}</p>}
      {editable && (
        <div className="flex justify-end">
          <button type="submit" disabled={!complete || submit.isPending}
            className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-semibold hover:bg-brand-deep disabled:opacity-50 transition-colors">
            {submit.isPending ? t.common.sending : checkin.status === "submitted" ? x.update : x.send}
          </button>
        </div>
      )}
    </form>
  );
}

function ManagerView({ checkin }: { checkin: Extract<CheckInDetail, { viewer: "manager" }> }) {
  const { t } = useI18n();
  if (checkin.status === "pending") {
    return <p className="bg-surface rounded-2xl border border-line-soft p-6 text-sm text-fg-muted">{t.checkins.waitingMember}</p>;
  }
  if (checkin.status === "cancelled") {
    return <p className="text-fg-subtle text-sm">{t.checkins.cancelledText}</p>;
  }
  return <CheckInReviewForm key={`${checkin.id}-${checkin.status}`} checkin={checkin} />;
}
