"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useAuth";
import { departmentsService } from "@/services/departments.service";
import { membersService } from "@/services/members.service";
import { isBureau } from "@/types/auth.types";
import { Building2, Plus, Users, Edit2, Trash2, X, Crown, ShieldHalf } from "lucide-react";
import { MemberSearchSelect } from "@/components/MemberSearchSelect";
import type { Department, DepartmentWritePayload } from "@/types/departments.types";
import type { MemberListItem } from "@/types/members.types";
import { useI18n } from "@/i18n/I18nProvider";

const emptyForm: DepartmentWritePayload = { name: "", description: "", lead: null, co_lead: null };

export default function DepartmentsManagePage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { t } = useI18n();
  const x = t.departments;
  const [showForm, setShowForm] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DepartmentWritePayload>(emptyForm);

  const canManage = isBureau(user);

  const { data, isLoading } = useQuery({
    queryKey: ["departments", "manage"],
    queryFn: () => departmentsService.list().then((r) => r.data),
  });

  const { data: membersData } = useQuery({
    queryKey: ["members", "list"],
    queryFn: () => membersService.list().then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });

  const createDept = useMutation({
    mutationFn: (data: DepartmentWritePayload) => departmentsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); closeForm(); },
  });

  const updateDept = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DepartmentWritePayload> }) =>
      departmentsService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["departments"] }); closeForm(); },
  });

  const deleteDept = useMutation({
    mutationFn: (id: number) => departmentsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });

  function closeForm() {
    setShowForm(false);
    setEditingDept(null);
    setForm(emptyForm);
  }

  function openCreateForm() {
    setEditingDept(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEditForm(dept: Department) {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      description: dept.description,
      lead: dept.lead_id,
      co_lead: dept.co_lead_id,
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (editingDept) {
      updateDept.mutate({ id: editingDept.id, data: form });
    } else {
      createDept.mutate(form);
    }
  }

  const members: MemberListItem[] = membersData?.results ?? membersData ?? [];
  const departments: Department[] = Array.isArray(data) ? data : data?.results ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t.sidebar.departments}</h1>
          <p className="text-fg-muted text-sm mt-1">{x.count(departments.length)}</p>
        </div>
        {canManage && (
          <button onClick={openCreateForm} className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">
            <Plus size={16} /> {x.create}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-surface rounded-2xl border border-brand-blue/20 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">
              {editingDept ? t.manageEvents.editTitle(editingDept.name) : x.newDepartment}
            </h2>
            <button onClick={closeForm} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              placeholder={`${t.common.name} *`}
              aria-label={t.common.name}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
            <textarea
              placeholder={t.myProfile.description}
              aria-label={t.myProfile.description}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none"
            />
            <div>
              <label className="block text-xs text-fg-muted mb-1">{x.lead}</label>
              <MemberSearchSelect
                members={members}
                value={form.lead ?? null}
                onChange={(userId) => setForm(f => ({ ...f, lead: userId }))}
              />
            </div>
            <div>
              <label className="block text-xs text-fg-muted mb-1">{x.coLead}</label>
              <MemberSearchSelect
                members={members}
                value={form.co_lead ?? null}
                onChange={(userId) => setForm(f => ({ ...f, co_lead: userId }))}
              />
            </div>
            <p className="sm:col-span-2 text-xs text-fg-subtle">
              {x.leadHint}
            </p>
            <div className="sm:col-span-2 flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={createDept.isPending || updateDept.isPending || !form.name}
                className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createDept.isPending || updateDept.isPending
                  ? t.common.saving
                  : editingDept ? t.manageEvents.saveChanges : x.createSubmit}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-line-soft p-5 h-32 animate-pulse" />)}
        </div>
      ) : departments.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={48} className="mx-auto text-fg-faint mb-4" />
          <p className="text-fg-muted font-medium">{x.none}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {departments.map(dept => (
            <div key={dept.id} className="bg-surface rounded-2xl border border-line-soft p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
                    <Building2 size={16} className="text-fg" />
                  </div>
                  <p className="font-semibold text-fg text-sm truncate">{dept.name}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditForm(dept)} title={t.common.edit} aria-label={t.common.edit} className="p-1.5 text-fg-faint hover:text-brand-blue rounded-lg hover:bg-brand-blue/5 transition-colors"><Edit2 size={14} /></button>
                    <button
                      onClick={() => { if (confirm(x.confirmDelete(dept.name))) deleteDept.mutate(dept.id); }}
                      title={t.common.delete}
                      aria-label={t.common.delete}
                      className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              {dept.description && <p className="text-fg-muted text-xs line-clamp-2">{dept.description}</p>}

              <div className="space-y-1.5 text-xs text-fg-muted">
                <div className="flex items-center gap-1.5">
                  <Crown size={12} className="text-brand-orange shrink-0" />
                  {dept.lead_name ?? <span className="text-fg-subtle">{x.noLead}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldHalf size={12} className="text-brand-blue shrink-0" />
                  {dept.co_lead_name ?? <span className="text-fg-subtle">{x.noCoLead}</span>}
                </div>
              </div>

              <Link
                href={`/manage/departments/${dept.id}`}
                className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-brand-blue border border-brand-blue/20 rounded-xl hover:bg-brand-blue hover:text-white transition-colors font-medium"
              >
                <Users size={13} /> {x.members(dept.member_count)} — {dept.can_manage ? x.manage : x.view}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
