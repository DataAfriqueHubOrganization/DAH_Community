"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { eventsService } from "@/services/events.service";
import { toDatetimeLocalValue } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/Badge";
import { Plus, CalendarDays, Edit2, Trash2, Users, Eye, EyeOff, X, Download } from "lucide-react";
import { isBureau } from "@/types/auth.types";
import Link from "next/link";
import type { Event, EventDetail, EventWritePayload, EventType } from "@/types/events.types";

const EVENT_TYPES: EventType[] = ["webinaire", "conference", "atelier", "hackathon", "meetup", "formation", "autre"];

const emptyForm: EventWritePayload = {
  title: "", description: "", event_type: "webinaire", start_date: "",
  end_date: "", registration_deadline: "", location: "", online_link: "",
  max_participants: undefined, is_published: false,
};

function eventToForm(event: EventDetail): EventWritePayload {
  return {
    title: event.title,
    description: event.description,
    event_type: event.event_type,
    start_date: toDatetimeLocalValue(event.start_date),
    end_date: toDatetimeLocalValue(event.end_date),
    registration_deadline: toDatetimeLocalValue(event.registration_deadline),
    location: event.location,
    online_link: event.online_link,
    max_participants: event.max_participants ?? undefined,
    is_published: event.is_published,
  };
}

