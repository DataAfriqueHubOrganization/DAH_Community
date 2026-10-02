"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Logo } from "@/components/ui/Logo";
import { NetworkPattern } from "@/components/ui/NetworkPattern";
import { eventsService } from "@/services/events.service";
import { membersService } from "@/services/members.service";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { CalendarDays, MapPin, ArrowRight, BookOpen, Lightbulb, Handshake, FlaskConical, ChevronRight } from "lucide-react";
import type { Event } from "@/types/events.types";
import type { PublicMemberListItem } from "@/types/members.types";

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const step = target / (2000 / 16);
        let current = 0;
        const timer = setInterval(() => {
          current += step;
          if (current >= target) { setCount(target); clearInterval(timer); }
          else setCount(Math.floor(current));
        }, 16);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <div ref={ref}>{count}{suffix}</div>;
}

// Les textes (rôles, citations, descriptions) viennent du dictionnaire : t.home.*
const testimonials = [
  { name: "Alice Mensah", avatar: "https://ui-avatars.com/api/?name=Alice+Mensah&background=2F6FE0&color=fff&bold=true&format=svg" },
  { name: "Robert Ouedraogo", avatar: "https://ui-avatars.com/api/?name=Robert+Ouedraogo&background=FB7C2C&color=fff&bold=true&format=svg" },
  { name: "Claire Gbénou", avatar: "https://ui-avatars.com/api/?name=Claire+Gbenou&background=1E4FAF&color=fff&bold=true&format=svg" },
];

const activities = [
  { icon: BookOpen, color: "bg-brand-blue" },
  { icon: Lightbulb, color: "bg-brand-orange" },
  { icon: Handshake, color: "bg-brand-deep" },
  { icon: FlaskConical, color: "bg-blue-700" },
];

// Sous-entités présentées dans la charte graphique
const poles = [
  { name: "Data Tour", accent: "bg-brand-orange" },
  { name: "DAH Academy", accent: "bg-brand-blue" },
  { name: "DAH Média", accent: "bg-brand-orange" },
  { name: "DAH Labs", accent: "bg-brand-blue" },
];

const POSTE_ORDER: Record<string, number> = {
  president: 1, vp1: 2, vp2: 3,
  secretaire_general: 4, secretaire_general_adj: 5,
  tresorier: 6, tresorier_adj: 7,
};
const ROLE_ORDER: Record<string, number> = { admin: 0, responsable: 20, membre: 21, candidat: 22, visiteur: 23 };

function memberSortRank(m: Pick<PublicMemberListItem, "role" | "poste">): number {
  return m.poste ? (POSTE_ORDER[m.poste] ?? 15) : (ROLE_ORDER[m.role] ?? 30);
}

function roleBadgeColor(member: Pick<PublicMemberListItem, "role" | "poste">) {
  const posteMap: Record<string, string> = {
    president: "bg-brand-orange", vp1: "bg-brand-orange", vp2: "bg-brand-orange",
    secretaire_general: "bg-brand-blue", tresorier: "bg-blue-700",
  };
  if (member.poste) return posteMap[member.poste] ?? "bg-gray-400";
  const roleMap: Record<string, string> = { responsable: "bg-brand-sky", membre: "bg-brand-blue", candidat: "bg-gray-400" };
  return roleMap[member.role] ?? "bg-gray-400";
}

