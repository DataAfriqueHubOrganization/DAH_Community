"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { eventsService } from "@/services/events.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { apiError } from "@/features/treasury/shared";
import type { EventDetail } from "@/types/events.types";

type Template = "before" | "after";

/** Rappel par email aux inscrits, à tout moment : modèle prêt à l'emploi
 *  (avant / après l'événement), modifiable, avec aperçu et envoi test. */
export function ReminderModal({ event, recipients, onClose, onSent }: {
  event: EventDetail;
  recipients: number;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const { t, intl, fmt } = useI18n();
  const x = t.eventReminder;
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();
  const isPast = new Date(event.end_date ?? event.start_date).getTime() < Date.now();

  const fill = (template: Template) => {
    const start = new Date(event.start_date);
    const date = start.toLocaleDateString(intl, { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      + " · " + start.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" });
    const place = event.location ? x.placeAt(event.location) : event.online_link ? x.placeOnline : "";
    return template === "before"
      ? { subject: x.subjectBefore(event.title, start.toLocaleDateString(intl, { day: "numeric", month: "long" })), message: x.messageBefore(event.title, x.onDate(date), place) }
      : { subject: x.subjectAfter(event.title), message: x.messageAfter(event.title) };
  };

  const [template, setTemplate] = useState<Template>(isPast ? "after" : "before");
  const [subject, setSubject] = useState(() => fill(isPast ? "after" : "before").subject);
  const [message, setMessage] = useState(() => fill(isPast ? "after" : "before").message);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["event-reminders", event.id],
    queryFn: () => eventsService.reminders(event.id).then((r) => r.data),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pick = (next: Template) => {
    const filled = fill(next);
    setTemplate(next);
    setSubject(filled.subject);
    setMessage(filled.message);
  };

  const send = useMutation({
    mutationFn: (test: boolean) => eventsService.remind(event.id, { subject, message, test }),
    onSuccess: ({ data }) => {
      if (data.test) {
        setNotice(x.testSent(user?.email ?? ""));
      } else {
        qc.invalidateQueries({ queryKey: ["event-reminders", event.id] });
        onSent(x.sent(data.sent));
      }
    },
  });

  const paragraphs = message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const valid = subject.trim() && message.trim();
  const start = new Date(event.start_date);
  const last = history[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="reminder-title">
      <div className="bg-surface rounded-[28px] w-full max-w-5xl my-8 shadow-2xl overflow-hidden">
        <header className="px-7 pt-6 pb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="reminder-title" className="font-display text-xl font-extrabold text-fg">{x.title}</h2>
            <p className="text-sm text-fg-muted mt-1 max-w-2xl">{x.intro}</p>
            {last && <p className="text-xs text-fg-subtle mt-2">{x.last(fmt.dateTime(last.sent_at), last.sent_by_name ?? "", last.recipients)}</p>}
          </div>
          <button onClick={onClose} aria-label={t.common.close} className="text-fg-subtle hover:text-fg shrink-0"><X size={22} /></button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-7 pb-6">
          {/* Rédaction */}
          <div className="space-y-4">
            <div role="radiogroup" aria-label={x.title} className="grid grid-cols-2 gap-1 bg-surface-muted rounded-2xl p-1">
              {(["before", "after"] as Template[]).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={template === k} onClick={() => pick(k)}
                  className={cn("h-10 rounded-xl text-sm transition-all", template === k ? "bg-surface shadow-sm font-bold text-fg" : "text-fg-muted hover:text-fg")}>
                  {x.templates[k]}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="reminder-subject" className="block text-xs text-fg-muted mb-1.5">{x.subject}</label>
              <input id="reminder-subject" value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 150))}
                className="w-full h-12 px-4 rounded-2xl border border-line bg-surface text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
            <div>
              <label htmlFor="reminder-message" className="flex justify-between text-xs text-fg-muted mb-1.5">
                <span>{x.message}</span><span className="text-fg-subtle">{x.messageHint}</span>
              </label>
              <textarea id="reminder-message" value={message} onChange={(e) => setMessage(e.target.value.slice(0, 5000))} rows={11}
                className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
            </div>
          </div>

          {/* Aperçu : reprend le gabarit des emails DAH */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted mb-2">{x.preview}</p>
            <div className="rounded-2xl border border-line-soft bg-[#F4F6FA] p-4">
              <p className="text-xs text-[#6B6F7B] mb-2 truncate"><b className="text-[#111114]">{subject || "—"}</b></p>
              <div className="rounded-xl bg-white overflow-hidden shadow-sm text-[#3F3F46]">
                <div className="bg-univers-brand px-5 py-4"><Logo variant="full" tone="white" height={34} /></div>
                <div className="px-5 py-5 space-y-3 text-[13px] leading-relaxed">
                  <p className="font-display text-base font-extrabold text-[#111114]">{event.title}</p>
                  <p>{x.greeting}</p>
                  {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
                  <div className="rounded-lg bg-[#EAF1FD] px-4 py-3 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#1E4FAF]">{x.details}</p>
                    <p><span className="text-[#6B6F7B]">{x.detailDate} : </span>{start.toLocaleDateString(intl)} {start.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })}</p>
                    {event.location && <p><span className="text-[#6B6F7B]">{x.detailPlace} : </span>{event.location}</p>}
                    {event.online_link && <p className="truncate"><span className="text-[#6B6F7B]">{x.detailLink} : </span>{event.online_link}</p>}
                  </div>
                  <span className="inline-block rounded-lg bg-[#2F6FE0] text-white font-semibold px-4 py-2">{x.cta}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {(notice || send.isError) && (
          <p className={cn("px-7 pb-3 text-sm", send.isError ? "text-red-600" : "text-green-600")} role="status">
            {send.isError ? apiError(send.error, t.common.error) : notice}
          </p>
        )}

        <footer className="px-7 py-4 border-t border-line-soft bg-surface-muted/60 flex flex-wrap items-center gap-2">
          {recipients === 0 && <span className="text-sm text-fg-muted">{x.noOne}</span>}
          <span className="flex-1" />
          <button onClick={() => send.mutate(true)} disabled={!valid || send.isPending}
            className="h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted disabled:opacity-50">
            {x.test}
          </button>
          <button onClick={() => { if (confirm(x.confirm(recipients))) send.mutate(false); }} disabled={!valid || recipients === 0 || send.isPending}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50">
            <Send size={15} /> {x.send(recipients)}
          </button>
        </footer>
      </div>
    </div>
  );
}
