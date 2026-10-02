import { CandidatureForm } from "@/features/candidatures/CandidatureForm";
import type { Metadata } from "next";
import { Users, Handshake, Sparkles } from "lucide-react";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.join.metaTitle };
}

const REASON_ICONS = [Users, Sparkles, Handshake];

export default async function JoinPage() {
  const t = await getT();

  return (
    <div className="min-h-[calc(100vh-72px)] sm:min-h-[calc(100vh-88px)] flex flex-col lg:flex-row">
      {/* Panneau visuel */}
      <div className="lg:w-[45%] relative overflow-hidden bg-panel flex flex-col justify-between p-10 sm:p-12 min-h-[280px]">
        <img
          src="/images/partner-banner.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-deep/90 via-brand-deep/75 to-brand-blue/60 dark:from-[#16223A]/95 dark:via-[#16223A]/90 dark:to-[#1A2D4E]/85" />

        <div className="relative z-10">
          <span className="inline-block bg-white/10 border border-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full mb-6">
            {t.join.badge}
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">{t.join.title}</h1>
          <p className="text-white/90 leading-relaxed max-w-sm">{t.join.intro}</p>
        </div>

        <ul className="relative z-10 space-y-4 mt-10">
          {REASON_ICONS.map((Icon, i) => (
            <li key={i} className="flex items-start gap-3 text-white/90 text-sm">
              <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <Icon size={16} />
              </span>
              {t.join.reasons[i]}
            </li>
          ))}
        </ul>
      </div>

      {/* Formulaire */}
      <div className="flex-1 bg-page flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-xl">
          <div className="bg-surface rounded-2xl border border-line-soft shadow-sm p-6 sm:p-8">
            <CandidatureForm />
          </div>
          <p className="text-center text-xs text-fg-subtle mt-6">
            {t.join.alreadyMember}{" "}
            <a href="/login" className="text-brand-blue hover:underline">
              {t.join.goToSpace}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
