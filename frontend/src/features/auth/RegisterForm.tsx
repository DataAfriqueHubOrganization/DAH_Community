"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRegister } from "@/hooks/useAuth";
import { makeRegisterSchema, type RegisterInput } from "./schemas";
import { useI18n } from "@/i18n/I18nProvider";

export function RegisterForm() {
  const { t } = useI18n();
  const STEPS = t.auth.registerSteps;
  const schema = useMemo(() => makeRegisterSchema(t.validation), [t]);
  const [step, setStep] = useState(0);
  const register = useRegister();
  const {
    register: field,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(schema) });

  async function nextStep() {
    const fields: (keyof RegisterInput)[][] = [
      ["first_name", "last_name", "phone"],
      ["email", "password", "password_confirm"],
    ];
    const valid = await trigger(fields[step]);
    if (valid) setStep((s) => s + 1);
  }

  return (
    <form onSubmit={handleSubmit((data) => register.mutate(data))} className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center justify-between mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i <= step ? "bg-brand-blue text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i <= step ? "text-fg font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      {/* Étape 1 — Identité */}
      {step === 0 && (
        <>
          <Field label={t.eventForm.firstName} error={errors.first_name?.message}>
            <input {...field("first_name")} placeholder="Merveille" className={inputCls} />
          </Field>
          <Field label={t.eventForm.lastName} error={errors.last_name?.message}>
            <input {...field("last_name")} placeholder="Houenagnon" className={inputCls} />
          </Field>
          <Field label={`${t.candidature.phone} (${t.common.optional})`} error={errors.phone?.message}>
            <input {...field("phone")} placeholder="+229 61 00 00 00" className={inputCls} />
          </Field>
        </>
      )}

      {/* Étape 2 — Compte */}
      {step === 1 && (
        <>
          <Field label={t.auth.email} error={errors.email?.message}>
            <input type="email" {...field("email")} placeholder={t.eventForm.emailPlaceholder} className={inputCls} />
          </Field>
          <Field label={t.auth.password} error={errors.password?.message}>
            <input type="password" {...field("password")} placeholder={t.auth.passwordMinPlaceholder} className={inputCls} />
          </Field>
          <Field label={t.auth.confirmPassword} error={errors.password_confirm?.message}>
            <input type="password" {...field("password_confirm")} placeholder="••••••••" className={inputCls} />
          </Field>
        </>
      )}

      {/* Étape 3 — Confirmation */}
      {step === 2 && (
        <div className="text-center py-4">
          <div className="text-4xl mb-3">✉️</div>
          <p className="text-sm text-muted-foreground">
            {t.auth.registerConfirmBefore} <strong>{t.auth.createAccount}</strong> {t.auth.registerConfirmAfter}
          </p>
        </div>
      )}

      {register.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {t.auth.registerError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 border border-border rounded-lg py-2.5 text-sm font-medium hover:bg-muted transition-colors"
          >
            {t.common.back}
          </button>
        )}
        {step < 2 ? (
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
            disabled={register.isPending}
            className="flex-1 bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
          >
            {register.isPending ? t.auth.creating : t.auth.createAccount}
          </button>
        )}
      </div>
    </form>
  );
}

const inputCls = "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue";

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium text-fg mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
