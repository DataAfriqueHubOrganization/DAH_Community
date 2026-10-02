"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/components/ThemeProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const NEXT_THEME: Record<ThemePreference, ThemePreference> = { light: "dark", dark: "system", system: "light" };
const THEME_ICON = { light: Sun, dark: Moon, system: Monitor };

/** Bouton cyclique Clair → Sombre → Système. */
export function ThemeToggle({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { t } = useI18n();
  const Icon = THEME_ICON[preference];
  const next = NEXT_THEME[preference];

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={t.prefs.themeSwitch(t.prefs.theme[preference], t.prefs.theme[next])}
      title={t.prefs.themeSwitch(t.prefs.theme[preference], t.prefs.theme[next])}
      className={cn(
        "w-10 h-10 inline-flex items-center justify-center rounded-[10px] border transition-colors",
        onDark
          ? "border-white/25 text-white hover:bg-white/10"
          : "border-line text-fg-soft hover:bg-surface-muted hover:text-fg",
        className,
      )}
    >
      <Icon size={18} />
    </button>
  );
}

/** Bascule FR / EN : affiche les deux codes, la langue active en gras. */
export function LocaleToggle({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const { locale, setLocale, isSwitching, t } = useI18n();
  const next = locale === "fr" ? "en" : "fr";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      disabled={isSwitching}
      aria-label={t.prefs.switchLanguage}
      title={t.prefs.switchLanguage}
      lang={next}
      className={cn(
        "h-10 px-2.5 inline-flex items-center gap-1 rounded-[10px] border text-xs font-semibold tracking-wide transition-colors disabled:opacity-60",
        onDark
          ? "border-white/25 text-white/75 hover:bg-white/10"
          : "border-line text-fg-subtle hover:bg-surface-muted",
        className,
      )}
    >
      <span className={locale === "fr" ? (onDark ? "text-white" : "text-fg") : undefined}>FR</span>
      <span aria-hidden="true">/</span>
      <span className={locale === "en" ? (onDark ? "text-white" : "text-fg") : undefined}>EN</span>
    </button>
  );
}

export function PreferencesToggle({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LocaleToggle onDark={onDark} />
      <ThemeToggle onDark={onDark} />
    </div>
  );
}
