"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, CalendarDays, FileText, Settings, ChevronLeft, ChevronRight, Home, CreditCard, Building2, Newspaper, ShieldCheck, Star, Trophy, Wallet, Landmark, Mail } from "lucide-react";
import { useCurrentUser } from "@/hooks/useAuth";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/i18n/I18nProvider";
import { PreferencesToggle } from "@/components/PreferencesToggle";
import { isAdmin, isBureau, isContributor, isTreasurer } from "@/types/auth.types";

const allNavItems = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, roles: "all" },
  { href: "/manage/events", key: "events", icon: CalendarDays, roles: "bureau" },
  { href: "/manage/members", key: "members", icon: Users, roles: "bureau" },
  // Liste des départements : bureau uniquement — un membre n'y verrait que le sien,
  // déjà accessible via « Mon département ».
  { href: "/manage/departments", key: "departments", icon: Building2, roles: "bureau" },
  { href: "/manage/actualites", key: "news", icon: Newspaper, roles: "bureau" },
  { href: "/manage/emails", key: "emails", icon: Mail, roles: "admin" },
  { href: "/my-department", key: "myDepartment", icon: Building2, roles: "all" },
  { href: "/my-points", key: "myPoints", icon: Star, roles: "all" },
  { href: "/my-contributions", key: "myContributions", icon: Wallet, roles: "contributors" },
  { href: "/treasury", key: "treasury", icon: Landmark, roles: "treasury" },
  // Classement : responsables de département et bureau — jamais les simples membres.
  { href: "/ranking", key: "ranking", icon: Trophy, roles: "managers" },
  { href: "/memberships", key: "applications", icon: FileText, roles: "admin_president" },
  { href: "/manage/access", key: "access", icon: ShieldCheck, roles: "admin" },
  { href: "/member-card", key: "memberCard", icon: CreditCard, roles: "all" },
] as const;

export function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();

  const navItems = allNavItems.filter(item => {
    if (item.roles === "all") return true;
    if (item.roles === "bureau") return isBureau(user);
    if (item.roles === "managers") return isBureau(user) || user?.role === "responsable";
    if (item.roles === "admin") return !!user && isAdmin(user.role);
    if (item.roles === "contributors") return isContributor(user);
    if (item.roles === "treasury") return isTreasurer(user);
    if (item.roles === "admin_president") return user && (isAdmin(user.role) || user.poste === "president");
    return true;
  });

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 ${collapsed ? "md:w-[68px]" : "md:w-64"} bg-panel text-white flex flex-col dark:border-r dark:border-line shrink-0 transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={onMobileClose}
          aria-label={t.sidebar.dashboard}
          className={`flex items-center ${collapsed ? "md:justify-center md:px-0" : ""} px-5 border-b border-white/15 h-[88px] shrink-0`}
        >
          {/* Logo complet quand la sidebar est ouverte, symbole seul quand elle est réduite (< 160 px) */}
          <Logo variant="full" tone="white" height={66} className={collapsed ? "md:hidden" : ""} />
          <Logo variant="symbol" tone="white" height={34} className={collapsed ? "hidden md:block" : "hidden"} />
        </Link>
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(({ href, key, icon: Icon }) => {
            const label = t.sidebar[key];
            // « Mon département » redirige vers /manage/departments/<id> : sans l'entrée
            // « Départements » (masquée hors bureau), c'est elle qui doit être surlignée.
            const showsMyDepartment = !isBureau(user) && pathname.startsWith("/manage/departments/");
            const active = href === "/my-department" && showsMyDepartment
              ? true
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href} title={collapsed ? label : undefined}
                onClick={onMobileClose}
                className={`flex items-center gap-3 ${collapsed ? "md:justify-center md:px-0" : "px-4"} px-4 py-2.5 text-sm transition-colors rounded-xl mx-2 mb-1 ${
                  active ? "bg-white/[0.14] text-white font-semibold shadow-[inset_3px_0_0_var(--brand-orange)]" : "text-white/80 hover:text-white hover:bg-white/[0.08]"
                }`}>
                <Icon size={18} className="shrink-0" />
                <span className={collapsed ? "md:hidden" : ""}>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/15 p-3 space-y-1">
          <PreferencesToggle onDark className="sm:hidden px-3 pb-2" />
          <Link href="/" target="_blank" rel="noopener noreferrer" title={collapsed ? t.sidebar.publicSite : undefined} onClick={onMobileClose} className={`flex items-center gap-3 ${collapsed ? "md:justify-center" : "px-3"} px-3 py-2.5 text-sm text-white/80 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors`}>
            <Home size={16} className="shrink-0" /><span className={collapsed ? "md:hidden" : ""}>{t.sidebar.publicSite}</span>
          </Link>
          <Link href="/profile" title={collapsed ? t.sidebar.profile : undefined} onClick={onMobileClose} className={`flex items-center gap-3 ${collapsed ? "md:justify-center" : "px-3"} px-3 py-2.5 text-sm text-white/80 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors`}>
            <Settings size={16} className="shrink-0" /><span className={collapsed ? "md:hidden" : ""}>{t.sidebar.profile}</span>
          </Link>
          <button onClick={() => setCollapsed(c => !c)} aria-label={collapsed ? t.sidebar.expand : t.sidebar.collapse} className={`hidden md:flex items-center gap-3 ${collapsed ? "justify-center" : "px-3"} py-2 text-white/90 hover:text-white w-full rounded-xl hover:bg-white/[0.08] transition-colors text-sm`}>
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>{t.sidebar.collapse}</span></>}
          </button>
        </div>
      </aside>
    </>
  );
}
