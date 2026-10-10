"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { MailX } from "lucide-react";
import { newsletterService } from "@/services/newsletter.service";
import { useI18n } from "@/i18n/I18nProvider";

/** Lien « Se désabonner » des emails de la newsletter. */
function Unsubscribe() {
  const { t } = useI18n();
  const x = t.newsletter;
  const token = useSearchParams().get("token") ?? "";
  const unsubscribe = useMutation({ mutationFn: () => newsletterService.unsubscribe(token) });
  const started = useRef(false);

  useEffect(() => {
    if (token && !started.current) {
      started.current = true;
      unsubscribe.mutate();
    }
  }, [token, unsubscribe]);

  const failed = !token || unsubscribe.isError;
  return (
    <div className="bg-page min-h-[60vh] flex items-center justify-center px-4 py-20">
      <div className="max-w-md w-full bg-surface rounded-2xl border border-line-soft p-8 text-center space-y-3">
        <MailX size={36} className="mx-auto text-brand-blue" aria-hidden="true" />
        <h1 className="font-display text-2xl font-extrabold text-fg">
          {failed ? x.invalidTitle : unsubscribe.isSuccess ? x.doneTitle : t.common.loading}
        </h1>
        <p role="status" className="text-sm text-fg-soft">
          {failed ? x.invalidText : unsubscribe.isSuccess ? x.doneText : ""}
        </p>
        <Link href="/" className="inline-block pt-2 text-sm font-semibold text-brand-blue hover:underline">{x.backHome}</Link>
      </div>
    </div>
  );
}

export default function NewsletterUnsubscribePage() {
  return <Suspense><Unsubscribe /></Suspense>;
}
