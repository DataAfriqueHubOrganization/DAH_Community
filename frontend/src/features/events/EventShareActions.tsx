"use client";

import { useState } from "react";
import { CalendarPlus, Check, Share2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { EventDetail } from "@/types/events.types";

/** Date au format iCalendar (UTC) : 20261025T090000Z. */
const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

/** « Ajouter à mon agenda » (fichier .ics) et « Partager » (partage natif ou lien copié). */
export function EventShareActions({ event }: { event: EventDetail }) {
  const { t } = useI18n();
  const x = t.eventDetail;
  const [copied, setCopied] = useState(false);

  const addToCalendar = () => {
    const url = window.location.href;
    const start = event.start_date;
    const end = event.end_date ?? new Date(new Date(start).getTime() + 2 * 3600 * 1000).toISOString();
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Data Afrique Hub//Evenements//FR", "BEGIN:VEVENT",
      `UID:${event.id}@dataafriquehub`, `DTSTAMP:${icsDate(new Date().toISOString())}`,
      `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(event.title)}`,
      `LOCATION:${icsText(event.location || event.online_link || "")}`,
      `DESCRIPTION:${icsText(url)}`, `URL:${url}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    link.download = `${event.title.replace(/[^\w\- ]+/g, "").trim() || "evenement"}.ics`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const share = async () => {
    const data = { title: event.title, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* partage annulé */ }
      return;
    }
    await navigator.clipboard.writeText(data.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const btn = "inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-line bg-surface text-sm font-semibold text-fg-soft hover:bg-surface-muted";
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={addToCalendar} className={btn}><CalendarPlus size={16} aria-hidden="true" /> {x.addToCalendar}</button>
      <button type="button" onClick={share} className={btn}>
        {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />} {copied ? x.linkCopied : x.share}
      </button>
    </div>
  );
}
