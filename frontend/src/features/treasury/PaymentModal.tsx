"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, X } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { todayIso } from "@/features/engagement/period";
import { Avatar, inputClass } from "@/features/departments/workspace/shared";
import type { ContributionRow, PaymentMethod } from "@/types/treasury.types";
import { apiError, monthName, shiftMonth } from "./shared";

const METHODS: PaymentMethod[] = ["cash", "mobile_money", "transfer", "other"];
type Quick = "one" | "three" | "yearEnd" | "twelve" | "custom";

/** Enregistrer un paiement de cotisation (trésorier / admin). */
export function PaymentModal({
  rows, initialUserId, onClose, onSaved,
}: {
  rows: ContributionRow[];
  initialUserId: number | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const { t, intl, fmt } = useI18n();
  const x = t.treasury;
  const qc = useQueryClient();
  const [userId, setUserId] = useState<number | null>(initialUserId);
  const [query, setQuery] = useState("");
  const [start, setStart] = useState<string>(""); // YYYY-MM
  const [quick, setQuick] = useState<Quick>("one");
  const [customMonths, setCustomMonths] = useState(1);
  const [paidOn, setPaidOn] = useState(todayIso());
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const row = rows.find((r) => r.user_id === userId) ?? null;

  const { data: detail } = useQuery({
    queryKey: ["treasury", "member", userId],
    queryFn: () => treasuryService.contributions.member(userId as number).then((r) => r.data),
    enabled: userId !== null,
  });

  // Début par défaut : premier mois non réglé du membre.
  useEffect(() => {
    if (detail) setStart(detail.next_unpaid.slice(0, 7));
  }, [detail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const startYear = Number(start.slice(0, 4)) || new Date().getFullYear();
  const startMonth = Number(start.slice(5, 7)) || 1;
  const months = quick === "one" ? 1 : quick === "three" ? 3 : quick === "twelve" ? 12
    : quick === "yearEnd" ? 12 - startMonth + 1 : Math.max(1, Math.min(24, customMonths));
  const covered = useMemo(
    () => (start ? Array.from({ length: months }, (_, i) => shiftMonth(start, i)) : []),
    [start, months],
  );
  const rate = detail?.rate ?? row?.rate ?? 0;
  const amount = rate * months;
  const pointsPerMonth = detail?.points_per_month ?? 5;

  const record = useMutation({
    mutationFn: () => treasuryService.contributions.record({
      user: userId as number, period_start: start, months, paid_on: paidOn, method, reference, note,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
      onSaved(x.saved(row?.full_name ?? detail?.full_name ?? ""));
    },
  });

  const cancelPayment = useMutation({
    mutationFn: (id: number) => treasuryService.contributions.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury"] });
      qc.invalidateQueries({ queryKey: ["ranking"] });
    },
  });

  const q = query.trim().toLowerCase();
  const matches = rows.filter((r) => !q || r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)).slice(0, 8);
  const lateCount = detail?.late_months.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="pay-title">
      <div className="bg-surface rounded-2xl w-full max-w-[640px] my-8 shadow-2xl">
        <header className="px-6 py-5 border-b border-line-soft flex items-center justify-between">
          <h2 id="pay-title" className="font-display text-lg font-bold text-fg">{x.record}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg"><X size={20} /></button>
        </header>

        <div className="px-6 py-5 space-y-5">
          {/* Membre */}
          <div>
            <p className="text-xs font-semibold text-fg-soft mb-1.5">{x.member}</p>
            {row ? (
              <div className="flex items-center justify-between gap-3 border border-line rounded-xl px-3 py-2">
                <span className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={row.full_name} src={row.avatar} size={28} />
                  <span className="font-semibold text-fg truncate">{row.full_name}</span>
                  {row.department_name && <span className="text-sm text-fg-muted truncate hidden sm:inline">· {row.department_name}</span>}
                </span>
                <button onClick={() => { setUserId(null); setStart(""); }} className="text-xs text-brand-blue hover:underline shrink-0">{t.memberSearch.change}</button>
              </div>
            ) : (
              <div>
                <label className="relative block">
                  <span className="sr-only">{x.chooseMember}</span>
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                  <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={x.chooseMember}
                    className={cn(inputClass, "w-full pl-9")} />
                </label>
                <ul className="mt-2 max-h-56 overflow-y-auto border border-line-soft rounded-xl divide-y divide-line-soft">
                  {matches.map((r) => (
                    <li key={r.user_id}>
                      <button onClick={() => setUserId(r.user_id)} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-surface-muted">
                        <Avatar name={r.full_name} src={r.avatar} size={26} />
                        <span className="flex-1 truncate text-fg">{r.full_name}</span>
                        <span className="text-xs text-fg-muted">{x.perMonth(x.fcfa(r.rate))}</span>
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && <li className="px-3 py-3 text-sm text-fg-subtle">{x.noMembers}</li>}
                </ul>
              </div>
            )}
            {detail && (
              <p className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-fg-soft">
                <span>{x.rateInfo(x.fcfa(detail.rate), detail.rate >= 1000 ? x.rateKind.lead : x.rateKind.member)}</span>
                {detail.paid_until && <span>{x.paidUntilInfo(monthName(detail.paid_until, intl))}</span>}
                {lateCount > 0 && <span className="font-semibold text-orange-800 dark:text-orange-300">{x.lateInfo(lateCount)}</span>}
              </p>
            )}
          </div>

          {detail && (
            <>
              {/* Période */}
              <div>
                <p className="text-xs font-semibold text-fg-soft mb-1.5">{x.period}</p>
                <div className="flex flex-wrap gap-2">
                  {(["one", "three", "yearEnd", "twelve", "custom"] as Quick[]).map((k) => (
                    <button key={k} type="button" onClick={() => setQuick(k)} aria-pressed={quick === k}
                      className={cn("h-8 px-3 rounded-full border text-xs font-medium",
                        quick === k ? "bg-fg text-surface border-fg" : "border-line text-fg-soft hover:bg-surface-muted")}>
                      {k === "yearEnd" ? x.quick.yearEnd(startYear) : x.quick[k]}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label htmlFor="pay-start" className="block text-xs text-fg-muted mb-1">{x.fromMonth}</label>
                    <input id="pay-start" type="month" value={start} min={detail.joined_month.slice(0, 7)}
                      onChange={(e) => setStart(e.target.value)} className={cn(inputClass, "w-full")} />
                  </div>
                  <div>
                    <label htmlFor="pay-months" className="block text-xs text-fg-muted mb-1">{x.monthsLabel}</label>
                    <input id="pay-months" type="number" min={1} max={24} value={months}
                      onChange={(e) => { setQuick("custom"); setCustomMonths(Number(e.target.value)); }}
                      className={cn(inputClass, "w-full")} />
                  </div>
                </div>
                {covered.length > 0 && (
                  <>
                    <p className="text-xs text-fg-muted mt-2">{x.toMonth(monthName(`${covered.at(-1)}-01`, intl))}</p>
                    <ul className="flex flex-wrap gap-1 mt-2" aria-label={x.period}>
                      {covered.map((m) => (
                        <li key={m} className="h-9 min-w-[52px] px-2 rounded-lg bg-brand-blue text-white text-[11px] font-semibold flex flex-col items-center justify-center leading-tight">
                          <span className="capitalize">{monthName(`${m}-01`, intl, "short", false).replace(".", "")}</span>
                          <span className="font-normal opacity-80">{m.slice(0, 4)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="text-xs text-fg-subtle mt-2">{x.periodHint}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-semibold text-fg-soft mb-1.5">{x.amount}</p>
                  <div className="h-10 px-3 rounded-xl bg-surface-muted border border-line flex items-center justify-between">
                    <b className="font-display text-fg">{x.fcfa(amount)}</b>
                    <span className="text-xs text-fg-muted">{x.amountCalc(months, x.fcfa(rate))}</span>
                  </div>
                </div>
                <div>
                  <label htmlFor="pay-date" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.paidOn}</label>
                  <input id="pay-date" type="date" value={paidOn} max={todayIso()} onChange={(e) => setPaidOn(e.target.value)} className={cn(inputClass, "w-full")} />
                </div>
              </div>

              <fieldset>
                <legend className="text-xs font-semibold text-fg-soft mb-1.5">{x.method}</legend>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {METHODS.map((m) => (
                    <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
                      className={cn("h-10 rounded-xl border text-sm font-medium",
                        method === m ? "border-brand-blue bg-brand-blue/10 text-brand-deep font-semibold" : "border-line text-fg-soft hover:bg-surface-muted")}>
                      {x.methods[m]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pay-ref" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.reference}</label>
                  <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={cn(inputClass, "w-full")} />
                </div>
                <div>
                  <label htmlFor="pay-note" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.note}</label>
                  <input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={cn(inputClass, "w-full")} />
                </div>
              </div>

              <p className="flex items-center gap-3 rounded-xl border border-brand-blue/25 bg-brand-blue/[0.06] px-4 py-3 text-sm text-fg-soft">
                <b className="font-display text-lg text-brand-deep whitespace-nowrap">{x.pointsPreview(pointsPerMonth * months, (row?.full_name ?? detail.full_name).split(" ")[0])}</b>
                <span>{x.pointsPreviewText}</span>
              </p>

              {record.isError && <p className="text-sm text-red-600" role="alert">{apiError(record.error, t.common.error)}</p>}

              {/* Paiements déjà enregistrés : pour corriger une erreur de saisie */}
              {detail.history.length > 0 && (
                <details className="rounded-xl border border-line-soft">
                  <summary className="px-4 py-2.5 text-sm font-medium text-fg-soft cursor-pointer">{x.memberHistory} · {detail.history.length}</summary>
                  <ul className="divide-y divide-line-soft">
                    {detail.history.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="flex-1 min-w-0 truncate">
                          <span className="capitalize">{monthName(c.period_start, intl, "short")}</span>
                          {c.months > 1 && <> → <span className="capitalize">{monthName(c.period_end, intl, "short")}</span></>}
                          <span className="text-fg-muted"> · {x.fcfa(c.amount)} · {fmt.date(c.paid_on)}</span>
                        </span>
                        <button onClick={() => { if (confirm(x.confirmDelete)) cancelPayment.mutate(c.id); }}
                          aria-label={x.deletePayment} title={x.deletePayment}
                          className="p-1.5 rounded-lg text-fg-faint hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>

        <footer className="px-6 py-4 border-t border-line-soft flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-line text-sm font-semibold text-fg-soft hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => record.mutate()} disabled={!detail || !start || months < 1 || record.isPending}
            className="h-10 px-5 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
            {record.isPending ? t.common.saving : x.save}
          </button>
        </footer>
      </div>
    </div>
  );
}

