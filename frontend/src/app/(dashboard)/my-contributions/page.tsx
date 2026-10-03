"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ImagePlus, Send, Wallet, X } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { inputClass } from "@/features/departments/workspace/shared";
import { MONTH_STYLE, MonthLegend, YearSelect, apiError, monthName, shiftMonth, yearOptions } from "@/features/treasury/shared";
import type { MonthStatus, MyContributionsData, PaymentMethod } from "@/types/treasury.types";

const METHODS: PaymentMethod[] = ["mobile_money", "transfer", "cash", "other"];
const MAX_PROOF = 5 * 1024 * 1024;

/** Le membre voit ses mois (payé ou non, point du mois) et déclare ses paiements
 *  avec une capture de la preuve — pas de récapitulatif de ce qu'il a payé. */
export default function MyContributionsPage() {
  const { t } = useI18n();
  const x = t.treasury;
  const [year, setYear] = useState(() => new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["my-contributions", year],
    queryFn: () => treasuryService.mine(year).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-9 w-64 bg-surface-strong rounded-lg" />
        <div className="h-72 bg-surface rounded-2xl border border-line-soft" />
      </div>
    );
  }
  if (!data) return null;

  if (!data.liable) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-fg">{x.myTitle}</h1>
        <p className="bg-surface rounded-2xl border border-line-soft p-6 text-sm text-fg-muted flex gap-3">
          <Wallet size={18} className="text-fg-subtle shrink-0" /> {x.notLiable}
        </p>
      </div>
    );
  }

  return <MyMonths data={data} year={year} onYear={setYear} />;
}

