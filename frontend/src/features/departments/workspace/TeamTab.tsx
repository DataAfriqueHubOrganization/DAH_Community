"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Search, UserPlus, X } from "lucide-react";
import { departmentsService } from "@/services/departments.service";
import { engagementService } from "@/services/engagement.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { MemberSearchSelect } from "@/components/MemberSearchSelect";
import type { DepartmentDetail } from "@/types/departments.types";
import { ProjectManagersCard } from "./ProjectManagersCard";
import type { CheckInManager, CheckInStatus, RankingRow } from "@/types/engagement.types";
import type { ProjectTask } from "@/types/projects.types";
import { todayIso } from "@/features/engagement/period";
import {
  Avatar, CHECKIN_PILL, OPEN_STATUSES, Pagination, Pill, currentMonthStart, inputClass, paginate, type ViewerMode,
} from "./shared";

const PAGE_SIZE = 20;
type RoleFilter = "all" | "leads" | "members";
type SortKey = "points" | "name" | "since";

interface TeamRow {
  key: string;
  userId: number;
  name: string;
  email: string;
  membershipId: number | null;
  role: "lead" | "deputy" | "member";
  start: string | null;
  end: string | null;
}

export function TeamTab({
  department, viewerMode, currentUserId, tasks, checkins, ranking, canLaunchCheckins,
}: {
  department: DepartmentDetail;
  viewerMode: ViewerMode;
  currentUserId: number | undefined;
  tasks: ProjectTask[];
  checkins: CheckInManager[];
  ranking: RankingRow[];
  canLaunchCheckins: boolean;
}) {
  const { t, fmt, intl } = useI18n();
  const w = t.workspace;
  const d = t.deptDetail;
  const qc = useQueryClient();
  const manager = viewerMode === "manager";

  const [view, setView] = useState<"current" | "former">("current");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [ciFilter, setCiFilter] = useState<CheckInStatus | "all" | "none">("all");
  const [sort, setSort] = useState<SortKey>(manager ? "points" : "name");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const memberships = department.memberships ?? [];
  const roleOf = (userId: number): TeamRow["role"] =>
    userId === department.lead_id ? "lead" : userId === department.co_lead_id ? "deputy" : "member";

  const current: TeamRow[] = memberships.filter((m) => m.is_current).map((m) => ({
    key: `m${m.id}`, userId: m.user_id, name: m.user_full_name, email: m.user_email,
    membershipId: m.id, role: roleOf(m.user_id), start: m.start_date, end: m.end_date,
  }));
  // Le responsable / l'adjoint n'ont pas forcément d'adhésion datée.
  for (const [id, name] of [[department.lead_id, department.lead_name], [department.co_lead_id, department.co_lead_name]] as const) {
    if (id && !current.some((r) => r.userId === id)) {
      current.unshift({ key: `l${id}`, userId: id, name: name ?? "", email: "", membershipId: null, role: roleOf(id), start: null, end: null });
    }
  }
  const former: TeamRow[] = memberships.filter((m) => !m.is_current).map((m) => ({
    key: `m${m.id}`, userId: m.user_id, name: m.user_full_name, email: m.user_email,
    membershipId: m.id, role: "member", start: m.start_date, end: m.end_date,
  }));

  // Indicateurs par membre (responsable / bureau).
  const openTasks = new Map<number, number>();
  tasks.forEach((task) => {
    if (task.assigned_to && OPEN_STATUSES.includes(task.status)) {
      openTasks.set(task.assigned_to, (openTasks.get(task.assigned_to) ?? 0) + 1);
    }
  });
  const points = new Map(ranking.map((r) => [r.user_id, r.total]));
  const monthStart = currentMonthStart();
  const latestCheckin = new Map<number, CheckInManager>();
  checkins
    .filter((c) => c.status !== "cancelled" && c.period_start === monthStart)
    .forEach((c) => latestCheckin.set(c.member_id, c));

  const source = view === "current" ? current : former;
  const q = query.trim().toLowerCase();
  const filtered = source
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
    .filter((r) => role === "all" || (role === "leads" ? r.role !== "member" : r.role === "member"))
    .filter((r) => {
      if (!manager || view === "former" || ciFilter === "all") return true;
      const c = latestCheckin.get(r.userId);
      return ciFilter === "none" ? !c : c?.status === ciFilter;
    })
    .sort((a, b) => {
      if (sort === "points") return (points.get(b.userId) ?? 0) - (points.get(a.userId) ?? 0) || a.name.localeCompare(b.name, intl);
      if (sort === "since") return (a.start ?? "").localeCompare(b.start ?? "");
      return a.name.localeCompare(b.name, intl);
    });
  const rows = paginate(filtered, page, PAGE_SIZE);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["department", department.id] });
  const endMembership = useMutation({
    mutationFn: (id: number) => departmentsService.endMembership(department.id, id),
    onSuccess: invalidate,
  });
  const removeMembership = useMutation({
    mutationFn: (id: number) => departmentsService.removeMembership(department.id, id),
    onSuccess: invalidate,
  });
  const launchFor = useMutation({
    mutationFn: (row: TeamRow) => engagementService.checkins.launch({
      department: department.id, members: [row.userId], month: monthStart,
    }),
    onSuccess: (_, row) => {
      setNotice(w.launchedFor(row.name));
      qc.invalidateQueries({ queryKey: ["checkins", department.id] });
    },
  });

  const roleLabel = (r: TeamRow["role"]) => (r === "lead" ? d.lead : r === "deputy" ? d.deputy : t.labels.role.membre);
  const monthShortLabel = new Date().toLocaleDateString(intl, { month: "short" }).replace(".", "");
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="space-y-4">
      {manager && <ProjectManagersCard department={department} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-surface-strong rounded-xl p-1 gap-1" role="tablist" aria-label={d.team}>
          {(["current", "former"] as const).filter((v) => v === "current" || manager).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => reset(() => setView(v))}
              className={cn("px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                view === v ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}>
              {v === "current" ? w.current : w.former} · {v === "current" ? current.length : former.length}
            </button>
          ))}
        </div>
        {manager && (
          <button onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-brand-blue text-white text-sm font-semibold hover:bg-brand-deep">
            <UserPlus size={15} /> {d.addMember}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative w-full sm:w-72">
          <span className="sr-only">{w.search}</span>
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => reset(() => setQuery(e.target.value))}
            placeholder={w.search} className={cn(inputClass, "w-full pl-9")} />
        </label>
        <SelectFilter label={w.roleFilter} value={role} onChange={(v) => reset(() => setRole(v as RoleFilter))}
          options={[["all", w.roleAll], ["leads", w.roleLeads], ["members", w.roleMembers]]} />
        {manager && view === "current" && (
          <>
            <SelectFilter label={w.checkinFilter} value={ciFilter} onChange={(v) => reset(() => setCiFilter(v as typeof ciFilter))}
              options={[["all", w.roleAll], ["submitted", t.checkins.status.submitted], ["pending", t.checkins.status.pending],
                ["confirmed", t.checkins.status.confirmed], ["none", w.notLaunched]]} />
            <SelectFilter label={w.sort} value={sort} onChange={(v) => setSort(v as SortKey)}
              options={[["points", w.sortPoints], ["name", w.sortName], ["since", w.sortSince]]} />
          </>
        )}
      </div>
      {notice && <p className="text-xs text-green-600" role="status">{notice}</p>}

      <div className="bg-surface rounded-2xl border border-line-soft">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-fg-subtle">{source.length === 0 ? d.noMembers : w.noResult}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left">
                <tr className="text-[11px] uppercase tracking-wider text-fg-muted">
                  <th scope="col" className="px-4 py-2.5 font-bold rounded-tl-2xl">{w.colMember}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold">{w.colRole}</th>
                  <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{view === "current" ? w.colSince : w.colPeriod}</th>
                  {manager && view === "current" && (
                    <>
                      <th scope="col" className="px-4 py-2.5 font-bold text-right hidden lg:table-cell">{w.colOpenTasks}</th>
                      <th scope="col" className="px-4 py-2.5 font-bold text-right">{w.colPoints(monthShortLabel)}</th>
                      <th scope="col" className="px-4 py-2.5 font-bold hidden md:table-cell">{w.colCheckin}</th>
                    </>
                  )}
                  {manager && <th scope="col" className="px-4 py-2.5 w-12 rounded-tr-2xl"><span className="sr-only">{w.colAction}</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const ci = latestCheckin.get(r.userId);
                  return (
                    <tr key={r.key} className={cn("border-t border-line-soft", view === "former" && "text-fg-muted")}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={r.name} />
                          <div className="min-w-0">
                            <p className="font-medium text-fg truncate">{r.name}</p>
                            {r.email && <p className="text-xs text-fg-muted truncate">{r.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Pill className={r.role === "member" ? "bg-surface-strong text-fg-soft" : "bg-brand-orange/15 text-orange-800 dark:text-orange-300"}>
                          {roleLabel(r.role)}
                        </Pill>
                      </td>
                      <td className="px-4 py-2.5 text-fg-muted hidden md:table-cell whitespace-nowrap">
                        {view === "current"
                          ? r.start ? fmt.date(r.start) : "—"
                          : d.fromTo(r.start ? fmt.date(r.start) : "?", r.end ? fmt.date(r.end) : "?")}
                      </td>
                      {manager && view === "current" && (
                        <>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell">{openTasks.get(r.userId) ?? 0}</td>
                          <td className="px-4 py-2.5 text-right font-display font-bold text-brand-deep">{points.get(r.userId) ?? 0}</td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            {ci ? <Pill className={CHECKIN_PILL[ci.status]}>{t.checkins.status[ci.status]}</Pill> : <span className="text-fg-subtle">—</span>}
                          </td>
                        </>
                      )}
                      {manager && (
                        <td className="px-2 py-2.5 text-right">
                          {(r.membershipId !== null || (canLaunchCheckins && view === "current" && r.userId !== currentUserId)) && (
                            <RowMenu
                              label={w.actions(r.name)}
                              items={[
                                ...(view === "current" && canLaunchCheckins && r.userId !== currentUserId && !ci
                                  ? [{ label: w.launchFor, onClick: () => launchFor.mutate(r) }] : []),
                                ...(view === "current" && r.membershipId !== null
                                  ? [{ label: w.endMembership, tone: "orange" as const, onClick: () => endMembership.mutate(r.membershipId as number) }] : []),
                                ...(r.membershipId !== null
                                  ? [{ label: w.deleteMembership, tone: "red" as const, onClick: () => { if (confirm(d.confirmDeleteMembership)) removeMembership.mutate(r.membershipId as number); } }] : []),
                              ]}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </div>

      {showAdd && <AddMemberModal departmentId={department.id} onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function SelectFilter({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: [string, string][];
}) {
  return (
    <label className="inline-flex items-center gap-2 h-10 pl-3 pr-1 border border-line rounded-xl bg-surface text-sm">
      <span className="text-fg-muted whitespace-nowrap">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent font-semibold text-fg focus:outline-none pr-1">
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function RowMenu({
  label, items,
}: {
  label: string;
  items: { label: string; onClick: () => void; tone?: "orange" | "red" }[];
}) {
  // Position fixe : le tableau défile horizontalement et couperait un menu absolu.
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const open = pos !== null;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setPos(null); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setPos(null); };
    const dismiss = () => setPos(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (open) { setPos(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuHeight = items.length * 40 + 12;
    const top = rect.bottom + 4 + menuHeight > window.innerHeight ? rect.top - 4 - menuHeight : rect.bottom + 4;
    setPos({ top, right: window.innerWidth - rect.right });
  };

  if (items.length === 0) return null;
  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={open}
        className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-surface-muted">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" style={{ top: pos.top, right: pos.right }}
          className="fixed z-40 w-60 bg-surface border border-line rounded-xl shadow-xl p-1.5 text-left">
          {items.map((item) => (
            <button key={item.label} role="menuitem" onClick={() => { setPos(null); item.onClick(); }}
              className={cn("block w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-surface-muted",
                item.tone === "red" ? "text-red-600" : item.tone === "orange" ? "text-orange-700 dark:text-orange-300" : "text-fg")}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddMemberModal({ departmentId, onClose }: { departmentId: number; onClose: () => void }) {
  const { t } = useI18n();
  const d = t.deptDetail;
  const qc = useQueryClient();
  const [userId, setUserId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState("");

  const { data: candidates = [] } = useQuery({
    queryKey: ["department", departmentId, "searchable-members"],
    queryFn: () => departmentsService.searchableMembers(departmentId).then((r) => r.data),
    staleTime: 1000 * 60 * 2,
  });

  const add = useMutation({
    mutationFn: () => departmentsService.addMember(departmentId, {
      user_id: userId as number, start_date: startDate, end_date: endDate || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["department", departmentId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="add-member-title">
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="add-member-title" className="font-semibold text-fg flex items-center gap-2"><UserPlus size={18} /> {d.addMember}</h2>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
        </div>
        <MemberSearchSelect members={candidates} value={userId} onChange={setUserId} allowClear={false} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="add-start" className="block text-xs text-fg-muted mb-1">{d.sinceDate}</label>
            <input id="add-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={cn(inputClass, "w-full")} />
          </div>
          <div>
            <label htmlFor="add-end" className="block text-xs text-fg-muted mb-1">{d.untilDate}</label>
            <input id="add-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={cn(inputClass, "w-full")} />
          </div>
        </div>
        {add.isError && <p className="text-red-500 text-xs">{d.addMemberError}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-line rounded-xl hover:bg-surface-muted">{t.common.cancel}</button>
          <button onClick={() => add.mutate()} disabled={!userId || add.isPending}
            className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-semibold hover:bg-brand-deep disabled:opacity-50">
            {add.isPending ? d.adding : t.common.add}
          </button>
        </div>
      </div>
    </div>
  );
}
