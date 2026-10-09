"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { eventsService } from "@/services/events.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { hasSection } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { EventEditor } from "@/features/events/EventEditor";

export default function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: user, isLoading: loadingUser } = useCurrentUser();
  const { t } = useI18n();
  const { data: event, isLoading, isError } = useQuery({
    queryKey: ["event", id],
    queryFn: () => eventsService.get(id).then((r) => r.data),
    enabled: hasSection(user, "events"),
  });

  if (loadingUser || isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-10 w-72 bg-surface-strong rounded-xl" />
        <div className="h-56 bg-surface rounded-3xl" />
        <div className="h-80 bg-surface rounded-3xl" />
      </div>
    );
  }
  if (!hasSection(user, "events")) return <p className="text-fg-muted">{t.manageEvents.restricted}</p>;
  if (isError || !event) return <p className="text-fg-muted">{t.common.error}</p>;
  // key : un autre événement ouvert dans la même page repart d'un formulaire neuf.
  return <EventEditor key={event.id} event={event} />;
}