function MyMonths({ data, year, onYear }: { data: MyContributionsData; year: number; onYear: (y: number) => void }) {
  const { t, intl } = useI18n();
  const x = t.treasury;
  const [declaring, setDeclaring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rejected = data.declarations.filter((d) => d.status === "rejected");

  const monthText = (status: MonthStatus) => ({
    paid: x.monthPaid(data.points_per_month),
    pending: x.monthPending,
    late: x.monthUnpaid,
    due: x.monthDue,
    upcoming: x.monthUpcoming,
    not_due: x.monthNotDue,
  })[status];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fg">{x.myTitle}</h1>
          <p className="text-sm text-fg-muted mt-1">
            {x.rateLine(x.fcfa(data.rate))} · {x.pointsRule(data.points_per_month)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <YearSelect value={year} onChange={onYear} years={yearOptions()} />
          <button onClick={() => { setDeclaring(true); setNotice(null); }}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep">
            <Send size={15} /> {x.declare}
          </button>
        </div>
      </div>

      {notice && <p className="text-sm text-green-600" role="status">{notice}</p>}

      {rejected.map((d) => (
        <p key={d.id} className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>
            <b className="block">{x.rejectedTitle}</b>
            <span>
              {x.rejectedText(
                d.months > 1 ? `${monthName(d.period_start, intl)} → ${monthName(d.period_end, intl)}` : monthName(d.period_start, intl),
                d.rejection_reason,
              )}
            </span>
          </span>
        </p>
      ))}

      <section className="bg-surface rounded-2xl border border-line-soft p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display font-bold text-fg flex items-center gap-3">
            {x.myMonths(year)}
            {data.late_count > 0 && (
              <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-brand-orange/15 text-orange-800 dark:text-orange-300">
                {x.lateBanner(data.late_count)}
              </span>
            )}
          </h2>
          <MonthLegend withNotDue={data.months.some((m) => m.status === "not_due")} />
        </div>
        <ul className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 mt-4">
          {data.months.map((m) => {
            const style = MONTH_STYLE[m.status];
            return (
              <li key={m.month} className={cn("rounded-xl border p-3 min-h-[76px] flex flex-col gap-1", style.cell)}>
                <span className={cn("font-display font-bold text-sm capitalize", m.status === "upcoming" || m.status === "not_due" ? "text-fg-muted" : "text-fg")}>
                  {monthName(m.month, intl, "long", false)}
                </span>
                <span className={cn("text-xs font-semibold", style.text)}>{monthText(m.status)}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-fg-muted mt-4">{x.declareIntro}</p>
      </section>

      {declaring && (
        <DeclareModal
          data={data}
          onClose={() => setDeclaring(false)}
          onDone={() => { setDeclaring(false); setNotice(x.declared); }}
        />
      )}
    </div>
  );
}

function DeclareModal({ data, onClose, onDone }: { data: MyContributionsData; onClose: () => void; onDone: () => void }) {
  const { t, intl } = useI18n();
  const x = t.treasury;
  const qc = useQueryClient();
  const [start, setStart] = useState(data.next_unpaid.slice(0, 7));
  const [months, setMonths] = useState(1);
  const [method, setMethod] = useState<PaymentMethod>("mobile_money");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const preview = useMemo(() => (proof ? URL.createObjectURL(proof) : null), [proof]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const covered = Array.from({ length: months }, (_, i) => shiftMonth(start, i));

  const send = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("period_start", start);
      form.append("months", String(months));
      form.append("method", method);
      form.append("reference", reference);
      form.append("proof", proof as File);
      return treasuryService.declare(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-contributions"] });
      onDone();
    },
  });

  const pick = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) { setFileError(x.proofHint); return; }
    if (file.size > MAX_PROOF) { setFileError(x.proofHint); return; }
    setProof(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="declare-title">
      <div className="bg-surface rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <header className="px-6 py-5 border-b border-line-soft flex items-start justify-between gap-3">
          <div>
            <h2 id="declare-title" className="font-display text-lg font-bold text-fg">{x.declareTitle}</h2>
            <p className="text-sm text-fg-muted mt-1">{x.declareIntro}</p>
          </div>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg shrink-0"><X size={20} /></button>
        </header>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="dec-start" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.fromMonth}</label>
              <input id="dec-start" type="month" value={start} min={data.joined_month.slice(0, 7)}
                onChange={(e) => setStart(e.target.value)} className={cn(inputClass, "w-full")} />
            </div>
            <div>
              <label htmlFor="dec-months" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.monthsLabel}</label>
              <input id="dec-months" type="number" min={1} max={12} value={months}
                onChange={(e) => setMonths(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} className={cn(inputClass, "w-full")} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-fg-soft mb-1.5">{x.declareMonths}</p>
            <ul className="flex flex-wrap gap-1">
              {covered.map((m) => (
                <li key={m} className="h-9 min-w-[52px] px-2 rounded-lg bg-brand-blue text-white text-[11px] font-semibold flex flex-col items-center justify-center leading-tight">
                  <span className="capitalize">{monthName(`${m}-01`, intl, "short", false).replace(".", "")}</span>
                  <span className="font-normal opacity-80">{m.slice(0, 4)}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-fg mt-2">{x.amount} : <b className="font-display">{x.fcfa(data.rate * months)}</b> <span className="text-fg-muted text-xs">({x.amountCalc(months, x.fcfa(data.rate))})</span></p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="dec-method" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.method}</label>
              <select id="dec-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={cn(inputClass, "w-full")}>
                {METHODS.map((m) => <option key={m} value={m}>{x.methods[m]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dec-ref" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.reference}</label>
              <input id="dec-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={cn(inputClass, "w-full")} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-fg-soft mb-1.5">{x.proofLabel}</p>
            <label className={cn("flex items-center gap-4 rounded-xl border border-dashed p-3 cursor-pointer hover:bg-surface-muted",
              proof ? "border-line" : "border-brand-blue/50")}>
              {preview ? (
                <img src={preview} alt="" className="w-20 h-20 rounded-lg object-cover border border-line-soft" />
              ) : (
                <span className="w-20 h-20 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center"><ImagePlus size={26} /></span>
              )}
              <span className="text-sm">
                <span className="font-semibold text-brand-blue">{proof ? x.proofChange : x.proofChoose}</span>
                <span className="block text-xs text-fg-muted mt-0.5">{proof ? proof.name : x.proofHint}</span>
              </span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
          </div>

          {send.isError && <p className="text-sm text-red-600" role="alert">{apiError(send.error, t.common.error)}</p>}
        </div>

        <footer className="px-6 py-4 border-t border-line-soft flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-line text-sm font-semibold text-fg-soft hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => send.mutate()} disabled={!proof || !start || send.isPending}
            className="h-10 px-5 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
            {send.isPending ? t.common.sending : x.declareSend}
          </button>
        </footer>
      </div>
    </div>
  );
}
