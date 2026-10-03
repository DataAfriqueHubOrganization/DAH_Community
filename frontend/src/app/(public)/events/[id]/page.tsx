"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { CalendarDays, MapPin, Video, ArrowLeft, Check, ExternalLink, Clock } from "lucide-react";
import { eventsService } from "@/services/events.service";
import { eventTypeBadgeVariant } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { EventRegistrationForm } from "@/features/events/EventRegistrationForm";

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, fmt, label } = useI18n();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => eventsService.get(id).then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page">
        <div className="max-w-4xl mx-auto px-4 py-12 animate-pulse space-y-6">
          <div className="h-64 bg-surface-strong rounded-2xl" />
          <div className="h-8 bg-surface-strong rounded w-3/4" />
          <div className="h-4 bg-surface-strong rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-fg-muted">{t.eventDetail.notFound}</p>
          <Link href="/events" className="text-brand-blue text-sm mt-2 inline-block">← {t.eventDetail.backToEvents}</Link>
        </div>
      </div>
    );
  }

  const now = new Date();
  const isPast = new Date(event.start_date) < now;
  const isRegistrationOpen = event.registration_deadline
    ? new Date(event.registration_deadline) >= now
    : !isPast;
  const displayImage = isPast ? event.recap_image ?? event.cover_image : event.cover_image;

  return (
    <div className="min-h-screen bg-page">
      {/* Hero */}
      <div className="bg-univers text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Link href="/events" className="inline-flex items-center gap-2 text-white/85 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={16} /> {t.eventDetail.allEvents}
          </Link>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant={eventTypeBadgeVariant(event.event_type)}>{label.eventType(event.event_type)}</Badge>
            {event.is_registered && <Badge variant="green"><Check size={10} className="mr-1" />{t.eventDetail.registeredBadge}</Badge>}
            {event.is_full && <Badge variant="red">{t.events.full}</Badge>}
            {isPast && <Badge variant="gray">{t.time.past}</Badge>}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 leading-tight">{event.title}</h1>
          {!isPast && (
            <div className="inline-flex items-center gap-2 bg-brand-orange/20 border border-brand-orange/30 rounded-full px-4 py-1.5 text-sm text-white">
              <Clock size={14} /> {fmt.timeUntil(event.start_date)}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        {/* Image */}
        <div className="h-64 sm:h-80 rounded-2xl overflow-hidden mb-8 bg-univers relative">
          {displayImage ? (
            <img src={displayImage} alt={event.title} className="w-full h-full object-contain" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center opacity-10">
              <CalendarDays size={120} className="text-white" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contenu principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Infos */}
            <div className="bg-surface rounded-2xl p-6 border border-line-soft">
              <h2 className="font-semibold text-fg mb-4">{t.eventDetail.info}</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 text-fg-soft">
                  <CalendarDays size={16} className="shrink-0 text-brand-blue mt-0.5" />
                  <div>
                    <p className="font-medium text-fg">{fmt.dateTime(event.start_date)}</p>
                    {event.end_date && <p className="text-fg-muted">{t.eventDetail.end} : {fmt.dateTime(event.end_date)}</p>}
                  </div>
                </div>
                {event.location && (
                  <div className="flex items-center gap-3 text-fg-soft">
                    <MapPin size={16} className="shrink-0 text-brand-orange" />
                    <span>{event.location}</span>
                  </div>
                )}
                {event.online_link && (
                  <div className="flex items-center gap-3 text-fg-soft">
                    <Video size={16} className="shrink-0 text-brand-blue" />
                    <a href={event.online_link} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline flex items-center gap-1">
                      {t.eventDetail.joinOnline} <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="bg-surface rounded-2xl p-6 border border-line-soft">
              <h2 className="font-semibold text-fg mb-4">
                {isPast ? t.eventDetail.summary : t.eventDetail.aboutEvent}
              </h2>
              {/^\s*</.test(event.description) ? (
                // Description saisie avec l'éditeur (HTML), sinon texte brut des anciens événements.
                <div className="rich-content text-sm" dangerouslySetInnerHTML={{ __html: event.description }} />
              ) : (
                <p className="text-fg-soft leading-relaxed whitespace-pre-line text-sm">{event.description}</p>
              )}
            </div>

            {/* Speakers */}
            {event.speakers && event.speakers.length > 0 && (
              <div className="bg-surface rounded-2xl p-6 border border-line-soft">
                <h2 className="font-semibold text-fg mb-4">{t.eventDetail.speakers}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.speakers.map((sp: { id: number; name: string; bio: string }) => (
                    <div key={sp.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-muted">
                      <div className="w-10 h-10 rounded-full bg-brand-blue flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {sp.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-fg text-sm">{sp.name}</p>
                        <p className="text-fg-muted text-xs leading-relaxed mt-0.5">{sp.bio}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Action inscription */}
            <div className="bg-surface rounded-2xl p-6 border border-line-soft">
              {event.is_registered ? (
                <div className="text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={24} className="text-green-600" />
                  </div>
                  <p className="font-semibold text-fg mb-1">{t.eventDetail.youAreRegistered}</p>
                  <p className="text-fg-muted text-sm">{t.eventDetail.reminder}</p>
                </div>
              ) : event.is_full ? (
                <div className="text-center py-2">
                  <p className="font-semibold text-fg-soft">{t.eventDetail.fullTitle}</p>
                  <p className="text-fg-subtle text-sm mt-1">{t.eventDetail.noSeats}</p>
                </div>
              ) : isPast ? (
                <div className="text-center py-2">
                  <p className="text-fg-muted text-sm">{t.eventDetail.ended}</p>
                </div>
              ) : !isRegistrationOpen ? (
                <div className="text-center py-2">
                  <p className="font-semibold text-fg-soft">{t.events.registrationClosed}</p>
                  <p className="text-fg-subtle text-sm mt-1">{t.eventDetail.deadlinePassed}</p>
                </div>
              ) : (
                <EventRegistrationForm eventId={id} />
              )}
              {event.registration_deadline && isRegistrationOpen && (
                <p className="text-xs text-fg-subtle text-center mt-3">
                  {t.eventDetail.closes} : {fmt.dateTime(event.registration_deadline)}
                </p>
              )}
            </div>

            {/* Organisateur */}
            {event.created_by_name && (
              <div className="bg-surface rounded-2xl p-5 border border-line-soft">
                <p className="text-xs text-fg-muted uppercase tracking-wide mb-2">{t.eventDetail.organizer}</p>
                <p className="font-medium text-fg text-sm">{event.created_by_name}</p>
                <p className="text-xs text-fg-subtle mt-0.5">Data Afrique Hub</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
