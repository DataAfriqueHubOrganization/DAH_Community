import type { Locale } from "../config";
import { fr, type Messages } from "./fr";
import { en } from "./en";

export type { Messages };

const MESSAGES: Record<Locale, Messages> = { fr, en };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
