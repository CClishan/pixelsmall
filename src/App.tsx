import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ChevronDown,
  Download,
  Loader2,
  Settings2,
} from "lucide-react";
import type { QueuedFile, ToastState, WorkspaceKind } from "@/app-types";
import { FileDropzone } from "@/components/FileDropzone";
import { QueueList } from "@/components/QueueList";
import { ToastRegion } from "@/components/ToastRegion";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import {
  type CompressionPreset,
  type ImageOutputPreference,
  type ImageWorkspaceState,
  type PdfCompressionInput,
  type PngCompressionMode,
} from "@/lib/compression";
import {
  clearedWorkspaceLabel,
  compressionFinishedLabel,
  formatTemplate,
  getCopy,
  getInitialLocale,
  message,
  noCompletedToDownloadLabel,
  noPendingLabel,
  pageReadyLabel,
  persistLocale,
  rawMessage,
  type Locale,
  type MessageDescriptor,
} from "@/lib/copy";
import { formatSavings, formatSize, formatTimestamp, sanitizeFileName } from "@/lib/format";

type WorkspaceRecord<T> = Record<WorkspaceKind, T>;

interface WorkspaceRuntimeState {
  files: QueuedFile[];
  isProcessing: boolean;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const LARGE_IMAGE_WARNING = 12 * 1024 * 1024;
const LARGE_PDF_WARNING = 30 * 1024 * 1024;
const IMAGE_ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/x-ms-bmp",
  "image/tiff",
  "image/svg+xml",
]);
const PDF_ACCEPTED_TYPES = new Set(["application/pdf"]);
const IMAGE_TARGETS: ImageOutputPreference[] = ["original", "JPG", "PNG", "WEBP"];
const PRESETS: CompressionPreset[] = ["fast", "balanced", "smallest"];
const PNG_MODES: PngCompressionMode[] = ["lossless", "lossy"];
const PNG_COLOR_OPTIONS = [256, 128, 64, 32];

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toMessageDescriptor(input: MessageDescriptor | string) {
  return typeof input === "string" ? rawMessage(input) : input;
}

