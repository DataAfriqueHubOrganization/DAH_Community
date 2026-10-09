"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import { ArrowRight, Eye, Send, Users, X } from "lucide-react";
import { mailingService } from "@/services/mailing.service";
import { useCurrentUser } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Logo } from "@/components/ui/Logo";
import { apiError } from "@/features/treasury/shared";
import { Modal } from "./Modal";
import type { MailTemplate, MailableMember, SendMemberEmailPayload } from "@/types/mailing.types";

const TEMPLATES: MailTemplate[] = ["annonce", "convocation", "volontaires", "felicitations", "libre"];
type Group = "all" | "bureau" | "leads" | "department";
const GROUPS: Group[] = ["all", "bureau", "leads", "department"];

const initials = (m: { first_name: string; last_name: string }) =>
  `${m.first_name[0] ?? ""}${m.last_name[0] ?? ""}`.toUpperCase();

/** Rédaction d'un email aux membres : modèle, destinataires, message, aperçu, quota. */
export function Composer({ onSent }: { onSent: (message: string) => void }) {
  const { t, label } = useI18n();
  const x = t.mailing;
  const qc = useQueryClient();
  const { data: user } = useCurrentUser();

  // ── Contenu ──
  const [template, setTemplate] = useState<MailTemplate>("annonce");
  const [subject, setSubject] = useState(x.templateContent.annonce.subject);
  const [body, setBody] = useState(x.templateContent.annonce.body);
  const [editorKey, setEditorKey] = useState(0);
  const [withCta, setWithCta] = useState(false);
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const onEditor = useCallback((ed: Editor | null) => setEditor(ed), []);

  const pickTemplate = (key: MailTemplate) => {
    const content = x.templateContent[key];
    setTemplate(key);
    setSubject(content.subject);
    setBody(content.body);
    setEditorKey((k) => k + 1); // l'éditeur repart du contenu du modèle
    setWithCta(!!content.cta);
    setCtaLabel(content.cta);
    setCtaUrl("");
  };
  const insert = (token: string) => editor?.chain().focus().insertContent(token).run();

  // ── Destinataires ──
  const [mode, setMode] = useState<"selection" | "group">("selection");
  const [group, setGroup] = useState<Group>("all");
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [selected, setSelected] = useState<MailableMember[]>([]);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data: audiences } = useQuery({
    queryKey: ["mailing", "audiences"],
    queryFn: () => mailingService.audiences().then((r) => r.data),
  });
  const { data: found = [], isFetching: searching } = useQuery({
    queryKey: ["mailing", "members", debounced],
    queryFn: () => mailingService.searchMembers(debounced).then((r) => r.data),
    enabled: mode === "selection" && open,
  });
  const suggestions = found.filter((m) => !selected.some((s) => s.id === m.id));

  const department = audiences?.departments.find((d) => d.id === departmentId);
  const groupCount = (g: Group) =>
    g === "department" ? department?.count ?? 0 : audiences?.groups[g] ?? 0;
  const count = mode === "selection" ? selected.length : groupCount(group);

  // ── Quota ──
  const quota = audiences?.quota;
  const remaining = quota?.remaining ?? 0;
  const overQuota = !!quota && count > remaining;
  const pct = (n: number) => `${quota ? Math.min(n / quota.limit, 1) * 100 : 0}%`;

  // ── Envoi ──
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const payload = (test: boolean): SendMemberEmailPayload => ({
    subject, body, template,
    cta_label: withCta ? ctaLabel : "",
    cta_url: withCta ? ctaUrl : "",
    audience: mode === "selection" ? "selection" : group,
    department: mode === "group" && group === "department" ? departmentId : null,
    user_ids: mode === "selection" ? selected.map((m) => m.id) : [],
    test,
  });
  const send = useMutation({
    mutationFn: (test: boolean) => mailingService.send(payload(test)).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["mailing"] });
      if ("test" in data) {
        setNotice(x.testSent(data.email));
      } else {
        setConfirming(false);
        setSelected([]);
        onSent(x.sent(data.total));
      }
    },
    onError: () => setConfirming(false),
  });
  const preview = useMutation({
    mutationFn: () => mailingService.preview({
      subject, body, cta_label: withCta ? ctaLabel : "", cta_url: withCta ? ctaUrl : "",
    }).then((r) => r.data),
  });

  const contentValid = subject.trim() !== "" && body.replace(/<[^>]*>/g, "").trim() !== ""
    && (!withCta || (ctaLabel.trim() !== "" && /^https?:\/\/\S+$/.test(ctaUrl.trim())));
  const recipientsValid = count > 0 && (mode === "selection" || group !== "department" || !!departmentId);
  const canSend = contentValid && recipientsValid && !overQuota && !send.isPending;

  // Aperçu en direct, personnalisé avec le nom de l'administrateur.
  const me = { first: user?.first_name ?? "Awa", last: user?.last_name ?? "" };
  const personal = useCallback((text: string) =>
    text.replaceAll("{prénom}", me.first).replaceAll("{prenom}", me.first).replaceAll("{nom}", me.last),
  [me.first, me.last]);
  const previewHtml = useMemo(() => personal(body), [body, personal]);
  const recipientsSummary = mode === "selection"
    ? selected.map((m) => `${m.first_name} ${m.last_name}`).join(", ")
    : group === "department" ? `${x.groups.department} · ${department?.name ?? ""}` : x.groups[group];

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      <section aria-label={x.tabs.compose} className="flex-1 min-w-0 w-full bg-surface rounded-2xl border border-line">
        {/* 1. Modèle */}
        <div className="p-6 border-b border-line-soft space-y-3">
          <h2 className="font-display font-bold text-[15px] text-fg">{x.stepTemplate}</h2>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((key) => (
              <button key={key} type="button" aria-pressed={template === key} onClick={() => pickTemplate(key)}
                className={cn("h-10 px-4 rounded-full border text-sm transition-colors",
                  template === key ? "bg-brand-blue border-brand-blue text-white font-semibold" : "border-line-strong text-fg-soft hover:bg-surface-muted")}>
                {x.templates[key]}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Destinataires */}
        <div className="p-6 border-b border-line-soft space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-bold text-[15px] text-fg">{x.stepRecipients}</h2>
            <div role="tablist" className="inline-flex gap-1 p-1 bg-surface-strong rounded-xl">
              {(["selection", "group"] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={cn("h-9 px-3.5 rounded-lg text-[13px] transition-all",
                    mode === m ? "bg-surface shadow-sm font-semibold text-fg" : "text-fg-soft hover:text-fg")}>
                  {m === "selection" ? x.modeSelect : x.modeGroup}
                </button>
              ))}
            </div>
          </div>

          {mode === "selection" ? (
            <div ref={searchRef} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 min-h-12 px-2.5 py-2 rounded-xl border border-line-strong focus-within:ring-2 focus-within:ring-brand-blue/20">
                {selected.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-2 pl-1 pr-1.5 py-1 rounded-lg bg-brand-blue/10 text-sm font-medium text-fg">
                    <span aria-hidden="true" className="w-6 h-6 rounded-md bg-brand-blue text-white text-[11px] font-semibold flex items-center justify-center">{initials(m)}</span>
                    {m.first_name} {m.last_name}
                    <button type="button" onClick={() => setSelected((s) => s.filter((v) => v.id !== m.id))}
                      aria-label={x.removeMember(`${m.first_name} ${m.last_name}`)}
                      className="w-6 h-6 rounded-md flex items-center justify-center text-fg-soft hover:bg-brand-blue/15 hover:text-fg">
                      <X size={14} />
                    </button>
                  </span>
                ))}
                <label className="flex-1 min-w-[180px]">
                  <span className="sr-only">{x.searchMember}</span>
                  <input type="search" value={query} placeholder={x.searchMember}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
                    className="w-full h-9 px-1 bg-transparent text-sm focus:outline-none" />
                </label>
              </div>
              {open && (
                <div className="rounded-xl border border-line overflow-hidden">
                  <p className="px-3.5 py-2 text-xs text-fg-muted bg-surface-muted">{x.suggestions}</p>
                  <div className="max-h-64 overflow-y-auto">
                    {suggestions.length === 0 ? (
                      <p className="px-3.5 py-3 text-sm text-fg-muted border-t border-line-soft">
                        {searching ? t.common.loading : x.noMember}
                      </p>
                    ) : suggestions.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 px-3.5 py-2.5 border-t border-line-soft">
                        <span aria-hidden="true" className="w-8 h-8 rounded-lg bg-surface-strong text-fg-soft text-xs font-semibold flex items-center justify-center shrink-0">{initials(m)}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-fg truncate">{m.first_name} {m.last_name}</span>
                          <span className="block text-xs text-fg-muted truncate">{label.position(m)} · {m.email}</span>
                        </span>
                        <button type="button" onClick={() => { setSelected((s) => [...s, m]); setQuery(""); }}
                          className="h-9 px-3 rounded-lg border border-line-strong text-[13px] font-medium text-brand-deep hover:bg-surface-muted">
                          {x.addMember}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GROUPS.map((g) => (
                <div key={g} className={cn("rounded-xl transition-colors",
                  group === g ? "border-2 border-brand-blue bg-brand-blue/[0.06]" : "border border-line-strong")}>
                  <button type="button" aria-pressed={group === g} onClick={() => setGroup(g)}
                    className="w-full min-h-16 px-3.5 py-3 flex items-center justify-between gap-3 text-left">
                    <span>
                      <span className="block text-sm font-semibold text-fg">{x.groups[g]}</span>
                      <span className="block text-xs text-fg-muted">{x.groupHints[g]}</span>
                    </span>
                    {(g !== "department" || department) && (
                      <span className="font-display font-extrabold text-lg text-brand-deep">{groupCount(g)}</span>
                    )}
                  </button>
                  {g === "department" && group === "department" && (
                    <div className="px-3.5 pb-3">
                      <label className="sr-only" htmlFor="mail-department">{x.pickDepartment}</label>
                      <select id="mail-department" value={departmentId ?? ""}
                        onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}
                        className="w-full h-10 px-3 rounded-lg border border-line-strong bg-surface text-sm">
                        <option value="">{x.pickDepartment}</option>
                        {audiences?.departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.count})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="flex items-center gap-2 text-[13px] text-fg-soft">
            <Users size={16} className="text-brand-blue shrink-0" aria-hidden="true" />
            <span><b className="text-fg">{x.recipients(count)}</b> · {x.privacy}</span>
          </p>
        </div>

        {/* 3. Message */}
        <div className="p-6 space-y-4">
          <h2 className="font-display font-bold text-[15px] text-fg">{x.stepMessage}</h2>
          <div>
            <label htmlFor="mail-subject" className="block text-[13px] font-medium text-fg-soft mb-1.5">{x.subject}</label>
            <input id="mail-subject" value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 150))}
              className="w-full h-11 px-3.5 rounded-xl border border-line-strong bg-surface text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <span className="text-[13px] font-medium text-fg-soft">{x.message}</span>
              <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                {x.insert}
                {["{prénom}", "{nom}"].map((token) => (
                  <button key={token} type="button" onClick={() => insert(token)} disabled={!editor}
                    className="h-7 px-2.5 rounded-md border border-line-strong bg-surface text-xs font-medium text-brand-deep hover:bg-surface-muted disabled:opacity-50">
                    {token}
                  </button>
                ))}
              </span>
            </div>
            <RichTextEditor key={editorKey} value={body} onChange={setBody} onEditor={onEditor} minHeight={240} label={x.message} />
          </div>
          <div className="rounded-xl bg-surface-muted p-4 space-y-3">
            <label className="flex items-center gap-2.5 text-sm font-medium text-fg cursor-pointer">
              <input type="checkbox" checked={withCta} onChange={(e) => setWithCta(e.target.checked)} className="w-[18px] h-[18px] accent-brand-blue" />
              {x.withCta}
            </label>
            {withCta && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mail-cta-label" className="block text-[13px] font-medium text-fg-soft mb-1.5">{x.ctaLabel}</label>
                  <input id="mail-cta-label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value.slice(0, 60))}
                    className="w-full h-10 px-3 rounded-lg border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                </div>
                <div>
                  <label htmlFor="mail-cta-url" className="block text-[13px] font-medium text-fg-soft mb-1.5">{x.ctaUrl}</label>
                  <input id="mail-cta-url" type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…"
                    className="w-full h-10 px-3 rounded-lg border border-line-strong bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                </div>
              </div>
            )}
          </div>
        </div>

        {(notice || send.isError || preview.isError) && (
          <p role="status" className={cn("px-6 pb-3 text-sm", notice && !send.isError ? "text-green-600" : "text-red-600")}>
            {send.isError ? apiError(send.error, t.common.error) : preview.isError ? apiError(preview.error, t.common.error) : notice}
          </p>
        )}

        <footer className="flex flex-wrap items-center gap-3 px-6 py-4 border-t border-line bg-surface-muted/60 rounded-b-2xl">
          <button type="button" onClick={() => { setNotice(null); send.mutate(true); }} disabled={!contentValid || send.isPending}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line-strong bg-surface text-sm font-medium text-fg hover:bg-surface-muted disabled:opacity-50">
            <Send size={16} aria-hidden="true" /> {x.test}
          </button>
          <button type="button" onClick={() => preview.mutate()} disabled={!contentValid || preview.isPending}
            className="inline-flex items-center gap-2 h-11 px-4 rounded-xl border border-line-strong bg-surface text-sm font-medium text-fg hover:bg-surface-muted disabled:opacity-50">
            <Eye size={16} aria-hidden="true" /> {x.fullPreview}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={() => { setNotice(null); setConfirming(true); }} disabled={!canSend}
            className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold shadow-lg shadow-brand-blue/25 hover:bg-brand-deep disabled:opacity-50 disabled:shadow-none">
            {x.send(count)} <ArrowRight size={16} aria-hidden="true" />
          </button>
        </footer>
      </section>

      <aside className="w-full xl:w-[380px] shrink-0 space-y-4">
        {/* Aperçu en direct (gabarit des emails DAH) */}
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-line-soft">
            <span className="font-display font-bold text-sm text-fg">{x.livePreview}</span>
            <span className="text-xs text-fg-muted truncate ml-2">{x.seenBy(`${me.first} ${me.last}`.trim())}</span>
          </div>
          <div className="p-4 bg-[#EEF0F3]">
            <div className="rounded-lg bg-white overflow-hidden shadow-sm text-[#3F3F46]">
              <div className="h-1 flex"><span className="w-[78%] bg-[#2F6FE0]" /><span className="flex-1 bg-[#FB7C2C]" /></div>
              <div className="px-5 pt-4"><Logo variant="full" tone="color" height={48} /></div>
              <div className="px-5 py-4 space-y-3 text-[13px] leading-relaxed">
                <p className="font-display text-[15px] font-extrabold text-[#111114] leading-snug">{personal(subject) || "—"}</p>
                <div className="rich-content text-[13px] [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                {withCta && ctaLabel && (
                  <span className="inline-block rounded-lg bg-[#2F6FE0] text-white font-semibold px-4 py-2">{ctaLabel}</span>
                )}
                <p className="whitespace-pre-line text-[#111114]">{"À bientôt,\nL'équipe Data Afrique Hub"}</p>
              </div>
              <div className="px-5 py-3 bg-[#1E4FAF] text-[11px] text-white/85">Former · Innover · Transformer</div>
            </div>
          </div>
        </div>

        {/* Quota Brevo du jour, partagé avec les envois automatiques */}
        {quota && (
          <div className="bg-surface rounded-2xl border border-line p-4 space-y-2.5">
            <div className="flex items-baseline justify-between">
              <span className="font-display font-bold text-sm text-fg">{x.quotaTitle}</span>
              <span className="text-[13px] text-fg-soft"><b className="text-fg">{quota.sent_today}</b> / {quota.limit}</span>
            </div>
            <div role="img" aria-label={x.quotaAria(quota.sent_today, count, quota.limit)}
              className="h-2 rounded bg-surface-strong flex gap-0.5 overflow-hidden">
              <span className="block bg-brand-deep rounded-l" style={{ width: pct(quota.sent_today) }} />
              <span className="block bg-brand-orange rounded-r" style={{ width: pct(Math.min(count, remaining)) }} />
            </div>
            <div className="flex flex-wrap gap-3.5 text-xs text-fg-soft">
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-brand-deep" />{x.quotaUsed}</span>
              <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="w-2.5 h-2.5 rounded-sm bg-brand-orange" />{x.quotaThis}</span>
            </div>
            {overQuota ? (
              <p className="rounded-lg bg-brand-orange/12 px-3 py-2.5 text-[13px] leading-snug text-fg">{x.quotaOver(remaining)}</p>
            ) : (
              <p className="text-xs text-fg-muted">{x.quotaAfter(Math.max(remaining - count, 0))}</p>
            )}
          </div>
        )}

        <div className="bg-surface rounded-2xl border border-line p-4 space-y-1.5 text-[13px] leading-relaxed text-fg-soft">
          <p className="font-display font-bold text-sm text-fg">{x.personalTitle}</p>
          <p>
            <code className="px-1.5 py-0.5 rounded bg-brand-blue/10 text-xs text-brand-deep">{"{prénom}"}</code>{" "}
            <code className="px-1.5 py-0.5 rounded bg-brand-blue/10 text-xs text-brand-deep">{"{nom}"}</code>{" "}
            {x.personalHint}
          </p>
        </div>
      </aside>

      {confirming && (
        <Modal labelledBy="mail-confirm-title" onClose={() => setConfirming(false)}>
          <div className="p-6 pb-2 space-y-3.5">
            <span className="w-11 h-11 rounded-xl bg-brand-blue/10 flex items-center justify-center">
              <Send size={20} className="text-brand-blue" aria-hidden="true" />
            </span>
            <h2 id="mail-confirm-title" className="font-display font-extrabold text-xl text-fg">{x.confirmTitle(count)}</h2>
            <p className="text-sm text-fg-soft leading-relaxed">{x.confirmIntro}</p>
            <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-xl bg-surface-muted px-4 py-3.5 text-sm">
              <dt className="text-fg-muted">{x.subject}</dt><dd className="font-medium text-fg">{subject}</dd>
              <dt className="text-fg-muted">{x.confirmRecipients}</dt><dd className="font-medium text-fg line-clamp-3">{recipientsSummary}</dd>
              {quota && (<><dt className="text-fg-muted">{x.confirmQuota}</dt><dd className="font-medium text-fg">{x.confirmQuotaValue(quota.sent_today + count, quota.limit)}</dd></>)}
            </dl>
          </div>
          <div className="flex justify-end gap-2.5 p-6 pt-4">
            <button type="button" onClick={() => setConfirming(false)}
              className="h-11 px-4 rounded-xl border border-line-strong text-sm font-medium text-fg hover:bg-surface-muted">{t.common.cancel}</button>
            <button type="button" onClick={() => send.mutate(false)} disabled={send.isPending}
              className="h-11 px-5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-brand-deep disabled:opacity-50">
              {send.isPending ? t.common.sending : x.confirmSend}
            </button>
          </div>
        </Modal>
      )}

      {preview.data && !preview.isPending && (
        <Modal labelledBy="mail-preview-title" onClose={() => preview.reset()} wide>
          <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-line-soft">
            <h2 id="mail-preview-title" className="font-display font-bold text-[15px] text-fg truncate">{preview.data.subject}</h2>
            <button type="button" onClick={() => preview.reset()} aria-label={t.common.close} className="text-fg-subtle hover:text-fg"><X size={20} /></button>
          </div>
          {/* Rendu exact de l'email (serveur), isolé du site. */}
          <iframe title={x.fullPreview} srcDoc={preview.data.html} sandbox="" className="w-full h-[70vh] bg-[#F7F8FA]" />
        </Modal>
      )}
    </div>
  );
}
