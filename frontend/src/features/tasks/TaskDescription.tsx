"use client";

import { useState } from "react";
import { toHtml } from "@/components/RichTextEditor";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Description d'une tâche (HTML de l'éditeur, nettoyé par le serveur, ou texte
 *  brut des anciennes tâches) : repliée sur une ligne, dépliable. */
export function TaskDescription({ description }: { description: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!description) return null;
  const html = toHtml(description);
  const long = html.replace(/<[^>]*>/g, "").length > 80 || /<(ul|ol|h2|h3|blockquote)/.test(html) || (html.match(/<p>/g)?.length ?? 0) > 1;
  return (
    <div className="mt-1">
      <div className={cn("rich-content text-xs text-fg-muted [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1", !open && "line-clamp-1")}
        dangerouslySetInnerHTML={{ __html: html }} />
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="text-brand-blue text-xs font-medium hover:underline">
          {open ? t.sidebar.collapse : t.deptDetail.moreDetails}
        </button>
      )}
    </div>
  );
}
