"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { eventsService } from "@/services/events.service";
import { makeEventRegistrationSchema, type EventRegistrationInput } from "@/features/events/schemas";
import { AFRICAN_COUNTRIES, OTHER_COUNTRIES, sortedCountries } from "@/lib/countries";
import { useI18n } from "@/i18n/I18nProvider";

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return (detail[0] as string) || fallback;
  if (typeof detail === "object") {
    const firstKey = Object.keys(detail as Record<string, unknown>)[0];
    const firstValue = firstKey ? (detail as Record<string, unknown>)[firstKey] : undefined;
    if (Array.isArray(firstValue)) return (firstValue[0] as string) || fallback;
    if (typeof firstValue === "string") return firstValue;
  }
  return fallback;
}

export function EventRegistrationForm({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { t, locale } = useI18n();
  const schema = useMemo(() => makeEventRegistrationSchema(t.validation), [t]);
  const [lookupDone, setLookupDone] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EventRegistrationInput>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: (data: EventRegistrationInput) => eventsService.register(eventId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event", eventId] }),
  });

  if (mutation.isSuccess) {
    return (
      <div className="text-center">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check size={24} className="text-green-600" />
        </div>
        <p className="font-semibold text-fg mb-1">{t.eventDetail.youAreRegistered}</p>
        <p className="text-fg-muted text-sm">{t.eventDetail.reminder}</p>
      </div>
    );
  }

  async function handleEmailBlur() {
    const email = getValues("email");
    if (!email || lookupDone) return;
    try {
      const { data, status } = await eventsService.lookupParticipant(email);
      if (status === 200 && data) {
        setValue("first_name", data.first_name);
        setValue("last_name", data.last_name);
        setValue("nationality", data.nationality);
        setValue("organisation", data.organisation);
        setValue("profession", data.profession);
      }
    } catch {
      // pas de correspondance : la personne remplit le formulaire elle-même
    } finally {
      setLookupDone(true);
    }
  }

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <input
          type="email"
          {...register("email", { onBlur: handleEmailBlur })}
          placeholder={t.eventForm.emailPlaceholder}
          aria-label={t.common.email}
          className={inputCls}
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input {...register("first_name")} placeholder={t.eventForm.firstName} aria-label={t.eventForm.firstName} className={inputCls} />
          {errors.first_name && (
            <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>
          )}
        </div>
        <div>
          <input {...register("last_name")} placeholder={t.eventForm.lastName} aria-label={t.eventForm.lastName} className={inputCls} />
          {errors.last_name && (
            <p className="text-red-500 text-xs mt-1">{errors.last_name.message}</p>
          )}
        </div>
      </div>
      <div>
        <select {...register("nationality")} defaultValue="" className={`${inputCls} bg-surface`} aria-label={t.eventForm.nationality}>
          <option value="" disabled>{t.eventForm.nationality}</option>
          <optgroup label={t.eventForm.africa}>
            {sortedCountries(AFRICAN_COUNTRIES, locale).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </optgroup>
          <optgroup label={t.eventForm.otherCountries}>
            {sortedCountries(OTHER_COUNTRIES, locale).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </optgroup>
        </select>
        {errors.nationality && (
          <p className="text-red-500 text-xs mt-1">{errors.nationality.message}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input {...register("organisation")} placeholder={t.eventForm.organisation} aria-label={t.eventForm.organisation} className={inputCls} />
          {errors.organisation && (
            <p className="text-red-500 text-xs mt-1">{errors.organisation.message}</p>
          )}
        </div>
        <div>
          <input {...register("profession")} placeholder={t.eventForm.profession} aria-label={t.eventForm.profession} className={inputCls} />
          {errors.profession && (
            <p className="text-red-500 text-xs mt-1">{errors.profession.message}</p>
          )}
        </div>
      </div>
      <div>
        <textarea
          {...register("motivation")}
          rows={3}
          placeholder={t.eventForm.motivation}
          aria-label={t.eventForm.motivation}
          className={`${inputCls} resize-none`}
        />
        {errors.motivation && (
          <p className="text-red-500 text-xs mt-1">{errors.motivation.message}</p>
        )}
      </div>

      {mutation.isError && (
        <p className="text-red-500 text-xs">{extractErrorMessage(mutation.error, t.eventForm.genericError)}</p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 bg-brand-blue text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-60"
      >
        {mutation.isPending ? t.eventForm.submitting : t.eventForm.submit}
      </button>
    </form>
  );
}
