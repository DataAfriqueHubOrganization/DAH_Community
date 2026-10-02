export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";
/** Cookie lu par le serveur (layout racine) et écrit par le sélecteur de langue. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/** Tag BCP 47 utilisé pour Intl (dates, nombres). */
export const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
