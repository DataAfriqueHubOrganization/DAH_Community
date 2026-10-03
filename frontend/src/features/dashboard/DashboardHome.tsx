"use client";

import Link from "next/link";
import { useCurrentUser } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { eventsService } from "@/services/events.service";
import { membersService } from "@/services/members.service";
import { membershipsService } from "@/services/memberships.service";
import { engagementService } from "@/services/engagement.service";
import { checkinPeriod } from "@/features/engagement/period";
import { Users, CalendarDays, Award, FileText, ArrowRight, Clock, CheckCircle2, ClipboardList } from "lucide-react";
import { isAdmin, isBureau } from "@/types/auth.types";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import type { Event } from "@/types/events.types";
import type { CandidatureList } from "@/types/memberships.types";

export function DashboardHome() {
  const { data: user, isLoading } = useCurrentUser();
  const { t, fmt, label, intl } = useI18n();
  const d = t.dashboardHome;

  const { data: eventsData } = useQuery({
    queryKey: ["events", "dashboard"],
    queryFn: () => eventsService.list({ is_published: "true" }).then((r) => r.data),
    enabled: !!user,
  });

  const { data: membersData } = useQuery({
    queryKey: ["members", "list"],
    queryFn: () => membersService.list().then((r) => r.data),
    enabled: isBureau(user),
  });

  const { data: membershipData } = useQuery({
    queryKey: ["candidatures", "pending"],
    queryFn: () => membershipsService.listCandidatures({ status: "pending" }).then((r) => r.data),
    enabled: !!user && (isAdmin(user.role) || user.poste === "president"),
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => membersService.myProfile().then((r) => r.data),
    enabled: !!user,
    retry: false,
  });

  const { data: myPoints } = useQuery({
    queryKey: ["my-points", "month", "dashboard"],
    queryFn: () => engagementService.myPoints({ period: "month" }).then((r) => r.data),
    enabled: !!user,
  });
  const pendingCheckins = myPoints?.checkins.filter((c) => c.status === "pending") ?? [];

  if (isLoading) return <DashboardSkeleton />;

  const allEvents: Event[] = eventsData?.results ?? eventsData ?? [];
  const upcomingEvents = allEvents.filter((e) => new Date(e.start_date) > new Date()).slice(0, 4);
  const allMembers = membersData?.results ?? membersData ?? [];
  const pendingCandidatures: CandidatureList[] = membershipData ?? [];

  const isAdminUser = user && isAdmin(user.role);
  const isBureauUser = isBureau(user);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">
            {d.greeting(user?.first_name ?? "")}
          </h1>
          <p className="text-fg-muted text-sm mt-1">
            {user ? label.position(user) : ""} · {fmt.date(new Date().toISOString())}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <img
            src={user?.avatar ?? avatarUrl(user?.full_name ?? "U")}
            alt={user?.full_name}
            className="w-10 h-10 rounded-full border-2 border-brand-blue"
          />
        </div>
      </div>

      {/* Point d'étape à remplir */}
      {pendingCheckins.map((c) => (
        <Link key={c.id} href={`/checkins/${c.id}`}
          className="flex items-center gap-4 rounded-xl border border-brand-orange/40 bg-brand-orange/10 px-5 py-4 hover:bg-brand-orange/15 transition-colors">
          <ClipboardList size={20} className="text-orange-700 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-fg text-sm">{t.points.checkinTodo}</p>
            <p className="text-xs text-fg-muted">{c.department_name} · <span className="capitalize">{checkinPeriod(c, intl)}</span></p>
          </div>
          <span className="text-xs font-semibold text-orange-800 shrink-0">{t.points.fill} →</span>
        </Link>
      ))}

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/events" target="_blank" rel="noopener noreferrer" className="bg-surface rounded-xl border border-line-soft p-5 flex items-center gap-4 hover:shadow-md transition-shadow group">
          <div className="p-2.5 rounded-xl bg-brand-blue/10 text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
            <CalendarDays size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-fg">{allEvents.length}</p>
            <p className="text-xs text-fg-muted">{d.events}</p>
          </div>
        </Link>

        {(isAdminUser || isBureauUser) && (
          <Link href="/members" target="_blank" rel="noopener noreferrer" className="bg-surface rounded-xl border border-line-soft p-5 flex items-center gap-4 hover:shadow-md transition-shadow group">
            <div className="p-2.5 rounded-xl bg-brand-orange/10 text-brand-orange group-hover:bg-brand-orange group-hover:text-ink transition-colors">
              <Users size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-fg">{allMembers.length}</p>
              <p className="text-xs text-fg-muted">{d.members}</p>
            </div>
          </Link>
        )}

        {(isAdminUser || user?.poste === "president") && (
          <Link href="/memberships" className="bg-surface rounded-xl border border-line-soft p-5 flex items-center gap-4 hover:shadow-md transition-shadow group">
            <div className="p-2.5 rounded-xl bg-brand-blue/10 text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
              <FileText size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-fg">{pendingCandidatures.length}</p>
              <p className="text-xs text-fg-muted">{d.pendingApplications}</p>
            </div>
          </Link>
        )}

        <div className="bg-surface rounded-xl border border-line-soft p-5 flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-brand-orange/10 text-orange-600">
            <Award size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-fg">0</p>
            <p className="text-xs text-fg-muted">{d.certificates}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prochains événements */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line-soft p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-fg">{t.home.events.title}</h2>
            <Link href="/events" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-blue hover:underline flex items-center gap-1">
              {t.common.seeAll} <ArrowRight size={12} />
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-fg-subtle text-sm py-6 text-center">{d.noUpcoming}</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-muted transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-deep flex items-center justify-center text-white shrink-0">
                    <CalendarDays size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-fg text-sm line-clamp-1 group-hover:text-brand-blue transition-colors">
                      {event.title}
                    </p>
                    <p className="text-xs text-fg-subtle flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> {fmt.date(event.start_date)}
                    </p>
                  </div>
                  {event.is_registered && (
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Mon profil / prochaines étapes */}
        <div className="bg-surface rounded-xl border border-line-soft p-6">
          <h2 className="font-semibold text-fg mb-4">{t.sidebar.profile}</h2>

          {myProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={myProfile.user_avatar ?? avatarUrl(user?.full_name ?? "U")}
                  alt={user?.full_name}
                  className="w-12 h-12 rounded-full border-2 border-brand-blue"
                />
                <div>
                  <p className="font-medium text-fg text-sm">{user?.full_name}</p>
                  {myProfile.member_number && (
                    <p className="text-xs text-brand-orange font-medium">{myProfile.member_number}</p>
                  )}
                </div>
              </div>

              {myProfile.skills && myProfile.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {myProfile.skills.slice(0, 4).map((skill: string) => (
                    <span key={skill} className="bg-brand-blue/10 text-brand-blue text-xs px-2 py-0.5 rounded-full">
                      {skill}
                    </span>
                  ))}
                  {myProfile.skills.length > 4 && (
                    <span className="text-fg-subtle text-xs px-2 py-0.5">+{myProfile.skills.length - 4}</span>
                  )}
                </div>
              )}

              <Link
                href="/profile"
                className="block w-full text-center py-2.5 text-sm font-medium text-brand-blue border border-brand-blue/30 rounded-xl hover:bg-brand-blue hover:text-white transition-colors"
              >
                {d.viewProfile}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-fg-muted">{d.completeProfile}</p>
              <Link
                href="/profile"
                className="block w-full text-center py-2.5 text-sm font-medium bg-brand-blue text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                {d.createProfile}
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 bg-surface-strong rounded w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="bg-surface rounded-xl border border-line-soft p-5 h-20" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface rounded-xl border border-line-soft p-6 h-64" />
        <div className="bg-surface rounded-xl border border-line-soft p-6 h-64" />
      </div>
    </div>
  );
}
