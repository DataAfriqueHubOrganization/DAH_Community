import { ResetPasswordForm } from "@/features/auth/ResetPasswordForm";
import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getT();

  return (
    <>
      <h2 className="text-xl font-semibold text-fg mb-1">{t.auth.newPassword}</h2>
      <p className="text-muted-foreground text-sm mb-6">{t.auth.resetSubtitle}</p>
      <ResetPasswordForm token={token} />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-brand-blue hover:underline">
          ← {t.auth.backToLogin}
        </Link>
      </p>
    </>
  );
}
