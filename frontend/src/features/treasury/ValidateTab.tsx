"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, X, ZoomIn } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Avatar, inputClass } from "@/features/departments/workspace/shared";
import type { PaymentDeclaration } from "@/types/treasury.types";
import { apiError, monthName, shiftMonth } from "./shared";

/** Examen des déclarations, une à la fois : la preuve en grand, les éléments à
 *  contrôler à côté, valider passe directement à la suivante. */
export function ValidateTab({ declarations, isLoading }: { declarations: PaymentDeclaration[]; isLoading: boolean }) {
  const { t, intl, fmt } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const qc = useQueryClient();
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [zoom, setZoom] = useState(false);

  const current = declarations.find((d) => d.id === currentId) ?? declarations[0] ?? null;
  const index = current ? declarations.indexOf(current) : -1;

  const { data: member } = useQuery({
    queryKey: ["treasury", "member", current?.user],
    queryFn: () => treasuryService.contributions.member(current!.user).then((r) => r.data),
    enabled: !!current,
  });

  const goNext = useCallback(() => {
    const next = declarations[index + 1] ?? declarations[index - 1] ?? null;
    setCurrentId(next ? next.id : null);
    setRejecting(false);
    setReason("");
  }, [declarations, index]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["treasury"] });
    qc.invalidateQueries({ queryKey: ["ranking"] });
  };
  const approve = useMutation({
    mutationFn: (id: number) => treasuryService.declarations.approve(id),
    onSuccess: () => { goNext(); refresh(); },
  });
  const reject = useMutation({
    mutationFn: (id: number) => treasuryService.declarations.reject(id, reason),
    onSuccess: () => { goNext(); refresh(); },
  });

  // Raccourcis : V valider, R refuser, → suivante (hors saisie de texte).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!current || rejecting || zoom) return;
      const target = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.key === "v" || e.key === "V") approve.mutate(current.id);
      else if (e.key === "r" || e.key === "R") setRejecting(true);
      else if (e.key === "ArrowRight" && declarations[index + 1]) setCurrentId(declarations[index + 1].id);
      else if (e.key === "ArrowLeft" && declarations[index - 1]) setCurrentId(declarations[index - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, rejecting, zoom, declarations, index, approve]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 animate-pulse">
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-[72px] bg-surface rounded-2xl" />)}</div>
        <div className="h-[560px] bg-surface rounded-3xl" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="bg-surface rounded-3xl shadow-sm py-20 px-6 text-center">
        <span className="mx-auto w-16 h-16 rounded-2xl bg-green-50 dark:bg-green-500/15 text-green-600 flex items-center justify-center">
          <CheckCircle2 size={30} />
        </span>
        <h2 className="font-display text-xl font-bold text-fg mt-5">{v.emptyTitle}</h2>
        <p className="text-sm text-fg-muted mt-2 max-w-md mx-auto">{v.emptyText}</p>
      </div>
    );
  }

  const months = Array.from({ length: current.months }, (_, i) => `${shiftMonth(current.period_start.slice(0, 7), i)}-01`);
  const firstName = current.user_name.split(" ")[0];
  const busy = approve.isPending || reject.isPending;
  const error = approve.error ?? reject.error;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
      {/* File d'attente */}
      <aside className="space-y-2.5">
        <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">{v.queueTitle(declarations.length)}</p>
        <ul className="space-y-2.5">
          {declarations.map((d) => {
            const active = d.id === current.id;
            return (
              <li key={d.id}>
                <button
                  onClick={() => { setCurrentId(d.id); setRejecting(false); setReason(""); }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full text-left bg-surface rounded-2xl px-4 py-3 flex items-center gap-3 border-2 transition-all",
                    active ? "border-brand-blue shadow-lg shadow-brand-blue/15" : "border-transparent shadow-sm hover:shadow-md",
                  )}
                >
                  <Avatar name={d.user_name} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-sm text-fg truncate">{d.user_name}</span>
                    <span className="block text-xs text-fg-muted capitalize truncate">
                      {d.months > 1
                        ? `${monthName(d.period_start, intl, "short")} → ${monthName(d.period_end, intl, "short")}`
                        : monthName(d.period_start, intl)}
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block font-display font-extrabold text-sm text-fg">{x.fcfa(d.amount)}</span>
                    <span className="block text-[11px] text-fg-subtle">{fmt.date(d.created_at)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-1 pt-1 text-xs text-fg-muted leading-relaxed">{v.queueHint}</p>
      </aside>

      {/* Déclaration examinée */}
      <section className="bg-surface rounded-3xl shadow-sm overflow-hidden">
        <header className="px-6 py-5 flex items-center gap-4 border-b border-line-soft">
          <Avatar name={current.user_name} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-extrabold text-fg truncate">{current.user_name}</h2>
            <p className="text-sm text-fg-muted">{x.perMonth(x.fcfa(current.monthly_rate))}</p>
          </div>
          <span className="text-xs font-semibold rounded-full px-3 py-1 bg-surface-strong text-fg-soft">{v.position(index + 1, declarations.length)}</span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-7 p-6">
          {/* Preuve */}
          <div>
            <button onClick={() => setZoom(true)} className="group relative block w-full rounded-3xl bg-ink p-2.5 shadow-xl" aria-label={x.viewProof}>
              <img src={current.proof} alt={x.proofAlt(current.user_name)} className="w-full max-h-[420px] object-contain rounded-2xl bg-white" />
              <span className="absolute inset-2.5 rounded-2xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn size={28} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </span>
            </button>
            <p className="text-center mt-3"><button onClick={() => setZoom(true)} className="text-sm font-semibold text-brand-blue hover:underline">{x.viewProof}</button></p>
          </div>

          {/* À contrôler */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{v.declaredMonths}</p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                {months.map((m) => (
                  <span key={m} className="px-4 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold capitalize">{monthName(m, intl)}</span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface-muted p-4">
                <p className="text-xs text-fg-muted">{v.expected}</p>
                <p className="font-display text-2xl font-extrabold text-fg mt-1">{x.fcfa(current.amount)}</p>
                <p className="text-xs text-fg-muted mt-1">{x.amountCalc(current.months, x.fcfa(current.monthly_rate))} · {v.checkProof}</p>
              </div>
              <div className="rounded-2xl bg-surface-muted p-4">
                <p className="text-xs text-fg-muted">{v.methodRef}</p>
                <p className="font-semibold text-fg mt-1.5">{x.methods[current.method]}</p>
                <p className="text-sm text-fg-muted mt-0.5 break-all">{current.reference || "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-brand-blue/10 px-4 py-3.5">
              <span className="font-display text-xl font-extrabold text-brand-deep whitespace-nowrap">+{(member?.points_per_month ?? 5) * current.months} pts</span>
              <span className="text-sm text-fg-soft">{v.pointsText}</span>
            </div>

            <p className="text-xs text-fg-muted">
              {x.declaredOn(fmt.date(current.created_at))}
              {member && ` · ${member.paid_until ? v.paidUntilLine(firstName, monthName(member.paid_until, intl)) : v.neverPaidLine(firstName)}`}
            </p>
          </div>
        </div>

        {rejecting && (
          <div className="px-6 pb-5 flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label htmlFor="reject-reason" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.rejectReason}</label>
              <input id="reject-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                onKeyDown={(e) => { if (e.key === "Enter" && reason.trim()) reject.mutate(current.id); if (e.key === "Escape") setRejecting(false); }}
                className={cn(inputClass, "w-full h-11")} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setRejecting(false); setReason(""); }} className="h-11 px-4 rounded-xl border border-line text-sm font-semibold text-fg-soft hover:bg-surface-muted">{t.common.cancel}</button>
              <button onClick={() => reject.mutate(current.id)} disabled={!reason.trim() || busy}
                className="h-11 px-5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{x.rejectConfirm}</button>
            </div>
          </div>
        )}
        {error && <p className="px-6 pb-4 text-sm text-red-600" role="alert">{apiError(error, t.common.error)}</p>}

        {!rejecting && (
          <footer className="px-6 py-4 border-t border-line-soft bg-surface-muted/60 flex flex-wrap items-center gap-3">
            <span className="hidden md:flex items-center gap-2 text-xs text-fg-muted">
              <Kbd>V</Kbd> {v.keys.validate} <Kbd>R</Kbd> {v.keys.reject} <Kbd>→</Kbd> {v.keys.next}
            </span>
            <span className="flex-1" />
            <button onClick={() => setRejecting(true)} disabled={busy}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted">
              <X size={16} /> {v.rejectOpen}
            </button>
            <button onClick={() => approve.mutate(current.id)} disabled={busy}
              className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-green-600 text-white text-sm font-semibold shadow-lg shadow-green-600/25 hover:bg-green-700 disabled:opacity-60">
              <Check size={16} /> {declarations.length > 1 ? v.approveNext : v.approve}
            </button>
          </footer>
        )}
      </section>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" role="dialog" aria-modal="true"
          aria-label={x.proofAlt(current.user_name)} onClick={() => setZoom(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setZoom(false); }}>
          <button onClick={() => setZoom(false)} autoFocus aria-label={t.common.close} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={28} /></button>
          <img src={current.proof} alt={x.proofAlt(current.user_name)} className="max-w-full max-h-[90vh] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="font-sans text-[11px] border border-line border-b-2 rounded-md px-1.5 py-px bg-surface text-fg-soft">{children}</kbd>;
}

