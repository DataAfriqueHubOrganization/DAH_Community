"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, ShieldAlert, ShieldCheck, ShieldOff } from "lucide-react";
import { usersService, type AdminUser } from "@/services/users.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { SECTIONS, isAdmin, type Section } from "@/types/auth.types";
import { avatarUrl, cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { apiError } from "@/features/treasury/shared";

type Filter = "granted" | "all";

/** Gestion des accès (admin) : l'admin a tout ; il accorde à chaque membre les
 *  sections de gestion qu'il peut ouvrir. */
export default function AccessManagementPage() {
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { t, label } = useI18n();
  const x = t.access;
  const [filter, setFilter] = useState<Filter>("granted");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const canView = !!currentUser && isAdmin(currentUser.role);
  const { data, isLoading } = useQuery({
    queryKey: ["users", "all"],
    queryFn: () => usersService.list({ page_size: "100" }).then((r) => r.data),
    enabled: canView,
  });

  // Seuls les membres actifs peuvent recevoir des accès (jamais visiteurs ni candidats).
  const people = useMemo(() => {
    const all: AdminUser[] = Array.isArray(data) ? data : data?.results ?? [];
    return all
      .filter((u) => u.is_active && u.role !== "visiteur" && u.role !== "candidat")
      .sort((a, b) => Number(b.role === "admin") - Number(a.role === "admin") || a.full_name.localeCompare(b.full_name));
  }, [data]);

  const q = query.trim().toLowerCase();
  const shown = people.filter((u) =>
    (q ? `${u.full_name} ${u.email}`.toLowerCase().includes(q) : filter === "all" || u.role === "admin" || u.sections.length > 0));
  const selected = people.find((u) => u.id === selectedId) ?? null;

  if (!isLoadingUser && !canView) {
    return (
      <div className="text-center py-16 text-fg-subtle">
        <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
        <p>{x.restricted}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{t.sidebar.access}</h1>
        <p className="text-sm text-fg-muted mt-1 max-w-2xl">{x.subtitle}</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Membres */}
        <section aria-label={t.sidebar.members} className="w-full lg:w-[400px] shrink-0 bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="p-4 space-y-3 border-b border-line-soft">
            <label className="relative block">
              <span className="sr-only">{x.searchPlaceholder}</span>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={x.searchPlaceholder}
                className="w-full h-11 pl-10 pr-3 rounded-xl border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </label>
            {!q && (
              <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-surface-strong rounded-xl">
                {(["granted", "all"] as Filter[]).map((f) => (
                  <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                    className={cn("h-9 rounded-lg text-[13px] transition-all",
                      filter === f ? "bg-surface shadow-sm font-semibold text-fg" : "text-fg-soft hover:text-fg")}>
                    {x.filters[f]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="p-4 space-y-2.5" aria-busy="true">
              {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 rounded-xl bg-surface-strong animate-pulse" />)}
            </div>
          ) : shown.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-fg-muted">{x.noResult}</p>
          ) : (
            <ul className="max-h-[640px] overflow-y-auto divide-y divide-line-soft">
              {shown.map((u) => {
                const active = u.id === selectedId;
                const isAdminUser = u.role === "admin";
                return (
                  <li key={u.id}>
                    <button type="button" onClick={() => setSelectedId(u.id)} aria-current={active}
                      className={cn("w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                        active ? "bg-brand-blue/[0.07]" : "hover:bg-surface-muted")}>
                      <img src={avatarUrl(u.full_name, 36)} alt="" className="w-9 h-9 rounded-lg shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-fg truncate">
                          {u.full_name}{u.id === currentUser?.id && <span className="text-fg-subtle font-normal"> ({x.you})</span>}
                        </span>
                        <span className="block text-xs text-fg-muted truncate">{label.position(u)}</span>
                      </span>
                      <span className={cn("shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        isAdminUser ? "bg-brand-deep text-white"
                          : u.sections.length ? "bg-brand-blue/10 text-brand-deep" : "bg-surface-strong text-fg-muted")}>
                        {isAdminUser ? x.allAccess : u.sections.length ? x.sectionsCount(u.sections.length) : x.noAccess}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Accès du membre choisi */}
        <section aria-label={x.sectionsTitle} className="flex-1 min-w-0 w-full">
          {selected
            ? <AccessPanel key={selected.id} user={selected} admins={people.filter((u) => u.role === "admin").length} selfId={currentUser?.id} />
            : (
              <div className="bg-surface rounded-2xl border border-line px-6 py-16 text-center">
                <ShieldCheck size={32} className="mx-auto text-fg-faint" aria-hidden="true" />
                <p className="mt-3 text-sm text-fg-muted">{x.pickMember}</p>
              </div>
            )}
        </section>
      </div>
    </div>
  );
}

function AccessPanel({ user, admins, selfId }: { user: AdminUser; admins: number; selfId?: number }) {
  const { t, label } = useI18n();
  const x = t.access;
  const qc = useQueryClient();
  const [sections, setSections] = useState<Section[]>(user.sections);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setNotice(null), [sections]);

  const isAdminUser = user.role === "admin";
  const changed = [...sections].sort().join() !== [...user.sections].sort().join();
  const toggle = (s: Section) =>
    setSections((cur) => (cur.includes(s) ? cur.filter((v) => v !== s) : SECTIONS.filter((v) => v === s || cur.includes(v))));

  const save = useMutation({
    mutationFn: () => usersService.update(user.id, { sections }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users", "all"] }); setNotice(x.saved(user.full_name)); },
  });
  const setRole = useMutation({
    mutationFn: (role: "admin" | "membre") => usersService.update(user.id, { role }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users", "all"] }),
  });
  const error = save.error ?? setRole.error;

  return (
    <div className="bg-surface rounded-2xl border border-line">
      <header className="flex flex-wrap items-center gap-4 p-6 border-b border-line-soft">
        <img src={avatarUrl(user.full_name, 48)} alt="" className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-bold text-lg text-fg truncate">{user.full_name}</h2>
          <p className="text-sm text-fg-muted truncate">{label.position(user)} · {user.email}</p>
        </div>
        {isAdminUser && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-deep text-white text-xs font-semibold"><ShieldCheck size={14} aria-hidden="true" />{x.admin}</span>}
      </header>

      {isAdminUser ? (
        <div className="p-6 space-y-4">
          <p className="text-sm text-fg-soft">{x.adminFull}</p>
          <button type="button"
            onClick={() => { if (confirm(x.confirmRevoke(user.full_name))) setRole.mutate("membre"); }}
            disabled={user.id === selfId || admins <= 1 || setRole.isPending}
            title={user.id === selfId ? x.cannotRevokeSelf : admins <= 1 ? x.cannotRevokeLast : undefined}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-line-strong text-sm font-medium text-fg-soft hover:text-red-600 hover:border-red-300 disabled:opacity-50 disabled:hover:text-fg-soft disabled:hover:border-line-strong">
            <ShieldOff size={15} aria-hidden="true" /> {x.revoke}
          </button>
          {user.id === selfId && <p className="text-xs text-fg-muted">{x.cannotRevokeSelf}</p>}
        </div>
      ) : (
        <>
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display font-bold text-[15px] text-fg">{x.sectionsTitle}</h3>
              <span className="flex gap-3 text-[13px]">
                <button type="button" onClick={() => setSections([...SECTIONS])} className="font-medium text-brand-blue hover:text-brand-deep">{x.selectAll}</button>
                <button type="button" onClick={() => setSections([])} className="font-medium text-fg-soft hover:text-fg">{x.clearAll}</button>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SECTIONS.map((s) => {
                const on = sections.includes(s);
                return (
                  <label key={s} className={cn("flex items-start gap-3 rounded-xl px-4 py-3 cursor-pointer transition-colors",
                    on ? "border-2 border-brand-blue bg-brand-blue/[0.06]" : "border border-line-strong hover:bg-surface-muted")}>
                    <input type="checkbox" checked={on} onChange={() => toggle(s)} className="sr-only peer" />
                    <span aria-hidden="true" className={cn("mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-blue/40",
                      on ? "bg-brand-blue text-white" : "border border-line-strong bg-surface")}>
                      {on && <Check size={14} strokeWidth={3} />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-fg">{x.sections[s].label}</span>
                      <span className="block text-xs text-fg-muted leading-snug">{x.sections[s].hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-fg-muted">{x.sectionsHint}</p>
            {user.role === "responsable" && <p className="text-xs text-fg-muted">{x.leadNote}</p>}
          </div>

          {(notice || error) && (
            <p role="status" className={cn("px-6 pb-3 text-sm", error ? "text-red-600" : "text-green-600")}>
              {error ? apiError(error, t.common.error) : notice}
            </p>
          )}

          <footer className="flex flex-wrap items-center gap-3 px-6 py-4 border-t border-line bg-surface-muted/60 rounded-b-2xl">
            <button type="button"
              onClick={() => { if (confirm(x.confirmGrant(user.full_name))) setRole.mutate("admin"); }}
              disabled={setRole.isPending}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line-strong bg-surface text-sm font-medium text-fg-soft hover:bg-surface-muted disabled:opacity-50">
              <ShieldCheck size={15} aria-hidden="true" /> {x.makeAdmin}
            </button>
            <span className="flex-1" />
            <button type="button" onClick={() => save.mutate()} disabled={!changed || save.isPending}
              className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50 disabled:shadow-none">
              {save.isPending ? t.common.saving : x.save}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
