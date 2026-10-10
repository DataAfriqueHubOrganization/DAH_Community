"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, X } from "lucide-react";
import { departmentsService } from "@/services/departments.service";
import { useI18n } from "@/i18n/I18nProvider";
import { apiError } from "@/features/treasury/shared";
import type { DepartmentDetail } from "@/types/departments.types";

/** Gestionnaires de projets du département (choisis par le responsable) : ils
 *  créent les projets et affectent les tâches, sans les valider. */
export function ProjectManagersCard({ department }: { department: DepartmentDetail }) {
  const { t } = useI18n();
  const d = t.deptDetail;
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["department", department.id] });

  const managers = department.project_managers ?? [];
  // Candidats : membres actuels, hors responsables (qui gèrent déjà tout) et gestionnaires.
  const candidates = (department.memberships ?? [])
    .filter((m) => m.is_current && m.user_id !== department.lead_id && m.user_id !== department.co_lead_id
      && !managers.some((pm) => pm.id === m.user_id))
    .sort((a, b) => a.user_full_name.localeCompare(b.user_full_name));

  const add = useMutation({
    mutationFn: () => departmentsService.addProjectManager(department.id, Number(userId)),
    onSuccess: () => { setUserId(""); refresh(); },
  });
  const remove = useMutation({
    mutationFn: (id: number) => departmentsService.removeProjectManager(department.id, id),
    onSuccess: refresh,
  });
  const error = add.error ?? remove.error;

  return (
    <section aria-labelledby="pm-title" className="bg-surface rounded-2xl border border-line-soft p-5 space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
          <FolderKanban size={18} aria-hidden="true" />
        </span>
        <div>
          <h2 id="pm-title" className="font-display font-bold text-fg">{d.projectManagers}</h2>
          <p className="text-xs text-fg-muted mt-0.5">{d.projectManagersHint}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {managers.length === 0 && <p className="text-sm text-fg-subtle">{d.noProjectManager}</p>}
        {managers.map((pm) => (
          <span key={pm.id} className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-brand-blue/10 text-sm font-medium text-fg">
            {pm.full_name}
            <button type="button" onClick={() => remove.mutate(pm.id)} disabled={remove.isPending}
              aria-label={d.removeProjectManager(pm.full_name)} title={d.removeProjectManager(pm.full_name)}
              className="w-6 h-6 rounded-full flex items-center justify-center text-fg-soft hover:bg-brand-blue/15 hover:text-fg">
              <X size={13} />
            </button>
          </span>
        ))}
      </div>

      {candidates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="pm-add" className="sr-only">{d.pickMember}</label>
          <select id="pm-add" value={userId} onChange={(e) => setUserId(e.target.value)}
            className="h-10 px-3 rounded-xl border border-line bg-surface text-sm min-w-[220px]">
            <option value="">{d.pickMember}</option>
            {candidates.map((m) => <option key={m.user_id} value={m.user_id}>{m.user_full_name}</option>)}
          </select>
          <button type="button" onClick={() => add.mutate()} disabled={!userId || add.isPending}
            className="h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
            {d.addProjectManager}
          </button>
        </div>
      )}
      {error && <p role="status" className="text-xs text-red-600">{apiError(error, t.common.error)}</p>}
    </section>
  );
}
