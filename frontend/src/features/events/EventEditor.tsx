"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Circle, ImagePlus } from "lucide-react";
import { eventsService } from "@/services/events.service";
import { useI18n } from "@/i18n/I18nProvider";
import { cn, toDatetimeLocalValue } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { apiError } from "@/features/treasury/shared";
import type { EventDetail, EventType } from "@/types/events.types";

const EVENT_TYPES: EventType[] = ["webinaire", "conference", "atelier", "hackathon", "meetup", "formation", "autre"];
type Format = "onsite" | "online" | "hybrid";

interface FormState {
  title: string;
  description: string;
  event_type: EventType;
  start_date: string;
  end_date: string;
  registration_deadline: string;
  format: Format;
  location: string;
  online_link: string;
  max_participants: string;
  is_published: boolean;
}

function initialState(event: EventDetail | null): FormState {
  if (!event) {
    return {
      title: "", description: "", event_type: "conference", start_date: "", end_date: "", registration_deadline: "",
      format: "onsite", location: "", online_link: "", max_participants: "", is_published: false,
    };
  }
  return {
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    start_date: toDatetimeLocalValue(event.start_date),
    end_date: toDatetimeLocalValue(event.end_date),
    registration_deadline: toDatetimeLocalValue(event.registration_deadline),
    // Pas de champ « format » en base : on le déduit du lieu et du lien.
    format: event.location && event.online_link ? "hybrid" : event.online_link ? "online" : "onsite",
    location: event.location,
    online_link: event.online_link,
    max_participants: event.max_participants ? String(event.max_participants) : "",
    is_published: event.is_published,
  };
}

const field = "w-full h-12 px-4 rounded-2xl border border-line bg-surface text-sm text-fg focus:outline-none focus:ring-2 focus:ring-brand-blue/20";

/** Création / modification d'un événement : sections claires, aperçu sur la
 *  droite tel qu'il apparaîtra sur le site, check-list avant publication. */
