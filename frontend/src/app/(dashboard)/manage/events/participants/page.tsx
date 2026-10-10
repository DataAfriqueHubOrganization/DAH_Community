"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Download, Search, ShieldAlert, Users, X } from "lucide-react";
import { eventsService } from "@/services/events.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { hasSection } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { countryLabel } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { todayIso } from "@/features/engagement/period";
import { Avatar, Pagination, paginate } from "@/features/departments/workspace/shared";
import { Segmented } from "@/features/treasury/shared";
import type { Event, ParticipantWithEvent, ParticipantsFilter } from "@/types/events.types";

type Mode = "period" | "events";
type View = "person" | "registration";
type Preset = "month" | "quarter" | "year" | "lastYear" | "all";
const PAGE_SIZE = 30;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  switch (preset) {
    case "month": return { from: iso(new Date(y, now.getMonth(), 1)), to: iso(new Date(y, now.getMonth() + 1, 0)) };
    case "quarter": return { from: iso(new Date(y, now.getMonth() - 2, 1)), to: todayIso() };
    case "year": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: "", to: "" };
  }
}

interface Person {
  key: string;
  name: string;
  email: string;
  details: string;
  member: boolean;
  events: { id: string; title: string; date: string }[];
}

/** Participants de tous les événements : par période ou par événements choisis,
 *  vus par personne (dédoublonnés par email) ou par inscription, export Excel. */
