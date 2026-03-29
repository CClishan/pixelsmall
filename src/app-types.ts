import type { CompressionMetrics } from "@/lib/compression/types";
import type { Locale, MessageDescriptor } from "@/lib/copy";

export type WorkspaceKind = "image" | "pdf";
export type QueueStatus = "pending" | "compressing" | "completed" | "error" | "cancelled";
export type ToastTone = "error" | "info" | "success";

export interface ToastState {
  id: string;
  message: MessageDescriptor;
  tone: ToastTone;
}

export interface QueuedFile {
  id: string;
  workspace: WorkspaceKind;
  name: string;
  size: number;
  label: string;
  kind: "image" | "svg" | "pdf";
  preview?: string;
  status: QueueStatus;
  progress?: number;
  compressedSize?: number;
  originalFile: File;
  resultBlob?: Blob;
  downloadName?: string;
  detail?: MessageDescriptor;
  error?: MessageDescriptor;
  pageCount?: number;
  warning?: MessageDescriptor;
  engine?: string;
  fallbackReason?: MessageDescriptor;
  retainedOriginal?: boolean;
  metrics?: CompressionMetrics;
}

export interface LocaleState {
  active: Locale;
}
