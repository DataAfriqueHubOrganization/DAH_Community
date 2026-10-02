"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { membershipsService } from "@/services/memberships.service";
import { useI18n } from "@/i18n/I18nProvider";
import { countryLabel } from "@/lib/countries";
import { Badge } from "@/components/ui/Badge";
import { isAdmin } from "@/types/auth.types";
import {
  Check, X, Clock, FileText, ChevronDown, ChevronUp,
  ExternalLink, Search, CheckCircle2, XCircle, Users, Trash2,
} from "lucide-react";
import Link from "next/link";
import type { CandidatureList, CandidatureStatus } from "@/types/memberships.types";

// Libellés : t.applications.status[...]
const STATUS_VARIANT: Record<CandidatureStatus, "blue" | "orange" | "green" | "red" | "gray"> = {
  pending: "gray",
  accepted: "green",
  rejected: "red",
};

export default function CandidaturesPage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { t } = useI18n();
  const a = t.applications;
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<CandidatureStatus | "">("");
  const [search, setSearch] = useState("");

  const canManage = user && (isAdmin(user.role) || user.poste === "president");

  const { data: all = [], isLoading } = useQuery({
    queryKey: ["candidatures"],
    queryFn: () => membershipsService.listCandidatures().then((r) => r.data),
    enabled: !!canManage,
  });

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      action,
      rejection_reason,
    }: {
      id: number;
      action: "accept" | "reject";
      rejection_reason?: string;
    }) => membershipsService.reviewCandidature(id, { action, rejection_reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidatures"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => membershipsService.deleteCandidature(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidatures"] }),
  });

  const pending = all.filter((c) => c.status === "pending");
  const accepted = all.filter((c) => c.status === "accepted");
  const rejected = all.filter((c) => c.status === "rejected");

  const filtered = all.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.first_name.toLowerCase().includes(q) ||
        c.last_name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q) ||
        c.profession.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (!canManage) {
    return (
      <div className="text-center py-20 text-fg-subtle">
        <p>{a.restricted}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-fg">{t.sidebar.applications}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface rounded-xl border border-line-soft p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-surface-strong">
            <Clock size={16} className="text-fg-muted" />
          </div>
          <div>
            <p className="text-2xl font-bold text-fg">{pending.length}</p>
            <p className="text-xs text-fg-muted">{a.pendingPlural}</p>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-line-soft p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <CheckCircle2 size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-fg">{accepted.length}</p>
            <p className="text-xs text-fg-muted">{a.acceptedPlural}</p>
          </div>
        </div>
        <div className="bg-surface rounded-xl border border-line-soft p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-100">
            <XCircle size={16} className="text-red-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-fg">{rejected.length}</p>
            <p className="text-xs text-fg-muted">{a.rejectedPlural}</p>
          </div>
        </div>
      </div>

      {/* Barre d'outils */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={a.searchPlaceholder}
            aria-label={a.searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              { val: "" as const, lbl: a.all, count: all.length },
              { val: "pending" as CandidatureStatus, lbl: a.pendingPlural, count: pending.length },
              { val: "accepted" as CandidatureStatus, lbl: a.acceptedPlural, count: accepted.length },
              { val: "rejected" as CandidatureStatus, lbl: a.rejectedPlural, count: rejected.length },
            ] as const
          ).map(({ val, lbl, count }) => (
            <button
              key={val}
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
                statusFilter === val
                  ? "bg-brand-blue text-white"
                  : "bg-surface border border-line text-fg-soft hover:bg-surface-muted"
              }`}
            >
              {lbl} <span className="opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="bg-surface rounded-xl border border-line-soft p-5 h-20 animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft">
          <FileText size={48} className="mx-auto text-fg-faint mb-4" />
          <p className="text-fg-muted">
            {search ? a.noResult : a.none}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="mt-2 text-xs text-brand-blue hover:underline"
            >
              {a.clearSearch}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <CandidatureCard
              key={c.id}
              candidature={c}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onAccept={() => reviewMutation.mutate({ id: c.id, action: "accept" })}
              onReject={(reason) =>
                reviewMutation.mutate({ id: c.id, action: "reject", rejection_reason: reason })
              }
              onDelete={() => {
                if (confirm(a.confirmDelete(`${c.first_name} ${c.last_name}`))) {
                  deleteMutation.mutate(c.id);
                }
              }}
              isPending={reviewMutation.isPending}
            />
          ))}
          <p className="text-xs text-fg-subtle text-center pt-2">
            <Users size={11} className="inline mr-1" />
            {a.count(filtered.length, !!(statusFilter || search))}
          </p>
        </div>
      )}
    </div>
  );
}

function CandidatureCard({
  candidature: c,
  expanded,
  onToggle,
  onAccept,
  onReject,
  onDelete,
  isPending,
}: {
  candidature: CandidatureList;
  expanded: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onReject: (reason: string) => void;
  onDelete: () => void;
  isPending: boolean;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState("");
  const { t, fmt, locale } = useI18n();
  const a = t.applications;
  const label = a.status[c.status];
  const variant = STATUS_VARIANT[c.status];

  return (
    <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-muted transition-colors"
        onClick={onToggle}
      >
        <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold text-sm shrink-0">
          {(c.first_name[0] + c.last_name[0]).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-fg text-sm">
            {c.first_name} {c.last_name}
          </p>
          <div className="flex items-center flex-wrap gap-2 mt-0.5">
            <Badge variant={variant}>{label}</Badge>
            <span className="text-xs text-fg-subtle">{c.email}</span>
            <span className="text-xs text-fg-subtle">{countryLabel(c.country, locale)} · {c.profession}</span>
            <span className="text-xs text-fg-subtle flex items-center gap-1">
              <Clock size={10} /> {fmt.date(c.created_at)}
            </span>
          </div>
        </div>
        <Link
          href={`/memberships/${c.id}`}
          onClick={(e) => e.stopPropagation()}
          title={a.viewFile}
          aria-label={a.viewFile}
          className="p-1.5 text-fg-faint hover:text-brand-blue transition-colors rounded-lg hover:bg-brand-blue/5"
        >
          <ExternalLink size={14} />
        </Link>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title={a.deleteApplication}
          aria-label={a.deleteApplication}
          className="p-1.5 text-fg-faint hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
        >
          <Trash2 size={14} />
        </button>
        {expanded ? (
          <ChevronUp size={16} className="text-fg-subtle shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-fg-subtle shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-line-soft">
          {c.reviewed_by_name && (
            <p className="text-xs text-fg-subtle pt-3">
              {c.status === "accepted" ? a.status.accepted : a.status.rejected} {a.by}{" "}
              <span className="text-fg-soft">{c.reviewed_by_name}</span>
              {c.reviewed_at && ` ${a.on} ${fmt.date(c.reviewed_at)}`}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {c.status !== "accepted" && (
              <button
                onClick={onAccept}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-green-600 rounded-xl hover:bg-green-700 font-medium disabled:opacity-50 transition-colors"
              >
                <Check size={14} /> {c.status === "rejected" ? a.undoReject : a.accept}
              </button>
            )}
            {c.status !== "rejected" && (
              <button
                onClick={() => setShowRejectForm(!showRejectForm)}
                disabled={isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm text-white bg-red-500 rounded-xl hover:bg-red-600 font-medium disabled:opacity-50 transition-colors"
              >
                <X size={14} /> {c.status === "accepted" ? a.undoAccept : a.reject}
              </button>
            )}
          </div>

          {showRejectForm && (
            <div className="mt-3 space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={a.rejectReason}
                aria-label={a.rejectReason}
                rows={3}
                className="w-full border border-red-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowRejectForm(false); setReason(""); }}
                  className="px-3 py-1.5 text-xs border border-line rounded-lg hover:bg-surface-muted"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={() => { onReject(reason); setShowRejectForm(false); setReason(""); }}
                  disabled={!reason.trim()}
                  className="px-4 py-1.5 text-xs bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
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
