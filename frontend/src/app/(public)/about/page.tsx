import type { Metadata } from "next";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import Link from "next/link";
import { Target, Eye, Heart, ArrowRight } from "lucide-react";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.about.metaTitle };
}

// Section « Le bureau » masquée pour l'instant : passer à true pour la réafficher.
const SHOW_BUREAU = false;

// Rôles traduits via t.about.team.roles (même ordre)
const team = [
  { name: "Kouamé Assouman", avatar: "https://ui-avatars.com/api/?name=Kouame+Assouman&background=2F6FE0&color=fff&bold=true&format=svg" },
  { name: "Fatou Diallo", avatar: "https://ui-avatars.com/api/?name=Fatou+Diallo&background=FB7C2C&color=fff&bold=true&format=svg" },
  { name: "Moussa Konaté", avatar: "https://ui-avatars.com/api/?name=Moussa+Konate&background=1E4FAF&color=fff&bold=true&format=svg" },
  { name: "Claire Gbénou", avatar: "https://ui-avatars.com/api/?name=Claire+Gbenou&background=0F87EF&color=fff&bold=true&format=svg" },
];

const pillars = [
  { icon: Target, color: "bg-brand-blue" },
  { icon: Eye, color: "bg-brand-orange" },
  { icon: Heart, color: "bg-brand-deep" },
];

export default async function AboutPage() {
  const t = await getT();

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-univers text-white py-20">
        <NetworkPattern />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl font-bold mb-6">{t.about.title}</h1>
            <p className="text-white/90 text-lg leading-relaxed max-w-2xl mx-auto lg:mx-0">{t.about.intro}</p>
          </div>
          <div className="relative">
            <div className="absolute -inset-4 bg-brand-orange/20 rounded-3xl blur-2xl" />
            <img
              src="/images/students-celebrating.png"
              alt={t.about.imageAlt}
              className="relative rounded-2xl shadow-2xl w-full h-64 sm:h-80 object-cover border border-white/10"
            />
          </div>
        </div>
      </section>

      {/* Mission / Vision / Valeurs */}
      <section className="bg-section py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {pillars.map(({ icon: Icon, color }, i) => (
              <div key={i} className="rounded-2xl p-8 border border-line-soft hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center text-white mb-5`}>
                  <Icon size={22} />
                </div>
                <h3 className="font-semibold text-xl text-fg mb-3">{t.about.pillars[i].title}</h3>
                <p className="text-fg-muted leading-relaxed text-sm">{t.about.pillars[i].text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Histoire : une année, un ou plusieurs temps forts */}
      <section className="bg-page py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-fg mb-3">{t.about.historyTitle}</h2>
            <p className="text-fg-muted">{t.about.historyIntro}</p>
          </div>
          <ol className="space-y-2">
            {t.about.timeline.map(({ year, events }, i) => (
              <li key={year} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl bg-brand-blue text-white flex items-center justify-center font-display font-extrabold text-lg shrink-0">
                    {year}
                  </div>
                  {i < t.about.timeline.length - 1 && <div aria-hidden="true" className="w-0.5 flex-1 bg-line mt-2" />}
                </div>
                <div className="flex-1 min-w-0 pb-10 space-y-3">
                  {events.map((event) => (
                    <article key={event.title} className="bg-surface rounded-2xl border border-line-soft p-5 sm:p-6">
                      <h3 className="font-semibold text-lg text-fg mb-2 flex items-start gap-2.5">
                        <span aria-hidden="true" className="mt-2 w-2.5 h-2.5 rounded-[3px] bg-brand-orange shrink-0" />
                        {event.title}
                      </h3>
                      <p className="text-fg-soft text-[15px] leading-relaxed">{event.desc}</p>
                    </article>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Bureau — masqué pour l'instant (SHOW_BUREAU). */}
      {SHOW_BUREAU && <section className="bg-panel py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">{t.about.teamTitle}</h2>
            <p className="text-white/85">{t.about.teamText}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {team.map((member, i) => (
              <div key={member.name} className="text-center">
                <img src={member.avatar} alt={member.name} className="w-20 h-20 rounded-full mx-auto mb-3 border-2 border-brand-orange" />
                <p className="font-semibold text-white text-sm">{member.name}</p>
                <p className="text-white/80 text-xs mt-0.5">{t.about.teamRoles[i]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>}

      {/* CTA */}
      <section className="relative overflow-hidden bg-univers py-16">
        <div className="max-w-2xl mx-auto text-center px-4 text-white">
          <h2 className="text-2xl font-bold mb-4">{t.about.ctaTitle}</h2>
          <p className="text-white/90 mb-6">{t.about.ctaText}</p>
          <Link href="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-ink font-bold rounded-xl hover:bg-orange-400 transition-colors">
            {t.about.ctaButton} <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
