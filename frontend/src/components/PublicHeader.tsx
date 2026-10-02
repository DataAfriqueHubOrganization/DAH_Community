"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { PreferencesToggle } from "@/components/PreferencesToggle";
import { useI18n } from "@/i18n/I18nProvider";

const navLinks = [
  { href: "/", key: "home" },
  { href: "/about", key: "about" },
  { href: "/events", key: "events" },
  { href: "/members", key: "members" },
  { href: "/blog", key: "news" },
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { t } = useI18n();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface dark:bg-surface/80 dark:backdrop-blur-md border-b border-line h-[72px] sm:h-[88px] flex items-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex items-center justify-between gap-4">
        {/* Logo : complet dès que la place le permet (≥ 160 px), symbole seul sur mobile */}
        <Link href="/" className="flex items-center gap-2.5" aria-label={t.nav.homeAria}>
          <Logo variant="full" height={66} className="hidden sm:block" />
          <Logo variant="symbol" height={38} className="sm:hidden" />
          <span className="sm:hidden font-display font-bold text-fg">DAH</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(({ href, key }) => {
            const label = t.nav[key];
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`px-2.5 xl:px-4 py-2 text-[15px] rounded-md transition-colors relative ${
                  active ? "text-brand-blue font-semibold" : "text-fg-soft font-medium hover:text-brand-blue"
                }`}
              >
                {label}
                {active && <span className="absolute -bottom-[25px] left-2.5 right-2.5 xl:left-4 xl:right-4 h-[3px] bg-brand-orange rounded-full" />}
              </Link>
            );
          })}
        </nav>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-2">
          <PreferencesToggle className="mr-1" />
          <Link
            href="/login"
            className="px-4 h-11 inline-flex items-center font-display text-[15px] font-semibold text-brand-blue rounded-[10px] hover:bg-brand-blue/10 transition-colors"
          >
            {t.nav.login}
          </Link>
          <Link
            href="/join"
            className="px-5 h-11 inline-flex items-center font-display text-[15px] font-bold bg-brand-orange text-ink rounded-[10px] hover:bg-orange-400 transition-colors"
          >
            {t.nav.join}
          </Link>
        </div>

        {/* Mobile */}
        <div className="lg:hidden flex items-center gap-2">
          <Link href="/join" className="px-3.5 h-10 inline-flex items-center text-sm font-bold bg-brand-orange text-ink rounded-[10px]">
            {t.nav.join}
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="w-11 h-11 inline-flex items-center justify-center rounded-[10px] border border-line text-fg hover:bg-surface-muted transition-colors"
            aria-label={open ? t.common.closeMenu : t.common.openMenu}
            aria-expanded={open}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {open && (
        <div className="absolute top-[72px] sm:top-[88px] left-0 right-0 bg-surface border-t border-line-soft shadow-lg lg:hidden">
          <div className="px-4 py-4 flex flex-col gap-1">
            {navLinks.map(({ href, key }) => {
              const label = t.nav[key];
              const active = pathname === href || (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-3 text-[15px] font-medium rounded-[10px] transition-colors ${
                    active ? "bg-brand-blue/10 text-brand-blue" : "text-fg hover:bg-surface-muted"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            <div className="border-t border-line-soft mt-2 pt-4 flex flex-col gap-3">
              <PreferencesToggle />
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex h-12 items-center justify-center font-display text-[15px] font-semibold bg-brand-blue text-white rounded-[10px] hover:bg-brand-deep"
              >
                {t.nav.login}
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
