"use client";

import { useQuery } from "@tanstack/react-query";
import { membersService } from "@/services/members.service";
import { departmentsService } from "@/services/departments.service";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Users, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { PublicMemberListItem } from "@/types/members.types";
import type { Messages } from "@/i18n/messages";

const POSTE_ORDER: Record<string, number> = {
  president: 1, vp1: 2, vp2: 3,
  secretaire_general: 4, secretaire_general_adj: 5,
  tresorier: 6, tresorier_adj: 7,
};
const ROLE_ORDER: Record<string, number> = { admin: 0, responsable: 20, membre: 21, candidat: 22, visiteur: 23 };

function sortRank(m: Pick<PublicMemberListItem, "role" | "poste">): number {
  return m.poste ? (POSTE_ORDER[m.poste] ?? 15) : (ROLE_ORDER[m.role] ?? 30);
}

export default function MembersPage() {
  const { t, label } = useI18n();
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["members", "public-list", departmentFilter],
    queryFn: () => membersService.publicList(departmentFilter ? { department: departmentFilter } : undefined).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments", "public"],
    queryFn: () => departmentsService.publicList().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

  const members: PublicMemberListItem[] = data?.results ?? [];

  const filtered = members
    .filter((m) => {
      const q = search.toLowerCase();
      return (
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
        m.skills.some((s) => s.toLowerCase().includes(q)) ||
        label.position(m).toLowerCase().includes(q)
      );
    })
    .sort((a, b) => sortRank(a) - sortRank(b));

  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <div className="bg-univers text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/25 rounded-full px-4 py-1.5 text-sm text-white mb-6">
            <Users size={14} />
            {t.members.badge}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            {t.members.title} <span className="text-brand-orange">DAH</span>
          </h1>
          <p className="text-white/85 text-lg max-w-xl mx-auto">
            {t.members.intro}
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Search & filtres */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              placeholder={t.members.searchPlaceholder}
              aria-label={t.members.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-line rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-surface"
            />
          </div>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label={t.members.allDepartments}
            className="text-sm border border-line rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-surface"
          >
            <option value="">{t.members.allDepartments}</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-surface rounded-2xl border border-line-soft p-6 h-48 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-fg-subtle">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>{search ? t.members.emptyFor(search) : t.members.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((member) => (
              <MemberCard key={member.slug} member={member} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: PublicMemberListItem }) {
  const { t, label } = useI18n();
  const fullName = `${member.first_name} ${member.last_name}`;
  const avatar = member.avatar ?? avatarUrl(fullName, 80);

  return (
    <Link
      href={`/members/${member.slug}`}
      className="group bg-surface rounded-2xl border border-line-soft p-6 hover:shadow-md hover:border-brand-blue/20 transition-all duration-200 flex flex-col"
    >
      {/* Top: avatar + name */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative shrink-0">
          <img
            src={avatar}
            alt={fullName}
            className="w-14 h-14 rounded-xl object-cover border-2 border-line-soft group-hover:border-brand-blue/30 transition-colors"
          />
          <div className={`absolute -bottom-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow leading-none ${
            roleBadgeColor(member)
          }`}>
            {roleShort(member, t)}
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-fg group-hover:text-brand-blue transition-colors leading-tight">{fullName}</p>
          <p className="text-xs text-fg-subtle mt-0.5">{label.position(member)}</p>
          {member.department && (
            <p className="text-xs text-brand-blue/70 mt-0.5">{member.department.name}</p>
          )}
          {member.current_job && (
            <p className="text-xs text-fg-muted mt-1 truncate">
              {member.current_job.title}
              <span className="text-brand-orange"> @ {member.current_job.company}</span>
            </p>
          )}
        </div>
      </div>

      {/* Skills */}
      {member.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {member.skills.slice(0, 4).map((skill) => (
            <span key={skill} className="px-2 py-0.5 bg-brand-blue/8 text-brand-blue text-[11px] font-medium rounded-full border border-brand-blue/15">
              {skill}
            </span>
          ))}
          {member.skills.length > 4 && (
            <span className="px-2 py-0.5 bg-surface-strong text-fg-subtle text-[11px] rounded-full">
              +{member.skills.length - 4}
            </span>
          )}
        </div>
      )}

      {/* View link */}
      <div className="mt-4 pt-4 border-t border-line-soft text-xs text-brand-blue opacity-0 group-hover:opacity-100 transition-opacity font-medium">
        {t.members.viewProfile} →
      </div>
    </Link>
  );
}

function roleBadgeColor(member: Pick<PublicMemberListItem, "role" | "poste">) {
  const posteMap: Record<string, string> = {
    president: "bg-brand-orange text-ink",
    vp1: "bg-brand-orange text-ink",
    vp2: "bg-brand-orange text-ink",
    secretaire_general: "bg-brand-blue text-white",
    secretaire_general_adj: "bg-blue-700 text-white",
    tresorier: "bg-brand-deep text-white",
    tresorier_adj: "bg-blue-700 text-white",
  };
  if (member.poste) return posteMap[member.poste] ?? "bg-gray-500 text-white";
  const roleMap: Record<string, string> = { responsable: "bg-brand-deep text-white", membre: "bg-brand-blue text-white", candidat: "bg-gray-500 text-white" };
  return roleMap[member.role] ?? "bg-gray-500 text-white";
}

function roleShort(member: Pick<PublicMemberListItem, "role" | "poste">, t: Messages) {
  const posteMap: Record<string, string> = t.labels.posteShort;
  if (member.poste) return posteMap[member.poste] ?? member.poste.toUpperCase().slice(0, 4);
  const roleMap: Record<string, string> = t.labels.roleShort;
  return roleMap[member.role] ?? member.role.toUpperCase().slice(0, 4);
}