export default function EventsManagePage() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const { t } = useI18n();
  const x = t.manageEvents;
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDetail | null>(null);
  const [form, setForm] = useState<EventWritePayload>(emptyForm);

  const canManage = isBureau(user);

  const { data, isLoading } = useQuery({
    queryKey: ["events", "manage"],
    queryFn: () => eventsService.list().then((r) => r.data),
  });

  const createEvent = useMutation({
    mutationFn: (data: EventWritePayload | FormData) => eventsService.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); closeForm(); },
  });

  const updateEvent = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EventWritePayload> | FormData }) => eventsService.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); },
  });

  const deleteEvent = useMutation({
    mutationFn: (id: string) => eventsService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  function closeForm() {
    setShowForm(false);
    setEditingEvent(null);
    setForm(emptyForm);
  }

  function openCreateForm() {
    setEditingEvent(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  async function openEditForm(eventId: string) {
    const { data: full } = await eventsService.get(eventId);
    setEditingEvent(full);
    setForm(eventToForm(full));
    setShowForm(true);
  }

  function handleFormSubmit(payload: EventWritePayload | FormData) {
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, data: payload }, { onSuccess: closeForm });
    } else {
      createEvent.mutate(payload);
    }
  }

  function togglePublish(event: Event) {
    updateEvent.mutate({ id: event.id, data: { is_published: !event.is_published } });
  }

  const all: Event[] = data?.results ?? data ?? [];
  const now = new Date();
  const upcoming = all.filter(e => new Date(e.start_date) >= now);
  const past = all.filter(e => new Date(e.start_date) < now);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t.sidebar.events}</h1>
          <p className="text-fg-muted text-sm mt-1">{x.total(all.length)}</p>
        </div>
        {canManage && (
          <button onClick={openCreateForm} className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">
            <Plus size={16} /> {x.create}
          </button>
        )}
      </div>

      {/* Formulaire création / édition */}
      {showForm && (
        <div className="bg-surface rounded-2xl border border-brand-blue/20 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">
              {editingEvent ? x.editTitle(editingEvent.title) : x.newEvent}
            </h2>
            <button onClick={closeForm} aria-label={t.common.close} className="text-fg-subtle hover:text-fg-soft"><X size={18} /></button>
          </div>
          <EventForm
            form={form}
            setForm={setForm}
            onSubmit={handleFormSubmit}
            isPending={editingEvent ? updateEvent.isPending : createEvent.isPending}
            submitLabel={editingEvent ? x.saveChanges : x.createSubmit}
            pendingLabel={editingEvent ? t.common.saving : t.auth.creating}
            existingCoverImage={editingEvent?.cover_image ?? null}
            existingRecapImage={editingEvent?.recap_image ?? null}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-surface rounded-xl border border-line-soft p-5 h-20 animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Événements à venir */}
          <Section title={t.events.upcoming} count={upcoming.length}>
            {upcoming.map(event => (
              <EventRow key={event.id} event={event} canManage={!!canManage}
                onTogglePublish={() => togglePublish(event)}
                onDelete={() => { if (confirm(x.confirmDelete)) deleteEvent.mutate(event.id); }}
                onEdit={() => openEditForm(event.id)}
              />
            ))}
          </Section>
          <Section title={t.events.past} count={past.length}>
            {past.map(event => (
              <EventRow key={event.id} event={event} canManage={!!canManage}
                onTogglePublish={() => togglePublish(event)}
                onDelete={() => { if (confirm(x.confirmDelete)) deleteEvent.mutate(event.id); }}
                onEdit={() => openEditForm(event.id)}
              />
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div>
      <h2 className="font-medium text-fg-muted text-sm uppercase tracking-wide mb-3">{title} ({count})</h2>
      {count === 0 ? <p className="text-fg-subtle text-sm py-4 text-center bg-surface rounded-xl border border-line-soft">{t.manageEvents.none}</p> : <div className="space-y-3">{children}</div>}
    </div>
  );
}

function EventRow({ event, canManage, onTogglePublish, onDelete, onEdit }: {
  event: Event; canManage: boolean;
  onTogglePublish: () => void; onDelete: () => void; onEdit: () => void;
}) {
  const { t, fmt, label } = useI18n();
  const x = t.manageEvents;

  function handleExport() {
    eventsService.export(event.id).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data as BlobPart]));
      const a = document.createElement("a");
      a.href = url;
      a.download = `participants_${event.id}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="bg-surface rounded-xl border border-line-soft p-4 flex items-center gap-4 group">
      <div className="w-10 h-10 rounded-xl bg-brand-blue/10 flex items-center justify-center shrink-0">
        <CalendarDays size={18} className="text-fg" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-fg text-sm truncate">{event.title}</p>
        <div className="flex items-center flex-wrap gap-2 mt-1">
          <Badge variant={event.is_published ? "green" : "gray"}>{event.is_published ? x.published : x.draft}</Badge>
          <span className="text-xs text-fg-subtle">{label.eventType(event.event_type)}</span>
          <span className="text-xs text-fg-subtle">{fmt.dateTime(event.start_date)}</span>
          <span className="text-xs text-fg-subtle flex items-center gap-1"><Users size={10} /> {event.participant_count}</span>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {canManage && <>
          <Link href={`/manage/events/${event.id}/participants`} title={x.participants} aria-label={x.participants} className="p-2 text-fg-subtle hover:text-brand-blue rounded-lg hover:bg-surface-muted">
            <Users size={16} />
          </Link>
          <button onClick={handleExport} title={x.exportExcel} aria-label={x.exportExcel} className="p-2 text-fg-subtle hover:text-brand-blue rounded-lg hover:bg-surface-muted">
            <Download size={16} />
          </button>
          <button onClick={onTogglePublish} title={event.is_published ? x.unpublish : x.publish} aria-label={event.is_published ? x.unpublish : x.publish} className="p-2 text-fg-subtle hover:text-brand-blue rounded-lg hover:bg-surface-muted">
            {event.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={onEdit} title={t.common.edit} aria-label={t.common.edit} className="p-2 text-fg-subtle hover:text-brand-blue rounded-lg hover:bg-surface-muted"><Edit2 size={16} /></button>
          <button onClick={onDelete} title={t.common.delete} aria-label={t.common.delete} className="p-2 text-fg-subtle hover:text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>
        </>}
      </div>
    </div>
  );
}

const fileInputCls = "w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-blue/10 file:text-brand-blue file:text-sm file:font-medium hover:file:bg-brand-blue/20 border border-line rounded-xl";

function EventForm({ form, setForm, onSubmit, isPending, submitLabel, pendingLabel, existingCoverImage, existingRecapImage }: {
  form: EventWritePayload;
  setForm: React.Dispatch<React.SetStateAction<EventWritePayload>>;
  onSubmit: (payload: EventWritePayload | FormData) => void;
  isPending: boolean;
  submitLabel: string;
  pendingLabel: string;
  existingCoverImage: string | null;
  existingRecapImage: string | null;
}) {
  const { t, label } = useI18n();
  const x = t.manageEvents;
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [recapFile, setRecapFile] = useState<File | null>(null);

  function handleSubmit() {
    if (!coverFile && !recapFile) {
      onSubmit(form);
      return;
    }
    const formData = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") formData.append(key, String(value));
    });
    if (coverFile) formData.append("cover_image", coverFile);
    if (recapFile) formData.append("recap_image", recapFile);
    onSubmit(formData);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <input placeholder={`${x.title} *`} aria-label={x.title} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <textarea placeholder={`${x.description} *`} aria-label={x.description} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={3} className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
      <select value={form.event_type} aria-label={x.type} onChange={e => setForm(f => ({...f, event_type: e.target.value as EventType}))} className="border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 bg-surface">
        {EVENT_TYPES.map(type => <option key={type} value={type}>{label.eventType(type)}</option>)}
      </select>
      <input type="number" placeholder={x.maxParticipants} aria-label={x.maxParticipants} value={form.max_participants ?? ""} onChange={e => setForm(f => ({...f, max_participants: e.target.value ? parseInt(e.target.value) : undefined}))} className="border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <div><label className="block text-xs text-fg-muted mb-1">{x.startDate} *</label><input type="datetime-local" aria-label={x.startDate} value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
      <div><label className="block text-xs text-fg-muted mb-1">{x.endDate}</label><input type="datetime-local" aria-label={x.endDate} value={form.end_date ?? ""} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
      <div><label className="block text-xs text-fg-muted mb-1">{x.deadline}</label><input type="datetime-local" aria-label={x.deadline} value={form.registration_deadline ?? ""} onChange={e => setForm(f => ({...f, registration_deadline: e.target.value}))} className="w-full border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" /></div>
      <input placeholder={x.location} aria-label={x.location} value={form.location ?? ""} onChange={e => setForm(f => ({...f, location: e.target.value}))} className="border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <input type="url" placeholder={x.onlineLink} aria-label={x.onlineLink} value={form.online_link ?? ""} onChange={e => setForm(f => ({...f, online_link: e.target.value}))} className="sm:col-span-2 border border-line rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
      <div>
        <label className="block text-xs text-fg-muted mb-1">{x.coverImage}</label>
        {existingCoverImage && !coverFile && (
          <img src={existingCoverImage} alt={x.currentCover} className="w-full h-24 object-cover rounded-lg mb-2 border border-line" />
        )}
        <input type="file" accept="image/*" aria-label={x.coverImage} onChange={e => setCoverFile(e.target.files?.[0] ?? null)} className={fileInputCls} />
      </div>
      <div>
        <label className="block text-xs text-fg-muted mb-1">{x.recapImage}</label>
        {existingRecapImage && !recapFile && (
          <img src={existingRecapImage} alt={x.currentRecap} className="w-full h-24 object-cover rounded-lg mb-2 border border-line" />
        )}
        <input type="file" accept="image/*" aria-label={x.recapImage} onChange={e => setRecapFile(e.target.files?.[0] ?? null)} className={fileInputCls} />
      </div>
      <label className="flex items-center gap-2 text-sm text-fg-soft sm:col-span-2">
        <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({...f, is_published: e.target.checked}))} className="rounded" />
        {x.publishNow}
      </label>
      <div className="sm:col-span-2 flex justify-end">
        <button onClick={handleSubmit} disabled={isPending || !form.title || !form.description || !form.start_date} className="px-6 py-2.5 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isPending ? pendingLabel : submitLabel}
        </button>
      </div>
    </div>
  );
}
