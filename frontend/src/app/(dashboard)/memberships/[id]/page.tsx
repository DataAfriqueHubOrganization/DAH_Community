"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/useAuth";
import { membershipsService } from "@/services/memberships.service";
import { useI18n } from "@/i18n/I18nProvider";
import { countryLabel } from "@/lib/countries";
import { Badge } from "@/components/ui/Badge";
import { isAdmin } from "@/types/auth.types";
import { ArrowLeft, Check, X, ExternalLink, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import type { CandidatureStatus } from "@/types/memberships.types";
import { useState } from "react";

const STATUS_VARIANT: Record<CandidatureStatus, "blue" | "orange" | "green" | "red" | "gray"> = {
  pending: "gray",
  accepted: "green",
  rejected: "red",
};

export default function CandidatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { t, fmt, locale } = useI18n();
  const a = t.applications;
  const qc = useQueryClient();
  const router = useRouter();
  const { data: user } = useCurrentUser();
  const canManage = user && (isAdmin(user.role) || user.poste === "president");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const { data: candidature, isLoading } = useQuery({
    queryKey: ["candidature", id],
    queryFn: () => membershipsService.getCandidature(Number(id)).then((r) => r.data),
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      action,
      rejection_reason,
    }: {
      action: "accept" | "reject";
      rejection_reason?: string;
    }) => membershipsService.reviewCandidature(Number(id), { action, rejection_reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidature", id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => membershipsService.deleteCandidature(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["candidatures"] });
      router.push("/memberships");
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-surface-strong rounded-lg" />
        <div className="h-48 bg-surface-strong rounded-2xl" />
        <div className="h-32 bg-surface-strong rounded-2xl" />
      </div>
    );
  }

  if (!candidature) {
    return (
      <div className="text-center py-20 text-fg-subtle">
        <p>{a.notFound}</p>
        <Link href="/memberships" className="text-brand-blue text-sm mt-2 inline-block">
          ← {t.common.back}
        </Link>
      </div>
    );
  }

  const label = a.status[candidature.status];
  const variant = STATUS_VARIANT[candidature.status];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/memberships"
            className="flex items-center gap-1.5 text-sm text-fg-subtle hover:text-brand-blue mb-2 transition-colors"
          >
            <ArrowLeft size={14} /> {a.backToList}
          </Link>
          <h1 className="text-2xl font-bold text-fg">{a.fileTitle}</h1>
        </div>
        {canManage && (
          <button
            onClick={() => {
              if (confirm(a.confirmDelete(`${candidature.first_name} ${candidature.last_name}`))) {
                deleteMutation.mutate();
              }
            }}
            title={a.deleteApplication}
            aria-label={a.deleteApplication}
            className="p-2 text-fg-faint hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 shrink-0"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* En-tête */}
      <div className="bg-surface rounded-2xl border border-line-soft p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold shrink-0">
            {(candidature.first_name[0] + candidature.last_name[0]).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-fg text-lg">
                  {candidature.first_name} {candidature.last_name}
                </h2>
                <p className="text-fg-muted text-sm">{candidature.email}</p>
              </div>
              <Badge variant={variant}>{label}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-fg-subtle">
              <span>{countryLabel(candidature.country, locale)}</span>
              <span>{candidature.profession}</span>
              {candidature.phone && <span>{candidature.phone}</span>}
              <span>{a.submittedOn} {fmt.date(candidature.created_at)}</span>
              {candidature.reviewed_by_name && (
                <span>
                  {a.reviewedBy} {candidature.reviewed_by_name}
                  {candidature.reviewed_at && ` ${a.on} ${fmt.date(candidature.reviewed_at)}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2">
              {candidature.linkedin_url && (
                <a
                  href={candidature.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline"
                >
                  <ExternalLink size={11} /> LinkedIn
                </a>
              )}
              {candidature.cv && (
                <a
                  href={candidature.cv}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline"
                >
                  <FileText size={11} /> {a.viewCv}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Souhaits d'engagement */}
      <div className="bg-surface rounded-2xl border border-line-soft p-6">
        <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-widest mb-3">
          {a.engagementTitle}
        </h3>
        {candidature.engagements?.length ? (
          <ul className="space-y-2">
            {candidature.engagements.map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-fg">
                <span className="mt-1.5 w-2 h-2 rounded-[2px] bg-brand-blue shrink-0" />
                {t.candidature.engagements[key]?.label ?? key}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-subtle italic">{a.notProvided}</p>
        )}
        {candidature.volunteer_poles?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-fg-muted mb-2">{a.volunteerPoles}</p>
            <div className="flex flex-wrap gap-2">
              {candidature.volunteer_poles.map((key) => (
                <span key={key} className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-orange/15 text-orange-800">
                  {t.candidature.poles[key]?.name ?? key}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Motivation */}
      <div className="bg-surface rounded-2xl border border-line-soft p-6">
        <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-widest mb-3">
          {a.motivation}
        </h3>
        <p className="text-fg leading-relaxed whitespace-pre-wrap text-sm">
          {candidature.motivation}
        </p>
      </div>

      {/* Motif de refus */}
      {candidature.status === "rejected" && candidature.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <h3 className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-2">
            {a.rejectionReason}
          </h3>
          <p className="text-red-700 text-sm leading-relaxed">
            {candidature.rejection_reason}
          </p>
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="bg-surface rounded-2xl border border-line-soft p-6 space-y-4">
          <h3 className="font-semibold text-fg text-sm">{a.decision}</h3>
          <div className="flex flex-wrap gap-3">
            {candidature.status !== "accepted" && (
              <button
                onClick={() => reviewMutation.mutate({ action: "accept" })}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Check size={15} /> {candidature.status === "rejected" ? a.undoReject : a.accept}
              </button>
            )}
            {candidature.status !== "rejected" && (
              <button
                onClick={() => setShowRejectForm(!showRejectForm)}
                disabled={reviewMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                <X size={15} /> {candidature.status === "accepted" ? a.undoAccept : a.reject}
              </button>
            )}
          </div>
          {showRejectForm && (
            <div className="space-y-3 pt-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={a.rejectReasonShort}
                aria-label={a.rejectReasonShort}
                rows={3}
                className="w-full border border-red-200 rounded-xl p-3 text-sm focus:outline-none resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-1.5 text-xs border border-line rounded-lg hover:bg-surface-muted"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => {
                    reviewMutation.mutate({ action: "reject", rejection_reason: rejectReason });
                    setShowRejectForm(false);
                  }}
                  disabled={!rejectReason.trim()}
                  className="px-4 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50"
                >
                  {a.confirmReject}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
