import { LoginForm } from "@/features/auth/LoginForm";
import type { Metadata } from "next";
import Link from "next/link";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.auth.loginMeta };
}

export default async function LoginPage() {
  const t = await getT();
  return (
    <>
      <h2 className="text-xl font-semibold text-fg mb-1">{t.auth.loginTitle}</h2>
      <p className="text-muted-foreground text-sm mb-6">{t.auth.loginSubtitle}</p>
      <LoginForm />
      <div className="mt-4 text-center space-y-2">
        <Link href="/forgot-password" className="text-sm text-brand-blue hover:underline block">
          {t.auth.forgotLink}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t.auth.notMember}{" "}
          <Link href="/join" className="text-brand-blue hover:underline">
            {t.auth.joinCommunity}
          </Link>
        </p>
      </div>
    </>
  );
}
