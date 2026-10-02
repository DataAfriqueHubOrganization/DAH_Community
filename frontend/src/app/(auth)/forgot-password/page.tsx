import { ForgotPasswordForm } from "@/features/auth/ForgotPasswordForm";
import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.forgotMeta };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <>
      <h2 className="text-xl font-semibold text-fg mb-1">{t.auth.forgotTitle}</h2>
      <p className="text-muted-foreground text-sm mb-6">{t.auth.forgotSubtitle}</p>
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-brand-blue hover:underline">
          ← {t.auth.backToLogin}
        </Link>
      </p>
    </>
  );
}
