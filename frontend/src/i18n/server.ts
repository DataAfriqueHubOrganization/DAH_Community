import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { getMessages } from "./messages";

/** Langue courante côté serveur (cookie, sinon français). */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Dictionnaire de la langue courante, pour les composants serveur et generateMetadata. */
export async function getT() {
  return getMessages(await getLocale());
}
