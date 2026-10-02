"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { membersService } from "@/services/members.service";
import { usersService } from "@/services/users.service";
import { departmentsService } from "@/services/departments.service";
import { avatarUrl, cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Search, Users, ExternalLink, Pencil, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useCurrentUser } from "@/hooks/useAuth";
import { isAdmin, POSTES, type Poste } from "@/types/auth.types";
import Link from "next/link";
import type { MemberListItem } from "@/types/members.types";
import type { Department } from "@/types/departments.types";

const ROLE_VARIANTS: Record<string, "blue" | "orange" | "green" | "gray"> = {
  admin: "orange",
  responsable: "blue",
  membre: "green",
  candidat: "gray",
  visiteur: "gray",
};

const ALL_ROLES = ["admin", "responsable", "membre", "candidat", "visiteur"];

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [editingMember, setEditingMember] = useState<MemberListItem | null>(null);
  const qc = useQueryClient();
  const { t, label } = useI18n();
  const x = t.manageMembers;

  const { data: currentUser } = useCurrentUser();
  const canManageUsers = !!currentUser && isAdmin(currentUser.role);

  const { data, isLoading } = useQuery({
    queryKey: ["members", "list", departmentFilter],
    queryFn: () => membersService.list(departmentFilter ? { department: departmentFilter } : undefined).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ["departments", "list"],
    queryFn: () => departmentsService.list().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const departments: Department[] = Array.isArray(departmentsData) ? departmentsData : departmentsData?.results ?? [];

  const deleteMutation = useMutation({
    mutationFn: (userId: number) => usersService.delete(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", "list"] }),
  });

  const all: MemberListItem[] = data?.results ?? data ?? [];

  const filtered = all.filter(m =>
    (!search || `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())) &&
    (!roleFilter || m.role === roleFilter)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t.sidebar.members}</h1>
        <p className="text-fg-muted text-sm mt-1">{x.count(all.length)}</p>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input
            type="text"
            placeholder={x.searchPlaceholder}
            aria-label={x.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} aria-label={x.allRoles} className="text-sm border border-line rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface">
          <option value="">{x.allRoles}</option>
          {ALL_ROLES.map(r => <option key={r} value={r}>{label.role(r)}</option>)}
        </select>
        <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} aria-label={t.members.allDepartments} className="text-sm border border-line rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface">
          <option value="">{t.members.allDepartments}</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-line-soft p-5 h-32 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users size={48} className="mx-auto text-fg-faint mb-4" />
          <p className="text-fg-muted font-medium">{t.members.empty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(member => {
            const isSelf = currentUser?.id === member.user_id;
            return (
              <div
                key={member.id}
                className={cn(
                  "bg-surface rounded-2xl border border-line-soft p-5 hover:shadow-md transition-shadow relative",
                  !member.is_active && "opacity-60"
                )}
              >
                {canManageUsers && !isSelf && (
                  <div className="absolute top-3 right-3 flex gap-1">
                    <button
                      onClick={() => setEditingMember(member)}
                      title={t.common.edit}
                      aria-label={t.common.edit}
                      className="p-1.5 text-fg-faint hover:text-brand-blue rounded-lg hover:bg-brand-blue/5 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(x.confirmDelete(`${member.first_name} ${member.last_name}`))) {
                          deleteMutation.mutate(member.user_id);
                        }
                      }}
                      title={t.common.delete}
                      aria-label={t.common.delete}
                      className="p-1.5 text-fg-faint hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}

                <div className="flex items-start gap-3 mb-4">
                  <img
                    src={member.avatar ?? avatarUrl(`${member.first_name} ${member.last_name}`, 60)}
                    alt={`${member.first_name} ${member.last_name}`}
                    className="w-12 h-12 rounded-xl object-cover border border-line-soft"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-fg text-sm truncate">
                      {member.first_name} {member.last_name}
                    </p>
                    {member.member_number && (
                      <p className="text-brand-orange text-xs font-medium">{member.member_number}</p>
                    )}
                    {canManageUsers && (
                      <p className="text-fg-subtle text-xs truncate">{member.email}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <Badge variant={ROLE_VARIANTS[member.role] ?? "gray"}>
                        {label.position(member)}
                      </Badge>
                      {member.department && (
                        <Badge variant="gray">{member.department.name}</Badge>
                      )}
                      {!member.is_active && <Badge variant="red">{x.disabled}</Badge>}
                    </div>
                  </div>
                </div>

                {member.skills && member.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {member.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="bg-surface-strong text-fg-soft text-xs px-2 py-0.5 rounded-full">{skill}</span>
                    ))}
                    {member.skills.length > 3 && <span className="text-fg-subtle text-xs">+{member.skills.length - 3}</span>}
                  </div>
                )}

                <Link
                  href={`/members/${member.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 w-full py-2 text-xs text-brand-blue border border-brand-blue/20 rounded-xl hover:bg-brand-blue hover:text-white transition-colors font-medium"
                >
                  {t.members.viewProfile} <ExternalLink size={12} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {editingMember && (
        <EditMemberModal
          member={editingMember}
          departments={departments}
          onClose={() => setEditingMember(null)}
          onSaved={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}

function EditMemberModal({
  member,
  departments,
  onClose,
  onSaved,
}: {
  member: MemberListItem;
  departments: Department[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const { t, label } = useI18n();
  const x = t.manageMembers;
  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [role, setRole] = useState(member.role);
  const [poste, setPoste] = useState<Poste | "">(member.poste as Poste | "" ?? "");
  const [departmentId, setDepartmentId] = useState<string>(member.department ? String(member.department.id) : "");
  const [isActive, setIsActive] = useState(member.is_active);

  const updateMutation = useMutation({
    mutationFn: () =>
      usersService.update(member.user_id, {
        first_name: firstName,
        last_name: lastName,
        role,
        poste: poste || null,
        department_id: departmentId ? Number(departmentId) : null,
        is_active: isActive,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", "list"] });
      onSaved();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-fg">{x.editTitle(`${member.first_name} ${member.last_name}`)}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-first-name" className="text-xs text-fg-muted mb-1 block">{t.eventForm.firstName}</label>
              <input
                id="edit-first-name"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
            <div>
              <label htmlFor="edit-last-name" className="text-xs text-fg-muted mb-1 block">{t.eventForm.lastName}</label>
              <input
                id="edit-last-name"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
              />
            </div>
          </div>

          <div>
            <label htmlFor="edit-role" className="text-xs text-fg-muted mb-1 block">{x.role}</label>
            <select
              id="edit-role"
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface"
            >
              {ALL_ROLES.map(r => <option key={r} value={r}>{label.role(r)}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="edit-poste" className="text-xs text-fg-muted mb-1 block">{x.poste}</label>
            <select
              id="edit-poste"
              value={poste}
              onChange={e => setPoste(e.target.value as Poste | "")}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface"
            >
              <option value="">-- ({x.noPoste})</option>
              {POSTES.map(p => <option key={p} value={p}>{label.poste(p)}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="edit-department" className="text-xs text-fg-muted mb-1 block">{x.department}</label>
            <select
              id="edit-department"
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface"
            >
              <option value="">{t.common.none}</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-fg">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
            {x.activeAccount}
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface-muted">
            {t.common.cancel}
          </button>
          <button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="px-4 py-2 text-sm bg-brand-blue text-white rounded-xl font-medium hover:bg-brand-blue/90 disabled:opacity-50"
          >
            {t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}
