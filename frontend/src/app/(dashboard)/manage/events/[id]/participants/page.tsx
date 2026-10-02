"use client";

import { use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsService } from "@/services/events.service";
import { useI18n } from "@/i18n/I18nProvider";
import { countryLabel } from "@/lib/countries";
import { avatarUrl } from "@/lib/utils";
import { Users, CheckCircle, Circle, ArrowLeft, Download, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCurrentUser } from "@/hooks/useAuth";
import { isBureau } from "@/types/auth.types";
import type { EventParticipant } from "@/types/events.types";

export default function EventParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, fmt, locale } = useI18n();
  const x = t.manageEvents;
  const qc = useQueryClient();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: () => eventsService.get(id).then((r) => r.data),
  });

  const canView = isBureau(currentUser);

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ["event-participants", id],
    queryFn: () => eventsService.participants(id).then((r) => r.data),
    enabled: canView,
  });

  const validatePresence = useMutation({
    mutationFn: (userId: number) => eventsService.validatePresence(id, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-participants", id] }),
  });

  const list: EventParticipant[] = Array.isArray(participants) ? participants : (participants as { results?: EventParticipant[] }).results ?? [];
  const validated = list.filter((p) => p.presence_validated).length;

  function handleExport() {
    eventsService.export(id).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `participants_${id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <Link href="/manage/events" className="flex items-center gap-1.5 text-sm text-fg-subtle hover:text-brand-blue mb-2 transition-colors">
            <ArrowLeft size={14} /> {t.eventDetail.backToEvents}
          </Link>
          <h1 className="text-2xl font-bold text-fg">{x.participants}</h1>
          {event && <p className="text-fg-muted text-sm mt-1">{event.title}</p>}
        </div>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-line rounded-xl text-sm font-medium text-fg-soft hover:bg-surface-muted transition-colors shrink-0"
        >
          <Download size={15} /> {x.exportExcel}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: x.registeredCount, value: list.length, color: "text-fg" },
          { label: x.validated, value: validated, color: "text-green-600" },
          { label: t.applications.pendingPlural, value: list.length - validated, color: "text-orange-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface rounded-2xl border border-line-soft p-5 text-center">
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
            <p className="text-fg-muted text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div className="bg-surface rounded-2xl border border-line-soft overflow-hidden">
        <div className="px-5 py-4 border-b border-line-soft flex items-center gap-2">
          <Users size={16} className="text-brand-blue" />
          <span className="font-medium text-fg text-sm">{t.eventDetail.participants(list.length)}</span>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-surface-strong rounded-xl animate-pulse" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center text-fg-subtle">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>{x.noParticipants}</p>
          </div>
        ) : (
          <div className="divide-y divide-line-soft">
            {list.map((participant) => {
              const fullName = `${participant.user_first_name} ${participant.user_last_name}`;
              return (
                <div key={participant.id} className="flex items-center gap-4 px-5 py-4 hover:bg-surface-muted transition-colors">
                  <img
                    src={avatarUrl(fullName, 36)}
                    alt={fullName}
                    className="w-9 h-9 rounded-full shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-fg text-sm">{fullName}</p>
                    <p className="text-fg-subtle text-xs">{participant.user_email}</p>
                    <p className="text-fg-subtle text-xs">
                      {participant.profession}
                      {participant.organisation && ` · ${participant.organisation}`}
                      {participant.nationality && ` · ${countryLabel(participant.nationality, locale)}`}
                    </p>
                    {participant.motivation && (
                      <p className="text-fg-muted text-xs mt-0.5 line-clamp-1 italic">&ldquo;{participant.motivation}&rdquo;</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-fg-subtle mb-1.5">{fmt.dateTime(participant.created_at)}</p>
                    {participant.presence_validated ? (
                      <div className="flex items-center gap-1.5 text-green-600 text-xs font-medium">
                        <CheckCircle size={14} className="fill-green-600 text-white" />
                        {x.present}
                      </div>
                    ) : (
                      <button
                        onClick={() => validatePresence.mutate(participant.id)}
                        disabled={validatePresence.isPending}
                        className="flex items-center gap-1.5 text-fg-subtle hover:text-brand-blue text-xs font-medium transition-colors group"
                      >
                        <Circle size={14} className="group-hover:text-brand-blue" />
                        {x.validate}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
