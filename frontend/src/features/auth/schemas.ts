import { z } from "zod";
import type { Messages } from "@/i18n/messages";

// Fabriques : les messages d'erreur suivent la langue courante (t.validation).
// Dans un composant : const schema = useMemo(() => makeLoginSchema(t.validation), [t]);
type V = Messages["validation"];

export const makeLoginSchema = (v: V) =>
  z.object({
    email: z.string().email(v.emailInvalid),
    password: z.string().min(1, v.passwordRequired),
  });

export const makeRegisterSchema = (v: V) =>
  z
    .object({
      first_name: z.string().min(2, v.firstNameMin),
      last_name: z.string().min(2, v.lastNameMin),
      email: z.string().email(v.emailInvalid),
      phone: z.string().optional(),
      password: z.string().min(8, v.passwordMin),
      password_confirm: z.string().min(1, v.passwordConfirm),
    })
    .refine((d) => d.password === d.password_confirm, {
      message: v.passwordMismatch,
      path: ["password_confirm"],
    });

export const makeForgotPasswordSchema = (v: V) =>
  z.object({
    email: z.string().email(v.emailInvalid),
  });

export const makeResetPasswordSchema = (v: V) =>
  z
    .object({
      new_password: z.string().min(8, v.passwordMin),
      new_password_confirm: z.string().min(1, v.passwordConfirm),
    })
    .refine((d) => d.new_password === d.new_password_confirm, {
      message: v.passwordMismatch,
      path: ["new_password_confirm"],
    });

export const makeCandidatureSchema = (v: V) =>
  z.object({
    first_name: z.string().min(2, v.firstNameMin),
    last_name: z.string().min(2, v.lastNameMin),
    email: z.string().email(v.emailInvalid),
    phone: z.string().optional(),
    country: z.string().min(2, v.countryRequired),
    profession: z.string().min(2, v.professionRequired),
    linkedin_url: z
      .string()
      .url(v.linkedinInvalid)
      .optional()
      .or(z.literal("")),
    motivation: z.string().min(50, v.motivationMin),
  });

export type LoginInput = z.infer<ReturnType<typeof makeLoginSchema>>;
export type RegisterInput = z.infer<ReturnType<typeof makeRegisterSchema>>;
export type CandidatureInput = z.infer<ReturnType<typeof makeCandidatureSchema>>;
export type ForgotPasswordInput = z.infer<ReturnType<typeof makeForgotPasswordSchema>>;
export type ResetPasswordInput = z.infer<ReturnType<typeof makeResetPasswordSchema>>;
