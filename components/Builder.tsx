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
import { useAutoSave, loadState } from "@/lib/autosave";

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
  const { doc, history, future, restoreState, undo, redo } = useBuilder();
  const [preview, setPreview] = useState<"desktop" | "mobile" | null>(null);

  // Hydrate persisted state on first mount
  useEffect(() => {
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
