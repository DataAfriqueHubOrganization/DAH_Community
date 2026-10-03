"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Minus, Paperclip, Pencil, Plus, Trash2, X } from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { todayIso } from "@/features/engagement/period";
import { Pagination, inputClass, paginate } from "@/features/departments/workspace/shared";
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  type CashCategory, type CashEntry, type CashKind, type CashSummary, type PaymentMethod,
} from "@/types/treasury.types";
import { monthName } from "./shared";

const PAGE_SIZE = 20;
const METHODS: PaymentMethod[] = ["cash", "mobile_money", "transfer", "other"];

export function CashTab({ year }: { year: number }) {
  const { t, fmt } = useI18n();
  const x = t.treasury;
  const qc = useQueryClient();
  const [kind, setKind] = useState<CashKind | "">("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CashEntry | { kind: CashKind } | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["treasury", "cash-summary", year],
    queryFn: () => treasuryService.cash.summary(year).then((r) => r.data),
  });
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["treasury", "cash", year, kind, category],
    queryFn: () => treasuryService.cash.list({ year, kind, category }).then((r) => r.data),
  });

  const remove = useMutation({
    mutationFn: (id: number) => treasuryService.cash.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["treasury"] }),
  });

  const exportCsv = async () => {
    const { data } = await treasuryService.cash.exportCsv(year);
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caisse-dah-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categories = kind === "income" ? INCOME_CATEGORIES : kind === "expense" ? EXPENSE_CATEGORIES : [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
  const rows = paginate(entries, page, PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Indicateurs */}
      <div className="grid grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr] gap-3">
        <div className="col-span-2 lg:col-span-1 bg-univers-brand text-white rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">{x.balance}</p>
          <p className="font-display text-3xl font-extrabold mt-1.5">{summary ? x.fcfa(summary.balance) : "—"}</p>
          <p className="text-xs text-white/80">{x.balanceAt(fmt.date(todayIso()))}</p>
        </div>
        <Stat label={x.income(year)} value={summary ? x.fcfa(summary.income) : "—"} sub={summary ? x.incomeOf(x.fcfa(summary.contributions)) : undefined} />
        <Stat label={x.expense(year)} value={summary ? x.fcfa(summary.expense) : "—"} />
        <Stat label={x.result(year)} value={summary ? `${summary.result > 0 ? "+" : ""}${x.fcfa(summary.result)}` : "—"} sub={x.resultHint}
          valueClass={summary && summary.result < 0 ? "text-red-600" : "text-green-700 dark:text-green-400"} />
      </div>

      {summary && <MonthlyChart summary={summary} />}

      {/* Filtres + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select label={x.kindFilter} value={kind} onChange={(v) => { setKind(v as CashKind | ""); setCategory(""); setPage(1); }}
            options={[["", x.allKinds], ["income", x.kind.income], ["expense", x.kind.expense]]} />
          <Select label={x.categoryFilter} value={category} onChange={(v) => { setCategory(v); setPage(1); }}
            options={[["", x.allCategories], ...categories.map((c) => [c, x.categories[c]] as [string, string])]} />
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-line text-sm font-medium text-fg-soft hover:bg-surface-muted">
            <Download size={14} /> {x.exportCsv}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing({ kind: "income" })}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep">
            <Plus size={15} /> {x.addIncome}
          </button>
          <button onClick={() => setEditing({ kind: "expense" })}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-brand-orange text-ink text-sm font-semibold hover:brightness-95">
            <Minus size={15} /> {x.addExpense}
          </button>
        </div>
      </div>

      {/* Journal */}
      <div className="bg-surface rounded-2xl border border-line-soft">
        {isLoading ? (
          <div className="h-64 animate-pulse" />
        ) : entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-subtle">{x.noEntries}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wider text-fg-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-bold rounded-tl-2xl">{x.colDate}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">{x.colLabel}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{x.colCategory}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden lg:table-cell">{x.colMethod}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold text-right">{x.colAmount}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{x.colProof}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden xl:table-cell">{x.colRecordedBy}</th>
                  <th scope="col" className="px-2 py-2.5 rounded-tr-2xl"><span className="sr-only">{x.colAction}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const income = e.kind === "income";
                  return (
                    <tr key={e.id} className="border-t border-line-soft">
                      <td className="px-4 py-2.5 text-fg-muted whitespace-nowrap">{fmt.date(e.date)}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-fg">{e.label}</p>
                        {e.note && <p className="text-xs text-fg-muted">{e.note}</p>}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className={cn("text-xs font-semibold rounded-full px-2.5 py-1 whitespace-nowrap",
                          income ? "bg-brand-blue/10 text-brand-deep" : "bg-brand-orange/15 text-orange-800 dark:text-orange-300")}>
                          {x.categories[e.category]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted hidden lg:table-cell">{x.methods[e.method]}</td>
                      <td className={cn("px-4 py-2.5 text-right font-display font-bold whitespace-nowrap", income ? "text-green-700 dark:text-green-400" : "text-red-600")}>
                        {income ? "+" : "−"}{x.fcfa(e.amount)}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {e.attachment ? (
                          <a href={e.attachment} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline">
                            <Paperclip size={12} /> {x.proof}
                          </a>
                        ) : <span className="text-fg-faint">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted hidden xl:table-cell">{e.recorded_by_name ?? "—"}</td>
                      <td className="px-2 py-2.5 text-right whitespace-nowrap">
                        {e.is_contribution ? (
                          <span className="text-[11px] text-fg-subtle" title={x.contributionsNote}>{x.auto}</span>
                        ) : (
                          <>
                            <button onClick={() => setEditing(e)} aria-label={x.editEntry} title={x.editEntry}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand-blue hover:bg-surface-muted"><Pencil size={14} /></button>
                            <button onClick={() => { if (confirm(x.confirmDeleteEntry)) remove.mutate(e.id); }} aria-label={t.common.delete} title={t.common.delete}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"><Trash2 size={14} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="px-4 py-3 border-t border-line-soft text-xs text-fg-muted">{x.contributionsNote}</p>
        <Pagination page={page} pageSize={PAGE_SIZE} total={entries.length} onChange={setPage} />
      </div>

      {editing && <CashEntryModal entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function Stat({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <div className="bg-surface rounded-2xl border border-line-soft p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</p>
      <p className={cn("font-display text-xl font-extrabold mt-1.5 text-fg", valueClass)}>{value}</p>
      {sub && <p className="text-xs text-fg-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="inline-flex items-center gap-2 h-10 pl-3 pr-1 border border-line rounded-xl bg-surface text-sm">
      <span className="text-fg-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-semibold text-fg focus:outline-none pr-1 max-w-[180px]">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

/** Recettes / dépenses par mois : barres groupées, une seule échelle, valeurs au
 *  survol et au focus ; tableau équivalent dépliable (lecteurs d'écran, contraste). */
function MonthlyChart({ summary }: { summary: CashSummary }) {
  const { t, intl } = useI18n();
  const x = t.treasury;
  const [active, setActive] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();
  const lastMonth = summary.year === currentYear ? new Date().getMonth() + 1 : 12;
  const months = summary.by_month.filter((m) => m.month <= lastMonth);
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  // Graduation « ronde » : 1, 2 ou 5 × 10^n.
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].map((k) => k * magnitude).find((s) => max / s <= 4) ?? magnitude * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();
  const compact = (n: number) => new Intl.NumberFormat(intl, { notation: "compact" }).format(n);
  const label = (m: number) => monthName(`${summary.year}-${String(m).padStart(2, "0")}-01`, intl, "short", false).replace(".", "");

  return (
    <section className="bg-surface rounded-2xl border border-line-soft p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold text-fg">{x.chartTitle(summary.year)}</h2>
        <ul className="flex gap-4 text-xs text-fg-soft">
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-brand-blue" aria-hidden="true" />{x.chartIncome}</li>
          <li className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-[3px] bg-brand-orange" aria-hidden="true" />{x.chartExpense}</li>
        </ul>
      </div>
      <div className="mt-4 grid grid-cols-[44px_1fr] h-52" aria-hidden="true">
        <div className="flex flex-col justify-between text-[11px] text-fg-subtle pb-6">
          {ticks.map((v) => <span key={v}>{compact(v)}</span>)}
        </div>
        <div className="relative">
          <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
            {ticks.map((v, i) => <div key={v} className={cn("border-t", i === ticks.length - 1 ? "border-line" : "border-line-soft")} />)}
          </div>
          <div className="absolute inset-0 flex">
            {months.map((m) => (
              <div key={m.month} className="relative flex-1 flex flex-col items-center justify-end"
                onMouseEnter={() => setActive(m.month)} onMouseLeave={() => setActive(null)}>
                <div className="flex items-end gap-0.5 h-[calc(100%-24px)]">
                  <div className="w-3 rounded-t-[4px] bg-brand-blue" style={{ height: `${(m.income / top) * 100}%` }} />
                  <div className="w-3 rounded-t-[4px] bg-brand-orange" style={{ height: `${(m.expense / top) * 100}%` }} />
                </div>
                <span className={cn("h-6 leading-6 text-[11px] capitalize", active === m.month ? "text-fg font-semibold" : "text-fg-muted")}>{label(m.month)}</span>
                {active === m.month && (
                  <div className="absolute bottom-full mb-1 z-10 w-max bg-fg text-surface text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none">
                    <p className="font-semibold capitalize mb-0.5">{label(m.month)}</p>
                    <p>{x.chartIncome} : {x.fcfa(m.income)}</p>
                    <p>{x.chartExpense} : {x.fcfa(m.expense)}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-3">
        <summary className="text-xs text-brand-blue cursor-pointer">{x.chartTable}</summary>
        <table className="mt-2 text-xs w-full max-w-md">
          <thead><tr className="text-fg-muted text-left"><th className="py-1 font-semibold">{x.colDate}</th><th className="py-1 font-semibold text-right">{x.chartIncome}</th><th className="py-1 font-semibold text-right">{x.chartExpense}</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month} className="border-t border-line-soft">
                <td className="py-1 capitalize">{label(m.month)}</td>
                <td className="py-1 text-right">{x.fcfa(m.income)}</td>
                <td className="py-1 text-right">{x.fcfa(m.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

function CashEntryModal({ entry, onClose }: { entry: CashEntry | { kind: CashKind }; onClose: () => void }) {
  const { t } = useI18n();
  const x = t.treasury;
  const qc = useQueryClient();
  const existing = "id" in entry ? entry : null;
  const kind = entry.kind;
  const categories = (kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)
    .filter((c) => c !== "contributions") as CashCategory[];
  const [category, setCategory] = useState<CashCategory>(existing?.category ?? categories[0]);
  const [label, setLabel] = useState(existing?.label ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [date, setDate] = useState(existing?.date ?? todayIso());
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? "cash");
  const [reference, setReference] = useState(existing?.reference ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("category", category);
      form.append("label", label);
      form.append("amount", amount);
      form.append("date", date);
      form.append("method", method);
      form.append("reference", reference);
      form.append("note", note);
      if (file) form.append("attachment", file);
      return existing ? treasuryService.cash.update(existing.id, form) : treasuryService.cash.create(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury"] });
      onClose();
    },
  });

  const title = existing ? x.editEntry : kind === "income" ? x.newIncome : x.newExpense;
  const valid = label.trim() && Number(amount) > 0 && date;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="cash-title">
      <div className="bg-surface rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <header className="px-6 py-5 border-b border-line-soft flex items-center justify-between">
          <h2 id="cash-title" className="font-display text-lg font-bold text-fg flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-[3px]", kind === "income" ? "bg-brand-blue" : "bg-brand-orange")} aria-hidden="true" />
            {title}
          </h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg"><X size={20} /></button>
        </header>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="cash-label" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.label}</label>
            <input id="cash-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} className={cn(inputClass, "w-full")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cash-category" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.category}</label>
              <select id="cash-category" value={category} onChange={(e) => setCategory(e.target.value as CashCategory)} className={cn(inputClass, "w-full")}>
                {categories.map((c) => <option key={c} value={c}>{x.categories[c]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="cash-amount" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.amount} (FCFA)</label>
              <input id="cash-amount" type="number" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} className={cn(inputClass, "w-full")} />
            </div>
            <div>
              <label htmlFor="cash-date" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.date}</label>
              <input id="cash-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "w-full")} />
            </div>
            <div>
              <label htmlFor="cash-method" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.method}</label>
              <select id="cash-method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className={cn(inputClass, "w-full")}>
                {METHODS.map((m) => <option key={m} value={m}>{x.methods[m]}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="cash-ref" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.reference}</label>
              <input id="cash-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} className={cn(inputClass, "w-full")} />
            </div>
            <div>
              <label htmlFor="cash-note" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.note}</label>
              <input id="cash-note" value={note} onChange={(e) => setNote(e.target.value)} className={cn(inputClass, "w-full")} />
            </div>
          </div>
          <div>
            <label htmlFor="cash-file" className="block text-xs font-semibold text-fg-soft mb-1.5">{x.attachment}</label>
            <input id="cash-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-fg-soft file:mr-3 file:h-9 file:px-3 file:rounded-lg file:border-0 file:bg-surface-strong file:text-fg file:font-medium" />
            {existing?.attachment && !file && (
              <a href={existing.attachment} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-blue hover:underline mt-1.5">
                <Paperclip size={12} /> {x.currentAttachment}
              </a>
            )}
          </div>
          {save.isError && <p className="text-sm text-red-600" role="alert">{t.common.error}</p>}
        </div>
        <footer className="px-6 py-4 border-t border-line-soft flex justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-xl border border-line text-sm font-semibold text-fg-soft hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending}
            className={cn("h-10 px-5 rounded-xl text-sm font-semibold disabled:opacity-50",
              kind === "income" ? "bg-brand-blue text-white hover:bg-brand-deep" : "bg-brand-orange text-ink hover:brightness-95")}>
            {save.isPending ? t.common.saving : t.common.save}
          </button>
        </footer>
      </div>
    </div>
  );
}
