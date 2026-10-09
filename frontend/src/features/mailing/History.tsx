"use client";

import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { mailingService } from "@/services/mailing.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { apiError } from "@/features/treasury/shared";
import type { MemberEmail } from "@/types/mailing.types";

/** Historique des emails aux membres, avec l'avancement de chaque envoi. */
export function History() {
  const { t, fmt } = useI18n();
  const x = t.mailing.history;
  const [openId, setOpenId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mailing", "emails"],
    queryFn: () => mailingService.list().then((r) => r.data),
    // Rafraîchit tant qu'un envoi est en cours.
    refetchInterval: (query) => {
      const d = query.state.data;
      const rows = Array.isArray(d) ? d : d?.results ?? [];
      return rows.some((r) => r.pending > 0) ? 3000 : false;
    },
  });
  const rows: MemberEmail[] = Array.isArray(data) ? data : data?.results ?? [];

  if (isLoading) {
    return (
      <div className="bg-surface rounded-2xl border border-line p-5 space-y-3" aria-busy="true">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-12 rounded-lg bg-surface-strong animate-pulse" />)}
      </div>
    );
  }
  if (!rows.length) {
    return (
      <div className="bg-surface rounded-2xl border border-line px-6 py-14 text-center">
        <Mail size={28} className="mx-auto text-fg-faint" aria-hidden="true" />
        <p className="mt-3 text-sm text-fg-muted">{x.empty}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-surface-muted text-left text-xs font-semibold text-fg-muted">
              <th scope="col" className="px-5 py-3">{x.date}</th>
              <th scope="col" className="px-5 py-3">{x.subject}</th>
              <th scope="col" className="px-5 py-3">{x.recipients}</th>
              <th scope="col" className="px-5 py-3">{x.by}</th>
              <th scope="col" className="px-5 py-3">{x.status}</th>
              <th scope="col" className="px-5 py-3"><span className="sr-only">{t.common.actions}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr className="border-t border-line-soft">
                  <td className="px-5 py-4 text-fg-soft whitespace-nowrap">{fmt.dateTime(row.created_at)}</td>
                  <td className="px-5 py-4">
                    <span className="block font-medium text-fg">{row.subject}</span>
                    {row.template && <span className="block text-xs text-fg-muted">{t.mailing.templates[row.template]}</span>}
                  </td>
                  <td className="px-5 py-4 text-fg-soft">{row.audience_label} · {row.total}</td>
                  <td className="px-5 py-4 text-fg-soft">{row.sent_by_name ?? "—"}</td>
                  <td className="px-5 py-4"><StatusBadge row={row} /></td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => setOpenId(openId === row.id ? null : row.id)} aria-expanded={openId === row.id}
                      className="text-[13px] font-medium text-brand-blue hover:text-brand-deep">
                      {openId === row.id ? x.hide : x.view}
                    </button>
                  </td>
                </tr>
                {openId === row.id && (
                  <tr className="bg-surface-muted/50">
                    <td colSpan={6} className="px-5 py-4"><Detail id={row.id} /></td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ row }: { row: MemberEmail }) {
  const { t } = useI18n();
  const x = t.mailing.history;
  const done = row.sent + row.failed;
  const [label, tone] = row.pending > 0
    ? [x.statusProgress, "bg-surface-strong"]
    : row.failed > 0 ? [x.statusPartial, "bg-brand-orange/15"] : [x.statusSent, "bg-brand-blue/10"];
  const dot = row.pending > 0 ? "bg-fg-muted" : row.failed > 0 ? "bg-brand-orange" : "bg-brand-blue";
  return (
    <span className={cn("inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[13px] font-medium text-fg whitespace-nowrap", tone)}>
      <span aria-hidden="true" className={cn("w-2 h-2 rounded-sm", dot)} />
      {label} · {row.pending > 0 ? done : row.sent} / {row.total}
    </span>
  );
}

function Detail({ id }: { id: number }) {
  const { t } = useI18n();
  const x = t.mailing.history;
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["mailing", "email", id],
    queryFn: () => mailingService.get(id).then((r) => r.data),
    refetchInterval: (query) => (query.state.data?.pending ? 3000 : false),
  });
  const retry = useMutation({
    mutationFn: () => mailingService.retry(id).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailing"] }),
  });

  if (isLoading || !data) return <div className="h-20 rounded-lg bg-surface-strong animate-pulse" aria-busy="true" />;
  const failed = data.recipients.filter((r) => r.status === "failed");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        {[
          [data.sent, x.sentCount, "bg-surface"],
          [data.failed, x.failedCount, data.failed ? "bg-brand-orange/12" : "bg-surface"],
          [data.pending, x.pendingCount, "bg-surface"],
        ].map(([value, text, bg]) => (
          <div key={text as string} className={cn("rounded-xl px-4 py-3 border border-line-soft", bg as string)}>
            <p className="font-display font-extrabold text-xl text-fg">{value}</p>
            <p className="text-[13px] text-fg-soft">{text}</p>
          </div>
        ))}
      </div>
      {failed.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[13px] text-fg-soft">
            <b className="text-fg">{x.failedList} :</b> {failed.map((r) => `${r.first_name} ${r.last_name}`.trim() || r.address).join(", ")} — {x.checkAddress}
          </p>
          <button type="button" onClick={() => retry.mutate()} disabled={retry.isPending || data.pending > 0}
            className="h-9 px-3.5 rounded-lg border border-line-strong bg-surface text-[13px] font-medium text-brand-deep hover:bg-surface-muted disabled:opacity-50">
            {x.retry}
          </button>
        </div>
      )}
      {retry.isSuccess && <p role="status" className="text-sm text-green-600">{x.retried(retry.data.retried)}</p>}
      {retry.isError && <p role="status" className="text-sm text-red-600">{apiError(retry.error, t.common.error)}</p>}
    </div>
  );
}