export function EventEditor({ event }: { event: EventDetail | null }) {
  const { t, intl, label } = useI18n();
  const x = t.eventsAdmin;
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(event));
  const [cover, setCover] = useState<File | null>(null);
  const [recap, setRecap] = useState<File | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const coverUrl = useMemo(() => (cover ? URL.createObjectURL(cover) : event?.cover_image ?? null), [cover, event]);
  const recapUrl = useMemo(() => (recap ? URL.createObjectURL(recap) : event?.recap_image ?? null), [recap, event]);
  useEffect(() => () => { if (cover && coverUrl) URL.revokeObjectURL(coverUrl); }, [cover, coverUrl]);
  useEffect(() => () => { if (recap && recapUrl) URL.revokeObjectURL(recapUrl); }, [recap, recapUrl]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: (publish: boolean) => {
      const data = new FormData();
      const showPlace = form.format !== "online";
      const showLink = form.format !== "onsite";
      const values: Record<string, string> = {
        title: form.title,
        description: form.description,
        event_type: form.event_type,
        start_date: form.start_date,
        end_date: form.end_date,
        registration_deadline: form.registration_deadline,
        location: showPlace ? form.location : "",
        online_link: showLink ? form.online_link : "",
        max_participants: form.max_participants,
        is_published: String(publish),
      };
      // Chaîne vide = valeur effacée (nulle) côté API pour les champs optionnels.
      Object.entries(values).forEach(([k, v]) => data.append(k, v));
      if (cover) data.append("cover_image", cover);
      if (recap) data.append("recap_image", recap);
      const request = event ? eventsService.update(event.id, data) : eventsService.create(data);
      return request.then((r) => r.data as EventDetail);
    },
    onSuccess: (data, publish) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event", data.id] });
      setForm((f) => ({ ...f, is_published: publish }));
      setDirty(false);
      setCover(null);
      setRecap(null);
      setSavedAt(new Date());
      if (!event) router.replace(`/manage/events/${data.id}/edit`);
    },
  });

  const checks = {
    title: !!form.title.trim() && !!form.description.trim(),
    date: !!form.start_date,
    place: form.format === "online" ? !!form.online_link : form.format === "hybrid" ? !!form.location && !!form.online_link : !!form.location,
    cover: !!coverUrl,
  };
  const canSave = !!form.title.trim() && !!form.description.trim() && !!form.start_date;

  const start = form.start_date ? new Date(form.start_date) : null;
  const status = save.isPending ? t.common.saving : dirty ? x.unsaved
    : savedAt ? x.savedAt(savedAt.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })) : "";

  return (
    <div className="space-y-6">
      {/* Barre d'actions */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <Link href="/manage/events" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-brand-blue">
            <ArrowLeft size={14} /> {x.back}
          </Link>
          <h1 className="font-display text-[26px] font-extrabold tracking-tight text-fg mt-1">{event ? x.editTitle : x.newTitle}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status && <span className={cn("text-xs mr-1", dirty ? "text-orange-700 dark:text-orange-300" : "text-fg-muted")}>{status}</span>}
          {form.is_published ? (
            <>
              <button onClick={() => save.mutate(false)} disabled={!canSave || save.isPending}
                className="h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted disabled:opacity-50">{x.unpublish}</button>
              <button onClick={() => save.mutate(true)} disabled={!canSave || save.isPending}
                className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50">{x.save}</button>
            </>
          ) : (
            <>
              <button onClick={() => save.mutate(false)} disabled={!canSave || save.isPending}
                className="h-11 px-4 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted disabled:opacity-50">{x.saveDraft}</button>
              <button onClick={() => save.mutate(true)} disabled={!canSave || save.isPending}
                className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50">{x.publish}</button>
            </>
          )}
        </div>
      </header>
      {save.isError && <p className="text-sm text-red-600" role="alert">{apiError(save.error, t.common.error)}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-5">
          {/* Couverture */}
          <ImageDrop
            url={coverUrl} onFile={(f) => { setCover(f); setDirty(true); }}
            title={coverUrl ? x.coverChange : x.coverAdd} hint={x.coverHint} tall
          />

          {/* L'essentiel */}
          <Card title={x.essentials}>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder={x.titlePlaceholder} aria-label={x.titlePlaceholder}
              className="w-full bg-transparent border-0 border-b-2 border-line-soft focus:border-brand-blue pb-2 font-display text-2xl font-extrabold text-fg placeholder:text-fg-faint focus:outline-none" />
            <div>
              <p className="text-xs text-fg-muted mb-2">{x.type}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={x.type}>
                {EVENT_TYPES.map((type) => (
                  <button key={type} type="button" role="radio" aria-checked={form.event_type === type} onClick={() => set("event_type", type)}
                    className={cn("h-9 px-4 rounded-full text-sm font-semibold transition-colors",
                      form.event_type === type ? "bg-fg text-surface" : "bg-surface-muted text-fg-soft hover:bg-surface-strong")}>
                    {label.eventType(type)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-fg-muted mb-2">{x.description}</p>
              <RichTextEditor value={form.description} onChange={(html) => set("description", html)}
                placeholder={x.descriptionPlaceholder} label={x.description} minHeight={140} />
            </div>
          </Card>

          {/* Quand et où */}
          <Card title={x.whenWhere}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={`${x.start} *`} id="ev-start">
                <input id="ev-start" type="datetime-local" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} className={field} />
              </Field>
              <Field label={x.end} id="ev-end">
                <input id="ev-end" type="datetime-local" value={form.end_date} min={form.start_date || undefined} onChange={(e) => set("end_date", e.target.value)} className={field} />
              </Field>
            </div>
            <div>
              <p className="text-xs text-fg-muted mb-2">{x.format}</p>
              <div role="radiogroup" aria-label={x.format} className="grid grid-cols-3 gap-1 bg-surface-muted rounded-2xl p-1">
                {(["onsite", "online", "hybrid"] as Format[]).map((f) => (
                  <button key={f} type="button" role="radio" aria-checked={form.format === f} onClick={() => set("format", f)}
                    className={cn("h-10 rounded-xl text-sm transition-all", form.format === f ? "bg-surface shadow-sm font-bold text-fg" : "text-fg-muted hover:text-fg")}>
                    {x.formats[f]}
                  </button>
                ))}
              </div>
            </div>
            {form.format !== "online" && (
              <Field label={x.location} id="ev-location">
                <input id="ev-location" value={form.location} onChange={(e) => set("location", e.target.value)} placeholder={x.locationPlaceholder} className={field} />
              </Field>
            )}
            {form.format !== "onsite" && (
              <Field label={x.link} id="ev-link">
                <input id="ev-link" type="url" value={form.online_link} onChange={(e) => set("online_link", e.target.value)} placeholder="https://meet.google.com/…" className={field} />
              </Field>
            )}
          </Card>

          {/* Inscriptions */}
          <Card title={x.registrations}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={x.capacity} id="ev-capacity" hint={x.capacityHint}>
                <input id="ev-capacity" type="number" min={1} value={form.max_participants} onChange={(e) => set("max_participants", e.target.value)} className={field} />
              </Field>
              <Field label={x.deadline} id="ev-deadline">
                <input id="ev-deadline" type="datetime-local" value={form.registration_deadline} max={form.start_date || undefined}
                  onChange={(e) => set("registration_deadline", e.target.value)} className={field} />
              </Field>
            </div>
          </Card>

          {/* Après l'événement (modification seulement) */}
          {event && (
            <Card title={x.after}>
              <p className="text-sm text-fg-muted -mt-1">{x.recapHint}</p>
              <ImageDrop url={recapUrl} onFile={(f) => { setRecap(f); setDirty(true); }} title={recapUrl ? x.coverChange : x.recap} hint={x.coverHint} />
            </Card>
          )}
        </div>

        {/* Aperçu + check-list */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">{x.preview}</p>
          <div className="bg-surface rounded-3xl shadow-sm overflow-hidden">
            <div className="relative h-40 bg-univers-brand overflow-hidden">
              {coverUrl ? <img src={coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <NetworkPattern className="opacity-80" />}
              {start && (
                <span className="absolute top-3 left-3 bg-white rounded-xl px-2.5 py-1.5 text-center shadow-md">
                  <span className="block font-display text-lg font-extrabold leading-none text-ink">{start.getDate()}</span>
                  <span className="block text-[10px] font-bold uppercase text-brand-orange">{start.toLocaleDateString(intl, { month: "short" })}</span>
                </span>
              )}
            </div>
            <div className="p-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{label.eventType(form.event_type)}</p>
              <p className="font-display font-extrabold text-fg mt-1">{form.title || x.titlePlaceholder}</p>
              <p className="text-sm text-fg-muted mt-1">
                {form.format === "online" ? x.formats.online : form.location || x.tbd}
                {form.max_participants && ` · ${x.ofSeats(Number(form.max_participants))}`}
              </p>
              <span className="mt-4 h-10 rounded-xl bg-brand-orange text-ink text-sm font-bold flex items-center justify-center">{x.register}</span>
            </div>
          </div>
          <div className="bg-surface rounded-3xl shadow-sm p-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{x.checklist}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {(["title", "date", "place", "cover"] as const).map((k) => (
                <li key={k} className={cn("flex items-center gap-2", checks[k] ? "text-green-700 dark:text-green-400" : k === "cover" ? "text-orange-800 dark:text-orange-300" : "text-fg-muted")}>
                  {checks[k] ? <Check size={15} /> : <Circle size={15} />} {x.checks[k]}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface rounded-3xl shadow-sm p-6 space-y-5">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs text-fg-muted mb-1.5">
        <span>{label}</span>{hint && <span className="text-fg-subtle">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

/** Zone de dépôt d'image (glisser-déposer ou clic), avec aperçu. */
function ImageDrop({ url, onFile, title, hint, tall = false }: {
  url: string | null; onFile: (f: File) => void; title: string; hint: string; tall?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f?.type.startsWith("image/")) onFile(f); }}
      className={cn("relative block rounded-3xl overflow-hidden cursor-pointer group", tall ? "h-56" : "h-44",
        url ? "shadow-sm" : cn("border-2 border-dashed", dragging ? "border-brand-blue bg-brand-blue/10" : "border-brand-blue/30 bg-brand-blue/[0.03] hover:bg-brand-blue/[0.06]"))}
    >
      {url ? (
        <>
          <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <span className="absolute bottom-3 right-3 h-9 px-3.5 rounded-xl bg-white/95 text-ink text-sm font-semibold inline-flex items-center gap-2 shadow-md">
            <ImagePlus size={15} /> {title}
          </span>
        </>
      ) : (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
          <span className="w-12 h-12 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center"><ImagePlus size={22} /></span>
          <b className="text-sm text-fg">{title}</b>
          <span className="text-xs text-fg-muted">{hint}</span>
        </span>
      )}
      <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
    </label>
  );
}
