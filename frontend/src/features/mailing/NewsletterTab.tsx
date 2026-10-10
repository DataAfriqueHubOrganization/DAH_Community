"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Search, Trash2 } from "lucide-react";
import { newsletterService, type NewsletterSubscriber } from "@/services/newsletter.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { apiError } from "@/features/treasury/shared";

type Status = "active" | "unsubscribed" | "";

/** Abonnés à la newsletter : liste, ajout, suppression, export CSV. L'envoi se fait
 *  depuis « Nouvel email », groupe « Abonnés à la newsletter ». */
export function NewsletterTab() {
  const { t, fmt } = useI18n();
  const x = t.mailing.newsletterAdmin;
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("active");
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["newsletter", status, search],
    queryFn: () => newsletterService.list({ status, search }).then((r) => r.data),
  });
  const rows: NewsletterSubscriber[] = Array.isArray(data) ? data : data?.results ?? [];
  const total = Array.isArray(data) ? data.length : data?.count ?? 0;
  const refresh = () => qc.invalidateQueries({ queryKey: ["newsletter"] });

  const add = useMutation({
    mutationFn: () => newsletterService.add(email.trim()),
    onSuccess: () => { setEmail(""); refresh(); qc.invalidateQueries({ queryKey: ["mailing", "audiences"] }); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => newsletterService.remove(id),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ["mailing", "audiences"] }); },
  });
  const exportCsv = async () => {
    const { data: blob } = await newsletterService.exportCsv();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "abonnes-newsletter.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-soft max-w-3xl">{x.intro}</p>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex gap-1 p-1 bg-surface-strong rounded-xl">
          {(["active", "unsubscribed", ""] as Status[]).map((s) => (
            <button key={s || "all"} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={cn("h-9 px-3.5 rounded-lg text-[13px] transition-all", status === s ? "bg-surface shadow-sm font-semibold text-fg" : "text-fg-soft hover:text-fg")}>
              {x.filters[s || "all"]}
            </button>
          ))}
        </div>
        <label className="relative w-full sm:w-64">
          <span className="sr-only">{x.search}</span>
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={x.search}
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
        </label>
        <span className="flex-1" />
        <button type="button" onClick={exportCsv}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-line bg-surface text-sm font-medium text-fg-soft hover:bg-surface-muted">
          <Download size={15} aria-hidden="true" /> {x.export}
        </button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) add.mutate(); }} className="flex flex-wrap gap-2">
        <label className="flex-1 min-w-[220px]">
          <span className="sr-only">{x.addPlaceholder}</span>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={x.addPlaceholder}
            className="w-full h-10 px-3.5 rounded-xl border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
        </label>
        <button type="submit" disabled={add.isPending}
          className="h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">{x.add}</button>
      </form>
      {(add.isError || remove.isError) && (
        <p role="status" className="text-sm text-red-600">{apiError(add.error ?? remove.error, t.common.error)}</p>
      )}

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <p className="px-5 py-3 text-xs font-semibold text-fg-muted bg-surface-muted">{x.count(total)}</p>
        {isLoading ? (
          <div className="p-5 space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-surface-strong animate-pulse" />)}</div>
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-fg-muted">{x.empty}</p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {rows.map((sub) => (
              <li key={sub.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1 min-w-0 truncate font-medium text-fg">{sub.email}</span>
                <span className="hidden sm:inline text-xs text-fg-muted">
                  {sub.is_active ? x.since(fmt.date(sub.created_at)) : x.unsubscribedOn(fmt.date(sub.unsubscribed_at ?? sub.created_at))}
                </span>
                <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-semibold",
                  sub.is_active ? "bg-brand-blue/10 text-brand-deep" : "bg-surface-strong text-fg-muted")}>
                  {sub.is_active ? x.active : x.unsubscribed}
                </span>
                <button type="button" onClick={() => { if (confirm(x.confirmDelete(sub.email))) remove.mutate(sub.id); }}
                  aria-label={x.delete(sub.email)} title={x.delete(sub.email)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-fg-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
