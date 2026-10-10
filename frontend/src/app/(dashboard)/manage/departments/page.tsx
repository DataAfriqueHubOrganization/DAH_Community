"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Building2, ChevronRight, Edit2, Plus, Search, Trash2, X } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { departmentsService } from "@/services/departments.service";
import { membersService } from "@/services/members.service";
import { hasSection } from "@/types/auth.types";
import { MemberSearchSelect } from "@/components/MemberSearchSelect";
import type { Department, DepartmentWritePayload } from "@/types/departments.types";
import type { MemberListItem } from "@/types/members.types";
import { useI18n } from "@/i18n/I18nProvider";
import { apiError } from "@/features/treasury/shared";
import { avatarUrl, cn } from "@/lib/utils";

const emptyForm: DepartmentWritePayload = { name: "", description: "", lead: null, co_lead: null };

/** Départements : une ligne par département (responsable, taille, ce qui demande
 *  une action) ; création et modification dans un panneau latéral. */
export default function DepartmentsManagePage() {
  const { data: user } = useCurrentUser();
  const { t } = useI18n();
  const x = t.departments;
  const canManage = hasSection(user, "departments");
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState<Department | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["departments", "manage"],
    queryFn: () => departmentsService.list().then((r) => r.data),
  });
  const departments: Department[] = Array.isArray(data) ? data : data?.results ?? [];
  const q = query.trim().toLowerCase();
  const shown = departments.filter((d) => !q || `${d.name} ${d.lead_name ?? ""}`.toLowerCase().includes(q));
  const totalMembers = departments.reduce((sum, d) => sum + d.member_count, 0);
  const toValidate = departments.reduce((sum, d) => sum + (d.activity?.to_validate ?? 0), 0);

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{t.sidebar.departments}</h1>
          <p className="text-sm text-fg-soft mt-1">
            {x.count(departments.length)} · {totalMembers} {x.membersShort}
            {toValidate > 0 && <> · <b className="text-fg">{x.attention(toValidate)}</b></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {departments.length > 3 && (
            <label className="relative w-full sm:w-60">
              <span className="sr-only">{x.search}</span>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={x.search}
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-line bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </label>
          )}
          {canManage && (
            <button onClick={() => setPanel("new")}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep">
              <Plus size={16} aria-hidden="true" /> {x.newDepartment}
            </button>
          )}
        </div>
      </header>

      {isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface border border-line-soft animate-pulse" />)}
        </div>
      ) : departments.length === 0 ? (
        <div className="text-center py-16 bg-surface rounded-2xl border border-line-soft">
          <Building2 size={40} className="mx-auto text-fg-faint mb-3" aria-hidden="true" />
          <p className="text-fg-muted">{canManage ? x.none : t.myDepartment.none}</p>
        </div>
      ) : shown.length === 0 ? (
        <p className="text-center py-12 text-sm text-fg-muted">{x.noResult}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((dept) => <DepartmentRow key={dept.id} dept={dept} canManage={canManage} onEdit={() => setPanel(dept)} />)}
        </ul>
      )}

      {panel && <DepartmentPanel department={panel === "new" ? null : panel} onClose={() => setPanel(null)} />}
    </div>
  );
}

