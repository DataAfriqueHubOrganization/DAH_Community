"use client";

import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { INTL_LOCALE, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages, type Messages } from "./messages";

interface I18nContextValue {
  locale: Locale;
  t: Messages;
  setLocale: (locale: Locale) => void;
  isSwitching: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** La langue vient du cookie lu par le layout racine ; changer de langue
 *  réécrit le cookie puis rafraîchit l'arbre serveur. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [isSwitching, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = next;
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo(
    () => ({ locale, t: getMessages(locale), setLocale, isSwitching }),
    [locale, setLocale, isSwitching],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

function useI18nContext() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé sous <I18nProvider>");
  return ctx;
}

/** Dictionnaire, langue courante et formateurs (dates, libellés métier). */
export function useI18n() {
  const { locale, t, setLocale, isSwitching } = useI18nContext();
  const intl = INTL_LOCALE[locale];

  return useMemo(() => {
    const date = (value: string, options?: Intl.DateTimeFormatOptions) =>
      new Date(value).toLocaleDateString(intl, { day: "numeric", month: "long", year: "numeric", ...options });

    const dateTime = (value: string) =>
      new Date(value).toLocaleString(intl, {
        day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      });

    const timeUntil = (value: string) => {
      const diff = new Date(value).getTime() - Date.now();
      if (diff < 0) return t.time.past;
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      if (days > 0) return t.time.inDaysHours(days, hours);
      const minutes = Math.floor((diff % 3600000) / 60000);
      return t.time.inHoursMinutes(hours, minutes);
    };

    const eventType = (type: string) => (t.labels.eventType as Record<string, string>)[type] ?? type;
    const role = (value: string) => (t.labels.role as Record<string, string>)[value] ?? value;
    const poste = (value: string | null | undefined) =>
      value ? ((t.labels.poste as Record<string, string>)[value] ?? value) : "--";
    /** Poste au bureau s'il existe (plus parlant), sinon rôle d'accès. */
    const position = (person: { role: string; poste?: string | null }) =>
      person.poste ? poste(person.poste) : role(person.role);

    return {
      t,
      locale,
      intl,
      setLocale,
      isSwitching,
      fmt: { date, dateTime, timeUntil },
      label: { eventType, role, poste, position },
    };
  }, [t, locale, intl, setLocale, isSwitching]);
}
