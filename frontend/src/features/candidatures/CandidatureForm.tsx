"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { membershipsService } from "@/services/memberships.service";
import { makeCandidatureSchema, ENGAGEMENTS, POLES, type CandidatureInput } from "@/features/auth/schemas";
import { AFRICAN_COUNTRIES, OTHER_COUNTRIES, sortedCountries } from "@/lib/countries";
import { useI18n } from "@/i18n/I18nProvider";
import { CheckCircle2, FileText, X } from "lucide-react";

const MAX_CV_SIZE = 5 * 1024 * 1024; // 5 Mo

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as {
    response?: { data?: { detail?: Record<string, string[]> | string } };
  })?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  const firstKey = Object.keys(detail)[0];
  return (firstKey && detail[firstKey]?.[0]) || fallback;
}

const inputCls =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-fg mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-fg-subtle text-xs mt-1">{hint}</p>}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

export function CandidatureForm() {
  const { t, locale } = useI18n();
  const c = t.candidature;
  const STEPS = c.steps;
  const schema = useMemo(() => makeCandidatureSchema(t.validation), [t]);
  const [step, setStep] = useState(0);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvError, setCvError] = useState("");

  const mutation = useMutation({
    mutationFn: (data: CandidatureInput) => {
      if (!cvFile) return membershipsService.submitCandidature(data);
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        // Listes (engagements, pôles) : une entrée par valeur, lue côté API comme une liste.
        if (Array.isArray(value)) value.forEach((v) => formData.append(key, v));
        else formData.append(key, value);
      });
      formData.append("cv", cvFile);
      return membershipsService.submitCandidature(formData);
    },
  });

  function handleCvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setCvFile(null);
      setCvError("");
      return;
    }
    if (file.type !== "application/pdf") {
      setCvError(c.cvMustBePdf);
      setCvFile(null);
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      setCvError(c.cvTooLarge);
      setCvFile(null);
      return;
    }
    setCvError("");
    setCvFile(file);
  }

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<CandidatureInput>({
    resolver: zodResolver(schema),
    defaultValues: { engagements: [], volunteer_poles: [] },
  });

  const motivation = watch("motivation") ?? "";
  const engagements = watch("engagements") ?? [];
  const wantsToVolunteer = engagements.includes("volunteer");

  // Champs validés avant de passer à l'étape suivante
  const STEP_FIELDS: (keyof CandidatureInput)[][] = [
    ["first_name", "last_name", "email", "phone"],
    ["country", "profession", "linkedin_url", "motivation"],
  ];
  const lastStep = STEPS.length - 1;

  async function nextStep() {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep((s) => s + 1);
  }

  if (mutation.isSuccess) {
    return (
      <div className="text-center py-6 space-y-4">
        <CheckCircle2 size={48} className="text-green-500 mx-auto" />
        <h3 className="text-lg font-semibold text-fg">{c.successTitle}</h3>
        <p className="text-sm text-fg-muted leading-relaxed">{c.successText}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i <= step
                  ? "bg-brand-blue text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                i <= step ? "text-fg font-medium" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px bg-border" />
            )}
          </div>
        ))}
      </div>

      {/* Étape 1 — Identité */}
      {step === 0 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`${t.eventForm.firstName} *`} error={errors.first_name?.message}>
              <input {...register("first_name")} placeholder="Merveille" className={inputCls} />
            </Field>
            <Field label={`${t.eventForm.lastName} *`} error={errors.last_name?.message}>
              <input {...register("last_name")} placeholder="Houenagnon" className={inputCls} />
            </Field>
          </div>
          <Field label={`${c.email} *`} error={errors.email?.message}>
            <input type="email" {...register("email")} placeholder={t.eventForm.emailPlaceholder} className={inputCls} />
          </Field>
          <Field label={c.phone} error={errors.phone?.message} hint={c.optional}>
            <input {...register("phone")} placeholder="+229 61 00 00 00" className={inputCls} />
          </Field>
        </>
      )}

      {/* Étape 2 — Profil & Motivation */}
      {step === 1 && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Field label={`${c.country} *`} error={errors.country?.message}>
              <select {...register("country")} defaultValue="" className={`${inputCls} bg-surface`}>
                <option value="" disabled>{c.selectCountry}</option>
                <optgroup label={t.eventForm.africa}>
                  {sortedCountries(AFRICAN_COUNTRIES, locale).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
                <optgroup label={t.eventForm.otherCountries}>
                  {sortedCountries(OTHER_COUNTRIES, locale).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label={`${t.eventForm.profession} *`} error={errors.profession?.message}>
              <input {...register("profession")} placeholder="Data Scientist" className={inputCls} />
            </Field>
          </div>
          <Field label="LinkedIn" error={errors.linkedin_url?.message} hint={c.optional}>
            <input
              {...register("linkedin_url")}
              placeholder="https://linkedin.com/in/..."
              className={inputCls}
            />
          </Field>
          <Field
            label={`${c.motivationLabel} *`}
            error={errors.motivation?.message}
          >
            <textarea
              {...register("motivation")}
              rows={5}
              placeholder={c.motivationPlaceholder}
              className={`${inputCls} resize-none`}
            />
            <p className={`text-xs mt-1 text-right ${motivation.length < 50 ? "text-fg-subtle" : "text-green-600"}`}>
              {c.motivationCount(motivation.length)}
            </p>
          </Field>

          <Field
            label={c.cv}
            error={cvError}
            hint={c.cvHint}
          >
            {cvFile ? (
              <div className="flex items-center justify-between gap-2 border border-border rounded-lg px-3 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-fg truncate">
                  <FileText size={16} className="text-brand-blue shrink-0" />
                  <span className="truncate">{cvFile.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setCvFile(null)}
                  aria-label={c.removeCv}
                  className="text-fg-subtle hover:text-red-500 shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="application/pdf"
                onChange={handleCvChange}
                className="w-full text-sm text-fg-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-blue/10 file:text-brand-blue file:text-sm file:font-medium hover:file:bg-brand-blue/20 border border-border rounded-lg"
              />
            )}
          </Field>
        </>
      )}

      {/* Étape 3 — Engagement */}
      {step === 2 && (
        <>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-fg mb-1">{c.engagementLabel} *</legend>
            <p className="text-fg-subtle text-xs -mt-1 mb-2">{c.engagementHint}</p>
            {ENGAGEMENTS.map((key) => (
              <label
                key={key}
                className="flex items-start gap-3 rounded-xl border border-border px-4 py-3 cursor-pointer transition-colors hover:bg-surface-muted has-[:checked]:border-brand-blue has-[:checked]:bg-brand-blue/5"
              >
                <input
                  type="checkbox"
                  value={key}
                  {...register("engagements")}
                  className="mt-1 h-4 w-4 shrink-0 accent-[#2F6FE0]"
                />
                <span>
                  <span className="block text-sm font-semibold text-fg">{c.engagements[key].label}</span>
                  <span className="block text-xs text-fg-muted mt-0.5">{c.engagements[key].desc}</span>
                </span>
              </label>
            ))}
            {errors.engagements && <p className="text-red-500 text-xs">{errors.engagements.message}</p>}
          </fieldset>

          {wantsToVolunteer && (
            <fieldset className="space-y-2 rounded-xl bg-brand-blue/5 border border-brand-blue/20 p-4">
              <legend className="sr-only">{c.polesLabel}</legend>
              <p className="text-sm font-medium text-fg">{c.polesLabel} *</p>
              <p className="text-fg-subtle text-xs">{c.polesHint}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {POLES.map((key) => (
                  <label
                    key={key}
                    className="flex items-start gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 cursor-pointer transition-colors has-[:checked]:border-brand-orange has-[:checked]:bg-brand-orange/10"
                  >
                    <input
                      type="checkbox"
                      value={key}
                      {...register("volunteer_poles")}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#FB7C2C]"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-fg">{c.poles[key].name}</span>
                      <span className="block text-xs text-fg-muted mt-0.5">{c.poles[key].desc}</span>
                    </span>
                  </label>
                ))}
              </div>
              {errors.volunteer_poles && <p className="text-red-500 text-xs">{errors.volunteer_poles.message}</p>}
            </fieldset>
          )}
        </>
      )}

      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {extractErrorMessage(mutation.error, t.eventForm.genericError)}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-1">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            ← {t.common.back}
          </button>
        )}
        {step < lastStep ? (
          <button
            type="button"
            onClick={nextStep}
            className="flex-1 bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-blue/90 transition-colors"
          >
            {t.common.next} →
          </button>
        ) : (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? c.submitting : c.submit}
          </button>
        )}
      </div>
    </form>
  );
}