function getFileLabel(file: File) {
  if (file.type === "application/pdf") {
    return "PDF";
  }
  if (file.type === "image/svg+xml") {
    return "SVG";
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

function createQueuedFile(file: File, workspace: WorkspaceKind): QueuedFile {
  const isPdf = workspace === "pdf";
  const isSvg = file.type === "image/svg+xml";

  return {
    id: createId(),
    workspace,
    name: file.name,
    size: file.size,
    label: getFileLabel(file),
    kind: isPdf ? "pdf" : isSvg ? "svg" : "image",
    preview: !isPdf ? URL.createObjectURL(file) : undefined,
    status: "pending",
    originalFile: file,
    detail: message(isPdf ? "preparingPdfEstimate" : "readyBrowserCompression"),
  };
}

function createDefaultImageSettings(): ImageWorkspaceState {
  return {
    targetFormat: "original",
    pngMode: "lossless",
    maxDimension: 3200,
    keepOriginalIfLarger: true,
    webpQuality: 82,
    jpeg: {
      preset: "balanced",
      quality: 78,
      progressive: true,
      chromaSubsampling: true,
      trellisLoops: 2,
    },
    pngLossless: {
      level: 3,
      interlace: false,
      optimiseAlpha: true,
    },
    pngLossy: {
      colors: 256,
      interlace: false,
    },
    svg: {
      preset: "safe",
      multipass: true,
      removeDimensions: false,
    },
  };
}

function createDefaultPdfSettings(): PdfCompressionInput {
  return {
    preset: "balanced",
    dpi: 140,
    jpegQuality: 0.72,
    pngColorThreshold: 40,
    pngLossless: {
      level: 3,
      interlace: false,
      optimiseAlpha: true,
    },
  };
}

function presetLabel(locale: Locale, preset: CompressionPreset) {
  if (locale === "zh") {
    switch (preset) {
      case "fast":
        return "\u5feb\u901f";
      case "balanced":
        return "\u5747\u8861";
      case "smallest":
        return "\u6700\u5c0f";
      case "custom":
        return "\u81ea\u5b9a\u4e49";
      default:
        return preset;
    }
  }

  return preset === "smallest" ? "Smallest" : preset[0].toUpperCase() + preset.slice(1);
}

function outputLabel(locale: Locale, target: ImageOutputPreference, keepSourceLabel: string) {
  return target === "original" ? keepSourceLabel : target;
}

function pngModeLabel(mode: PngCompressionMode, copy: ReturnType<typeof getCopy>) {
  return mode === "lossless" ? copy.settings.lossless : copy.settings.lossy;
}

function formatEncodingSuffix(locale: Locale, encoding?: string) {
  if (!encoding) {
    return "";
  }

  return formatTemplate(getCopy(locale).templates.pageEncodingSuffix, { encoding: encoding.toUpperCase() });
}

function optionClass(active: boolean) {
  return `toggle-button ${active ? "toggle-button--active" : ""}`;
}

function languageButtonClass(active: boolean) {
  return active
    ? "rounded-xl bg-neutral-900 px-3 py-[0.3125rem] text-[11px] font-bold tracking-tight text-white transition-all"
    : "rounded-xl px-3 py-[0.3125rem] text-[11px] font-bold tracking-tight text-neutral-500 transition-all hover:text-neutral-700";
}

function tabButtonClass(active: boolean) {
  return active
    ? "workspace-tab workspace-tab--active rounded-xl bg-neutral-900 px-3 py-[0.3125rem] text-[11px] font-bold tracking-tight text-white transition-all"
    : "workspace-tab rounded-xl px-3 py-[0.3125rem] text-[11px] font-bold tracking-tight text-neutral-500 transition-all hover:text-neutral-700";
}

function getRangePercent(value: number, min: number, max: number) {
  return `${((value - min) / (max - min)) * 100}%`;
}

async function loadImageCompressionModule() {
  return import("@/lib/compression/image");
}

async function loadPdfCompressionModule() {
  return import("@/lib/compression/pdf");
}

async function createZip() {
  const { default: JSZipModule } = await import("jszip");
  return new JSZipModule();
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceKind>("image");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [imageSettings, setImageSettings] = useState<ImageWorkspaceState>(createDefaultImageSettings);
  const [pdfSettings, setPdfSettings] = useState<PdfCompressionInput>(createDefaultPdfSettings);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [runtime, setRuntime] = useState<WorkspaceRecord<WorkspaceRuntimeState>>({
    image: { files: [], isProcessing: false },
    pdf: { files: [], isProcessing: false },
  });

  const runtimeRef = useRef(runtime);
  const configPanelRef = useRef<HTMLElement | null>(null);
  const controllersRef = useRef<WorkspaceRecord<Record<string, AbortController>>>({
    image: {},
    pdf: {},
  });
  const sessionStampRef = useRef(formatTimestamp());
  const copy = useMemo(() => getCopy(locale), [locale]);

  useEffect(() => {
    runtimeRef.current = runtime;
  }, [runtime]);

  useEffect(() => {
    document.body.dataset.language = locale;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    persistLocale(locale);
  }, [locale]);

  useEffect(() => {
    return () => {
      for (const workspace of Object.keys(runtimeRef.current) as WorkspaceKind[]) {
        runtimeRef.current[workspace].files.forEach((file) => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview);
          }
        });
      }
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeFiles = runtime[activeWorkspace].files;
  const completedFiles = useMemo(
    () => activeFiles.filter((file) => file.status === "completed" && file.resultBlob && file.downloadName),
    [activeFiles],
  );
  const totalOriginal = useMemo(() => completedFiles.reduce((sum, file) => sum + file.size, 0), [completedFiles]);
  const totalCompressed = useMemo(
    () => completedFiles.reduce((sum, file) => sum + (file.compressedSize ?? file.size), 0),
    [completedFiles],
  );
  const totalSavings = formatSavings(totalOriginal, totalCompressed);

  function showToast(input: MessageDescriptor | string, tone: ToastState["tone"] = "info") {
    setToast({ id: createId(), message: toMessageDescriptor(input), tone });
  }

  function setWorkspaceFiles(workspace: WorkspaceKind, updater: (files: QueuedFile[]) => QueuedFile[]) {
    setRuntime((current) => ({
      ...current,
      [workspace]: {
        ...current[workspace],
        files: updater(current[workspace].files),
      },
    }));
  }

  function setWorkspaceProcessing(workspace: WorkspaceKind, isProcessing: boolean) {
    setRuntime((current) => ({
      ...current,
      [workspace]: {
        ...current[workspace],
        isProcessing,
      },
    }));
  }

  function revokePreview(file?: QueuedFile) {
    if (file?.preview) {
      URL.revokeObjectURL(file.preview);
    }
  }

  function updateFile(workspace: WorkspaceKind, id: string, patch: Partial<QueuedFile>) {
    setWorkspaceFiles(workspace, (current) => current.map((file) => (file.id === id ? { ...file, ...patch } : file)));
  }

  function removeFile(workspace: WorkspaceKind, file: QueuedFile) {
    const activeController = controllersRef.current[workspace][file.id];
    if (activeController) {
      activeController.abort(new Error("Compression cancelled by user."));
      delete controllersRef.current[workspace][file.id];
    }

    revokePreview(file);
    setWorkspaceFiles(workspace, (current) => current.filter((entry) => entry.id !== file.id));
  }

  function cancelFile(workspace: WorkspaceKind, file: QueuedFile) {
    const controller = controllersRef.current[workspace][file.id];
    if (!controller) {
      return;
    }

    controller.abort(new Error("Compression cancelled by user."));
    delete controllersRef.current[workspace][file.id];
    updateFile(workspace, file.id, {
      status: "cancelled",
      detail: message("cancelledBeforeCompletion"),
      error: undefined,
      progress: undefined,
    });
    showToast(message("cancelledOneRunningJob"));
  }

  function clearWorkspace(workspace: WorkspaceKind) {
    for (const controller of Object.values(controllersRef.current[workspace]) as AbortController[]) {
      controller.abort(new Error("Compression cancelled by reset."));
    }
    controllersRef.current[workspace] = {};

    runtimeRef.current[workspace].files.forEach(revokePreview);
    setRuntime((current) => ({
      ...current,
      [workspace]: {
        files: [],
        isProcessing: false,
      },
    }));
    showToast(clearedWorkspaceLabel(locale, workspace), "info");
  }

  async function enrichPdfMeta(queuedFile: QueuedFile) {
    try {
      const { estimatePdfPages } = await loadPdfCompressionModule();
      const pageCount = await estimatePdfPages(queuedFile.originalFile);
      updateFile("pdf", queuedFile.id, {
        pageCount,
        detail: pageReadyLabel(locale, pageCount),
      });

      if (pageCount > 40) {
        updateFile("pdf", queuedFile.id, {
          warning: message("longPdfDetected"),
        });
        showToast(message("longPdfToast"));
      }
    } catch {
      updateFile("pdf", queuedFile.id, {
        detail: message("pdfUploadedEstimateUnavailable"),
      });
    }
  }

  function handleFiles(workspace: WorkspaceKind, uploadedFiles: FileList) {
    const queue: QueuedFile[] = [];

    Array.from(uploadedFiles).forEach((file) => {
      const acceptedTypes = workspace === "image" ? IMAGE_ACCEPTED_TYPES : PDF_ACCEPTED_TYPES;

      if (!acceptedTypes.has(file.type)) {
        showToast(message("unsupportedFileType", { name: file.name }), "error");
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        showToast(message("fileTooLarge", { name: file.name, maxMb: 50 }), "error");
        return;
      }

      if (workspace === "image" && file.size >= LARGE_IMAGE_WARNING) {
        showToast(message("largeImageWarning", { name: file.name }));
      }

      if (workspace === "pdf" && file.size >= LARGE_PDF_WARNING) {
        showToast(message("largePdfWarning", { name: file.name }));
      }

      queue.push(createQueuedFile(file, workspace));
    });

    if (!queue.length) {
      return;
    }

    setWorkspaceFiles(workspace, (current) => [...current, ...queue]);

    if (workspace === "pdf") {
      queue.forEach((queuedFile) => {
        void enrichPdfMeta(queuedFile);
      });
    }
  }

  async function compressQueue(workspace: WorkspaceKind) {
    const pendingFiles = runtimeRef.current[workspace].files.filter((file) =>
      ["pending", "error", "cancelled"].includes(file.status),
    );

    if (!pendingFiles.length) {
      showToast(noPendingLabel(locale, workspace), "error");
      return;
    }

    setWorkspaceProcessing(workspace, true);

    try {
      for (const queuedFile of pendingFiles) {
        if (!runtimeRef.current[workspace].files.some((file) => file.id === queuedFile.id)) {
          continue;
        }

        const controller = new AbortController();
        controllersRef.current[workspace][queuedFile.id] = controller;

        updateFile(workspace, queuedFile.id, {
          status: "compressing",
          progress: 0,
          error: undefined,
          detail:
            workspace === "image"
              ? message("preparingImagePipeline")
              : message("rasterizingPdfPages", {
                  count: queuedFile.pageCount ?? copy.tabs.pdf,
                  pageLabel: locale === "zh" ? "\u9875" : "pages",
                }),
        });

        try {
          if (workspace === "image") {
            const { compressImageFile } = await loadImageCompressionModule();
            const result = await compressImageFile(queuedFile.originalFile, imageSettings, controller.signal, (progress) => {
              updateFile(workspace, queuedFile.id, {
                progress,
                detail: message("compressingImage", { progress: Math.round(progress) }),
              });
            });

            updateFile(workspace, queuedFile.id, {
              status: "completed",
              progress: 100,
              compressedSize: result.file.size,
              resultBlob: result.file,
              downloadName: result.file.name,
              detail: message(result.retainedOriginal ? "keptOriginal" : "imageCompressedReady"),
              warning: result.warning ? rawMessage(result.warning) : undefined,
              engine: result.engine,
              fallbackReason: result.fallbackReason ? rawMessage(result.fallbackReason) : undefined,
              retainedOriginal: result.retainedOriginal,
              metrics: result.metrics,
            });

            if (result.warning) {
              showToast(rawMessage(result.warning));
            }
          } else {
            const { compressPdfFile } = await loadPdfCompressionModule();
            const result = await compressPdfFile(queuedFile.originalFile, pdfSettings, controller.signal, (currentPage, totalPages, encoding) => {
              updateFile(workspace, queuedFile.id, {
                progress: Math.round((currentPage / totalPages) * 100),
                detail: message("compressingPdfPage", {
                  currentPage,
                  totalPages,
                  encoding: formatEncodingSuffix(locale, encoding),
                }),
              });
            });

            updateFile(workspace, queuedFile.id, {
              status: "completed",
              progress: 100,
              compressedSize: result.file.size,
              resultBlob: result.file,
              downloadName: result.file.name,
              detail: message("pdfCompressedReady", {
                jpeg: result.pageEncodings.jpeg,
                png: result.pageEncodings.png,
              }),
              warning: result.warning ? rawMessage(result.warning) : undefined,
              engine: result.engine,
              fallbackReason: result.fallbackReason ? rawMessage(result.fallbackReason) : undefined,
              metrics: result.metrics,
            });

            if (result.warning) {
              showToast(rawMessage(result.warning));
            }
          }
        } catch (error) {
          if (controller.signal.aborted) {
            updateFile(workspace, queuedFile.id, {
              status: "cancelled",
              detail: message("cancelledBeforeCompletion"),
              error: undefined,
              progress: undefined,
            });
          } else {
            const runtimeMessage = error instanceof Error ? rawMessage(error.message) : message("compressionFailedBrowser");
            updateFile(workspace, queuedFile.id, {
              status: "error",
              detail: message("compressionFailed"),
              error: runtimeMessage,
              progress: undefined,
            });
            showToast(runtimeMessage, "error");
          }
        } finally {
          delete controllersRef.current[workspace][queuedFile.id];
        }
      }

      if (runtimeRef.current[workspace].files.some((file) => file.status === "completed")) {
        showToast(compressionFinishedLabel(locale, workspace), "success");
      }
    } finally {
      setWorkspaceProcessing(workspace, false);
    }
  }

  function downloadSingle(file: QueuedFile) {
    if (!file.resultBlob || !file.downloadName) {
      showToast(message("fileNotReadyDownload"), "error");
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
    showToast(message("downloadedFile", { name: file.downloadName }), "success");
  }

  async function downloadZip(workspace: WorkspaceKind) {
    const selectedFiles = runtime[workspace].files.filter(
      (file) => file.status === "completed" && file.resultBlob && file.downloadName,
    );

    if (!selectedFiles.length) {
      showToast(noCompletedToDownloadLabel(locale, workspace), "error");
      return;
    }

    if (selectedFiles.length === 1) {
      downloadSingle(selectedFiles[0]);
      return;
    }

    const zip = await createZip();
    selectedFiles.forEach((file) => {
      zip.file(sanitizeFileName(file.downloadName ?? file.name), file.resultBlob!);
    });

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pixelsmall-${workspace}-${sessionStampRef.current}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast(message("preparedZip", { count: selectedFiles.length, name: anchor.download }), "success");
  }

  const queueEmptyLabel = activeWorkspace === "image" ? copy.empty.imageQueue : copy.empty.pdfQueue;
  const settingsLabel = activeWorkspace === "image" ? copy.imageSettingsLabel : copy.pdfSettingsLabel;
  const showJpegControls = activeWorkspace === "image" && imageSettings.targetFormat === "JPG";
  const showPngControls = activeWorkspace === "image" && imageSettings.targetFormat === "PNG";
  const showWebpControls = activeWorkspace === "image" && imageSettings.targetFormat === "WEBP";
  const showSvgControls = activeWorkspace === "image" && imageSettings.targetFormat === "original";
  const snapshotMiddleLabel =
    activeWorkspace === "image"
      ? formatTemplate(copy.templates.imageSummary, {
          pngMode: pngModeLabel(imageSettings.pngMode, copy),
          preset: presetLabel(locale, imageSettings.jpeg.preset),
        })
      : formatTemplate(copy.templates.pdfSummary, {
          dpi: pdfSettings.dpi,
          quality: Math.round(pdfSettings.jpegQuality * 100),
        });
  const snapshotBottomLabel = completedFiles.length
    ? formatTemplate(copy.templates.completedOutputSummary, {
        compressed: formatSize(totalCompressed),
        original: formatSize(totalOriginal),
      })
    : copy.empty.noCompleted;
  const activeWorkspaceLabel = activeWorkspace === "image" ? copy.tabs.image : copy.tabs.pdf;
  const primaryActionLabel = runtime[activeWorkspace].isProcessing
    ? copy.actions.processing
    : activeWorkspace === "image"
      ? copy.actions.compressImage
      : copy.actions.compressPdf;

  function scrollToSettings() {
    configPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="app-frame min-h-screen bg-[#FDFDFD] p-8 font-sans text-[#1D1D1F] selection:bg-neutral-200 md:p-16">
      <ToastRegion locale={locale} closeLabel={copy.closeToastLabel} toast={toast} onClose={() => setToast(null)} />

      <div className="page-shell mx-auto grid w-full min-w-0 max-w-6xl grid-cols-1 items-start gap-10 lg:grid-cols-12">
        <main className="workspace-grid">
          <section className="workspace-main">
            <header className="page-header">
              <div className="page-header__brand">
                <h1 className="page-header__title display-face">PixelSmall</h1>
              </div>

              <div className="page-header__controls">
                <div className="page-header__tabs">
                  <WorkspaceTabs
                    activeWorkspace={activeWorkspace}
                    imageLabel={copy.tabs.image}
                    pdfLabel={copy.tabs.pdf}
                    getButtonClassName={tabButtonClass}
                    onChange={setActiveWorkspace}
                  />
                </div>

                <div className="page-header__locale">
                  <button type="button" className={languageButtonClass(locale === "en")} onClick={() => setLocale("en")}>
                    {copy.languageOptionEnglish}
                  </button>
                  <button type="button" className={languageButtonClass(locale === "zh")} onClick={() => setLocale("zh")}>
                    {copy.languageOptionChinese}
                  </button>
                </div>
              </div>
            </header>

            {activeWorkspace === "image" ? (
              <FileDropzone
                title={copy.dropzone.imageTitle}
                subtitle=""
                accept="image/jpeg,image/png,image/webp,image/bmp,image/x-ms-bmp,image/tiff,image/svg+xml"
                hint={copy.dropzone.imageHint}
                compact={activeFiles.length > 0}
                onFiles={(files) => handleFiles("image", files)}
              />
            ) : (
              <FileDropzone
                title={copy.dropzone.pdfTitle}
                subtitle=""
                accept="application/pdf"
                hint={copy.dropzone.pdfHint}
                compact={activeFiles.length > 0}
                onFiles={(files) => handleFiles("pdf", files)}
              />
            )}

            <section className="upload-guide">
              <div className="upload-guide__grid upload-guide__grid--four">
                <article className="upload-guide__item upload-guide__item--compact-mobile">
                  <p className="section-kicker">{settingsLabel}</p>
                  <p className="upload-guide__body upload-guide__body--tag">{snapshotMiddleLabel}</p>
                  <p className="upload-guide__meta-note">{activeWorkspaceLabel}</p>
                </article>
                <article className="upload-guide__item upload-guide__item--compact-mobile">
                  <p className="section-kicker">{copy.savingsLabel}</p>
                  <p className="upload-guide__body upload-guide__body--tag">{snapshotBottomLabel}</p>
                  <p className="upload-guide__meta-note">
                    {totalSavings ? formatTemplate(copy.templates.savingsSoFar, { savings: totalSavings }) : copy.empty.noDownloads}
                  </p>
                </article>
              </div>
            </section>

            <QueueList
              locale={locale}
              workspace={activeWorkspace}
              title={copy.queueTitle}
              files={activeFiles}
              isProcessing={runtime[activeWorkspace].isProcessing}
              emptyLabel={queueEmptyLabel}
              downloadLabel={copy.actions.download}
              removeLabel={copy.actions.remove}
              cancelLabel={copy.actions.cancel}
              clearLabel={copy.clearWorkspaceLabel}
              onDownload={downloadSingle}
              onRemove={(file) => removeFile(activeWorkspace, file)}
              onCancel={(file) => cancelFile(activeWorkspace, file)}
              onClearAll={() => clearWorkspace(activeWorkspace)}
            />
          </section>

          <aside className="workspace-aside" ref={configPanelRef}>
            <header className="config-header">
              <h2 className="config-header__title">
                <Settings2 className="config-header__icon h-3.5 w-3.5" />
                CONFIGURATION
              </h2>
            </header>

            <section className="surface-card config-panel">
              <div className="config-stack">
                {activeWorkspace === "image" ? (
                  <>
                    <div className="control-block control-block--tight">
                      <label className="output-format-label">{copy.preferredOutputLabel}</label>
                      <div className="output-format-grid">
                        {IMAGE_TARGETS.map((target) => (
                          <button
                            key={target}
                            type="button"
                            onClick={() => setImageSettings((current) => ({ ...current, targetFormat: target }))}
                            className={imageSettings.targetFormat === target ? "output-format-button output-format-button--active" : "output-format-button"}
                          >
                            {outputLabel(locale, target, copy.settings.keepSource)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {showJpegControls ? (
                      <div className="control-section">
                        <div className="control-group-head control-group-head--native">
                          <p className="output-format-label">{copy.jpegPresetLabel}</p>
                        </div>
                        <div className="toggle-surface grid grid-cols-2 gap-1">
                          {PRESETS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() =>
                                setImageSettings((current) => ({
                                  ...current,
                                  jpeg: { ...current.jpeg, preset },
                                }))
                              }
                              className={optionClass(imageSettings.jpeg.preset === preset)}
                            >
                              {presetLabel(locale, preset)}
                            </button>
                          ))}
                        </div>

                        <div className="control-subsection">
                          <div className="quality-heading">
                            <label className="output-format-label">{copy.jpegQualityLabel}</label>
                            <span className="quality-value">{imageSettings.jpeg.quality}%</span>
                          </div>
                          <div className="quality-range-shell">
                            <div className="quality-range-track" />
                            <div
                              className="quality-range-fill"
                              style={{ width: getRangePercent(imageSettings.jpeg.quality, 40, 92) }}
                            />
                            <input
                              type="range"
                              min="40"
                              max="92"
                              value={imageSettings.jpeg.quality}
                              onChange={(event) =>
                                setImageSettings((current) => ({
                                  ...current,
                                  jpeg: { ...current.jpeg, quality: parseInt(event.target.value, 10) },
                                }))
                              }
                              className="range-input"
                            />
                            <div
                              className="quality-range-thumb"
                              style={{ left: `calc(${getRangePercent(imageSettings.jpeg.quality, 40, 92)} - 0.5rem)` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {showPngControls ? (
                      <div className="control-section">
                        <div className="control-group-head control-group-head--native">
                          <p className="output-format-label">{copy.pngModeLabel}</p>
                        </div>
                        <div className="toggle-surface grid grid-cols-2 gap-1">
                          {PNG_MODES.map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setImageSettings((current) => ({ ...current, pngMode: mode }))}
                              className={optionClass(imageSettings.pngMode === mode)}
                            >
                              {pngModeLabel(mode, copy)}
                            </button>
                          ))}
                        </div>

                        {imageSettings.pngMode === "lossless" ? (
                          <div className="control-subsection">
                            <div className="quality-heading">
                              <label className="output-format-label">{copy.oxipngLevelLabel}</label>
                              <span className="quality-value">{imageSettings.pngLossless.level}</span>
                            </div>
                            <div className="quality-range-shell">
                              <div className="quality-range-track" />
                              <div
                                className="quality-range-fill"
                                style={{ width: getRangePercent(imageSettings.pngLossless.level, 1, 6) }}
                              />
                              <input
                                type="range"
                                min="1"
                                max="6"
                                value={imageSettings.pngLossless.level}
                                onChange={(event) =>
                                  setImageSettings((current) => ({
                                    ...current,
                                    pngLossless: { ...current.pngLossless, level: parseInt(event.target.value, 10) },
                                  }))
                                }
                                className="range-input"
                              />
                              <div
                                className="quality-range-thumb"
                                style={{ left: `calc(${getRangePercent(imageSettings.pngLossless.level, 1, 6)} - 0.5rem)` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="control-subsection">
                            <label className="control-label">{copy.pngPaletteLabel}</label>
                            <div className="toggle-surface grid grid-cols-4 gap-1">
                              {PNG_COLOR_OPTIONS.map((colors) => (
                                <button
                                  key={colors}
                                  type="button"
                                  onClick={() =>
                                    setImageSettings((current) => ({
                                      ...current,
                                      pngLossy: { ...current.pngLossy, colors },
                                    }))
                                  }
                                  className={optionClass(imageSettings.pngLossy.colors === colors)}
                                >
                                  {colors}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {showWebpControls ? (
                      <div className="control-section">
                        <div className="control-group-head control-group-head--native">
                          <p className="output-format-label">{copy.webpQualityLabel}</p>
                        </div>
                        <div className="control-subsection control-subsection--first">
                          <div className="quality-heading">
                            <label className="output-format-label">{copy.webpQualityLabel}</label>
                            <span className="quality-value">{imageSettings.webpQuality}%</span>
                          </div>
                          <div className="quality-range-shell">
                            <div className="quality-range-track" />
                            <div
                              className="quality-range-fill"
                              style={{ width: getRangePercent(imageSettings.webpQuality, 40, 95) }}
                            />
                            <input
                              type="range"
                              min="40"
                              max="95"
                              value={imageSettings.webpQuality}
                              onChange={(event) =>
                                setImageSettings((current) => ({ ...current, webpQuality: parseInt(event.target.value, 10) }))
                              }
                              className="range-input"
                            />
                            <div
                              className="quality-range-thumb"
                              style={{ left: `calc(${getRangePercent(imageSettings.webpQuality, 40, 95)} - 0.5rem)` }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="control-section">
                      <button
                        type="button"
                        className="advanced-toggle"
                        onClick={() => setAdvancedOpen((current) => !current)}
                        aria-expanded={advancedOpen}
                      >
                        <span className="control-group-head control-group-head--native">
                          <span className="advanced-toggle__title-row">
                            <span className="output-format-label">{copy.advancedLabel}</span>
                            <span className="advanced-toggle__badge">{copy.advancedHintLabel}</span>
                          </span>
                        </span>
                        <ChevronDown className={advancedOpen ? "advanced-toggle__icon advanced-toggle__icon--open" : "advanced-toggle__icon"} />
                      </button>

                      {advancedOpen ? (
                        <>
                          <div className="control-subsection">
                            <div className="quality-heading">
                              <label className="output-format-label">{copy.maxDimensionLabel}</label>
                              <span className="quality-value">{imageSettings.maxDimension}px</span>
                            </div>
                            <div className="quality-range-shell">
                              <div className="quality-range-track" />
                              <div
                                className="quality-range-fill"
                                style={{ width: getRangePercent(imageSettings.maxDimension, 1600, 4000) }}
                              />
                              <input
                                type="range"
                                min="1600"
                                max="4000"
                                step="200"
                                value={imageSettings.maxDimension}
                                onChange={(event) =>
                                  setImageSettings((current) => ({ ...current, maxDimension: parseInt(event.target.value, 10) }))
                                }
                                className="range-input"
                              />
                              <div
                                className="quality-range-thumb"
                                style={{ left: `calc(${getRangePercent(imageSettings.maxDimension, 1600, 4000)} - 0.5rem)` }}
                              />
                            </div>
                          </div>

                          <div className="control-subsection">
                            <label className="control-label">{copy.keepResultLabel}</label>
                            <div className="toggle-surface grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => setImageSettings((current) => ({ ...current, keepOriginalIfLarger: true }))}
                                className={optionClass(imageSettings.keepOriginalIfLarger)}
                              >
                                {copy.settings.keepSmallerResult}
                              </button>
                              <button
                                type="button"
                                onClick={() => setImageSettings((current) => ({ ...current, keepOriginalIfLarger: false }))}
                                className={optionClass(!imageSettings.keepOriginalIfLarger)}
                              >
                                {copy.settings.alwaysExportCompressed}
                              </button>
                            </div>
                          </div>

                          {showSvgControls ? (
                            <div className="control-subsection">
                              <label className="control-label">{copy.svgProfileLabel}</label>
                              <div className="toggle-surface grid grid-cols-2 gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImageSettings((current) => ({
                                      ...current,
                                      svg: { ...current.svg, preset: "safe" },
                                    }))
                                  }
                                  className={optionClass(imageSettings.svg.preset === "safe")}
                                >
                                  {copy.settings.safe}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImageSettings((current) => ({
                                      ...current,
                                      svg: { ...current.svg, preset: "advanced" },
                                    }))
                                  }
                                  className={optionClass(imageSettings.svg.preset === "advanced")}
                                >
                                  {copy.settings.advanced}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="control-block control-block--tight">
                      <label className="output-format-label">{copy.compressionPresetLabel}</label>
                      <div className="toggle-surface grid grid-cols-3 gap-1">
                        {PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setPdfSettings((current) => ({ ...current, preset }))}
                            className={optionClass(pdfSettings.preset === preset)}
                          >
                            {presetLabel(locale, preset)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="control-section">
                      <div className="control-group-head control-group-head--native">
                        <p className="output-format-label">{copy.jpegPageQualityLabel}</p>
                      </div>

                      <div className="control-subsection">
                        <div className="quality-heading">
                          <label className="output-format-label">{copy.rasterDpiLabel}</label>
                          <span className="quality-value">{pdfSettings.dpi}</span>
                        </div>
                        <div className="quality-range-shell">
                          <div className="quality-range-track" />
                          <div className="quality-range-fill" style={{ width: getRangePercent(pdfSettings.dpi, 96, 180) }} />
                          <input
                            type="range"
                            min="96"
                            max="180"
                            step="4"
                            value={pdfSettings.dpi}
                            onChange={(event) => setPdfSettings((current) => ({ ...current, dpi: parseInt(event.target.value, 10) }))}
                            className="range-input"
                          />
                          <div
                            className="quality-range-thumb"
                            style={{ left: `calc(${getRangePercent(pdfSettings.dpi, 96, 180)} - 0.5rem)` }}
                          />
                        </div>
                      </div>

                      <div className="control-subsection">
                        <div className="quality-heading">
                          <label className="output-format-label">{copy.jpegPageQualityLabel}</label>
                          <span className="quality-value">{Math.round(pdfSettings.jpegQuality * 100)}%</span>
                        </div>
                        <div className="quality-range-shell">
                          <div className="quality-range-track" />
                          <div
                            className="quality-range-fill"
                            style={{ width: getRangePercent(Math.round(pdfSettings.jpegQuality * 100), 45, 88) }}
                          />
                          <input
                            type="range"
                            min="45"
                            max="88"
                            value={Math.round(pdfSettings.jpegQuality * 100)}
                            onChange={(event) =>
                              setPdfSettings((current) => ({ ...current, jpegQuality: parseInt(event.target.value, 10) / 100 }))
                            }
                            className="range-input"
                          />
                          <div
                            className="quality-range-thumb"
                            style={{ left: `calc(${getRangePercent(Math.round(pdfSettings.jpegQuality * 100), 45, 88)} - 0.5rem)` }}
                          />
                        </div>
                      </div>

                      <div className="control-subsection">
                        <div className="quality-heading">
                          <label className="output-format-label">{copy.pngThresholdLabel}</label>
                          <span className="quality-value">{pdfSettings.pngColorThreshold}</span>
                        </div>
                        <div className="quality-range-shell">
                          <div className="quality-range-track" />
                          <div
                            className="quality-range-fill"
                            style={{ width: getRangePercent(pdfSettings.pngColorThreshold, 16, 96) }}
                          />
                          <input
                            type="range"
                            min="16"
                            max="96"
                            step="4"
                            value={pdfSettings.pngColorThreshold}
                            onChange={(event) =>
                              setPdfSettings((current) => ({
                                ...current,
                                pngColorThreshold: parseInt(event.target.value, 10),
                              }))
                            }
                            className="range-input"
                          />
                          <div
                            className="quality-range-thumb"
                            style={{ left: `calc(${getRangePercent(pdfSettings.pngColorThreshold, 16, 96)} - 0.5rem)` }}
                          />
                        </div>
                        <p className="compact-note compact-note--tight">{copy.pngThresholdHint}</p>
                      </div>
                    </div>
                  </>
                )}

                <div className="control-section control-section--actions">
                  <div className="action-stack">
                    <button
                      type="button"
                      onClick={() => void compressQueue(activeWorkspace)}
                      disabled={!activeFiles.length || runtime[activeWorkspace].isProcessing}
                      className="primary-button"
                    >
                      {runtime[activeWorkspace].isProcessing ? <Loader2 className="smooth-spin h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      {primaryActionLabel}
                    </button>

                    {completedFiles.length ? (
                      <button type="button" onClick={() => void downloadZip(activeWorkspace)} className="secondary-button">
                        <Download className="h-4 w-4" />
                        {copy.downloadZipLabel}
                      </button>
                    ) : null}
                  </div>
                </div>

              </div>
            </section>

            <section className="surface-card config-credits-panel">
              <div className="control-group-head control-group-head--native config-credits-panel__head">
                <p className="output-format-label">{copy.creditsLabel}</p>
              </div>
              <p className="compact-note compact-note--tight config-credits__note">{copy.creditsNote}</p>
              <div className="config-credits__grid" aria-label={copy.creditsLabel}>
                {["MozJPEG", "OxiPNG", "UPNG.js", "SVGO", "pdf.js", "pdf-lib"].map((name) => (
                  <span key={name} className="config-credits__chip">
                    {name}
                  </span>
                ))}
              </div>
            </section>
          </aside>
        </main>

        <div className={completedFiles.length ? "mobile-fab-bar mobile-fab-bar--with-download" : "mobile-fab-bar"}>
          <button type="button" className="mobile-fab-bar__settings" onClick={scrollToSettings}>
            <Settings2 className="h-4 w-4" />
            {settingsLabel}
          </button>
          {completedFiles.length ? (
            <button type="button" className="mobile-fab-bar__secondary" onClick={() => void downloadZip(activeWorkspace)}>
              <Download className="h-4 w-4" />
              {copy.downloadZipLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void compressQueue(activeWorkspace)}
            disabled={!activeFiles.length || runtime[activeWorkspace].isProcessing}
            className="mobile-fab-bar__primary"
          >
            {runtime[activeWorkspace].isProcessing ? <Loader2 className="smooth-spin h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
