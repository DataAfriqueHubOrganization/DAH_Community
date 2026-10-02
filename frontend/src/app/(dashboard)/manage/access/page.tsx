"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersService, type AdminUser } from "@/services/users.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { isAdmin } from "@/types/auth.types";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { ShieldCheck, ShieldOff, ShieldAlert, Search, X } from "lucide-react";

export default function AccessManagementPage() {
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const qc = useQueryClient();
  const { t } = useI18n();
  const x = t.access;
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const canView = !!currentUser && isAdmin(currentUser.role);

  const { data, isLoading } = useQuery({
    queryKey: ["users", "all"],
    queryFn: () => usersService.list().then((r) => r.data),
    enabled: canView,
  });

  const allUsers: AdminUser[] = Array.isArray(data) ? data : data?.results ?? [];
  const admins = allUsers.filter((u) => u.role === "admin").sort((a, b) => a.full_name.localeCompare(b.full_name));
  const candidates = allUsers.filter((u) => u.role !== "admin");

  const grantAccess = useMutation({
    mutationFn: (userId: number) => usersService.update(userId, { role: "admin" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", "all"] });
      setSelectedUser(null);
    },
  });

  const revokeAccess = useMutation({
    mutationFn: (userId: number) => usersService.update(userId, { role: "membre" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users", "all"] }),
  });

  function handleGrant() {
    if (!selectedUser) return;
    if (confirm(x.confirmGrant(selectedUser.full_name))) {
      grantAccess.mutate(selectedUser.id);
    }
  }

  function handleRevoke(user: AdminUser) {
    if (confirm(x.confirmRevoke(user.full_name))) {
      revokeAccess.mutate(user.id);
    }
  }

  if (!isLoadingUser && !canView) {
    return (
      <div className="text-center py-20 text-fg-subtle">
        <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
        <p>{x.restricted}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t.sidebar.access}</h1>
        <p className="text-fg-muted text-sm mt-1">{x.subtitle}</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 flex items-start gap-2.5">
        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
        <p>{x.warning}</p>
      </div>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">{x.currentAdmins} · {admins.length}</h2>
        <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
          {isLoading ? (
            <div className="p-5 space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-surface-strong rounded-xl animate-pulse" />)}</div>
          ) : admins.length === 0 ? (
            <div className="py-8 text-center text-fg-subtle text-sm">{x.noAdmin}</div>
          ) : (
            <div className="divide-y divide-line-soft">
              {admins.map((u) => {
                const isSelf = u.id === currentUser?.id;
                const isLastAdmin = admins.length === 1;
                return (
                  <div key={u.id} className="flex items-center gap-3 px-5 py-3.5">
                    <img src={avatarUrl(u.full_name, 36)} alt={u.full_name} className="w-9 h-9 rounded-full shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-fg text-sm truncate">
                        {u.full_name}{isSelf && <span className="text-fg-subtle font-normal"> ({x.you})</span>}
                      </p>
                      <p className="text-fg-subtle text-xs truncate">{u.email}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(u)}
                      disabled={isSelf || isLastAdmin || revokeAccess.isPending}
                      title={isSelf ? x.cannotRevokeSelf : isLastAdmin ? x.cannotRevokeLast : x.revokeTitle}
                      className="flex items-center gap-1.5 text-xs font-medium text-fg-subtle hover:text-red-500 disabled:opacity-40 disabled:hover:text-fg-subtle disabled:cursor-not-allowed transition-colors shrink-0"
                    >
                      <ShieldOff size={14} /> {x.revoke}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted mb-2">{x.grantTitle}</h2>
        <div className="bg-surface rounded-2xl border border-line-soft p-5 space-y-3">
          <UserSearchSelect users={candidates} value={selectedUser} onChange={setSelectedUser} />
          <div className="flex justify-end">
            <button
              onClick={handleGrant}
              disabled={!selectedUser || grantAccess.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <ShieldCheck size={15} /> {grantAccess.isPending ? x.granting : x.grantTitle}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function UserSearchSelect({
  users, value, onChange,
}: {
  users: AdminUser[];
  value: AdminUser | null;
  onChange: (user: AdminUser | null) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = users.filter((u) =>
    `${u.full_name} ${u.email}`.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  if (value) {
    return (
      <div className="flex items-center gap-2 border border-line rounded-xl px-3 py-2">
        <img src={avatarUrl(value.full_name, 28)} alt={value.full_name} className="w-7 h-7 rounded-full shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg truncate">{value.full_name}</p>
          <p className="text-xs text-fg-subtle truncate">{value.email}</p>
        </div>
        <button onClick={() => onChange(null)} aria-label={t.memberSearch.change} className="text-fg-subtle hover:text-fg-soft shrink-0"><X size={16} /></button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle" />
      <input
        type="text"
        placeholder={t.access.searchPlaceholder}
        aria-label={t.access.searchPlaceholder}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        className="w-full pl-9 pr-3 py-2 text-sm border border-line rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      {open && query && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-line rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-fg-subtle">{t.access.noResult}</p>
          ) : (
            filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => { onChange(u); setQuery(""); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted transition-colors"
              >
                <img src={avatarUrl(u.full_name, 24)} alt={u.full_name} className="w-6 h-6 rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-fg truncate">{u.full_name}</p>
                  <p className="text-xs text-fg-subtle truncate">{u.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
