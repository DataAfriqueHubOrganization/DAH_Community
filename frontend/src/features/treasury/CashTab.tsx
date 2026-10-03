"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownLeft, ArrowUpRight, Download, FileText, Gift, Handshake, Megaphone, Mic, MoreHorizontal, Paperclip,
  Pencil, Plus, Search, Ticket, Trash2, Truck, Wallet, Wrench, X, type LucideIcon,
} from "lucide-react";
import { treasuryService } from "@/services/treasury.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { todayIso } from "@/features/engagement/period";
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  type CashCategory, type CashEntry, type CashKind, type CashSummary, type PaymentMethod,
} from "@/types/treasury.types";
import { Segmented, YearSelect, apiError, monthName, yearOptions } from "./shared";

const METHODS: PaymentMethod[] = ["cash", "mobile_money", "transfer", "other"];
const CATEGORY_ICON: Record<CashCategory, LucideIcon> = {
  contributions: Wallet, donations: Gift, sponsorship: Handshake, events_income: Ticket, other_income: MoreHorizontal,
  events: Mic, communication: Megaphone, tools: Wrench, logistics: Truck, other_expense: MoreHorizontal,
};

/** Caisse : solde et tendance, entrées / sorties de l'année, journal par mois. */
export function CashTab({ year, onYear }: { year: number; onYear: (y: number) => void }) {
  const { t, fmt, intl } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const qc = useQueryClient();
  const [kind, setKind] = useState<CashKind | "">("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CashEntry | "new" | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["treasury", "cash-summary", year],
    queryFn: () => treasuryService.cash.summary(year).then((r) => r.data),
  });
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["treasury", "cash", year],
    queryFn: () => treasuryService.cash.list({ year }).then((r) => r.data),
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

  // Journal groupé par mois, avec les totaux du mois.
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = entries
      .filter((e) => !kind || e.kind === kind)
      .filter((e) => !q || e.label.toLowerCase().includes(q) || e.note.toLowerCase().includes(q));
    const map = new Map<string, CashEntry[]>();
    for (const e of filtered) {
      const key = e.date.slice(0, 7);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()].map(([month, list]) => ({
      month,
      list,
      income: list.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0),
      expense: list.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0),
    }));
  }, [entries, kind, query]);

  return (
    <div className="space-y-5">
      {summary ? <Overview summary={summary} /> : <div className="h-52 bg-surface rounded-3xl animate-pulse" />}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<CashKind | "">
          label={x.kindFilter}
          value={kind}
          onChange={setKind}
          options={[["", v.all], ["income", v.inflow], ["expense", v.outflow]]}
        />
        <YearSelect value={year} onChange={onYear} years={yearOptions().filter((y) => y <= new Date().getFullYear())} />
        <label className="relative w-full sm:w-72">
          <span className="sr-only">{v.searchEntry}</span>
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={v.searchEntry}
            className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
        </label>
        <span className="flex-1" />
        <button onClick={exportCsv} className="inline-flex items-center gap-1.5 h-10 px-3 text-sm font-semibold text-fg-muted hover:text-fg">
          <Download size={15} /> {x.exportShort}
        </button>
        <button onClick={() => setEditing("new")}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep">
          <Plus size={16} /> {v.newEntry}
        </button>
      </div>

      <section className="bg-surface rounded-3xl shadow-sm py-2">
        {isLoading ? (
          <div className="h-64 animate-pulse" />
        ) : groups.length === 0 ? (
          <p className="py-14 text-center text-sm text-fg-subtle">{v.emptyJournal}</p>
        ) : groups.map((g) => (
          <div key={g.month}>
            <div className="flex items-baseline justify-between gap-3 px-6 pt-5 pb-2">
              <h3 className="font-display font-extrabold text-fg capitalize">{monthName(`${g.month}-01`, intl)}</h3>
              <p className="text-sm">
                <b className="text-green-700 dark:text-green-400">+{x.fcfa(g.income)}</b>
                <span className="text-fg-subtle"> · </span>
                <b className="text-red-600">−{x.fcfa(g.expense)}</b>
              </p>
            </div>
            <ul>
              {g.list.map((e) => {
                const income = e.kind === "income";
                const Icon = CATEGORY_ICON[e.category];
                return (
                  <li key={e.id} className="group flex items-center gap-4 px-6 py-2.5 hover:bg-surface-muted transition-colors">
                    <span className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      income ? "bg-brand-blue/10 text-brand-blue" : "bg-brand-orange/15 text-orange-700 dark:text-orange-300")}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-fg truncate">{e.label}</span>
                      <span className="block text-xs text-fg-muted truncate">
                        {fmt.date(e.date)} · {x.categories[e.category]} · {x.methods[e.method]}{e.note && ` · ${e.note}`}
                      </span>
                    </span>
                    {e.attachment && (
                      <a href={e.attachment} target="_blank" rel="noopener noreferrer" aria-label={x.colProof} title={x.colProof}
                        className="p-1.5 rounded-lg text-brand-blue hover:bg-brand-blue/10"><Paperclip size={15} /></a>
                    )}
                    <span className={cn("w-32 text-right font-display font-extrabold whitespace-nowrap", income ? "text-green-700 dark:text-green-400" : "text-fg")}>
                      {income ? "+" : "−"}{x.fcfa(e.amount)}
                    </span>
                    <span className="w-16 flex justify-end gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                      {e.is_contribution ? (
                        <span className="text-[11px] text-fg-subtle" title={x.contributionsNote}>{x.auto}</span>
                      ) : (
                        <>
                          <button onClick={() => setEditing(e)} aria-label={x.editEntry} title={x.editEntry}
                            className="p-1.5 rounded-lg text-fg-muted hover:text-brand-blue hover:bg-surface"><Pencil size={14} /></button>
                          <button onClick={() => { if (confirm(x.confirmDeleteEntry)) remove.mutate(e.id); }} aria-label={t.common.delete} title={t.common.delete}
                            className="p-1.5 rounded-lg text-fg-muted hover:text-red-600 hover:bg-surface"><Trash2 size={14} /></button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      {editing && <EntryModal entry={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Solde (avec sa courbe sur l'année) + cartes Entrées / Sorties avec barres mensuelles. */
function Overview({ summary }: { summary: CashSummary }) {
  const { t, fmt, intl } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const thisYear = new Date().getFullYear();
  const lastMonth = summary.year === thisYear ? new Date().getMonth() + 1 : 12;
  const months = summary.by_month.filter((m) => m.month <= lastMonth);

  // Courbe du solde (année en cours) : solde d'ouverture + cumul mois par mois.
  const showCurve = summary.year === thisYear;
  const opening = summary.balance - summary.result;
  let running = opening;
  const balances = months.map((m) => (running += m.income - m.expense));
  const points = [opening, ...balances];
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const path = points.map((b, i) => `${(i / Math.max(1, points.length - 1)) * 300},${62 - ((b - min) / span) * 54}`).join(" L");

  const peak = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const top = (k: "income" | "expense") => summary.by_category.find((c) => c.kind === k && c.category !== "contributions") ?? null;
  const topExpense = top("expense");
  const label = (m: number) => monthName(`${summary.year}-${String(m).padStart(2, "0")}-01`, intl, "short", false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-5">
      <section className="relative overflow-hidden rounded-3xl bg-univers-brand text-white p-6 shadow-xl shadow-brand-deep/20">
        <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">{x.balance}</p>
        <p className="font-display text-4xl font-extrabold mt-2 tracking-tight">{x.fcfa(summary.balance)}</p>
        <p className="text-sm text-white/85 mt-0.5">{x.balanceAt(fmt.date(todayIso()))}</p>
        {showCurve && (
          <svg viewBox="0 0 300 70" className="w-full h-[70px] mt-4" preserveAspectRatio="none" aria-hidden="true">
            <path d={`M${path} L300,70 L0,70 Z`} fill="rgba(255,255,255,.12)" />
            <path d={`M${path}`} fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        )}
      </section>

      <FlowCard
        title={v.inflows(summary.year)} amount={`+${x.fcfa(summary.income)}`} amountClass="text-green-700 dark:text-green-400"
        sub={x.incomeOf(x.fcfa(summary.contributions))}
        bars={months.map((m) => ({ key: m.month, value: m.income, title: `${label(m.month)} : ${x.fcfa(m.income)}` }))}
        peak={peak} barClass="bg-brand-blue"
      />
      <FlowCard
        title={v.outflows(summary.year)} amount={`−${x.fcfa(summary.expense)}`} amountClass="text-fg"
        sub={topExpense ? v.ofWhich(x.categories[topExpense.category], x.fcfa(topExpense.total)) : ""}
        bars={months.map((m) => ({ key: m.month, value: m.expense, title: `${label(m.month)} : ${x.fcfa(m.expense)}` }))}
        peak={peak} barClass="bg-brand-orange"
      />
    </div>
  );
}

function FlowCard({ title, amount, amountClass, sub, bars, peak, barClass }: {
  title: string; amount: string; amountClass: string; sub: string;
  bars: { key: number; value: number; title: string }[]; peak: number; barClass: string;
}) {
  return (
    <section className="bg-surface rounded-3xl shadow-sm p-6 flex flex-col">
      <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{title}</p>
      <p className={cn("font-display text-[28px] font-extrabold mt-2", amountClass)}>{amount}</p>
      <p className="text-sm text-fg-muted mt-0.5 truncate">{sub}</p>
      <div className="flex items-end gap-1 h-12 mt-auto pt-4">
        {bars.map((b) => (
          <span key={b.key} title={b.title} className={cn("flex-1 rounded-t-[4px] min-h-[2px]", barClass)}
            style={{ height: `${Math.max(4, (b.value / peak) * 100)}%`, opacity: b.value ? 1 : 0.25 }}>
            <span className="sr-only">{b.title}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/** Nouvelle écriture / modification : Entrée ou Sortie, montant en grand, catégories en tuiles. */
function EntryModal({ entry, onClose }: { entry: CashEntry | null; onClose: () => void }) {
  const { t } = useI18n();
  const x = t.treasury;
  const v = x.v2;
  const qc = useQueryClient();
  const [kind, setKind] = useState<CashKind>(entry?.kind ?? "expense");
  const categoriesFor = (k: CashKind) => (k === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).filter((c) => c !== "contributions") as CashCategory[];
  const [category, setCategory] = useState<CashCategory>(entry?.category ?? categoriesFor(kind)[0]);
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [label, setLabel] = useState(entry?.label ?? "");
  const [date, setDate] = useState(entry?.date ?? todayIso());
  const [method, setMethod] = useState<PaymentMethod>(entry?.method ?? "cash");
  const [reference, setReference] = useState(entry?.reference ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchKind = (k: CashKind) => {
    setKind(k);
    if (!categoriesFor(k).includes(category)) setCategory(categoriesFor(k)[0]);
  };

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
      return entry ? treasuryService.cash.update(entry.id, form) : treasuryService.cash.create(form);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treasury"] });
      onClose();
    },
  });

  const valid = label.trim() && Number(amount) > 0 && date;
  const income = kind === "income";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="entry-title">
      <div className="bg-surface rounded-[28px] w-full max-w-[600px] my-8 shadow-2xl overflow-hidden">
        <header className="px-7 pt-6 pb-3 flex items-center justify-between">
          <h2 id="entry-title" className="font-display text-xl font-extrabold text-fg">{entry ? x.editEntry : v.newEntry}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg"><X size={22} /></button>
        </header>

        <div className="px-7 pb-6 space-y-5">
          {/* Entrée / Sortie */}
          <div role="radiogroup" aria-label={x.kindFilter} className="grid grid-cols-2 gap-1.5 bg-surface-muted rounded-2xl p-1.5">
            {(["income", "expense"] as CashKind[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => switchKind(k)}
                className={cn("h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 transition-all",
                  kind === k
                    ? cn("bg-surface shadow-sm", k === "income" ? "text-brand-deep" : "text-orange-800 dark:text-orange-300")
                    : "text-fg-muted hover:text-fg")}>
                {k === "income" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                {k === "income" ? v.kindIn : v.kindOut}
              </button>
            ))}
          </div>

          {/* Montant */}
          <label className="block text-center">
            <span className="flex items-baseline justify-center gap-2">
              <input
                type="number" inputMode="numeric" min={1} step={1} value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0" autoFocus
                className="w-full max-w-[280px] bg-transparent text-center font-display text-5xl font-extrabold tracking-tight text-fg placeholder:text-fg-faint focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-xl font-bold text-fg-subtle">FCFA</span>
            </span>
            <span className="block text-sm text-fg-muted mt-1">{x.amount}</span>
          </label>

          {/* Catégories */}
          <fieldset>
            <legend className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2.5">{x.category}</legend>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {categoriesFor(kind).map((c) => {
                const Icon = CATEGORY_ICON[c];
                const active = category === c;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={active}
                    className={cn("rounded-2xl px-2 py-3 text-xs font-semibold flex flex-col items-center gap-1.5 border transition-colors",
                      active
                        ? income ? "border-2 border-brand-blue bg-brand-blue/10 text-brand-deep" : "border-2 border-brand-orange bg-brand-orange/10 text-orange-800 dark:text-orange-300"
                        : "border-line text-fg-soft hover:bg-surface-muted")}>
                    <Icon size={20} />
                    <span className="text-center leading-tight">{x.categories[c]}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_1fr] gap-3">
            <div>
              <label htmlFor="entry-label" className="block text-xs text-fg-muted mb-1.5">{x.label}</label>
              <input id="entry-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200}
                className="w-full h-12 px-4 rounded-2xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label htmlFor="entry-date" className="block text-xs text-fg-muted mb-1.5">{x.date}</label>
              <input id="entry-date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>

          <fieldset>
            <legend className="text-xs text-fg-muted mb-1.5">{x.method}</legend>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
                  className={cn("h-10 px-4 rounded-full text-sm font-semibold transition-colors",
                    method === m ? "bg-fg text-surface" : "bg-surface-muted text-fg-soft hover:bg-surface-strong")}>
                  {x.methods[m]}
                </button>
              ))}
            </div>
          </fieldset>

          <details className="group">
            <summary className="text-xs font-semibold text-brand-blue cursor-pointer select-none">{x.reference} · {x.note}</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
              <input aria-label={x.reference} placeholder={x.reference} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100}
                className="h-11 px-4 rounded-2xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
              <input aria-label={x.note} placeholder={x.note} value={note} onChange={(e) => setNote(e.target.value)}
                className="h-11 px-4 rounded-2xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </details>

          {/* Justificatif : glisser-déposer */}
          <label
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            className={cn("flex items-center gap-4 rounded-2xl border-2 border-dashed p-3.5 cursor-pointer transition-colors",
              dragging ? "border-brand-blue bg-brand-blue/10" : "border-brand-blue/30 bg-brand-blue/[0.03] hover:bg-brand-blue/[0.06]")}
          >
            <span className="w-12 h-12 rounded-xl bg-surface border border-line-soft flex items-center justify-center text-brand-blue shrink-0">
              {file || entry?.attachment ? <FileText size={20} /> : <Paperclip size={20} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-fg truncate">
                {file ? file.name : entry?.attachment ? x.currentAttachment : x.attachment}
              </span>
              <span className="block text-xs text-fg-muted">{file || entry?.attachment ? v.dropReplace : v.dropHint}</span>
            </span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>

          {save.isError && <p className="text-sm text-red-600" role="alert">{apiError(save.error, t.common.error)}</p>}
        </div>

        <footer className="px-7 py-4 border-t border-line-soft bg-surface-muted/60 flex justify-end gap-2">
          <button onClick={onClose} className="h-11 px-5 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => save.mutate()} disabled={!valid || save.isPending}
            className={cn("h-11 px-6 rounded-xl text-sm font-bold disabled:opacity-50",
              income ? "bg-brand-blue text-white hover:bg-brand-deep shadow-lg shadow-brand-blue/25" : "bg-brand-orange text-ink hover:brightness-95 shadow-lg shadow-brand-orange/25")}>
            {save.isPending ? t.common.saving : entry ? t.common.save : income ? v.saveIn : v.saveOut}
          </button>
        </footer>
      </div>
    </div>
  );
}
