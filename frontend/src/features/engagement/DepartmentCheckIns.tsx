"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, X } from "lucide-react";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import type { CheckInStatus } from "@/types/engagement.types";

const STATUS_PILL: Record<CheckInStatus, string> = {
  pending: "bg-surface-strong text-fg-soft",
  submitted: "bg-brand-orange/15 text-orange-800",
  confirmed: "bg-green-50 text-green-600",
  cancelled: "bg-surface-strong text-fg-subtle line-through",
};

function defaultPeriodLabel(): string {
  const now = new Date();
  return `T${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
}

/** Section « Points d'étape » de la page d'un département (responsable / bureau). */
export function DepartmentCheckIns({
  departmentId, members,
}: {
  departmentId: number;
  members: { id: number; name: string }[];
}) {
  const { t, fmt } = useI18n();
  const x = t.checkins;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [periodLabel, setPeriodLabel] = useState(defaultPeriodLabel);
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<number[]>([]); // vide = tous
  const [result, setResult] = useState<string | null>(null);

  // Le responsable figure parfois deux fois (lead + membre) : dédoublonnage.
  const uniqueMembers = members.filter((m, i) => members.findIndex((o) => o.id === m.id) === i);

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["checkins", departmentId],
    queryFn: () => engagementService.checkins.list(departmentId).then((r) => r.data),
  });

  const launch = useMutation({
    mutationFn: () => engagementService.checkins.launch({
      department: departmentId, members: selected, period_label: periodLabel, due_date: dueDate || null,
    }),
    onSuccess: ({ data }) => {
      setResult(x.launched(data.created, data.skipped));
      setOpen(false);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["checkins", departmentId] });
    },
  });

  const cancel = useMutation({
    mutationFn: (id: number) => engagementService.checkins.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checkins", departmentId] }),
  });

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((v) => v !== id) : [...s, id]));

  const visible = checkins.filter((c) => c.status !== "cancelled");

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted flex items-center gap-1.5">
          <ClipboardList size={13} /> {x.title} · {visible.length}
        </h2>
        {!open && (
          <button onClick={() => { setOpen(true); setResult(null); }} className="flex items-center gap-1.5 text-xs font-medium text-brand-blue hover:underline">
            <Plus size={14} /> {x.launch}
          </button>
        )}
      </div>

      {result && <p className="mb-2 text-xs text-green-600">{result}</p>}

      {open && (
        <div className="bg-surface rounded-2xl border border-brand-blue/20 p-5 mb-3 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-fg-soft">{x.launchIntro}</p>
            <button onClick={() => setOpen(false)} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft shrink-0"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="checkin-period" className="block text-xs text-fg-muted mb-1">{x.periodLabel}</label>
              <input id="checkin-period" value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label htmlFor="checkin-due" className="block text-xs text-fg-muted mb-1">{x.dueDate}</label>
              <input id="checkin-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>
          <fieldset>
            <legend className="text-xs text-fg-muted mb-2">{x.who}</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setSelected([])}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected.length === 0 ? "bg-brand-blue text-white border-brand-blue" : "border-line text-fg-soft hover:bg-surface-muted"}`}>
                {x.everyone}
              </button>
              {uniqueMembers.map((m) => (
                <button key={m.id} type="button" onClick={() => toggle(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${selected.includes(m.id) ? "bg-brand-blue/10 text-brand-deep border-brand-blue/40" : "border-line text-fg-soft hover:bg-surface-muted"}`}>
                  {m.name}
                </button>
              ))}
            </div>
          </fieldset>
          {launch.isError && <p className="text-xs text-red-500">{t.common.error}</p>}
          <div className="flex justify-end">
            <button onClick={() => launch.mutate()} disabled={!periodLabel.trim() || launch.isPending}
              className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-brand-deep disabled:opacity-50 transition-colors">
              {launch.isPending ? t.common.sending : x.launchSubmit}
            </button>
          </div>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
        {isLoading ? (
          <div className="p-5 h-16 animate-pulse" />
        ) : visible.length === 0 ? (
          <div className="py-8 text-center text-fg-subtle text-sm">{x.none}</div>
        ) : (
          <div className="divide-y divide-line-soft">
            {visible.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-fg text-sm truncate">{c.member_name}</p>
                  <p className="text-fg-subtle text-xs">
                    {c.period_label}
                    {c.due_date && ` · ${x.before} ${fmt.date(c.due_date)}`}
                    {c.status === "confirmed" && c.points !== null && ` · ${t.tasks.points(c.points)}`}
                  </p>
                </div>
                <span className={`text-xs font-medium rounded-full px-2.5 py-1 shrink-0 ${STATUS_PILL[c.status]}`}>{x.status[c.status]}</span>
                {c.status === "submitted" ? (
                  <Link href={`/checkins/${c.id}`} className="text-xs font-semibold text-white bg-brand-blue rounded-lg px-2.5 py-1.5 hover:bg-brand-deep shrink-0">{x.review}</Link>
                ) : (
                  <Link href={`/checkins/${c.id}`} className="text-xs font-medium text-brand-blue hover:underline shrink-0">{x.open}</Link>
                )}
                {c.status === "pending" && (
                  <button onClick={() => { if (confirm(x.confirmCancel)) cancel.mutate(c.id); }}
                    aria-label={x.cancel} title={x.cancel} className="p-1 text-fg-faint hover:text-red-500 shrink-0">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
