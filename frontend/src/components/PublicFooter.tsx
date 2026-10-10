"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { Logo } from "@/components/ui/Logo";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { useI18n } from "@/i18n/I18nProvider";
import { CONTACT_EMAIL, SOCIAL_LINKS } from "@/lib/site";
import { newsletterService } from "@/services/newsletter.service";
import { apiError } from "@/features/treasury/shared";

export function PublicFooter() {
  const year = new Date().getFullYear();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const subscribe = useMutation({
    mutationFn: () => newsletterService.subscribe(email.trim()),
    onSuccess: () => setEmail(""),
  });

  return (
    <footer className="relative overflow-hidden bg-univers text-white">
      <NetworkPattern className="opacity-60" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <Logo variant="full" tone="white" height={72} />
            <p className="mt-5 text-white/90 text-[15px] leading-relaxed max-w-sm">
              {t.footer.mission}
            </p>
            <div className="flex items-center gap-3 mt-6">
              {SOCIAL_LINKS.map(({ href, label, title }) => (
                <a
                  key={title}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  aria-label={title}
                  className="w-10 h-10 rounded-[10px] bg-white/10 border border-white/20 flex items-center justify-center hover:bg-brand-orange hover:border-brand-orange hover:text-ink transition-colors text-sm font-bold"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-bold text-[15px] mb-4">{t.footer.navigation}</h3>
            <ul className="space-y-2.5">
              {[
                { href: "/", label: t.nav.home },
                { href: "/about", label: t.nav.about },
                { href: "/events", label: t.nav.events },
                { href: "/login", label: t.footer.login },
                { href: "/join", label: t.footer.join },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href} className="text-sm text-white/85 hover:text-white transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-bold text-[15px] mb-4">{t.footer.contact}</h3>
            <ul className="space-y-2.5 text-sm text-white/85">
              <li><a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white underline-offset-2 hover:underline">{CONTACT_EMAIL}</a></li>
              <li>{t.footer.city}</li>
            </ul>
            <div className="mt-6">
              <label htmlFor="footer-newsletter" className="block text-xs font-semibold tracking-wider uppercase text-white/85 mb-2">
                {t.footer.newsletter}
              </label>
              <form className="flex" onSubmit={(e) => { e.preventDefault(); if (email.trim()) subscribe.mutate(); }}>
                <input
                  id="footer-newsletter"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (subscribe.isSuccess || subscribe.isError) subscribe.reset(); }}
                  placeholder={t.footer.emailPlaceholder}
                  className="flex-1 bg-white/10 border border-white/20 text-white text-sm px-3 py-2.5 rounded-l-[10px] placeholder-white/60 outline-none focus:bg-white/20 transition-colors min-w-0"
                />
                <button type="submit" disabled={subscribe.isPending}
                  className="bg-brand-orange text-ink px-4 py-2.5 rounded-r-[10px] text-sm font-bold hover:bg-orange-400 transition-colors whitespace-nowrap disabled:opacity-60">
                  OK
                </button>
              </form>
              <p role="status" className="text-xs text-white/85 mt-2 min-h-[1rem]">
                {subscribe.isSuccess ? t.footer.subscribed
                  : subscribe.isError ? apiError(subscribe.error, t.footer.subscribeError)
                    : t.footer.newsletterHint}
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 mt-12 pt-6 flex flex-col sm:flex-row gap-2 justify-between text-white/80 text-sm">
          <span>© {year} Data Afrique Hub — {t.footer.rights}</span>
          <span className="font-display font-semibold tracking-[0.14em] text-xs uppercase">{t.brand.tagline}</span>
        </div>
      </div>
    </footer>
  );
}
