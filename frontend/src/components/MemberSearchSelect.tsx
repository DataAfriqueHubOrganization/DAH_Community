"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { MemberListItem } from "@/types/members.types";
import { useI18n } from "@/i18n/I18nProvider";

export function MemberSearchSelect({
  members,
  value,
  onChange,
  placeholder,
  allowClear = true,
}: {
  members: MemberListItem[];
  value: number | null;
  onChange: (userId: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = members.find((m) => m.user_id === value) ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (selected && !open) {
    return (
      <div className="flex items-center justify-between border border-line rounded-xl px-3 py-2 text-sm bg-surface">
        <span className="truncate">{selected.first_name} {selected.last_name}</span>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery(""); }}
          className="text-fg-subtle hover:text-red-500 shrink-0 ml-2"
          title={t.memberSearch.change}
          aria-label={t.memberSearch.change}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  const filtered = members.filter((m) =>
    !query || `${m.first_name} ${m.last_name}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? t.memberSearch.placeholder}
        className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-line rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {allowClear && (
            <button
              type="button"
              onClick={() => { onChange(null); setQuery(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-fg-subtle hover:bg-surface-muted"
            >
              {t.memberSearch.none}
            </button>
          )}
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-fg-subtle">{t.memberSearch.noResult}</p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => { onChange(m.user_id); setQuery(""); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted flex items-center justify-between gap-2"
              >
                <span>{m.first_name} {m.last_name}</span>
                <span className="text-fg-subtle text-xs truncate">{m.email}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
