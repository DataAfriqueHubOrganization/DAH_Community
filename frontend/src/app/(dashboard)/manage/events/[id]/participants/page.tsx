"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Mail, Search, ShieldAlert, Users } from "lucide-react";
import { eventsService } from "@/services/events.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { hasSection } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { countryLabel } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { Avatar } from "@/features/departments/workspace/shared";
import type { EventParticipant } from "@/types/events.types";
import { ReminderModal } from "@/features/events/ReminderModal";

/** Personnes inscrites à un événement : recherche et export Excel. */
export default function EventParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, intl, fmt, locale } = useI18n();
  const x = t.eventsAdmin;
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser();
  const canView = hasSection(currentUser, "events");
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const [reminding, setReminding] = useState(searchParams.get("remind") === "1");
  const [notice, setNotice] = useState<string | null>(null);

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: () => eventsService.get(id).then((r) => r.data),
    enabled: canView,
  });
  const { data: participants, isLoading } = useQuery({
    queryKey: ["event-participants", id],
    queryFn: () => eventsService.participants(id).then((r) => r.data),
    enabled: canView,
  });

  const list: EventParticipant[] = useMemo(
    () => (Array.isArray(participants) ? participants : (participants as { results?: EventParticipant[] } | undefined)?.results ?? []),
    [participants],
  );

  if (!loadingUser && !canView) {
    return (
      <div className="text-center py-20 text-fg-subtle">
        <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
        <p>{t.manageEvents.restricted}</p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = list
    .filter((p) => !q || `${p.user_first_name} ${p.user_last_name} ${p.user_email} ${p.organisation}`.toLowerCase().includes(q))
    .sort((a, b) => `${a.user_first_name} ${a.user_last_name}`.localeCompare(`${b.user_first_name} ${b.user_last_name}`, intl));
  const start = event ? new Date(event.start_date) : null;

  const exportExcel = () => {
    eventsService.export(id).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `participants_${id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {start && (
            <span className="w-16 h-16 rounded-2xl bg-univers-brand text-white flex flex-col items-center justify-center shrink-0">
              <b className="font-display text-[22px] leading-none">{start.getDate()}</b>
              <span className="text-[10px] font-bold uppercase text-orange-200">{start.toLocaleDateString(intl, { month: "short" })}</span>
            </span>
          )}
          <div className="min-w-0">
            <Link href="/manage/events" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-brand-blue">
              <ArrowLeft size={14} /> {x.back}
            </Link>
            <h1 className="font-display text-2xl font-extrabold text-fg truncate">{event?.title ?? "…"}</h1>
            <p className="text-sm text-fg-muted">
              {x.participants} · <b className="text-fg">{x.registered(list.length)}</b>
              {event?.max_participants ? ` ${x.ofSeats(event.max_participants)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 self-start lg:self-auto">
          <button onClick={exportExcel} className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted">
            <Download size={15} /> {t.manageEvents.exportExcel}
          </button>
          <button onClick={() => { setNotice(null); setReminding(true); }} disabled={!event}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50">
            <Mail size={15} /> {t.eventReminder.open}
          </button>
        </div>
      </header>
      {notice && <p className="text-sm text-green-600" role="status">{notice}</p>}

      <section className="bg-surface rounded-3xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line-soft">
          <label className="relative block w-full sm:w-96">
            <span className="sr-only">{x.searchPeople}</span>
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={x.searchPeople}
              className="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-muted text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </label>
        </div>
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-strong rounded-xl" />)}</div>
        ) : shown.length === 0 ? (
          <div className="py-16 text-center text-fg-subtle">
            <Users size={36} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{list.length === 0 ? t.manageEvents.noParticipants : x.nobody}</p>
          </div>
        ) : (
          <ul>
            {shown.map((p) => {
              const name = `${p.user_first_name} ${p.user_last_name}`;
              const member = p.user_id !== null;
              const details = [p.profession, p.organisation, p.nationality ? countryLabel(p.nationality, locale) : ""].filter(Boolean).join(" · ");
              return (
                <li key={p.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft last:border-b-0">
                  <Avatar name={name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-fg truncate">
                      {name}
                      <span className={cn("ml-2 align-middle text-[11px] font-semibold rounded-full px-2 py-0.5",
                        member ? "bg-brand-blue/10 text-brand-deep" : "bg-surface-strong text-fg-soft")}>
                        {member ? x.memberTag : x.externalTag}
                      </span>
                    </p>
                    <p className="text-xs text-fg-muted truncate">{p.user_email}{details && ` · ${details}`}</p>
                    {p.motivation && <p className="text-xs text-fg-soft italic mt-0.5 line-clamp-1">« {p.motivation} »</p>}
                  </div>
                  <span className="hidden sm:block text-xs text-fg-subtle whitespace-nowrap">{x.registeredOn(fmt.date(p.created_at))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {reminding && event && (
        <ReminderModal
          event={event}
          recipients={list.length}
          onClose={() => setReminding(false)}
          onSent={(message) => { setNotice(message); setReminding(false); }}
        />
      )}
    </div>
  );
}
