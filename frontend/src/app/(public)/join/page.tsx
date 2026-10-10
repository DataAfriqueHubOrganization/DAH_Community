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
          {/* Questions fréquentes (sans JavaScript : <details>). */}
          <section aria-labelledby="join-faq" className="mt-8 space-y-2.5">
            <h2 id="join-faq" className="font-display font-bold text-lg text-fg">{t.join.faqTitle}</h2>
            {t.join.faq.map((item) => (
              <details key={item.q} className="group bg-surface rounded-xl border border-line-soft px-5 py-4">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-sm font-semibold text-fg">
                  {item.q}
                  <span aria-hidden="true" className="text-brand-blue text-lg leading-none transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-fg-soft leading-relaxed">{item.a}</p>
              </details>
            ))}
          </section>
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
