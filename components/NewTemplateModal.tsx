"use client";

// =============================================================================
// components/NewTemplateModal.tsx — "How would you like to start?" chooser.
//
// Shown when a user clicks "+ New Template" from the templates gallery (or
// any other entry point that wants to fork the new-template flow). Two
// large selectable cards:
//
//   1. Drag & Drop Email Builder  → routes to `/?fresh=1`
//   2. HTML Code Editor           → routes to `/html-editor?fresh=1`
//
// Keyboard:
//   - Esc closes
//   - Enter activates the focused card
//
// The fresh=1 query param is intentional — it tells the destination page
// to start with a blank canvas instead of the previous draft.
// =============================================================================

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function NewTemplateModal({ open, onClose }: Props) {
  const router = useRouter();

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function go(href: string) {
    onClose();
    // Small delay so the modal can finish its close transition before the
    // next page mounts and steals focus.
    setTimeout(() => router.push(href), 50);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-[fadeIn_.15s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="text-xs font-medium tracking-wider text-indigo-600 uppercase">
            New template
          </div>
          <h2 className="text-2xl font-semibold text-slate-900 mt-1">
            How would you like to start?
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
            Pick the editor that fits how you work. Both produce the same
            kind of saved template and can be sent through the same SMTP
            account.
          </p>
        </div>

        {/* Choices */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-6 pb-6">
          <ChoiceCard
            onClick={() => go("/?fresh=1")}
            tone="indigo"
            badge="Recommended"
            title="Drag & Drop Email Builder"
            subtitle="No coding required"
            description="Visually compose your email — drop in text, images, buttons, columns. Outputs clean, table-based HTML that renders well in Outlook and Gmail."
            features={[
              "Block-based visual editor",
              "Real-time preview · undo / redo",
              "Outlook-compatible export",
              "Save & reuse as template",
            ]}
            icon={<DragDropIcon />}
          />
          <ChoiceCard
            onClick={() => go("/html-editor?fresh=1")}
            tone="slate"
            badge="For developers"
            title="HTML Code Editor"
            subtitle="Bring your own markup"
            description="Paste, import or hand-write raw HTML. Live side-by-side preview shows exactly what subscribers will see, with desktop/mobile toggles."
            features={[
              "Paste raw HTML or upload .html files",
              "Live split-screen preview",
              "Outlook-compatible rendering",
              "Keeps all the markup you wrote",
            ]}
            icon={<CodeIcon />}
          />
        </div>

        <div className="px-6 pb-5 text-center text-xs text-slate-400">
          You can switch editors later — both save to the same workspace
          library.
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Choice card                                                        */
/* ------------------------------------------------------------------ */

function ChoiceCard({
  onClick,
  tone,
  badge,
  title,
  subtitle,
  description,
  features,
  icon,
}: {
  onClick: () => void;
  tone: "indigo" | "slate";
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
}) {
  const accent =
    tone === "indigo"
      ? {
          ring: "hover:border-indigo-400",
          chip: "bg-indigo-50 text-indigo-700",
          icon: "from-indigo-500 to-blue-600 text-white",
          cta: "bg-indigo-600 hover:bg-indigo-700 text-white",
        }
      : {
          ring: "hover:border-slate-400",
          chip: "bg-slate-100 text-slate-700",
          icon: "from-slate-800 to-slate-900 text-white",
          cta: "bg-slate-900 hover:bg-black text-white",
        };

  return (
    <button
      onClick={onClick}
      className={
        "group text-left rounded-2xl border border-slate-200 p-5 bg-white transition transform hover:-translate-y-0.5 hover:shadow-lg " +
        accent.ring
      }
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={
            "h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-sm " +
            accent.icon
          }
        >
          {icon}
        </div>
        <span
          className={
            "inline-flex items-center text-[11px] font-medium tracking-wide px-2 py-1 rounded-full " +
            accent.chip
          }
        >
          {badge}
        </span>
      </div>
      <div>
        <div className="text-base font-semibold text-slate-900">{title}</div>
        <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
      </div>
      <p className="text-sm text-slate-600 mt-3 leading-relaxed">
        {description}
      </p>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li
            key={f}
            className="text-sm text-slate-600 flex items-start gap-2"
          >
            <span className="mt-0.5 text-emerald-500">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div
        className={
          "mt-4 inline-flex items-center gap-1 h-9 px-3 rounded-lg text-sm font-medium transition " +
          accent.cta
        }
      >
        Continue
        <span className="group-hover:translate-x-0.5 transition">→</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function DragDropIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="18" height="7" rx="1.5" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 18l6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
      <path d="M13 4l-2 16" />
    </svg>
  );
}
