import { AlertCircle, CheckCircle2, Settings, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ToastState } from "@/app-types";
import type { Locale } from "@/lib/copy";
import { translateMessage } from "@/lib/copy";

interface ToastRegionProps {
  locale: Locale;
  closeLabel: string;
  toast: ToastState | null;
  onClose: () => void;
}

export function ToastRegion({ locale, closeLabel, toast, onClose }: ToastRegionProps) {
  return (
    <AnimatePresence>
      {toast ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 20 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed left-1/2 top-0 z-50 w-full max-w-xl -translate-x-1/2 px-4"
        >
          <div className="surface-card flex items-center gap-4 px-4 py-4 sm:px-5">
            <div className="status-card-icon">
              {toast.tone === "error" ? (
                <AlertCircle className="h-5 w-5 text-[var(--error)]" />
              ) : toast.tone === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
              ) : (
                <Settings className="h-5 w-5 text-[var(--text-primary)]" />
              )}
            </div>
            <p className="flex-1 text-sm font-medium leading-6 text-[var(--text-primary)]">
              {translateMessage(locale, toast.message)}
            </p>
            <button type="button" onClick={onClose} className="ghost-icon-button" aria-label={closeLabel}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
