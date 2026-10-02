"use client";

import { useCurrentUser, useLogout } from "@/hooks/useAuth";
import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { PreferencesToggle } from "@/components/PreferencesToggle";

export function DashboardHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const { t, label } = useI18n();

  return (
    <header className="h-[88px] bg-surface border-b border-line flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 rounded-lg text-fg-muted hover:bg-surface-strong transition-colors shrink-0"
          aria-label={t.common.openMenu}
        >
          <Menu size={20} />
        </button>
        <div className="text-sm text-fg-muted hidden sm:block truncate">
          {user && (
            <span>
              <span className="font-medium text-fg">{user.first_name}</span>
              {" "}· {label.position(user)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <PreferencesToggle className="hidden sm:flex mr-1" />
        <Link
          href="/profile"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-surface-muted transition-colors"
        >
          <img
            src={user?.avatar ?? avatarUrl(user?.full_name ?? "U", 32)}
            alt={user?.full_name}
            className="w-8 h-8 rounded-full border border-line object-cover"
          />
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium text-fg leading-tight">{user?.full_name ?? "…"}</p>
            <p className="text-xs text-fg-subtle leading-tight">{user?.email}</p>
          </div>
        </Link>
        <button
          onClick={() => logout.mutate()}
          className="p-2 text-fg-subtle hover:text-red-500 rounded-xl hover:bg-red-50 transition-colors"
          title={t.common.logout}
          aria-label={t.common.logout}
          data-testid="logout-btn"
        >
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
