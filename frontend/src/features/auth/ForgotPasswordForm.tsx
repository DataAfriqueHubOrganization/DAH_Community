"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { makeForgotPasswordSchema, type ForgotPasswordInput } from "./schemas";
import { useI18n } from "@/i18n/I18nProvider";

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const { t } = useI18n();
  const schema = useMemo(() => makeForgotPasswordSchema(t.validation), [t]);
  const mutation = useMutation({
    mutationFn: (data: ForgotPasswordInput) => authService.requestPasswordReset(data.email),
    onSuccess: () => setSent(true),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(schema),
  });

  if (sent) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">📧</div>
        <p className="text-sm text-muted-foreground">
          {t.auth.resetLinkSent}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div>
        <label htmlFor="forgot-email" className="block text-sm font-medium text-fg mb-1">{t.auth.email}</label>
        <input
          id="forgot-email"
          type="email"
          {...register("email")}
          placeholder={t.eventForm.emailPlaceholder}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? t.common.sending : t.auth.sendLink}
      </button>
    </form>
  );
}
