"use client";
import { useEffect, useState } from "react";
import TopBar from "./TopBar";
import Canvas from "./Canvas";
import LeftPanel from "./LeftPanel";
import RightPanel from "./RightPanel";
import PreviewModal from "./PreviewModal";
import BuilderDndProvider from "./BuilderDndProvider";
import NotificationProvider from "./NotificationProvider";
import { useBuilder } from "@/lib/store";
import { useAutoSave, loadState, clearSaved } from "@/lib/autosave";

/**
 * v3.1 dashboard:
 *   +--------------------------- TopBar (undo/redo/preview) -----+
 *   |                |                     |                     |
 *   |  Left Panel    |   Canvas            |   Right Panel       |
 *   +------------------------------------------------------------+
 *
 * On mount we hydrate the FULL state — doc + history + future — so undo
 * survives reloads. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z drive history.
 */
export default function Builder() {
  const { doc, history, future, restoreState, setDoc, undo, redo } =
    useBuilder();
  const [preview, setPreview] = useState<"desktop" | "mobile" | null>(null);

  // Hydrate persisted state on first mount.
  //
  // The "Use template" flow from /templates passes ?template=<id> on the URL.
  // When that's present we want a fresh canvas seeded with that template's
  // doc — NOT the previously-autosaved draft. We honour that by:
  //   1. Skipping the localStorage restore.
  //   2. Clearing any prior autosave so the template doesn't get
  //      immediately overwritten by leftover state.
  //   3. Fetching /api/templates/<id> and pushing it into the store.
  // The query param is removed from the URL once the template is loaded so
  // a refresh doesn't keep re-loading the same template.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const templateId = params.get("template");
    const fresh = params.get("fresh") === "1";

    // ?fresh=1 (from the chooser modal "New template" flow) → wipe the
    // autosaved draft and DON'T hydrate. The zustand store's initial
    // `doc: newDocument()` already gives a blank canvas, so we just have to
    // clear localStorage and strip the param.
    if (fresh) {
      clearSaved();
      const url = new URL(window.location.href);
      url.searchParams.delete("fresh");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (templateId) {
      clearSaved();
      fetch(`/api/templates/${encodeURIComponent(templateId)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.template?.doc) {
            // Deep-clone so subsequent edits don't mutate the cached row.
            setDoc(JSON.parse(JSON.stringify(data.template.doc)));
          }
        })
        .catch(() => {
          /* fall back silently — user can pick from dropdown */
        })
        .finally(() => {
          // Drop the query param so reloads don't re-trigger the fetch.
          const url = new URL(window.location.href);
          url.searchParams.delete("template");
          window.history.replaceState({}, "", url.toString());
        });
      return;
    }
    const saved = loadState();
    if (saved) restoreState(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist doc + history + future every 4s
  useAutoSave(doc, history, future, 4000);

  // Keyboard shortcuts for undo / redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <NotificationProvider>
      <div className="flex flex-col h-screen">
        <TopBar onPreview={setPreview} />
        {/*
          BuilderDndProvider wraps LeftPanel + Canvas + RightPanel so the
          palette draggables (in LeftPanel) share a single DndContext with
          the column droppables and block sortables (in Canvas). Without
          this lift, palette items have no DndContext ancestor and
          silently no-op.
        */}
        <BuilderDndProvider>
          <div className="flex flex-1 overflow-hidden">
            <LeftPanel />
            <Canvas />
            <RightPanel />
          </div>
        </BuilderDndProvider>
        {preview && (
          <PreviewModal mode={preview} onClose={() => setPreview(null)} />
        )}
      </div>
    </NotificationProvider>
  );
}
