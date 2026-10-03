"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold, Heading2, Heading3, ImageIcon, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

/** Texte brut (anciens contenus) → HTML : un paragraphe par bloc. */
export function toHtml(value: string): string {
  if (!value) return "";
  if (/^\s*</.test(value)) return value;
  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return value.split(/\n{2,}/).map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Éditeur de texte riche (Tiptap) : titres, gras, italique, listes, citation,
 *  lien, image. Produit du HTML, affiché avec la classe `rich-content`. */
export function RichTextEditor({
  value, onChange, placeholder, variant = "boxed", minHeight = 220, label,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** « document » : sans cadre, gros texte (éditeur d'article) ; « boxed » : champ de formulaire. */
  variant?: "boxed" | "document";
  minHeight?: number;
  label?: string;
}) {
  const editor = useEditor({
    immediatelyRender: false, // rendu côté client uniquement (Next.js)
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" } },
      }),
      Image,
      Placeholder.configure({ placeholder: placeholder ?? "" }),
    ],
    content: toHtml(value),
    editorProps: {
      attributes: {
        class: cn("rich-content focus:outline-none", variant === "document" ? "text-[17px]" : "text-sm"),
        style: `min-height:${minHeight}px`,
        ...(label ? { "aria-label": label } : {}),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.isEmpty ? "" : editor.getHTML()),
  });

  // Contenu chargé après coup (édition d'un élément existant).
  useEffect(() => {
    if (editor && value && editor.isEmpty) editor.commands.setContent(toHtml(value), { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={cn(variant === "boxed" && "rounded-2xl border border-line bg-surface overflow-hidden focus-within:ring-2 focus-within:ring-brand-blue/20")}>
      <Toolbar editor={editor} variant={variant} />
      <div className={cn(variant === "boxed" ? "px-4 py-3" : "pt-2")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function Toolbar({ editor, variant }: { editor: Editor | null; variant: "boxed" | "document" }) {
  const { t } = useI18n();
  const e = t.editor;
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed ? {
      h2: ed.isActive("heading", { level: 2 }),
      h3: ed.isActive("heading", { level: 3 }),
      bold: ed.isActive("bold"),
      italic: ed.isActive("italic"),
      bullet: ed.isActive("bulletList"),
      ordered: ed.isActive("orderedList"),
      quote: ed.isActive("blockquote"),
      link: ed.isActive("link"),
      canUndo: ed.can().undo(),
      canRedo: ed.can().redo(),
    } : null,
  });
  if (!editor || !state) return <div className={cn("h-11", variant === "boxed" && "border-b border-line-soft bg-surface-muted")} />;

  const setLink = () => {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(e.linkPrompt, previous ?? "https://");
    if (url === null) return;
    if (url === "" || url === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const addImage = () => {
    const url = window.prompt(e.imagePrompt, "https://");
    if (url && url !== "https://") editor.chain().focus().setImage({ src: url }).run();
  };

  const groups: { key: string; icon: React.ReactNode; label: string; active?: boolean; disabled?: boolean; run: () => void }[][] = [
    [
      { key: "h2", icon: <Heading2 size={16} />, label: e.h2, active: state.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
      { key: "h3", icon: <Heading3 size={16} />, label: e.h3, active: state.h3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    ],
    [
      { key: "b", icon: <Bold size={16} />, label: e.bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
      { key: "i", icon: <Italic size={16} />, label: e.italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
      { key: "ul", icon: <List size={16} />, label: e.bullet, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
      { key: "ol", icon: <ListOrdered size={16} />, label: e.ordered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
      { key: "q", icon: <Quote size={16} />, label: e.quote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    ],
    [
      { key: "a", icon: <Link2 size={16} />, label: e.link, active: state.link, run: setLink },
      { key: "img", icon: <ImageIcon size={16} />, label: e.image, run: addImage },
    ],
    [
      { key: "undo", icon: <Undo2 size={16} />, label: e.undo, disabled: !state.canUndo, run: () => editor.chain().focus().undo().run() },
      { key: "redo", icon: <Redo2 size={16} />, label: e.redo, disabled: !state.canRedo, run: () => editor.chain().focus().redo().run() },
    ],
  ];

  return (
    <div role="toolbar" aria-label={e.toolbar}
      className={cn("flex flex-wrap items-center gap-0.5",
        variant === "boxed" ? "px-2 py-1.5 border-b border-line-soft bg-surface-muted" : "w-fit rounded-xl bg-surface-muted p-1 sticky top-0 z-10")}>
      {groups.map((group, gi) => (
        <span key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="w-px h-5 bg-line mx-1" aria-hidden="true" />}
          {group.map((b) => (
            <button key={b.key} type="button" onClick={b.run} disabled={b.disabled} title={b.label} aria-label={b.label} aria-pressed={b.active}
              className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30",
                b.active ? "bg-fg text-surface" : "text-fg-soft hover:bg-surface hover:text-fg")}>
              {b.icon}
            </button>
          ))}
        </span>
      ))}
    </div>
  );
}
