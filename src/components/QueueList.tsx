import { AlertCircle, CheckCircle2, Download, FileText, Image as ImageIcon, Layers, Loader2, X } from "lucide-react";
import type { QueuedFile, WorkspaceKind } from "@/app-types";
import type { Locale } from "@/lib/copy";
import { formatTemplate, getCopy, itemCountLabel, pageCountLabel, translateMessage } from "@/lib/copy";
import { formatDuration, formatSavings, formatSize } from "@/lib/format";

interface QueueListProps {
  locale: Locale;
  workspace: WorkspaceKind;
  title: string;
  emptyLabel: string;
  files: QueuedFile[];
  isProcessing: boolean;
  downloadLabel: string;
  removeLabel: string;
  cancelLabel: string;
  clearLabel: string;
  onDownload: (file: QueuedFile) => void;
  onRemove: (file: QueuedFile) => void;
  onCancel: (file: QueuedFile) => void;
  onClearAll: () => void;
}

export function QueueList({
  locale,
  workspace,
  title,
  emptyLabel,
  files,
  isProcessing,
  downloadLabel,
  removeLabel,
  cancelLabel,
  clearLabel,
  onDownload,
  onRemove,
  onCancel,
  onClearAll,
}: QueueListProps) {
  const emptyIconLabel = workspace === "image" ? "IMG" : "PDF";

  return (
    <section className="surface-card queue-shell overflow-hidden">
      <div className="queue-header">
        <div className="queue-header__copy">
          <div className="queue-header__title-row">
            <span className="queue-header__icon">
              <Layers className="h-3.5 w-3.5" />
            </span>
            <h2 className="queue-title">{title}</h2>
          </div>
        </div>
        <div className="queue-header__actions">
          <span className="queue-count-chip">{itemCountLabel(locale, files.length)}</span>
          <button
            type="button"
            onClick={onClearAll}
            disabled={!files.length || isProcessing}
            className="queue-clear-button"
          >
            {clearLabel}
          </button>
        </div>
      </div>

      <div className="queue-body">
        {files.length ? (
          <div className="divide-y divide-[var(--soft-border)]">
            {files.map((file) => {
              const savings = formatSavings(file.size, file.compressedSize);
              const detail = translateMessage(locale, file.detail);
              const warning = translateMessage(locale, file.warning);
              const error = translateMessage(locale, file.error);
              const fallbackReason = translateMessage(locale, file.fallbackReason);
              const fallbackLabel = fallbackReason
                ? formatTemplate(getCopy(locale).templates.fallbackReasonPrefix, { reason: fallbackReason })
                : "";
              const completedInfoMessages = [
                file.status === "completed" && file.retainedOriginal && detail ? detail : "",
                warning,
                fallbackLabel,
              ].filter(Boolean);
              const showCollapsedCompletedInfo = file.status === "completed" && completedInfoMessages.length > 0;
              const inlineDetail = file.status === "completed" && file.retainedOriginal ? "" : detail;

              return (
                <div
                  key={file.id}
                  className="queue-row group"
                >
                  <div className="queue-row__main">
                    <div className="queue-thumbnail">
                      {file.preview ? (
                        <img src={file.preview} alt={file.name} className="h-full w-full object-cover" />
                      ) : (
                        <FileText className="h-4 w-4 text-[var(--text-secondary)]" />
                      )}
                    </div>

                    <div className="queue-copy">
                      <p className="queue-file-name">{file.name}</p>
                      <div className="queue-meta">
                        <span className="eyebrow-chip">{formatSize(file.size)}</span>
                        <span className="eyebrow-chip">{file.label}</span>
                        {typeof file.pageCount === "number" ? <span className="eyebrow-chip">{pageCountLabel(locale, file.pageCount)}</span> : null}
                        {file.engine ? <span className="eyebrow-chip">{file.engine}</span> : null}
                        {file.compressedSize ? (
                          <>
                            <span className="eyebrow-chip eyebrow-chip--success">{formatSize(file.compressedSize)}</span>
                            {savings ? <span className="eyebrow-chip text-[var(--success)]">-{savings}%</span> : null}
                          </>
                        ) : null}
                        {file.metrics ? <span className="eyebrow-chip">{formatDuration(file.metrics.durationMs)}</span> : null}
                      </div>
                      {inlineDetail ? (file.status === "pending" ? null : <p className="queue-detail">{inlineDetail}</p>) : null}
                      {!showCollapsedCompletedInfo && warning ? <p className="queue-note queue-note--warning">{warning}</p> : null}
                      {!showCollapsedCompletedInfo && fallbackLabel ? <p className="queue-note">{fallbackLabel}</p> : null}
                      {error ? <p className="queue-note queue-note--error">{error}</p> : null}
                    </div>
                  </div>

                  <div className="queue-actions">
                    <div className="queue-status-cluster">
                      {file.status === "pending" ? <span className="queue-status-pill">READY</span> : null}

                      <div className="queue-state-icon">
                        {file.status === "compressing" ? (
                          <Loader2 className="smooth-spin h-4 w-4 text-[var(--text-secondary)]" />
                        ) : file.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
                        ) : file.status === "error" ? (
                          <AlertCircle className="h-4 w-4 text-[var(--error)]" />
                        ) : file.status === "cancelled" ? (
                          <AlertCircle className="h-4 w-4 text-[var(--warning)]" />
                        ) : null}
                      </div>

                      {showCollapsedCompletedInfo ? (
                        <div className="queue-info-tooltip">
                          <span className="queue-info-tooltip__trigger" aria-hidden="true">
                            <AlertCircle className="h-3.5 w-3.5" />
                          </span>
                          <div className="queue-info-tooltip__bubble">
                            {completedInfoMessages.map((message) => (
                              <p key={message}>{message}</p>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="queue-action-buttons">
                      {file.status === "completed" ? (
                        <button
                          type="button"
                          onClick={() => onDownload(file)}
                          className="queue-action-button queue-action-button--download"
                          aria-label={downloadLabel}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => (file.status === "compressing" ? onCancel(file) : onRemove(file))}
                        className="queue-action-button"
                        aria-label={file.status === "compressing" ? cancelLabel : removeLabel}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="queue-empty-state">
            <div className="queue-empty-badge">
              <div className="queue-empty-icon">
                <ImageIcon className="h-4 w-4 text-neutral-300" />
              </div>
            </div>
            <p className="queue-empty-copy">{emptyLabel}</p>
          </div>
        )}
      </div>
    </section>
  );
}
