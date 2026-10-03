import { api } from "@/lib/axios";
import type {
  EventDetail, EventReminder, EventWritePayload, EventRegistrationPayload, ParticipantLookupResult,
  ParticipantWithEvent, ParticipantsFilter,
} from "@/types/events.types";

export const eventsService = {
  list: (params?: Record<string, string>) =>
    api.get("/events/", { params }),

  get: (id: string) =>
    api.get<EventDetail>(`/events/${id}/`),

  create: (data: EventWritePayload | FormData) =>
    api.post("/events/", data, {
      headers: data instanceof FormData ? { "Content-Type": undefined } : undefined,
    }),

  update: (id: string, data: Partial<EventWritePayload> | FormData) =>
    api.patch(`/events/${id}/`, data, {
      headers: data instanceof FormData ? { "Content-Type": undefined } : undefined,
    }),

  delete: (id: string) =>
    api.delete(`/events/${id}/`),

  register: (id: string, data: EventRegistrationPayload) =>
    api.post(`/events/${id}/register/`, data),

  lookupParticipant: (email: string) =>
    api.get<ParticipantLookupResult>("/events/participants/lookup/", { params: { email } }),

  participants: (id: string) =>
    api.get(`/events/${id}/participants/`),

  validatePresence: (eventId: string, participantId: number) =>
    api.post(`/events/${eventId}/validate/${participantId}/`),

  /** Tous les participants de tous les événements (bureau), par période ou par événements. */
  allParticipants: (filter: ParticipantsFilter) =>
    api.get<ParticipantWithEvent[]>("/events/participants/", { params: filter }),

  exportAllParticipants: (filter: ParticipantsFilter) =>
    api.get<Blob>("/events/participants/export/", { params: filter, responseType: "blob" }),

  /** Rappel par email aux inscrits (test=true : envoi à soi-même uniquement). */
  remind: (id: string, data: { subject: string; message: string; test?: boolean }) =>
    api.post<{ sent: number; test: boolean }>(`/events/${id}/remind/`, data),

  reminders: (id: string) => api.get<EventReminder[]>(`/events/${id}/reminders/`),

  export: (id: string) =>
    api.get(`/events/${id}/export/`, { responseType: "blob" }),
};
