"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { useI18n } from "@/i18n/I18nProvider";

export function PublicFooter() {
  const year = new Date().getFullYear();
  const { t } = useI18n();

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
              {[
                { href: "https://facebook.com", label: "f", title: "Facebook" },
                { href: "https://youtube.com", label: "▶", title: "YouTube" },
                { href: "https://linkedin.com", label: "in", title: "LinkedIn" },
              ].map(({ href, label, title }) => (
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
              <li>contact@dataafrique.hub</li>
              <li>+229 00 00 00 00</li>
              <li>{t.footer.city}</li>
            </ul>
            <div className="mt-6">
              <label htmlFor="footer-newsletter" className="block text-xs font-semibold tracking-wider uppercase text-white/85 mb-2">
                {t.footer.newsletter}
              </label>
              <div className="flex">
                <input
                  id="footer-newsletter"
                  type="email"
                  placeholder={t.footer.emailPlaceholder}
                  className="flex-1 bg-white/10 border border-white/20 text-white text-sm px-3 py-2.5 rounded-l-[10px] placeholder-white/60 outline-none focus:bg-white/20 transition-colors min-w-0"
                />
                <button className="bg-brand-orange text-ink px-4 py-2.5 rounded-r-[10px] text-sm font-bold hover:bg-orange-400 transition-colors whitespace-nowrap">
                  OK
                </button>
              </div>
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
