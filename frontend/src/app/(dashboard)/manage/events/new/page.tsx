"use client";

import { useCurrentUser } from "@/hooks/useAuth";
import { isBureau } from "@/types/auth.types";
import { useI18n } from "@/i18n/I18nProvider";
import { EventEditor } from "@/features/events/EventEditor";

export default function NewEventPage() {
  const { data: user, isLoading } = useCurrentUser();
  const { t } = useI18n();
  if (isLoading) return <div className="h-40 bg-surface rounded-3xl animate-pulse" />;
  if (!isBureau(user)) return <p className="text-fg-muted">{t.manageEvents.restricted}</p>;
  return <EventEditor event={null} />;
}
