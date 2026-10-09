"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Download, Eye, EyeOff, Mail, MoreHorizontal, Plus, Search, Trash2, Users } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { eventsService } from "@/services/events.service";
import { hasSection } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import type { Event } from "@/types/events.types";

type Tab = "upcoming" | "drafts" | "past";
const DAY = 86_400_000;

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

/** Événements (bureau) : prochain événement à la une, puis les autres en cartes. */
export default function EventsManagePage() {
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const { t } = useI18n();
  const x = t.eventsAdmin;
  const [tab, setTab] = useState<Tab>("upcoming");
  const [query, setQuery] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["events", "manage"],
    queryFn: () => eventsService.list({ page_size: "100", ordering: "start_date" }).then((r) => r.data),
    enabled: hasSection(user, "events"),
  });

  if (!loadingUser && !hasSection(user, "events")) return <p className="text-fg-muted">{t.manageEvents.restricted}</p>;

  const all: Event[] = Array.isArray(data) ? data : data?.results ?? [];
  const now = Date.now();
  const upcoming = all.filter((e) => e.is_published && new Date(e.end_date ?? e.start_date).getTime() >= now)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const drafts = all.filter((e) => !e.is_published).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const past = all.filter((e) => e.is_published && new Date(e.end_date ?? e.start_date).getTime() < now)
    .sort((a, b) => b.start_date.localeCompare(a.start_date));
  const lists: Record<Tab, Event[]> = { upcoming, drafts, past };

  const q = query.trim().toLowerCase();
  const shown = lists[tab].filter((e) => !q || e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
  const featured = tab === "upcoming" && !q ? shown[0] : undefined;
  const rest = featured ? shown.slice(1) : shown;

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-extrabold tracking-tight text-fg">{t.sidebar.events}</h1>
          <p className="text-sm text-fg-muted mt-1">
            {x.subtitle(upcoming.length, drafts.length)}
            {upcoming[0] && <> · <b className="text-fg">{x.nextIn(daysUntil(upcoming[0].start_date))}</b></>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative w-full sm:w-64">
            <span className="sr-only">{x.search}</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={x.search}
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </label>
          <Link href="/manage/events/participants"
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted">
            <Users size={16} /> {t.allParticipants.open}
          </Link>
          <Link href="/manage/events/new"
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep">
            <Plus size={16} /> {x.create}
          </Link>
        </div>
      </header>

      <nav aria-label={t.sidebar.events} className="inline-flex gap-1.5 bg-surface rounded-2xl p-1.5 shadow-sm">
        {(["upcoming", "drafts", "past"] as Tab[]).map((key) => (
          <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? "page" : undefined}
            className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors",
              tab === key ? "bg-fg text-surface font-semibold" : "text-fg-muted hover:text-fg font-medium")}>
            {x.tabs[key]}
            <span className={cn("text-[11px] font-bold rounded-full px-2 py-0.5", tab === key ? "bg-surface/20" : "bg-surface-strong text-fg-soft")}>
              {lists[key].length}
            </span>
          </button>
        ))}
      </nav>

      {isLoading ? (
        <div className="space-y-5 animate-pulse">
          <div className="h-64 bg-surface rounded-3xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <div key={i} className="h-72 bg-surface rounded-3xl" />)}</div>
        </div>
      ) : shown.length === 0 ? (
        <div className="bg-surface rounded-3xl shadow-sm py-16 text-center">
          <CalendarDays size={40} className="mx-auto text-fg-faint" />
          <p className="text-fg-muted mt-3">{x.empty[tab]}</p>
        </div>
      ) : (
        <>
          {featured && <FeaturedEvent event={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {rest.map((e) => <EventCard key={e.id} event={e} past={tab === "past"} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DateBadge({ iso, size = "md" }: { iso: string; size?: "md" | "lg" }) {
  const { intl } = useI18n();
  const d = new Date(iso);
  return (
    <span className={cn("absolute top-3 left-3 bg-white rounded-xl text-center shadow-md", size === "lg" ? "px-3.5 py-2.5" : "px-2.5 py-1.5")}>
      <span className={cn("block font-display font-extrabold leading-none text-ink", size === "lg" ? "text-[26px]" : "text-lg")}>{d.getDate()}</span>
      <span className="block text-[10px] font-bold uppercase text-brand-orange mt-0.5">{d.toLocaleDateString(intl, { month: "short" })}</span>
    </span>
  );
}

function Cover({ event, className, children }: { event: Event; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden bg-univers-brand", className)}>
      {event.cover_image ? (
        <img src={event.cover_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <NetworkPattern className="opacity-80" />
      )}
      {children}
    </div>
  );
}

function placeOf(event: Event, x: { online: string; tbd: string }) {
  return event.location || (event.online_link ? x.online : x.tbd);
}

function FeaturedEvent({ event }: { event: Event }) {
  const { t, fmt, label } = useI18n();
  const x = t.eventsAdmin;
  const pct = event.max_participants ? Math.min(100, Math.round((event.participant_count / event.max_participants) * 100)) : 0;
  const closesIn = event.registration_deadline ? daysUntil(event.registration_deadline) : null;

  return (
    <section className="bg-surface rounded-3xl shadow-sm overflow-hidden grid grid-cols-1 lg:grid-cols-[420px_1fr]">
      <Cover event={event} className="min-h-[220px]">
        <DateBadge iso={event.start_date} size="lg" />
        <span className="absolute bottom-4 left-4 text-xs font-semibold rounded-full px-3 py-1 bg-black/30 text-white backdrop-blur-sm">
          {label.eventType(event.event_type)}
        </span>
      </Cover>
      <div className="p-6 lg:p-7 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-2.5 py-1 bg-green-50 text-green-700 dark:bg-green-500/15 dark:text-green-300">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" aria-hidden="true" />{t.manageEvents.published}
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{x.next}</span>
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold text-fg">{event.title}</h2>
          <p className="text-sm text-fg-muted mt-1.5 capitalize-first">{fmt.dateTime(event.start_date)} · {placeOf(event, x)}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr] gap-4 items-end">
          <div>
            <div className="flex justify-between text-sm">
              <b className="text-fg">{x.registered(event.participant_count)}</b>
              <span className="text-fg-muted">{event.max_participants ? x.ofSeats(event.max_participants) : x.noLimit}</span>
            </div>
            {event.max_participants && (
              <div className="h-2.5 rounded-full bg-surface-strong mt-2 overflow-hidden" aria-hidden="true">
                <div className="h-full rounded-full bg-brand-blue" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
          {closesIn !== null && (
            <div className="rounded-2xl bg-brand-orange/10 px-4 py-2.5">
              <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">{closesIn > 0 ? x.closesIn : x.closed}</p>
              {closesIn > 0 && <p className="font-display text-lg font-extrabold text-orange-800 dark:text-orange-300">{x.days(closesIn)}</p>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-auto">
          <Link href={`/manage/events/${event.id}/participants`} className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold inline-flex items-center hover:bg-brand-deep">
            {x.participants} · {event.participant_count}
          </Link>
          <Link href={`/manage/events/${event.id}/edit`} className="h-11 px-5 rounded-xl border border-line text-sm font-semibold text-fg-soft inline-flex items-center hover:bg-surface-muted">{x.edit}</Link>
          <Link href={`/events/${event.id}`} target="_blank" className="h-11 px-5 rounded-xl border border-line text-sm font-semibold text-fg-soft inline-flex items-center hover:bg-surface-muted">{x.viewPage} ↗</Link>
          <span className="flex-1" />
          <EventMenu event={event} />
        </div>
      </div>
    </section>
  );
}

function EventCard({ event, past }: { event: Event; past: boolean }) {
  const { t, fmt, label } = useI18n();
  const x = t.eventsAdmin;
  const pct = event.max_participants ? Math.min(100, Math.round((event.participant_count / event.max_participants) * 100)) : 0;
  return (
    <article className={cn("bg-surface rounded-3xl shadow-sm overflow-hidden flex flex-col", past && "opacity-90")}>
      <Cover event={event} className="h-32">
        <DateBadge iso={event.start_date} />
        <span className={cn("absolute top-3 right-3 text-xs font-semibold rounded-full px-2.5 py-1",
          event.is_published ? "bg-green-50 text-green-700" : "bg-white text-fg-soft")}>
          {event.is_published ? t.manageEvents.published : t.manageEvents.draft}
        </span>
      </Cover>
      <div className="p-5 flex flex-col gap-2.5 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label.eventType(event.event_type)}</p>
        <h3 className="font-display font-extrabold text-fg leading-snug">{event.title}</h3>
        <p className="text-sm text-fg-muted capitalize-first">{fmt.dateTime(event.start_date)} · {placeOf(event, x)}</p>
        <div className="flex items-center gap-3 mt-auto pt-1">
          <div className="flex-1 h-1.5 rounded-full bg-surface-strong overflow-hidden" aria-hidden="true">
            <div className="h-full rounded-full bg-brand-blue" style={{ width: `${event.max_participants ? pct : event.participant_count ? 100 : 0}%` }} />
          </div>
          <span className="text-xs font-semibold text-fg whitespace-nowrap">{x.registered(event.participant_count)}{event.max_participants ? ` / ${event.max_participants}` : ""}</span>
        </div>
        <div className="flex items-center gap-1 border-t border-line-soft pt-3 mt-1">
          <Link href={`/manage/events/${event.id}/participants`} className="text-sm font-semibold text-brand-blue hover:underline">{x.participants}</Link>
          <span className="flex-1" />
          <Link href={`/manage/events/${event.id}/edit`} className="px-2 py-1 text-sm text-fg-muted hover:text-fg">{x.edit}</Link>
          <EventMenu event={event} />
        </div>
      </div>
    </article>
  );
}

/** Actions secondaires : publier / dépublier, export Excel, suppression. */
function EventMenu({ event }: { event: Event }) {
  const { t } = useI18n();
  const x = t.manageEvents;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  const toggle = useMutation({
    mutationFn: () => eventsService.update(event.id, { is_published: !event.is_published }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
  const remove = useMutation({
    mutationFn: () => eventsService.delete(event.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
  const exportExcel = () => {
    eventsService.export(event.id).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `participants_${event.id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  const item = "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left hover:bg-surface-muted";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={t.eventsAdmin.more} aria-haspopup="menu" aria-expanded={open}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-muted hover:bg-surface-muted hover:text-fg">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 bottom-full mb-1 z-20 w-60 bg-surface border border-line rounded-xl shadow-xl p-1.5">
          <button role="menuitem" className={cn(item, "text-fg")} onClick={() => { setOpen(false); toggle.mutate(); }}>
            {event.is_published ? <EyeOff size={15} /> : <Eye size={15} />} {event.is_published ? x.unpublish : x.publish}
          </button>
          <Link role="menuitem" href={`/manage/events/${event.id}/participants?remind=1`} className={cn(item, "text-fg")}>
            <Mail size={15} /> {t.eventReminder.open}
          </Link>
          <button role="menuitem" className={cn(item, "text-fg")} onClick={() => { setOpen(false); exportExcel(); }}>
            <Download size={15} /> {x.exportExcel}
          </button>
          <button role="menuitem" className={cn(item, "text-red-600")} onClick={() => { setOpen(false); if (confirm(x.confirmDelete)) remove.mutate(); }}>
            <Trash2 size={15} /> {t.common.delete}
          </button>
        </div>
      )}
    </div>
  );
}
