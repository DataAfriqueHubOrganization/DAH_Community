"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { makeResetPasswordSchema, type ResetPasswordInput } from "./schemas";
import { useI18n } from "@/i18n/I18nProvider";
import Link from "next/link";

export function ResetPasswordForm({ token }: { token: string }) {
  const [done, setDone] = useState(false);
  const { t } = useI18n();
  const schema = useMemo(() => makeResetPasswordSchema(t.validation), [t]);

  const mutation = useMutation({
    mutationFn: (data: ResetPasswordInput) =>
      authService.confirmPasswordReset(token, data.new_password, data.new_password_confirm),
    onSuccess: () => setDone(true),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordInput>({
    resolver: zodResolver(schema),
  });

  if (done) {
    return (
      <div className="text-center py-4 space-y-3">
        <div className="text-4xl mb-2">✅</div>
        <p className="text-sm font-medium text-fg">{t.auth.resetDone}</p>
        <p className="text-sm text-muted-foreground">{t.auth.resetDoneText}</p>
        <Link href="/login" className="inline-block mt-2 px-6 py-2.5 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors">
          {t.nav.login}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      {mutation.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-600">
          {t.auth.resetInvalidLink}
        </div>
      )}
      <div>
        <label htmlFor="reset-password" className="block text-sm font-medium text-fg mb-1">{t.auth.newPassword}</label>
        <input
          id="reset-password"
          type="password"
          {...register("new_password")}
          placeholder={t.auth.passwordMinPlaceholder}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        {errors.new_password && <p className="text-red-500 text-xs mt-1">{errors.new_password.message}</p>}
      </div>
      <div>
        <label htmlFor="reset-password-confirm" className="block text-sm font-medium text-fg mb-1">{t.auth.confirmPassword}</label>
        <input
          id="reset-password-confirm"
          type="password"
          {...register("new_password_confirm")}
          placeholder={t.auth.repeatPassword}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        {errors.new_password_confirm && <p className="text-red-500 text-xs mt-1">{errors.new_password_confirm.message}</p>}
      </div>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
      >
        {mutation.isPending ? t.auth.resetting : t.auth.resetSubmit}
      </button>
    </form>
  );
}
