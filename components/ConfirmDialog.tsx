"use client";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "primary";
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  isOpen,
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const confirmButtonColor =
    confirmVariant === "danger"
      ? "bg-red-600 hover:bg-red-700"
      : "bg-blue-600 hover:bg-blue-700";

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm transition-all duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-2xl p-6 w-[420px] transform transition-all duration-300 ease-out scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="font-semibold text-lg text-slate-900 mb-2">
          {title}
        </div>

        {/* Message */}
        <div className="text-sm text-slate-600 mb-6 leading-relaxed">
          {message}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-md border border-slate-300 text-slate-700 font-medium text-sm hover:bg-slate-50 active:bg-slate-100 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-white font-medium text-sm transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonColor}`}
          >
            {isLoading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
