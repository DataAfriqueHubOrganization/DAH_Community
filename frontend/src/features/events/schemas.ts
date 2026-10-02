import { z } from "zod";
import type { Messages } from "@/i18n/messages";

type V = Messages["validation"];

// Fabrique : les messages d'erreur suivent la langue courante (t.validation).
export function makeEventRegistrationSchema(v: V) {
  return z.object({
    email: z.string().email(v.emailInvalid),
    first_name: z.string().min(2, v.firstNameRequired),
    last_name: z.string().min(2, v.lastNameRequired),
    nationality: z.string().min(2, v.nationalityRequired),
    organisation: z.string().min(1, v.organisationRequired),
    profession: z.string().min(1, v.professionRequired),
    motivation: z.string().min(1, v.motivationRequired),
  });
}

export type EventRegistrationInput = z.infer<ReturnType<typeof makeEventRegistrationSchema>>;
