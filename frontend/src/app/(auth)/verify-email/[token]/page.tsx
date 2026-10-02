"use client";

import { use, useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import Link from "next/link";
import { useI18n } from "@/i18n/I18nProvider";

export default function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const { t } = useI18n();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    authService.verifyEmail(token)
      .then(() => {
        setStatus("success");
        // Redirection dure (pas une navigation Next.js) : force un rechargement
        // complet de page, donc un état 100% à jour côté dashboard, sans dépendre
        // du cache ou d'un mécanisme de synchronisation en arrière-plan.
        setTimeout(() => { window.location.href = "/dashboard"; }, 1500);
      })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <>
      <h2 className="text-xl font-semibold text-fg mb-1">{t.auth.verifyTitle}</h2>

      {status === "loading" && (
        <div className="text-center py-8">
          <div className="w-10 h-10 border-4 border-brand-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">{t.auth.verifying}</p>
        </div>
      )}

      {status === "success" && (
        <div className="text-center py-6 space-y-3">
          <div className="text-5xl mb-2">✅</div>
          <p className="text-sm font-medium text-fg">{t.auth.verified}</p>
          <p className="text-sm text-muted-foreground">{t.auth.accountActive}</p>
          <button
            onClick={() => { window.location.href = "/dashboard"; }}
            className="inline-block mt-3 px-6 py-2.5 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors"
          >
            {t.auth.goToDashboard}
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-6 space-y-3">
          <div className="text-5xl mb-2">❌</div>
          <p className="text-sm font-medium text-fg">{t.auth.invalidLink}</p>
          <p className="text-sm text-muted-foreground">
            {t.auth.invalidLinkText}
          </p>
          <Link href="/login" className="inline-block mt-3 px-6 py-2.5 bg-brand-blue text-white rounded-lg text-sm font-medium hover:bg-brand-blue/90 transition-colors">
            {t.auth.goToLogin}
          </Link>
        </div>
      )}
    </>
  );
}