export default function AllParticipantsPage() {
  const { t, intl, fmt, locale } = useI18n();
  const x = t.allParticipants;
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const canView = hasSection(user, "events");

  const [mode, setMode] = useState<Mode>("period");
  const [preset, setPreset] = useState<Preset | null>("year");
  const [range, setRange] = useState(() => presetRange("year"));
  const [picked, setPicked] = useState<string[]>([]);
  const [eventQuery, setEventQuery] = useState("");
  const [view, setView] = useState<View>("person");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filter: ParticipantsFilter = mode === "period"
    ? { date_from: range.from || undefined, date_to: range.to || undefined }
    : { events: picked.join(",") };
  const ready = mode === "period" || picked.length > 0;

  const { data: events = [] } = useQuery({
    queryKey: ["events", "manage", "picker"],
    queryFn: () => eventsService.list({ page_size: "100", ordering: "-start_date" }).then((r) => {
      const d = r.data as Event[] | { results: Event[] };
      return Array.isArray(d) ? d : d.results;
    }),
    enabled: canView,
  });
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["all-participants", filter],
    queryFn: () => eventsService.allParticipants(filter).then((r) => r.data),
    enabled: canView && ready,
  });

  // Regroupement par personne (email), informations de l'inscription la plus récente.
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of rows) {
      const key = p.user_email.toLowerCase();
      let person = map.get(key);
      if (!person) {
        person = {
          key, email: p.user_email, name: `${p.user_first_name} ${p.user_last_name}`, member: false, events: [],
          details: [p.profession, p.organisation, p.nationality ? countryLabel(p.nationality, locale) : ""].filter(Boolean).join(" · "),
        };
        map.set(key, person);
      }
      person.member ||= p.user_id !== null;
      person.events.push({ id: p.event_id, title: p.event_title, date: p.event_start_date });
    }
    return [...map.values()];
  }, [rows, locale]);

  if (!loadingUser && !canView) {
    return (
      <div className="text-center py-20 text-fg-subtle">
        <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
        <p>{t.manageEvents.restricted}</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const peopleShown = people.filter((p) => !q || `${p.name} ${p.email} ${p.details}`.toLowerCase().includes(q));
  const rowsShown = rows.filter((p) => !q || `${p.user_first_name} ${p.user_last_name} ${p.user_email} ${p.organisation} ${p.event_title}`.toLowerCase().includes(q));
  const total = view === "person" ? peopleShown.length : rowsShown.length;
  const returning = people.filter((p) => p.events.length > 1).length;
  const externals = people.filter((p) => !p.member).length;

  const exportExcel = async () => {
    const { data } = await eventsService.exportAllParticipants({ ...filter, group: view });
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participants_dah${mode === "period" && range.from ? `_${range.from}_${range.to}` : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyPreset = (p: Preset) => { setPreset(p); setRange(presetRange(p)); setPage(1); };
  const toggleEvent = (id: string) => { setPicked((list) => (list.includes(id) ? list.filter((v) => v !== id) : [...list, id])); setPage(1); };
  const eq = eventQuery.trim().toLowerCase();
  const eventOptions = events.filter((e) => !eq || e.title.toLowerCase().includes(eq));

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <Link href="/manage/events" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-brand-blue">
            <ArrowLeft size={14} /> {x.back}
          </Link>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg mt-1">{x.title}</h1>
        </div>
        <button onClick={exportExcel} disabled={!ready || rows.length === 0}
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50 self-start lg:self-auto">
          <Download size={15} /> {x.export}
        </button>
      </header>

      {/* Filtres */}
      <section className="bg-surface rounded-3xl shadow-sm p-5 space-y-4">
        <Segmented<Mode> label={x.title} value={mode} onChange={(m) => { setMode(m); setPage(1); }}
          options={[["period", x.modes.period], ["events", x.modes.events]]} />

        {mode === "period" ? (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(["month", "quarter", "year", "lastYear", "all"] as Preset[]).map((p) => (
                <button key={p} type="button" onClick={() => applyPreset(p)} aria-pressed={preset === p}
                  className={cn("h-9 px-3.5 rounded-full text-sm font-semibold transition-colors",
                    preset === p ? "bg-fg text-surface" : "bg-surface-muted text-fg-soft hover:bg-surface-strong")}>
                  {x.presets[p]}
                </button>
              ))}
            </div>
            <span className="flex-1" />
            <label className="text-xs text-fg-muted">
              {x.from}
              <input type="date" value={range.from} max={range.to || undefined}
                onChange={(e) => { setRange((r) => ({ ...r, from: e.target.value })); setPreset(null); setPage(1); }}
                className="block mt-1 h-10 px-3 rounded-xl border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </label>
            <label className="text-xs text-fg-muted">
              {x.to}
              <input type="date" value={range.to} min={range.from || undefined}
                onChange={(e) => { setRange((r) => ({ ...r, to: e.target.value })); setPreset(null); setPage(1); }}
                className="block mt-1 h-10 px-3 rounded-xl border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            {picked.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {picked.map((id) => {
                  const e = events.find((ev) => ev.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-brand-blue text-white text-sm font-semibold">
                      {e?.title ?? id}
                      <button onClick={() => toggleEvent(id)} aria-label={t.common.delete} className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center"><X size={13} /></button>
                    </span>
                  );
                })}
                <button onClick={() => setPicked([])} className="text-xs font-semibold text-fg-muted hover:text-fg ml-1">{x.clear}</button>
              </div>
            )}
            <label className="relative block max-w-md">
              <span className="sr-only">{x.searchEvents}</span>
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
              <input type="search" value={eventQuery} onChange={(e) => setEventQuery(e.target.value)} placeholder={x.searchEvents}
                className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </label>
            <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1" aria-label={x.pickEvents}>
              {eventOptions.map((e) => {
                const on = picked.includes(e.id);
                return (
                  <li key={e.id}>
                    <button type="button" onClick={() => toggleEvent(e.id)} aria-pressed={on}
                      className={cn("w-full text-left flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 transition-colors",
                        on ? "border-brand-blue bg-brand-blue/[0.06]" : "border-line-soft hover:bg-surface-muted")}>
                      <span className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                        on ? "bg-brand-blue border-brand-blue text-white" : "border-line")}>{on && <Check size={13} />}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-fg truncate">{e.title}</span>
                        <span className="block text-xs text-fg-muted">{fmt.date(e.start_date)} · {t.eventsAdmin.registered(e.participant_count)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      {!ready ? (
        <p className="bg-surface rounded-3xl shadow-sm py-14 text-center text-sm text-fg-muted">{x.noEventPicked}</p>
      ) : (
        <>
          {/* Chiffres */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label={x.stats.registrations} value={rows.length} />
            <Stat label={x.stats.people} value={people.length} sub={x.stats.externals(externals)} />
            <Stat label={x.stats.returning} value={returning} />
          </div>

          {/* Liste */}
          <section className="bg-surface rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-line-soft">
              <Segmented<View> label={x.title} value={view} onChange={(v) => { setView(v); setPage(1); }}
                options={[["person", x.views.person], ["registration", x.views.registration]]} />
              <span className="flex-1" />
              <label className="relative w-full sm:w-72">
                <span className="sr-only">{x.search}</span>
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
                <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder={x.search}
                  className="w-full h-10 pl-10 pr-3 rounded-xl bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
              </label>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3 animate-pulse">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-strong rounded-xl" />)}</div>
            ) : total === 0 ? (
              <div className="py-16 text-center text-fg-subtle">
                <Users size={36} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">{x.empty}</p>
              </div>
            ) : view === "person" ? (
              <ul>
                {paginate(peopleShown, page, PAGE_SIZE).map((p) => (
                  <li key={p.key} className="flex items-start gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0">
                    <Avatar name={p.name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-fg truncate">
                        {p.name}
                        <MemberTag member={p.member} />
                      </p>
                      <p className="text-xs text-fg-muted truncate">{p.email}{p.details && ` · ${p.details}`}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.events.map((e) => (
                          <span key={e.id} className="text-[11px] font-medium rounded-full px-2.5 py-1 bg-surface-muted text-fg-soft">
                            {e.title} · {new Date(e.date).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={cn("shrink-0 text-xs font-bold rounded-full px-2.5 py-1",
                      p.events.length > 1 ? "bg-brand-orange/15 text-orange-800 dark:text-orange-300" : "bg-surface-strong text-fg-soft")}>
                      {x.eventsCount(p.events.length)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul>
                {paginate(rowsShown, page, PAGE_SIZE).map((p) => {
                  const name = `${p.user_first_name} ${p.user_last_name}`;
                  return (
                    <li key={p.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0">
                      <Avatar name={name} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-fg truncate">{name}<MemberTag member={p.user_id !== null} /></p>
                        <p className="text-xs text-fg-muted truncate">{p.user_email}{p.organisation && ` · ${p.organisation}`}</p>
                      </div>
                      <div className="hidden md:block text-right min-w-0 max-w-[40%]">
                        <p className="text-sm font-medium text-fg truncate">{p.event_title}</p>
                        <p className="text-xs text-fg-muted">{fmt.date(p.event_start_date)} · {x.registeredOn(fmt.date(p.created_at))}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
          </section>
        </>
      )}
    </div>
  );
}

function MemberTag({ member }: { member: boolean }) {
  const { t } = useI18n();
  return (
    <span className={cn("ml-2 align-middle text-[11px] font-semibold rounded-full px-2 py-0.5",
      member ? "bg-brand-blue/10 text-brand-deep" : "bg-surface-strong text-fg-soft")}>
      {member ? t.allParticipants.memberTag : t.allParticipants.externalTag}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <section className="bg-surface rounded-3xl shadow-sm p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label}</p>
      <p className="font-display text-3xl font-extrabold text-fg mt-1.5">{value}</p>
      {sub && <p className="text-xs text-fg-muted mt-0.5">{sub}</p>}
    </section>
  );
}