export default function LandingPage() {
  const { t, fmt, label, intl } = useI18n();
  const { data: eventsData } = useQuery({
    queryKey: ["events", "public"],
    queryFn: () => eventsService.list({ is_published: "true" }).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const { data: membersData } = useQuery({
    queryKey: ["members", "public-list"],
    queryFn: () => membersService.publicList().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
  const all: Event[] = eventsData?.results ?? eventsData ?? [];
  const upcomingEvents = all.filter((e) => new Date(e.start_date) > new Date()).slice(0, 3);
  const featuredMembers: PublicMemberListItem[] = (membersData?.results ?? [])
    .sort((a: PublicMemberListItem, b: PublicMemberListItem) => memberSortRank(a) - memberSortRank(b))
    .slice(0, 6);

  return (
    <>
      <PublicHeader />
      <main className="pt-[72px] sm:pt-[88px]">
        {/* HERO — dégradé « univers » + motif réseau */}
        <section className="relative overflow-hidden bg-univers text-white">
          <NetworkPattern />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.15fr_1fr] gap-12 items-center py-16 sm:py-24 lg:py-28">
            <div className="flex flex-col gap-6 text-center lg:text-left items-center lg:items-start">
              <Logo variant="symbol" tone="white" height={110} className="lg:hidden" />
              <p className="inline-flex items-center gap-3 font-display text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase">
                <span className="w-2.5 h-2.5 rounded-[2px] bg-brand-orange" />
                {t.brand.tagline}
              </p>
              <h1 className="text-4xl sm:text-5xl lg:text-[62px] font-extrabold leading-[1.06] tracking-tight">
                {t.home.heroTitle}
              </h1>
              <p className="text-lg sm:text-[19px] leading-relaxed max-w-xl text-white/90">
                {t.home.heroText}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto mt-2">
                <Link href="/register" className="inline-flex items-center justify-center gap-2 h-14 px-7 bg-brand-orange hover:bg-orange-400 text-ink font-display font-bold rounded-[10px] transition-colors">
                  {t.home.heroCta} <ArrowRight size={18} />
                </Link>
                <Link href="/events" className="inline-flex items-center justify-center h-14 px-7 border-[1.5px] border-white/60 hover:bg-white/10 text-white font-display font-semibold rounded-[10px] transition-colors">
                  {t.home.heroSecondary}
                </Link>
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <div className="w-[420px] h-[420px] rounded-full border border-white/20 flex items-center justify-center">
                <div className="w-[330px] h-[330px] rounded-full bg-white/[0.08] flex items-center justify-center">
                  <Logo variant="symbol" tone="white" height={245} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHIFFRES */}
        <section className="bg-section border-b border-line">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-3 py-6 sm:py-10">
            {[
              { value: 30, suffix: "+", label: t.home.stats.members },
              { value: 50, suffix: "+", label: t.home.stats.trained },
              { value: 10, suffix: "+", label: t.home.stats.countries },
            ].map(({ value, suffix, label }) => (
              <div key={label} className="flex flex-col gap-1 px-6 py-4 sm:py-0 border-b sm:border-b-0 sm:border-l border-line last:border-b-0">
                <div className="font-display text-4xl font-bold text-brand-blue"><AnimatedCounter target={value} suffix={suffix} /></div>
                <p className="text-sm text-fg-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PÔLES */}
        <section className="bg-section py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12">
              <div className="max-w-2xl">
                <p className="font-display text-sm font-semibold tracking-[0.16em] uppercase text-brand-blue mb-3">{t.home.poles.eyebrow}</p>
                <h2 className="text-3xl sm:text-[38px] font-semibold text-fg leading-tight">{t.home.poles.title}</h2>
              </div>
              <Logo variant="dah" height={54} className="hidden md:block" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {poles.map(({ name, accent }, i) => (

                <div key={name} className="flex flex-col gap-3 p-7 rounded-2xl border border-line bg-surface hover:border-brand-blue/40 hover:shadow-lg transition-all">
                  <span className={`w-3.5 h-3.5 rounded-[3px] ${accent}`} />
                  <h3 className="text-xl font-bold text-fg">{name}</h3>
                  <p className="text-[15px] leading-relaxed text-fg-soft">{t.home.poles.items[i]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ACTIVITÉS */}
        <section className="bg-page py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="font-display text-sm font-semibold tracking-[0.16em] uppercase text-brand-blue mb-3">{t.home.activities.eyebrow}</p>
              <h2 className="text-3xl sm:text-[38px] font-semibold text-fg leading-tight mb-4">{t.home.activities.title}</h2>
              <p className="text-fg-soft">{t.home.activities.text}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {activities.map(({ icon: Icon, color }, i) => (
                <div key={i} className="group bg-surface rounded-2xl p-7 border border-line hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                  <div className={`w-12 h-12 ${color} rounded-[10px] flex items-center justify-center text-white mb-5`}><Icon size={22} /></div>
                  <h3 className="font-semibold text-xl text-fg mb-2">{t.home.activities.items[i].title}</h3>
                  <p className="text-fg-soft text-[15px] leading-relaxed">{t.home.activities.items[i].desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ÉVÉNEMENTS */}
        {upcomingEvents.length > 0 && (
          <section className="bg-section py-20 sm:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="font-display text-sm font-semibold tracking-[0.16em] uppercase text-brand-blue mb-3">{t.home.events.eyebrow}</p>
                  <h2 className="text-3xl sm:text-[38px] font-semibold text-fg">{t.home.events.title}</h2>
                </div>
                <Link href="/events" className="hidden sm:inline-flex items-center gap-2 font-display font-semibold text-brand-blue hover:gap-3 transition-all">
                  {t.home.events.all} <ChevronRight size={16} />
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingEvents.map((event) => {
                  const start = new Date(event.start_date);
                  return (
                    <Link key={event.id} href={`/events/${event.id}`} className="group bg-surface rounded-2xl overflow-hidden border border-line hover:border-brand-blue/40 hover:shadow-lg transition-all">
                      <div className="h-44 bg-univers relative flex items-end p-4">
                        <Logo variant="symbol" tone="white" height={110} className="absolute right-5 top-5 opacity-25" />
                        <div className="relative bg-surface rounded-[10px] px-3 py-2 flex flex-col items-center border-t-4 border-brand-orange">
                          <span className="font-display text-2xl font-extrabold leading-none text-fg">{start.toLocaleDateString(intl, { day: "2-digit" })}</span>
                          <span className="text-xs font-semibold text-fg-muted uppercase">{start.toLocaleDateString(intl, { month: "short" }).replace(".", "")}</span>
                        </div>
                      </div>
                      <div className="p-5 flex flex-col gap-2.5">
                        <span className="self-start px-2.5 py-1 rounded-full bg-brand-blue/10 text-brand-deep text-xs font-semibold">{label.eventType(event.event_type)}</span>
                        <h3 className="font-semibold text-lg text-fg line-clamp-2 group-hover:text-brand-blue transition-colors">{event.title}</h3>
                        <div className="space-y-1.5 text-sm text-fg-muted">
                          <div className="flex items-center gap-2"><CalendarDays size={14} className="shrink-0 text-brand-blue" />{fmt.date(event.start_date)}</div>
                          {event.location && <div className="flex items-center gap-2"><MapPin size={14} className="shrink-0 text-brand-orange" /><span className="line-clamp-1">{event.location}</span></div>}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* MEMBRES */}
        {featuredMembers.length > 0 && (
          <section id="membres" className="bg-surface-muted py-20 sm:py-24">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-10">
                <div>
                  <p className="font-display text-sm font-semibold tracking-[0.16em] uppercase text-brand-blue mb-3">{t.home.community.eyebrow}</p>
                  <h2 className="text-3xl sm:text-[38px] font-semibold text-fg mb-2">{t.home.community.title}</h2>
                  <p className="text-fg-soft">{t.home.community.text}</p>
                </div>
                <Link href="/members" className="hidden sm:inline-flex items-center gap-2 font-display font-semibold text-brand-blue hover:gap-3 transition-all">
                  {t.home.community.all} <ChevronRight size={16} />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredMembers.map((member) => {
                  const fullName = `${member.first_name} ${member.last_name}`;
                  const avatar = member.avatar ?? avatarUrl(fullName, 80);
                  return (
                    <Link
                      key={member.slug}
                      href={`/members/${member.slug}`}
                      className="group flex items-start gap-4 p-5 rounded-2xl border border-line hover:border-brand-blue/40 hover:shadow-md transition-all duration-200 bg-surface"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={avatar}
                          alt={fullName}
                          className="w-14 h-14 rounded-xl object-cover border-2 border-white shadow-sm"
                        />
                        <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-[4px] border-2 border-white ${roleBadgeColor(member)}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-fg group-hover:text-brand-blue transition-colors leading-tight">{fullName}</p>
                        <p className="text-xs text-fg-muted mt-0.5">{label.position(member)}</p>
                        {member.current_job && (
                          <p className="text-xs text-fg-soft mt-1 truncate">
                            {member.current_job.title}
                            <span className="text-orange-700"> @ {member.current_job.company}</span>
                          </p>
                        )}
                        {member.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {member.skills.slice(0, 3).map((skill) => (
                              <span key={skill} className="px-1.5 py-0.5 bg-brand-blue/10 text-brand-deep text-[10px] font-medium rounded">
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-8 text-center sm:hidden">
                <Link href="/members" className="inline-flex items-center gap-2 font-display font-semibold text-brand-blue text-sm">
                  {t.home.community.all} <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* TÉMOIGNAGES */}
        <section className="bg-panel text-white py-20 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12">
              <p className="font-display text-sm font-semibold tracking-[0.16em] uppercase text-white/85 mb-3">{t.home.testimonials.eyebrow}</p>
              <h2 className="text-3xl sm:text-[38px] font-semibold mb-3">{t.home.testimonials.title}</h2>
              <p className="text-white/85">{t.home.testimonials.text}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {testimonials.map((p, i) => (
                <figure key={p.name} className="flex flex-col gap-5 bg-white/[0.08] border border-white/15 rounded-2xl p-7">
                  <span aria-hidden="true" className="font-display text-5xl leading-[0.6] font-extrabold text-brand-orange">&ldquo;</span>
                  <blockquote className="text-white/90 text-[15px] leading-relaxed flex-1">{t.home.testimonials.items[i].text}</blockquote>
                  <figcaption className="flex items-center gap-3">
                    <img src={p.avatar} alt={p.name} className="w-11 h-11 rounded-[10px]" />
                    <div><p className="font-display font-semibold text-sm">{p.name}</p><p className="text-white/75 text-xs">{t.home.testimonials.items[i].role}</p></div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* CTA FINAL — aplat orange, fond autorisé par la charte pour le logo blanc */}
        <section className="bg-panel-accent py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-[40px] font-bold text-ink dark:text-white leading-tight mb-3">{t.home.cta.title}</h2>
              <p className="text-ink/85 dark:text-white/85 text-lg">{t.home.cta.text}</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-7">
              <Logo variant="full" tone="white" height={80} />
              <Link href="/register" className="inline-flex items-center gap-2 h-14 px-8 bg-ink text-white dark:bg-brand-orange dark:text-ink font-display font-bold rounded-[10px] hover:bg-ink/85 dark:hover:bg-orange-400 transition-colors">
                {t.home.cta.button} <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
