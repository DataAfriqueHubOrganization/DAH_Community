"use client";

import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLogin } from "@/hooks/useAuth";
import { makeLoginSchema, type LoginInput } from "./schemas";
import { useI18n } from "@/i18n/I18nProvider";

export function LoginForm() {
  const login = useLogin();
  const { t } = useI18n();
  const schema = useMemo(() => makeLoginSchema(t.validation), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit((data) => login.mutate(data))} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-fg mb-1">
          {t.auth.email}
        </label>
        <input
          id="login-email"
          type="email"
          {...register("email")}
          placeholder={t.eventForm.emailPlaceholder}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        {errors.email && (
          <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-fg mb-1">
          {t.auth.password}
        </label>
        <input
          id="login-password"
          type="password"
          {...register("password")}
          placeholder="••••••••"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue"
        />
        {errors.password && (
          <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
        )}
      </div>

      {login.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {t.auth.invalidCredentials}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || login.isPending}
        className="w-full bg-brand-blue text-white rounded-lg py-2.5 text-sm font-medium hover:bg-brand-blue/90 disabled:opacity-50 transition-colors"
      >
        {login.isPending ? t.auth.loggingIn : t.nav.login}
      </button>
    </form>
  );
}
