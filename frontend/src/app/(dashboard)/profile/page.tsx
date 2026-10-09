"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useAuth";
import { membersService } from "@/services/members.service";
import { avatarUrl } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import { Edit2, Plus, Trash2, ExternalLink, GitBranch, Link2, Globe, Check, X, Lock, AlertTriangle, Camera } from "lucide-react";
import { authService } from "@/services/auth.service";
import { useDeleteAccount } from "@/hooks/useAuth";
import type { MemberProfile, MemberExperience, MemberCertification } from "@/types/members.types";

export default function ProfilePage() {
  const { t, fmt, label } = useI18n();
  const p = t.myProfile;
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => membersService.myProfile().then((r) => r.data),
    retry: 1,
  });

  const updateProfile = useMutation({
    mutationFn: (data: Partial<MemberProfile>) => membersService.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const updateAvatar = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      return authService.updateMe(formData);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });
  const removeAvatar = useMutation({
    mutationFn: () => authService.updateMe({ avatar: null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) updateAvatar.mutate(file);
    e.target.value = "";
  }

  const [editBio, setEditBio] = useState(false);
  const [bioValue, setBioValue] = useState("");
  const [editSkills, setEditSkills] = useState(false);
  const [skillsValue, setSkillsValue] = useState("");

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 bg-surface-strong rounded-2xl" />
        <div className="h-48 bg-surface-strong rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-fg">{t.sidebar.profile}</h1>

      {/* Identité */}
      <div className="bg-surface rounded-2xl border border-line-soft p-6">
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <img
              src={user?.avatar ?? avatarUrl(user?.full_name ?? "U", 80)}
              alt={user?.full_name}
              className="w-20 h-20 rounded-2xl border-2 border-brand-blue object-cover"
            />
            {user?.avatar && (
              <button
                onClick={() => removeAvatar.mutate()}
                disabled={removeAvatar.isPending}
                title={p.removePhoto}
                aria-label={p.removePhoto}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center border-2 border-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <X size={11} />
              </button>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={updateAvatar.isPending}
              title={p.changePhoto}
              aria-label={p.changePhoto}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 bg-brand-blue text-white rounded-full flex items-center justify-center border-2 border-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Camera size={12} />
            </button>
            <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-fg">{user?.full_name}</h2>
            <p className="text-brand-orange font-medium text-sm">{user ? label.position(user) : ""}</p>
            {user?.department && (
              <p className="text-fg-subtle text-xs mt-0.5">{user.department.name}</p>
            )}
            {profile?.member_number && (
              <span className="inline-block mt-1 text-xs bg-brand-deep text-white px-2.5 py-0.5 rounded-full">
                {profile.member_number}
              </span>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-fg-muted">
              <span>{user?.email}</span>
              {user?.phone && <span>{user.phone}</span>}
              {profile?.created_at && <span>{t.memberCard.memberSince} {fmt.date(profile.created_at)}</span>}
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mt-6 pt-5 border-t border-line-soft">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-fg text-sm">{p.bio}</h3>
            <button onClick={() => { setEditBio(true); setBioValue(profile?.bio ?? ""); }} className="text-brand-blue text-xs flex items-center gap-1 hover:underline">
              <Edit2 size={12} /> {t.common.edit}
            </button>
          </div>
          {editBio ? (
            <div className="space-y-2">
              <textarea value={bioValue} onChange={(e) => setBioValue(e.target.value)} rows={3} className="w-full border border-line rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 resize-none" />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditBio(false)} aria-label={t.common.cancel} className="px-3 py-1.5 text-xs border border-line rounded-lg hover:bg-surface-muted"><X size={12} /></button>
                <button onClick={() => { updateProfile.mutate({ bio: bioValue }); setEditBio(false); }} className="px-3 py-1.5 text-xs bg-brand-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                  <Check size={12} /> {t.common.save}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-fg-muted text-sm leading-relaxed">{profile?.bio || <span className="text-fg-faint italic">{p.noBio}</span>}</p>
          )}
        </div>

        {/* Compétences */}
        <div className="mt-5 pt-5 border-t border-line-soft">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-fg text-sm">{t.profile.skills}</h3>
            <button onClick={() => { setEditSkills(true); setSkillsValue((profile?.skills ?? []).join(", ")); }} className="text-brand-blue text-xs flex items-center gap-1 hover:underline">
              <Edit2 size={12} /> {t.common.edit}
            </button>
          </div>
          {editSkills ? (
            <div className="space-y-2">
              <input value={skillsValue} onChange={(e) => setSkillsValue(e.target.value)} placeholder="Python, SQL, Tableau, ..." className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
              <p className="text-xs text-fg-subtle">{p.skillsHint}</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditSkills(false)} aria-label={t.common.cancel} className="px-3 py-1.5 text-xs border border-line rounded-lg hover:bg-surface-muted"><X size={12} /></button>
                <button onClick={() => { updateProfile.mutate({ skills: skillsValue.split(",").map(s => s.trim()).filter(Boolean) }); setEditSkills(false); }} className="px-3 py-1.5 text-xs bg-brand-blue text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                  <Check size={12} /> {t.common.save}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile?.skills?.length ? profile.skills.map((s: string) => (
                <span key={s} className="bg-brand-blue/10 text-brand-blue text-xs px-3 py-1 rounded-full font-medium">{s}</span>
              )) : <span className="text-fg-faint text-sm italic">{p.noSkills}</span>}
            </div>
          )}
        </div>

        {/* Liens */}
        <div className="mt-5 pt-5 border-t border-line-soft">
          <h3 className="font-medium text-fg text-sm mb-3">{p.links}</h3>
          <div className="space-y-2">
            {[
              { key: "github_url", icon: GitBranch, label: "GitHub", placeholder: "https://github.com/..." },
              { key: "linkedin_url", icon: Link2, label: "LinkedIn", placeholder: "https://linkedin.com/in/..." },
              { key: "website_url", icon: Globe, label: t.profile.website, placeholder: "https://monsite.com" },
            ].map(({ key, icon: Icon, label, placeholder }) => (
              <div key={key} className="flex items-center gap-3">
                <Icon size={16} className="text-fg-subtle shrink-0" />
                <input
                  type="url"
                  defaultValue={(profile as Record<string, string>)?.[key] ?? ""}
                  placeholder={placeholder}
                  aria-label={label}
                  onBlur={(e) => { if (e.target.value !== (profile as Record<string, string>)?.[key]) updateProfile.mutate({ [key]: e.target.value }); }}
                  className="flex-1 border border-line rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
                />
                {(profile as Record<string, string>)?.[key] && (
                  <a href={(profile as Record<string, string>)[key]} target="_blank" rel="noopener noreferrer" className="text-brand-blue">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Visibilité sur le site public (choix du membre) */}
      {user && user.role !== "visiteur" && user.role !== "candidat" && <VisibilitySection profile={profile} />}

      {/* Expériences */}
      <ExperiencesSection profile={profile} />

      {/* Certifications */}
      <CertificationsSection profile={profile} />

      {/* Mot de passe */}
      <PasswordSection />

      {/* Zone de danger */}
      <DeleteAccountSection />
    </div>
  );
}

function VisibilitySection({ profile }: { profile: MemberProfile | undefined }) {
  const { t } = useI18n();
  const p = t.myProfile;
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (isPublic: boolean) => membersService.updateProfile({ is_public: isPublic }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });
  if (!profile) return null;
  const on = update.isPending ? !!update.variables : profile.is_public;

  return (
    <section id="visibilite" aria-labelledby="visibility-title" className="bg-surface rounded-2xl border border-line-soft p-6 scroll-mt-24">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="visibility-title" className="font-semibold text-fg">{p.visibilityTitle}</h2>
          <p className="text-sm text-fg-muted mt-1 max-w-xl">{on ? p.visibilityOn : p.visibilityOff}</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-labelledby="visibility-title"
          onClick={() => update.mutate(!profile.is_public)} disabled={update.isPending}
          className={`relative shrink-0 w-12 h-7 rounded-full transition-colors disabled:opacity-60 ${on ? "bg-brand-blue" : "bg-surface-strong border border-line-strong"}`}>
          <span aria-hidden="true" className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>
      <dl className="mt-4 grid grid-cols-1 sm:grid-cols-[140px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-fg-muted">{p.visibilityShownLabel}</dt><dd className="text-fg">{p.visibilityShown}</dd>
        <dt className="text-fg-muted">{p.visibilityNeverLabel}</dt><dd className="text-fg">{p.visibilityNever}</dd>
      </dl>
      {profile.is_public && profile.slug && (
        <a href={`/members/${profile.slug}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 text-sm font-medium text-brand-blue hover:underline">
          {p.visibilityView} <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      {update.isError && <p role="status" className="mt-3 text-sm text-red-600">{t.common.error}</p>}
    </section>
  );
}

function ExperiencesSection({ profile }: { profile: MemberProfile | undefined }) {
  const { t, fmt } = useI18n();
  const p = t.myProfile;
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", start_date: "", end_date: "", is_current: false, description: "" });

  const createExp = useMutation({
    mutationFn: (data: typeof form) =>
      membersService.experiences.create({
        ...data,
        // Un DateField Django rejette "" (attend une date valide ou null)
        end_date: data.is_current || !data.end_date ? null : data.end_date,
      } as Omit<MemberExperience, "id">),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-profile"] }); setAdding(false); setForm({ title: "", company: "", start_date: "", end_date: "", is_current: false, description: "" }); },
  });
  const deleteExp = useMutation({
    mutationFn: (id: number) => membersService.experiences.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  return (
    <div className="bg-surface rounded-2xl border border-line-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-fg">{p.experiencesTitle}</h2>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-brand-blue hover:underline">
          <Plus size={14} /> {t.common.add}
        </button>
      </div>

      {adding && (
        <div className="bg-surface-muted rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder={`${p.position} *`} aria-label={p.position} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm col-span-2" />
            <input placeholder={`${t.eventForm.organisation} *`} aria-label={t.eventForm.organisation} value={form.company} onChange={e => setForm(f => ({...f, company: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm" />
            <input type="date" aria-label={p.startDate} value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm text-fg-soft col-span-2">
              <input type="checkbox" checked={form.is_current} onChange={e => setForm(f => ({...f, is_current: e.target.checked}))} />
              {p.currentPosition}
            </label>
            {!form.is_current && <input type="date" aria-label={p.endDate} value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm" />}
            <textarea placeholder={p.description} aria-label={p.description} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={2} className="border border-line rounded-lg px-3 py-2 text-sm col-span-2 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs border border-line rounded-lg">{t.common.cancel}</button>
            <button onClick={() => createExp.mutate(form)} disabled={!form.title || !form.company || !form.start_date} className="px-4 py-1.5 text-xs bg-brand-blue text-white rounded-lg disabled:opacity-50">
              {createExp.isPending ? "..." : t.common.add}
            </button>
          </div>
        </div>
      )}

      {profile?.experiences?.length === 0 && !adding && (
        <p className="text-fg-subtle text-sm py-4 text-center italic">{p.noExperience}</p>
      )}
      <div className="space-y-4">
        {profile?.experiences?.map((exp: MemberExperience) => (
          <div key={exp.id} className="flex items-start gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-brand-deep flex items-center justify-center text-white shrink-0 mt-0.5">
              <span className="text-xs font-bold">{exp.company.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-fg text-sm">{exp.title}</p>
                  <p className="text-brand-blue text-xs">{exp.company}</p>
                  <p className="text-fg-subtle text-xs mt-0.5">
                    {fmt.date(exp.start_date)} — {exp.is_current ? t.profile.present : exp.end_date ? fmt.date(exp.end_date) : "?"}
                  </p>
                </div>
                <button onClick={() => deleteExp.mutate(exp.id)} aria-label={t.common.delete} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1">
                  <Trash2 size={14} />
                </button>
              </div>
              {exp.description && <p className="text-fg-muted text-xs leading-relaxed mt-1">{exp.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordSection() {
  const { t } = useI18n();
  const p = t.myProfile;
  const qc = useQueryClient();
  const [form, setForm] = useState({ old_password: "", new_password: "", new_password_confirm: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => authService.changePassword(form),
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setForm({ old_password: "", new_password: "", new_password_confirm: "" });
      setTimeout(() => setSuccess(false), 4000);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? p.wrongCurrentPassword);
    },
  });

  const valid = form.old_password && form.new_password.length >= 8 && form.new_password === form.new_password_confirm;

  return (
    <div className="bg-surface rounded-2xl border border-line-soft p-6">
      <div className="flex items-center gap-2 mb-4">
        <Lock size={16} className="text-fg" />
        <h2 className="font-semibold text-fg">{p.changePassword}</h2>
      </div>
      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 flex items-center gap-2">
          <Check size={14} /> {p.passwordChanged}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">{error}</div>
      )}
      <div className="space-y-3">
        {[
          { key: "old_password", label: p.currentPassword, placeholder: "••••••••" },
          { key: "new_password", label: t.auth.newPassword, placeholder: t.auth.passwordMinPlaceholder },
          { key: "new_password_confirm", label: t.common.confirm, placeholder: p.repeatNewPassword },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label htmlFor={`pwd-${key}`} className="block text-xs text-fg-muted mb-1">{label}</label>
            <input
              id={`pwd-${key}`}
              type="password"
              value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20"
            />
          </div>
        ))}
        {form.new_password && form.new_password_confirm && form.new_password !== form.new_password_confirm && (
          <p className="text-xs text-red-500">{t.validation.passwordMismatch}</p>
        )}
        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={!valid || mutation.isPending}
            className="px-5 py-2 bg-brand-blue text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteAccountSection() {
  const { t } = useI18n();
  const p = t.myProfile;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const deleteAccount = useDeleteAccount();

  function handleDelete() {
    setError("");
    deleteAccount.mutate(password, {
      onError: (err: unknown) => {
        const detail = (err as { response?: { data?: { detail?: { password?: string[] } | string } } })?.response?.data?.detail;
        if (typeof detail === "object" && detail?.password) {
          setError(detail.password[0]);
        } else {
          setError(typeof detail === "string" ? detail : p.wrongPassword);
        }
      },
    });
  }

  return (
    <div className="bg-surface rounded-2xl border border-red-100 p-6">
      <button
        onClick={() => { setOpen((o) => !o); setPassword(""); setError(""); }}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" />
          <h2 className="font-semibold text-red-600">{p.deleteAccount}</h2>
        </div>
        <span className="text-xs text-fg-subtle">{open ? t.common.close : p.open}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-fg-soft">
            {p.deleteWarningBefore} <strong>{p.irreversible}</strong>. {p.deleteWarningAfter}
          </p>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-600">{error}</div>
          )}
          <div>
            <label htmlFor="delete-password" className="block text-xs text-fg-muted mb-1">{t.auth.password}</label>
            <input
              id="delete-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-line rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleDelete}
              disabled={!password || deleteAccount.isPending}
              className="px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleteAccount.isPending ? p.deleting : p.deleteForever}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CertificationsSection({ profile }: { profile: MemberProfile | undefined }) {
  const { t, fmt } = useI18n();
  const p = t.myProfile;
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", issuer: "", issued_date: "", credential_url: "" });

  const createCert = useMutation({
    mutationFn: (data: typeof form) => membersService.certifications.create(data as Omit<MemberCertification, "id">),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-profile"] }); setAdding(false); setForm({ title: "", issuer: "", issued_date: "", credential_url: "" }); },
  });
  const deleteCert = useMutation({
    mutationFn: (id: number) => membersService.certifications.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-profile"] }),
  });

  return (
    <div className="bg-surface rounded-2xl border border-line-soft p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-fg">{t.profile.certifications}</h2>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-xs text-brand-blue hover:underline">
          <Plus size={14} /> {t.common.add}
        </button>
      </div>

      {adding && (
        <div className="bg-surface-muted rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder={`${p.certTitle} *`} aria-label={p.certTitle} value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm col-span-2" />
            <input placeholder={`${p.issuer} *`} aria-label={p.issuer} value={form.issuer} onChange={e => setForm(f => ({...f, issuer: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm" />
            <input type="date" aria-label={p.issuedDate} value={form.issued_date} onChange={e => setForm(f => ({...f, issued_date: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm" />
            <input placeholder={p.credentialUrl} aria-label={p.credentialUrl} type="url" value={form.credential_url} onChange={e => setForm(f => ({...f, credential_url: e.target.value}))} className="border border-line rounded-lg px-3 py-2 text-sm col-span-2" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs border border-line rounded-lg">{t.common.cancel}</button>
            <button onClick={() => createCert.mutate(form)} disabled={!form.title || !form.issuer || !form.issued_date} className="px-4 py-1.5 text-xs bg-brand-blue text-white rounded-lg disabled:opacity-50">
              {createCert.isPending ? "..." : t.common.add}
            </button>
          </div>
        </div>
      )}

      {profile?.certifications?.length === 0 && !adding && (
        <p className="text-fg-subtle text-sm py-4 text-center italic">{p.noCertification}</p>
      )}
      <div className="space-y-3">
        {profile?.certifications?.map((cert: MemberCertification) => (
          <div key={cert.id} className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-brand-orange/10 flex items-center justify-center shrink-0">
              <span className="text-brand-orange text-lg">🏅</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-fg text-sm">{cert.title}</p>
              <p className="text-fg-muted text-xs">{cert.issuer} · {fmt.date(cert.issued_date)}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {cert.credential_url && (
                <a href={cert.credential_url} target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:text-blue-700 p-1">
                  <ExternalLink size={14} />
                </a>
              )}
              <button onClick={() => deleteCert.mutate(cert.id)} aria-label={t.common.delete} className="text-red-400 hover:text-red-600 p-1">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
