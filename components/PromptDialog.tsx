"use client";

interface PromptDialogProps {
  isOpen: boolean;
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function PromptDialog({
  isOpen,
  title,
  label,
  value,
  placeholder,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
  onChange,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-lg font-semibold text-slate-900 mb-3">{title}</div>
        <label className="text-sm text-slate-500 mb-2 block">{label}</label>
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Loading..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
