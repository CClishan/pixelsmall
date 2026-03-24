import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Image as ImageIcon,
  FileText,
  X,
  Download,
  Trash2,
  Settings,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
  GripVertical,
  Archive,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import JSZip from "jszip";
import {
  compressImageFile,
  compressPdfFile,
  estimatePdfPages,
  type ImageOutputFormat,
} from "@/lib/compression";
import { formatSavings, formatSize, formatTimestamp, sanitizeFileName } from "@/lib/format";

type QueueStatus = "pending" | "compressing" | "completed" | "error" | "cancelled";
type QueueKind = "image" | "pdf";
type ToastTone = "error" | "info" | "success";
type DownloadType = "all" | "images" | "pdfs";

interface ToastState {
  id: string;
  message: string;
  tone: ToastTone;
}

interface QueuedFile {
  id: string;
  name: string;
  size: number;
  label: string;
  kind: QueueKind;
  preview?: string;
  status: QueueStatus;
  compressedSize?: number;
  originalFile: File;
  resultBlob?: Blob;
  downloadName?: string;
  detail?: string;
  error?: string;
  pageCount?: number;
  warning?: string;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const LARGE_IMAGE_WARNING = 12 * 1024 * 1024;
const LARGE_PDF_WARNING = 30 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "application/pdf",
]);

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getFileLabel(file: File) {
  if (file.type === "application/pdf") {
    return "PDF";
  }

  if (file.type.includes("jpeg")) {
    return "JPG";
  }

  if (file.type.includes("png")) {
    return "PNG";
  }

  if (file.type.includes("webp")) {
    return "WEBP";
  }

  if (file.type.includes("bmp")) {
    return "BMP";
  }

  if (file.type.includes("tiff")) {
    return "TIFF";
  }

  return "FILE";
}

function createQueuedFile(file: File): QueuedFile {
  const isImage = file.type.startsWith("image/");

  return {
    id: createId(),
    name: file.name,
    size: file.size,
    label: getFileLabel(file),
    kind: isImage ? "image" : "pdf",
    preview: isImage ? URL.createObjectURL(file) : undefined,
    status: "pending",
    originalFile: file,
    detail: isImage ? "Ready for browser-side image compression." : "Preparing PDF page estimate...",
  };
}

function createPdfOptions(quality: number) {
  return {
    dpi: quality >= 88 ? 156 : quality >= 72 ? 140 : quality >= 55 ? 126 : 110,
    jpegQuality: Math.min(Math.max(quality / 100, 0.42), 0.86),
  };
}

