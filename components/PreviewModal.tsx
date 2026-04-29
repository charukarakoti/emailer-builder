"use client";
import { useBuilder } from "@/lib/store";
import { generateEmailHtml } from "@/lib/htmlGenerator";
import { useRef } from "react";

/**
 * Sandbox iframe preview. For a full-page preview the TopBar exposes a
 * "new tab" button that ships the same HTML to an isolated blob URL.
 */
export default function PreviewModal({
  mode,
  onClose,
}: {
  mode: "desktop" | "mobile";
  onClose: () => void;
}) {
  const { doc } = useBuilder();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const html = generateEmailHtml(doc);
  const width = mode === "mobile" ? 375 : 720;

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const doc = iframe.contentWindow.document;
    doc.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest("a[href]");
      if (anchor) {
        event.preventDefault();
      }
    });
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
    >
     <div
  onClick={(e) => e.stopPropagation()}
  className="bg-white rounded-lg flex flex-col h-[90vh] shadow-2xl"
  style={{ width }}
>
  <div className="flex items-center justify-between p-3 border-b">
    <div className="text-sm font-semibold">
      {mode === "mobile" ? "📱 Mobile preview" : "🖥 Desktop preview"}
      <span className="ml-2 text-xs text-slate-400">
        {doc.meta.contentWidth}px content · alignment:{" "}
        {doc.meta.alignment}
      </span>
    </div>
    <button onClick={onClose} className="text-sm px-2 py-1 border rounded">
      Close
    </button>
  </div>

  <iframe
    ref={iframeRef}
    srcDoc={html}
    sandbox="allow-same-origin"
    className="flex-1 w-full rounded-b-lg"
    style={{ border: 0 }}
    title="preview"
    onLoad={handleIframeLoad}
  />
</div>
    </div>
  );
}
