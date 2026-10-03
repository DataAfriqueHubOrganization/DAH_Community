"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, X } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Avatar, GroupTitle, inputClass } from "@/features/departments/workspace/shared";
import type { PaymentDeclaration } from "@/types/treasury.types";
import { apiError, monthName } from "./shared";

/** Déclarations des membres en attente : preuve, validation ou refus motivé. */
export function DeclarationsPanel() {
  const { t } = useI18n();
  const x = t.treasury;
  const [zoom, setZoom] = useState<PaymentDeclaration | null>(null);

  const { data: declarations = [] } = useQuery({
    queryKey: ["treasury", "declarations", "pending"],
    queryFn: () => treasuryService.declarations.list("pending").then((r) => r.data),
  });

  if (declarations.length === 0) return null;

  return (
    <section className="rounded-2xl border border-brand-orange/45 bg-brand-orange/[0.04] overflow-hidden">
      <div className="px-5 py-3">
        <GroupTitle count={declarations.length} tone="orange">{x.toValidate}</GroupTitle>
      </div>
      <ul>
        {declarations.map((d) => <DeclarationRow key={d.id} declaration={d} onZoom={() => setZoom(d)} />)}
      </ul>
      {zoom && <ProofViewer declaration={zoom} onClose={() => setZoom(null)} />}
    </section>
  );
}

function DeclarationRow({ declaration: d, onZoom }: { declaration: PaymentDeclaration; onZoom: () => void }) {
  const { t, intl, fmt } = useI18n();
  const x = t.treasury;
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["treasury"] });
    qc.invalidateQueries({ queryKey: ["ranking"] });
  };
  const approve = useMutation({ mutationFn: () => treasuryService.declarations.approve(d.id), onSuccess: refresh });
  const reject = useMutation({ mutationFn: () => treasuryService.declarations.reject(d.id, reason), onSuccess: refresh });
  const error = approve.error ?? reject.error;

  const period = d.months > 1
    ? `${monthName(d.period_start, intl)} → ${monthName(d.period_end, intl)}`
    : monthName(d.period_start, intl);

  return (
    <li className="border-t border-brand-orange/25 px-5 py-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button onClick={onZoom} className="shrink-0 rounded-lg overflow-hidden border border-line-soft hover:ring-2 hover:ring-brand-blue/40" aria-label={x.viewProof}>
          <img src={d.proof} alt={x.proofAlt(d.user_name)} className="w-16 h-16 object-cover" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar name={d.user_name} size={30} />
          <div className="min-w-0">
            <p className="font-medium text-fg truncate">{d.user_name}</p>
            <p className="text-xs text-fg-muted">
              <span className="capitalize">{period}</span> · <b className="text-fg">{x.fcfa(d.amount)}</b> · {x.methods[d.method]}
              {d.reference && ` · ${d.reference}`}
            </p>
            <p className="text-[11px] text-fg-subtle">{x.declaredOn(fmt.date(d.created_at))}</p>
          </div>
        </div>
        {!rejecting && (
          <div className="flex gap-2 shrink-0">
            <button onClick={() => setRejecting(true)} disabled={approve.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-line text-xs font-semibold text-fg-soft hover:bg-surface-muted">
              <X size={14} /> {x.reject}
            </button>
            <button onClick={() => approve.mutate()} disabled={approve.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-brand-blue text-white text-xs font-semibold hover:bg-brand-deep disabled:opacity-50">
              <Check size={14} /> {x.approve}
            </button>
          </div>
        )}
      </div>
      {rejecting && (
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <label htmlFor={`reject-${d.id}`} className="block text-xs text-fg-muted mb-1">{x.rejectReason}</label>
            <input id={`reject-${d.id}`} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
              className={cn(inputClass, "w-full")} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setRejecting(false); setReason(""); }} className="h-10 px-3 rounded-xl border border-line text-sm text-fg-soft hover:bg-surface-muted">{t.common.cancel}</button>
            <button onClick={() => reject.mutate()} disabled={!reason.trim() || reject.isPending}
              className="h-10 px-4 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{x.rejectConfirm}</button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2" role="alert">{apiError(error, t.common.error)}</p>}
    </li>
  );
}

function ProofViewer({ declaration, onClose }: { declaration: PaymentDeclaration; onClose: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true"
      aria-label={t.treasury.proofAlt(declaration.user_name)} onClick={onClose}>
      <button onClick={onClose} aria-label={t.common.close} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={28} /></button>
      <img src={declaration.proof} alt={t.treasury.proofAlt(declaration.user_name)}
        className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/** Rappel mensuel : disponible dans les 10 derniers jours du mois, une fois par mois. */
export function ReminderCard() {
  const { t, intl, fmt } = useI18n();
  const x = t.treasury;
  const qc = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ["treasury", "reminder"],
    queryFn: () => treasuryService.reminders.status().then((r) => r.data),
  });
  const send = useMutation({
    mutationFn: () => treasuryService.reminders.send(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["treasury", "reminder"] }),
  });

  if (!status) return null;
  const month = monthName(status.month, intl);

  return (
    <section className="bg-surface rounded-2xl border border-line-soft p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        status.is_open && !status.sent ? "bg-brand-orange/15 text-orange-700 dark:text-orange-300" : "bg-brand-blue/10 text-brand-blue")}>
        <BellRing size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-fg">{x.reminderTitle(month)}</p>
        <p className="text-sm text-fg-muted">
          {status.sent
            ? x.reminderSent(fmt.date(status.sent.sent_at), status.sent.sent_by ?? "", status.sent.recipients)
            : !status.is_open
              ? x.reminderClosed(fmt.date(status.window_opens))
              : status.recipients > 0 ? x.reminderOpen(status.recipients) : x.reminderNobody}
        </p>
        {send.isError && <p className="text-xs text-red-600 mt-1" role="alert">{apiError(send.error, t.common.error)}</p>}
      </div>
      {!status.sent && (
        <button
          onClick={() => { if (confirm(x.reminderConfirm(status.recipients))) send.mutate(); }}
          disabled={!status.is_open || status.recipients === 0 || send.isPending}
          className="h-10 px-4 rounded-xl bg-brand-orange text-ink text-sm font-semibold hover:brightness-95 disabled:opacity-40 shrink-0"
        >
          {x.reminderSend(status.recipients)}
        </button>
      )}
    </section>
  );
}