export default function App() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [outputFormat, setOutputFormat] = useState<ImageOutputFormat>("JPG");
  const [quality, setQuality] = useState(85);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<QueuedFile[]>([]);
  const controllersRef = useRef<Record<string, AbortController>>({});
  const sessionStampRef = useRef(formatTimestamp());

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const completedFiles = useMemo(
    () => files.filter((file) => file.status === "completed" && file.resultBlob && file.downloadName),
    [files],
  );
  const completedImages = completedFiles.filter((file) => file.kind === "image");
  const completedPdfs = completedFiles.filter((file) => file.kind === "pdf");

  function showToast(message: string, tone: ToastTone = "info") {
    setToast({ id: createId(), message, tone });
  }

  function updateFile(id: string, patch: Partial<QueuedFile>) {
    setFiles((current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  }

  function removeFile(id: string) {
    const activeController = controllersRef.current[id];
    if (activeController) {
      activeController.abort(new Error("Compression cancelled by user."));
      delete controllersRef.current[id];
    }

    setFiles((current) => {
      const target = current.find((file) => file.id === id);
      if (target?.preview) {
        URL.revokeObjectURL(target.preview);
      }
      return current.filter((file) => file.id !== id);
    });
  }

  function clearQueue() {
    for (const controller of Object.values(controllersRef.current) as AbortController[]) {
      controller.abort(new Error("Compression cancelled by reset."));
    }
    controllersRef.current = {};

    filesRef.current.forEach((file) => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });

    setFiles([]);
    setIsProcessing(false);
    showToast("Queue cleared. Any running jobs were cancelled.");
  }

  function cancelFile(id: string) {
    const controller = controllersRef.current[id];
    if (!controller) {
      return;
    }

    controller.abort(new Error("Compression cancelled by user."));
    delete controllersRef.current[id];
    updateFile(id, {
      status: "cancelled",
      detail: "Cancelled by user.",
      error: undefined,
    });
    showToast("Cancelled one running job.");
  }

  async function enrichPdfMeta(queuedFile: QueuedFile) {
    try {
      const pageCount = await estimatePdfPages(queuedFile.originalFile);
      updateFile(queuedFile.id, {
        pageCount,
        detail: `${pageCount} page${pageCount === 1 ? "" : "s"} ready for scanned-PDF compression.`,
      });

      if (pageCount > 40) {
        updateFile(queuedFile.id, {
          warning: "Long PDF detected. Expect slower processing and higher browser memory usage.",
        });
        showToast("Long PDF detected. Expect slower local processing.");
      }
    } catch {
      updateFile(queuedFile.id, {
        detail: "PDF uploaded. Page estimate unavailable in this browser.",
      });
    }
  }

  function handleFileUpload(
    event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement>,
  ) {
    let uploadedFiles: FileList | null = null;

    if ("files" in event.target && event.target.files) {
      uploadedFiles = event.target.files;
    } else if ("dataTransfer" in event && event.dataTransfer.files) {
      uploadedFiles = event.dataTransfer.files;
    }

    if (!uploadedFiles?.length) {
      return;
    }

    const queue: QueuedFile[] = [];

    Array.from(uploadedFiles).forEach((file) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        showToast(`Unsupported file type: ${file.name}`, "error");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        showToast(`File too large (max 50MB): ${file.name}`, "error");
        return;
      }

      if (file.type.startsWith("image/") && file.size >= LARGE_IMAGE_WARNING) {
        showToast(`${file.name} is large. Compression may take longer on this device.`);
      }

      if (file.type === "application/pdf" && file.size >= LARGE_PDF_WARNING) {
        showToast(`${file.name} is a large PDF. Expect higher browser memory usage.`);
      }

      queue.push(createQueuedFile(file));
    });

    if (!queue.length) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setFiles((current) => [...current, ...queue]);

    queue.forEach((queuedFile) => {
      if (queuedFile.kind === "pdf") {
        void enrichPdfMeta(queuedFile);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function compressQueue() {
    const pendingFiles = filesRef.current.filter((file) =>
      ["pending", "error", "cancelled"].includes(file.status),
    );

    if (!pendingFiles.length) {
      showToast("No pending files to compress.", "error");
      return;
    }

    setIsProcessing(true);

    try {
      for (const queuedFile of pendingFiles) {
        if (!filesRef.current.some((file) => file.id === queuedFile.id)) {
          continue;
        }

        const controller = new AbortController();
        controllersRef.current[queuedFile.id] = controller;

        updateFile(queuedFile.id, {
          status: "compressing",
          error: undefined,
          detail:
            queuedFile.kind === "image"
              ? "Compressing image locally in your browser..."
              : `Rasterizing ${queuedFile.pageCount ?? "PDF"} pages locally...`,
        });

        try {
          if (queuedFile.kind === "image") {
            const result = await compressImageFile(
              queuedFile.originalFile,
              { outputFormat, quality },
              controller.signal,
              (progress) => {
                updateFile(queuedFile.id, {
                  detail: `Compressing image locally... ${Math.round(progress)}%`,
                });
              },
            );

            updateFile(queuedFile.id, {
              status: "completed",
              compressedSize: result.file.size,
              resultBlob: result.file,
              downloadName: result.file.name,
              detail: "Image compressed and ready to download.",
              warning: result.warning ?? queuedFile.warning,
            });

            if (result.warning) {
              showToast(result.warning);
            }
          } else {
            const pdfOptions = createPdfOptions(quality);
            const compressedPdf = await compressPdfFile(
              queuedFile.originalFile,
              pdfOptions,
              controller.signal,
              (currentPage, totalPages) => {
                updateFile(queuedFile.id, {
                  detail: `Compressing scanned PDF page ${currentPage}/${totalPages}...`,
                });
              },
            );

            updateFile(queuedFile.id, {
              status: "completed",
              compressedSize: compressedPdf.size,
              resultBlob: compressedPdf,
              downloadName: compressedPdf.name,
              detail: "PDF compressed and ready to download.",
            });
          }
        } catch (error) {
          if (controller.signal.aborted) {
            updateFile(queuedFile.id, {
              status: "cancelled",
              detail: "Cancelled before completion.",
              error: undefined,
            });
          } else {
            const message =
              error instanceof Error ? error.message : "Compression failed in this browser.";

            updateFile(queuedFile.id, {
              status: "error",
              detail: "Compression failed.",
              error: message,
            });
            showToast(message, "error");
          }
        } finally {
          delete controllersRef.current[queuedFile.id];
        }
      }

      if (filesRef.current.some((file) => file.status === "completed")) {
        showToast("Compression finished. Results are ready to download.", "success");
      }
    } finally {
      setIsProcessing(false);
    }
  }

  function downloadSingle(file: QueuedFile) {
    if (!file.resultBlob || !file.downloadName) {
      showToast("This file is not ready to download yet.", "error");
      return;
    }

    const url = URL.createObjectURL(file.resultBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.downloadName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${file.downloadName}.`, "success");
  }

  async function downloadZip(type: DownloadType) {
    const selectedFiles = completedFiles.filter((file) => {
      if (type === "all") {
        return true;
      }

      if (type === "images") {
        return file.kind === "image";
      }

      return file.kind === "pdf";
    });

    if (!selectedFiles.length) {
      showToast(`No ${type === "all" ? "completed files" : type} to download.`, "error");
      return;
    }

    if (selectedFiles.length === 1) {
      downloadSingle(selectedFiles[0]);
      return;
    }

    const zip = new JSZip();
    const prefix =
      type === "all" ? "pixelsmall-bundle" : type === "images" ? "pixelsmall-images" : "pixelsmall-pdfs";

    selectedFiles.forEach((file) => {
      const safeName = sanitizeFileName(file.downloadName ?? file.name);

      if (type === "all") {
        const folder = file.kind === "image" ? "images" : "pdfs";
        zip.folder(folder)?.file(safeName, file.resultBlob!);
        return;
      }

      zip.file(safeName, file.resultBlob!);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${prefix}-${sessionStampRef.current}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast(`Prepared ${selectedFiles.length} files in ${anchor.download}.`, "success");
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#fcfcfc] font-sans selection:bg-zinc-900 selection:text-white">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 20 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
          >
            <div
              className={`bg-white shadow-xl rounded-2xl p-4 flex items-center gap-3 border ${
                toast.tone === "error"
                  ? "border-red-100"
                  : toast.tone === "success"
                    ? "border-emerald-100"
                    : "border-zinc-100"
              }`}
            >
              <div
                className={`p-2 rounded-xl ${
                  toast.tone === "error"
                    ? "bg-red-50"
                    : toast.tone === "success"
                      ? "bg-emerald-50"
                      : "bg-zinc-50"
                }`}
              >
                {toast.tone === "error" ? (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                ) : toast.tone === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Settings className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <p className="text-sm font-bold text-zinc-900 flex-grow">{toast.message}</p>
              <button onClick={() => setToast(null)} className="text-zinc-300 hover:text-zinc-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="w-full max-w-6xl mx-auto px-8 py-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center shadow-lg shadow-zinc-200">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">PixelSmall</h1>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 font-bold text-[10px] tracking-[0.2em] uppercase">
          <Settings className="w-4 h-4" />
          Configuration
        </div>
      </header>

      <main className="flex-grow w-full max-w-6xl mx-auto px-8 pb-20 grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <section
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                return;
              }
              setIsDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDragging(false);
              handleFileUpload(event);
            }}
            className={`bg-white rounded-2xl border shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all cursor-pointer group relative overflow-hidden ${
              isDragging
                ? "border-zinc-900 shadow-[0_12px_40px_rgb(0,0,0,0.06)]"
                : "border-zinc-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              multiple
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
            />
            <div className="flex flex-col items-center justify-center py-24 px-8 relative z-10">
              <div className="bg-zinc-50 p-5 rounded-2xl mb-6 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-zinc-300" />
              </div>
              <p className="text-zinc-400 font-bold text-sm">
                {isDragging ? "Drop files to queue them locally" : "Drag & Drop or Click to Upload"}
              </p>
              <p className="text-[10px] text-zinc-300 font-bold uppercase tracking-widest mt-2">
                Images & PDF · Max 50MB
              </p>
            </div>
            <div className="absolute inset-0 bg-zinc-50/0 group-hover:bg-zinc-50/20 transition-colors" />
          </section>

          <section className="bg-white rounded-2xl border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden">
            <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-50">
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-zinc-900" />
                <h2 className="font-bold text-sm text-zinc-900">Queue List</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.2em]">
                  {files.length} ITEMS
                </span>
              </div>
            </div>

            <div className="p-8">
              {files.length > 0 ? (
                <Reorder.Group axis="y" values={files} onReorder={setFiles} className="space-y-4">
                  {files.map((file) => {
                    const savings = formatSavings(file.size, file.compressedSize);

                    return (
                      <Reorder.Item
                        key={file.id}
                        value={file}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-5 bg-zinc-50/50 rounded-xl group cursor-grab active:cursor-grabbing border border-transparent hover:border-zinc-100 transition-all"
                      >
                        <div className="flex items-center gap-5 min-w-0">
                          <GripVertical className="w-4 h-4 text-zinc-200 group-hover:text-zinc-300 transition-colors shrink-0" />
                          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center shadow-sm overflow-hidden border border-zinc-50 shrink-0">
                            {file.preview ? (
                              <img src={file.preview} alt={file.name} className="w-full h-full object-cover" />
                            ) : (
                              <FileText className="w-6 h-6 text-zinc-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-zinc-900 truncate max-w-[240px]">{file.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                {formatSize(file.size)}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-widest">
                                {file.label}
                              </span>
                              {typeof file.pageCount === "number" && (
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                  {file.pageCount} Pages
                                </span>
                              )}
                              {file.compressedSize ? (
                                <>
                                  <span className="text-zinc-300 text-[10px]">→</span>
                                  <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
                                    {formatSize(file.compressedSize)}
                                  </span>
                                  {savings ? (
                                    <span className="text-[10px] font-bold text-green-500/70 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded">
                                      -{savings}%
                                    </span>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                            {file.detail ? (
                              <p className="mt-2 text-[11px] font-medium text-zinc-400 truncate max-w-[340px]">
                                {file.detail}
                              </p>
                            ) : null}
                            {file.warning ? (
                              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                                {file.warning}
                              </p>
                            ) : null}
                            {file.error ? (
                              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-red-500">
                                {file.error}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {file.status === "compressing" ? (
                            <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                          ) : file.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : file.status === "error" ? (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          ) : file.status === "cancelled" ? (
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                          ) : null}

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {file.status === "completed" ? (
                              <button
                                onClick={() => downloadSingle(file)}
                                className="p-2 hover:bg-white rounded-lg transition-colors text-zinc-400 hover:text-zinc-900 shadow-sm border border-transparent hover:border-zinc-100"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            ) : null}
                            <button
                              onClick={() => (file.status === "compressing" ? cancelFile(file.id) : removeFile(file.id))}
                              className="p-2 hover:bg-white rounded-lg transition-colors text-zinc-300 hover:text-red-500 shadow-sm border border-transparent hover:border-zinc-100"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </Reorder.Item>
                    );
                  })}
                </Reorder.Group>
              ) : (
                <div className="py-24 flex flex-col items-center justify-center text-center">
                  <div className="bg-zinc-50 p-5 rounded-2xl mb-5">
                    <ImageIcon className="w-8 h-8 text-zinc-100" />
                  </div>
                  <p className="text-zinc-300 text-sm font-bold">No files in queue</p>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="space-y-8">
          <div className="bg-white rounded-2xl border border-zinc-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] p-10 space-y-12">
            <div className="space-y-5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
                Output Format
              </label>
              <div className="bg-zinc-50 p-1.5 rounded-2xl grid grid-cols-3 gap-1.5">
                {(["JPG", "PNG", "WEBP", "BMP", "TIFF"] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setOutputFormat(format)}
                    className={`py-3 text-[10px] font-bold rounded-xl transition-all ${
                      outputFormat === format
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-400 hover:bg-white/50"
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                BMP / TIFF selections export as PNG in the browser.
              </p>
            </div>

            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
                  Quality
                </label>
                <span className="font-bold text-sm text-zinc-900">{quality}%</span>
              </div>
              <div className="relative w-full h-6 flex items-center">
                <input
                  type="range"
                  min="35"
                  max="95"
                  value={quality}
                  onChange={(event) => setQuality(parseInt(event.target.value, 10))}
                  className="w-full"
                />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">
                For PDFs this also tunes raster DPI and JPEG quality.
              </p>
            </div>

            <div className="space-y-5">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
                Bulk Actions
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => void downloadZip("images")}
                  disabled={!completedImages.length}
                  className="flex flex-col items-center gap-3 p-4 bg-zinc-50 hover:bg-zinc-100 rounded-2xl transition-all disabled:opacity-30 group"
                >
                  <ImageIcon className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900">
                    Images ZIP
                  </span>
                </button>
                <button
                  onClick={() => void downloadZip("pdfs")}
                  disabled={!completedPdfs.length}
                  className="flex flex-col items-center gap-3 p-4 bg-zinc-50 hover:bg-zinc-100 rounded-2xl transition-all disabled:opacity-30 group"
                >
                  <FileText className="w-5 h-5 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 group-hover:text-zinc-900">
                    PDFs ZIP
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-6 space-y-4">
              <button
                onClick={() => void compressQueue()}
                disabled={files.length === 0 || isProcessing}
                className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-300 text-white py-5 rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3 shadow-lg shadow-zinc-200"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                {isProcessing ? "Processing..." : "Compress All"}
              </button>

              {completedFiles.length ? (
                <button
                  onClick={() => void downloadZip("all")}
                  className="w-full bg-zinc-50 hover:bg-zinc-100 text-zinc-900 py-5 rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-3"
                >
                  <Download className="w-4 h-4" />
                  Download All ZIP
                </button>
              ) : null}

              <button
                onClick={clearQueue}
                className="w-full py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-300 hover:text-zinc-400 transition-colors flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Queue
              </button>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}