function DepartmentRow({ dept, canManage, onEdit }: { dept: Department; canManage: boolean; onEdit: () => void }) {
  const { t } = useI18n();
  const x = t.departments;
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: () => departmentsService.delete(dept.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });
  const a = dept.activity;
  const calm = !a?.to_validate && !a?.late;

  return (
    <li className="relative bg-surface rounded-2xl border border-line-soft hover:border-brand-blue/40 hover:shadow-sm transition">
      <Link href={`/manage/departments/${dept.id}`}
        className="grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.3fr)_24px] items-center gap-4 md:gap-5 p-5 pr-5 md:pr-24 rounded-2xl">
        <span className="min-w-0">
          <span className="block font-display font-bold text-[17px] text-fg truncate">{dept.name}</span>
          {dept.description && <span className="block text-[13px] text-fg-muted truncate mt-0.5">{dept.description}</span>}
        </span>
        <span className="flex items-center gap-2.5 min-w-0">
          {dept.lead_name ? (
            <>
              <img src={avatarUrl(dept.lead_name, 68)} alt="" className="w-[34px] h-[34px] rounded-lg shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg truncate">{dept.lead_name}</span>
                <span className="block text-xs text-fg-muted">{x.leadRole}</span>
              </span>
            </>
          ) : <span className="text-sm text-fg-subtle">{x.noLead}</span>}
        </span>
        <span className="flex gap-5 text-[13px] text-fg-soft">
          <span><b className="block font-display text-lg text-fg">{dept.member_count}</b>{x.membersShort}</span>
          {a && <span><b className="block font-display text-lg text-fg">{a.active_projects}</b>{x.projectsShort}</span>}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {a && a.to_validate > 0 && <span className="px-2.5 py-1 rounded-full bg-brand-orange/15 text-xs font-semibold text-fg">{x.toValidate(a.to_validate)}</span>}
          {a && a.late > 0 && <span className="px-2.5 py-1 rounded-full bg-surface-strong text-xs font-semibold text-fg-soft">{x.late(a.late)}</span>}
          {a && calm && <span className="px-2.5 py-1 rounded-full bg-brand-blue/10 text-xs font-semibold text-brand-deep">{x.upToDate}</span>}
        </span>
        <ChevronRight size={20} className="hidden md:block text-fg-subtle" aria-hidden="true" />
      </Link>
      {canManage && (
        <span className="absolute top-4 right-4 md:top-1/2 md:-translate-y-1/2 md:right-12 flex gap-1">
          <button onClick={onEdit} aria-label={`${t.common.edit} ${dept.name}`} title={t.common.edit}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-brand-blue hover:bg-surface-muted">
            <Edit2 size={15} />
          </button>
          <button onClick={() => { if (confirm(x.confirmDelete(dept.name))) remove.mutate(); }}
            aria-label={`${t.common.delete} ${dept.name}`} title={t.common.delete}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
            <Trash2 size={15} />
          </button>
        </span>
      )}
    </li>
  );
}

/** Création / modification d'un département, dans un panneau latéral. */
function DepartmentPanel({ department, onClose }: { department: Department | null; onClose: () => void }) {
  const { t } = useI18n();
  const x = t.departments;
  const qc = useQueryClient();
  const [form, setForm] = useState<DepartmentWritePayload>(department
    ? { name: department.name, description: department.description, lead: department.lead_id, co_lead: department.co_lead_id }
    : emptyForm);
  const { data: membersData } = useQuery({
    queryKey: ["members", "list"],
    queryFn: () => membersService.list().then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });
  const members: MemberListItem[] = membersData?.results ?? membersData ?? [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = useMutation({
    mutationFn: () => department ? departmentsService.update(department.id, form) : departmentsService.create(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/45" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" aria-labelledby="dept-panel-title" onMouseDown={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 w-full max-w-lg bg-surface shadow-2xl flex flex-col">
        <header className="flex items-center justify-between px-6 py-5 border-b border-line-soft">
          <h2 id="dept-panel-title" className="font-display font-extrabold text-xl text-fg">
            {department ? t.manageEvents.editTitle(department.name) : x.newDepartment}
          </h2>
          <button onClick={onClose} aria-label={t.common.close} className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-surface-muted"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label htmlFor="dept-name" className="block text-sm font-semibold text-fg mb-1.5">{t.common.name}</label>
            <input id="dept-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full h-11 px-3.5 rounded-xl border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <label htmlFor="dept-desc" className="block text-sm font-semibold text-fg mb-1.5">{t.myProfile.description} <span className="font-normal text-fg-muted">({t.common.optional})</span></label>
            <textarea id="dept-desc" value={form.description} rows={3} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-line-strong bg-surface text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg mb-1.5">{x.lead}</p>
            <MemberSearchSelect members={members} value={form.lead ?? null} onChange={(id) => setForm((f) => ({ ...f, lead: id }))} />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg mb-1.5">{x.coLead}</p>
            <MemberSearchSelect members={members} value={form.co_lead ?? null} onChange={(id) => setForm((f) => ({ ...f, co_lead: id }))} />
          </div>
          <p className="text-xs text-fg-muted">{x.leadHint}</p>
          {save.isError && <p role="status" className="text-sm text-red-600">{apiError(save.error, t.common.error)}</p>}
        </div>
        <footer className="flex justify-end gap-2 px-6 py-4 border-t border-line">
          <button onClick={onClose} className="h-11 px-4 rounded-xl border border-line-strong text-sm font-medium text-fg hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => save.mutate()} disabled={!form.name.trim() || save.isPending}
            className={cn("h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-deep disabled:opacity-50")}>
            {save.isPending ? t.common.saving : department ? t.manageEvents.saveChanges : x.createSubmit}
          </button>
        </footer>
      </aside>
    </div>
  );
}
