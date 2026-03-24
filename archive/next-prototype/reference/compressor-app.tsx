"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import styles from "./compressor-app.module.css";
import {
  IMAGE_FORMAT_LABELS,
  compressImageFile,
  type ImageCompressionOptions,
  type ImageOutputFormat,
} from "@/lib/image-compress";
import {
  compressPdfFile,
  estimatePdfPages,
  type PdfCompressionOptions,
} from "@/lib/pdf-compress";
import { formatBytes, formatPercent, formatSeconds } from "@/lib/formatters";
import { validateImageFiles, validatePdfFiles } from "@/lib/validators";

type JobKind = "image" | "pdf";
type JobStatus = "processing" | "done" | "error" | "cancelled";

type CompressionJob = {
  id: string;
  kind: JobKind;
  name: string;
  status: JobStatus;
  originalSize: number;
  outputSize?: number;
  progress: number;
  detail: string;
  previewUrl?: string;
  downloadUrl?: string;
  downloadName?: string;
  durationMs?: number;
  error?: string;
};

type Notice = {
  id: string;
  tone: "info" | "error";
  message: string;
};

type DownloadGroup = "all" | JobKind;

const imageInputAccept = "image/jpeg,image/png,image/webp";
const pdfInputAccept = "application/pdf";

const defaultImageOptions: ImageCompressionOptions = {
  quality: 0.72,
  maxDimension: 2400,
  outputFormat: "keep",
};

const defaultPdfOptions: PdfCompressionOptions = {
  dpi: 120,
  jpegQuality: 0.62,
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatTimestamp(value = Date.now()) {
  const date = new Date(value);
  const parts = [
    date.getFullYear(),
    `${date.getMonth() + 1}`.padStart(2, "0"),
    `${date.getDate()}`.padStart(2, "0"),
    `${date.getHours()}`.padStart(2, "0"),
    `${date.getMinutes()}`.padStart(2, "0"),
  ];

  return `${parts[0]}${parts[1]}${parts[2]}-${parts[3]}${parts[4]}`;
}

function sanitizeName(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function CompressorApp() {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const controllersRef = useRef<Record<string, AbortController>>({});

  const [imageOptions, setImageOptions] =
    useState<ImageCompressionOptions>(defaultImageOptions);
  const [pdfOptions, setPdfOptions] = useState<PdfCompressionOptions>(defaultPdfOptions);
  const [jobs, setJobs] = useState<CompressionJob[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [activeKind, setActiveKind] = useState<JobKind>("image");
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [isPdfDragging, setIsPdfDragging] = useState(false);
  const [isPackagingDownloads, setIsPackagingDownloads] = useState(false);
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const sessionStampRef = useRef(formatTimestamp());

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const summary = useMemo(() => {
    const finishedJobs = jobs.filter((job) => job.status === "done");
    const savedBytes = finishedJobs.reduce((total, job) => {
      return total + (job.originalSize - (job.outputSize ?? job.originalSize));
    }, 0);

    return {
      totalJobs: jobs.length,
      finishedJobs: finishedJobs.length,
      savedBytes,
    };
  }, [jobs]);

  function updateJob(id: string, patch: Partial<CompressionJob>) {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }

  function rememberUrl(url: string) {
    objectUrlsRef.current.push(url);
    return url;
  }

  function forgetUrl(url: string) {
    URL.revokeObjectURL(url);
    objectUrlsRef.current = objectUrlsRef.current.filter((entry) => entry !== url);
  }

  function pushNotice(message: string, tone: Notice["tone"] = "info") {
    setNotices((current) => [{ id: createId(), tone, message }, ...current].slice(0, 4));
  }

  function dismissNotice(id: string) {
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }

  function resetJobs() {
    Object.values(controllersRef.current).forEach((controller) =>
      controller.abort(new Error("Compression cancelled.")),
    );
    controllersRef.current = {};
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
    setJobs([]);
    pushNotice("Session reset. Any running jobs were cancelled.");
  }

  function removeJob(id: string) {
    const controller = controllersRef.current[id];
    if (controller) {
      controller.abort(new Error("Compression cancelled."));
      delete controllersRef.current[id];
    }

    setJobs((current) => {
      const target = current.find((job) => job.id === id);
      if (target?.downloadUrl) {
        forgetUrl(target.downloadUrl);
      }

      if (target?.previewUrl && target.previewUrl !== target.downloadUrl) {
        forgetUrl(target.previewUrl);
      }

      return current.filter((job) => job.id !== id);
    });
  }

  function finishController(id: string) {
    delete controllersRef.current[id];
  }

  function cancelJob(id: string) {
    const controller = controllersRef.current[id];
    if (!controller) {
      return;
    }

    controller.abort(new Error("Compression cancelled by user."));
    delete controllersRef.current[id];
    updateJob(id, {
      status: "cancelled",
      detail: "Cancelled by user",
      error: undefined,
      progress: 0,
    });
    pushNotice("Cancelled one running job.");
  }

  function moveJob(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }

    setJobs((current) => {
      const sourceIndex = current.findIndex((job) => job.id === sourceId);
      const targetIndex = current.findIndex((job) => job.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  async function handleImagesSelected(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const { accepted: files, errors, warnings } = validateImageFiles(Array.from(fileList));
    errors.forEach((message) => pushNotice(message, "error"));
    warnings.forEach((message) => pushNotice(message));

    if (!files.length) {
      return;
    }

    const entries = files.map<CompressionJob>((file) => ({
      id: createId(),
      kind: "image",
      name: file.name,
      status: "processing",
      originalSize: file.size,
      progress: 0,
      detail: "Queued in your browser",
    }));

    setJobs((current) => [...entries, ...current]);

    for (const [index, file] of files.entries()) {
      const entry = entries[index];
      const startedAt = performance.now();
      const controller = new AbortController();
      controllersRef.current[entry.id] = controller;

      try {
        if (controller.signal.aborted) {
          throw controller.signal.reason;
        }

        const compressedFile = await compressImageFile(
          file,
          imageOptions,
          controller.signal,
          (progress) => {
            updateJob(entry.id, {
              progress,
              detail: `Re-encoding image on local device (${Math.round(progress)}%)`,
            });
          },
        );

        const url = rememberUrl(URL.createObjectURL(compressedFile));
        const finishedAt = performance.now();

        updateJob(entry.id, {
          status: "done",
          progress: 100,
          detail: "Ready to download",
          previewUrl: url,
          outputSize: compressedFile.size,
          durationMs: finishedAt - startedAt,
          downloadName: compressedFile.name,
          downloadUrl: url,
        });
        finishController(entry.id);
      } catch (error) {
        if (controller.signal.aborted) {
          updateJob(entry.id, {
            status: "cancelled",
            detail: "Cancelled before finishing",
            error: undefined,
          });
          finishController(entry.id);
          continue;
        }

        updateJob(entry.id, {
          status: "error",
          detail: "Compression failed",
          error: error instanceof Error ? error.message : "Unknown image compression error",
        });
        pushNotice(`${file.name}: image compression failed.`, "error");
        finishController(entry.id);
      }
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  async function handlePdfSelected(fileList: FileList | null) {
    const { accepted, errors, warnings } = validatePdfFiles(Array.from(fileList ?? []));
    errors.forEach((message) => pushNotice(message, "error"));
    warnings.forEach((message) => pushNotice(message));

    const file = accepted[0];
    if (!file) {
      return;
    }

    try {
      const estimatedPages = await estimatePdfPages(file);
      pushNotice(`PDF estimate: ${estimatedPages} page${estimatedPages === 1 ? "" : "s"} detected.`);
      if (estimatedPages > 40) {
        pushNotice("Long PDF detected: expect slower processing and higher browser memory usage.");
      }
    } catch {
      pushNotice("Could not estimate PDF pages before compression.", "error");
    }

    const entry: CompressionJob = {
      id: createId(),
      kind: "pdf",
      name: file.name,
      status: "processing",
      originalSize: file.size,
      progress: 0,
      detail: "Preparing browser-side PDF rendering",
    };

    setJobs((current) => [entry, ...current]);
    const startedAt = performance.now();
    const controller = new AbortController();
    controllersRef.current[entry.id] = controller;

    try {
      const compressedFile = await compressPdfFile(
        file,
        pdfOptions,
        controller.signal,
        (currentPage, totalPages) => {
          const progress = Math.max(5, Math.round((currentPage / totalPages) * 100));
          updateJob(entry.id, {
            progress,
            detail: `Rasterizing page ${currentPage}/${totalPages} inside the browser`,
          });
        },
      );

      const url = rememberUrl(URL.createObjectURL(compressedFile));
      const finishedAt = performance.now();

      updateJob(entry.id, {
        status: "done",
        progress: 100,
        detail: "PDF bundle rebuilt locally",
        outputSize: compressedFile.size,
        durationMs: finishedAt - startedAt,
        downloadName: compressedFile.name,
        downloadUrl: url,
      });
      finishController(entry.id);
    } catch (error) {
      if (controller.signal.aborted) {
        updateJob(entry.id, {
          status: "cancelled",
          detail: "Cancelled before finishing",
          error: undefined,
        });
        finishController(entry.id);
        if (pdfInputRef.current) {
          pdfInputRef.current.value = "";
        }
        return;
      }

      updateJob(entry.id, {
        status: "error",
        detail: "Compression failed",
        error: error instanceof Error ? error.message : "Unknown PDF compression error",
      });
      pushNotice(`${file.name}: PDF compression failed.`, "error");
      finishController(entry.id);
    }

    if (pdfInputRef.current) {
      pdfInputRef.current.value = "";
    }
  }

  function handleDragState(
    event: React.DragEvent<HTMLElement>,
    kind: JobKind,
    dragging: boolean,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (!dragging) {
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
        return;
      }
    }

    if (kind === "image") {
      setIsImageDragging(dragging);
      return;
    }

    setIsPdfDragging(dragging);
  }

  async function handleDroppedFiles(event: React.DragEvent<HTMLElement>, kind: JobKind) {
    event.preventDefault();
    event.stopPropagation();

    const files = event.dataTransfer.files;

    if (kind === "image") {
      setIsImageDragging(false);
      await handleImagesSelected(files);
      return;
    }

    setIsPdfDragging(false);
    await handlePdfSelected(files);
  }

  async function packageAndDownloadResults(selectedJobs: CompressionJob[], group: DownloadGroup) {
    const timestamp = sessionStampRef.current;

    if (!selectedJobs.length) {
      pushNotice("No finished results available yet.", "error");
      return;
    }

    if (selectedJobs.length === 1) {
      const onlyJob = selectedJobs[0];
      const anchor = document.createElement("a");
      anchor.href = onlyJob.downloadUrl!;
      anchor.download = onlyJob.downloadName!;
      anchor.click();
      pushNotice(`Downloaded ${onlyJob.downloadName}.`);
      return;
    }

    setIsPackagingDownloads(true);

    try {
      const zip = new JSZip();
      const zipPrefix =
        group === "all" ? "pixelsmall-bundle" : group === "image" ? "pixelsmall-images" : "pixelsmall-pdfs";

      for (const job of selectedJobs) {
        const response = await fetch(job.downloadUrl!);
        const buffer = await response.arrayBuffer();
        const folder =
          group === "all" ? (job.kind === "image" ? "images" : "pdfs") : undefined;
        const fileName = sanitizeName(job.downloadName!);

        if (folder) {
          zip.folder(folder)?.file(fileName, buffer);
        } else {
          zip.file(fileName, buffer);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = rememberUrl(URL.createObjectURL(zipBlob));
      const anchor = document.createElement("a");
      anchor.href = zipUrl;
      anchor.download = `${zipPrefix}-${timestamp}.zip`;
      anchor.click();
      pushNotice(`Prepared ${selectedJobs.length} files in ${anchor.download}.`);
    } catch (error) {
      pushNotice(
        error instanceof Error ? error.message : "Failed to package result downloads.",
        "error",
      );
    } finally {
      setIsPackagingDownloads(false);
    }
  }

  const imagePresetLabel = IMAGE_FORMAT_LABELS[imageOptions.outputFormat as ImageOutputFormat];
  const completedJobs = jobs.filter((job) => job.status === "done");
  const completedImageJobs = completedJobs.filter(
    (job) => job.kind === "image" && job.downloadUrl && job.downloadName,
  );
  const completedPdfJobs = completedJobs.filter(
    (job) => job.kind === "pdf" && job.downloadUrl && job.downloadName,
  );
  const downloadReadyJobs = completedJobs.filter((job) => job.downloadUrl && job.downloadName);

  return (
    <main className={styles.shell}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>PixelSmall / browser-first compression</p>
          <h1>Compress images and scanned PDFs on the user&apos;s own device.</h1>
          <p className={styles.lead}>
            Files stay in the browser, CPU work happens on the uploader&apos;s machine,
            and Vercel only ships the frontend.
          </p>
          <div className={styles.heroStats}>
            <article>
              <span>{summary.finishedJobs}</span>
              <p>Finished jobs</p>
            </article>
            <article>
              <span>{formatBytes(summary.savedBytes)}</span>
              <p>Total bytes saved this session</p>
            </article>
            <article>
              <span>{summary.totalJobs}</span>
              <p>Files touched in this browser tab</p>
            </article>
          </div>
        </div>

        <div className={styles.heroCard}>
          <p>Launch scope</p>
          <ul>
            <li>Image compression with local re-encoding and batch downloads</li>
            <li>Scanned PDF compression by page rasterization and rebuild</li>
            <li>Static-first deployment model for Git + Vercel</li>
          </ul>
        </div>
      </section>

      {notices.length > 0 ? (
        <section className={styles.noticeStack} aria-live="polite">
          {notices.map((notice) => (
            <article
              key={notice.id}
              className={notice.tone === "error" ? styles.noticeError : styles.noticeInfo}
            >
              <p>{notice.message}</p>
              <button type="button" onClick={() => dismissNotice(notice.id)}>
                Dismiss
              </button>
            </article>
          ))}
        </section>
      ) : null}

      <section className={styles.workspace}>
        <div className={styles.panelTabs}>
          <button
            type="button"
            className={activeKind === "image" ? styles.tabActive : styles.tab}
            onClick={() => setActiveKind("image")}
          >
            Images
          </button>
          <button
            type="button"
            className={activeKind === "pdf" ? styles.tabActive : styles.tab}
            onClick={() => setActiveKind("pdf")}
          >
            PDF
          </button>
        </div>

        <div className={styles.workspaceGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Upload zone</p>
                <h2>{activeKind === "image" ? "Batch image compressor" : "Scanned PDF compressor"}</h2>
              </div>
              <button type="button" className={styles.ghostButton} onClick={resetJobs}>
                Reset session
              </button>
            </div>

            {activeKind === "image" ? (
              <>
                <button
                  type="button"
                  className={`${styles.dropzone} ${isImageDragging ? styles.dropzoneActive : ""}`}
                  onClick={() => imageInputRef.current?.click()}
                  onDragEnter={(event) => handleDragState(event, "image", true)}
                  onDragOver={(event) => handleDragState(event, "image", true)}
                  onDragLeave={(event) => handleDragState(event, "image", false)}
                  onDrop={(event) => handleDroppedFiles(event, "image")}
                >
                  <span>Drop JPG, PNG or WebP here, or click to pick files</span>
                  <strong>
                    Preset: {imagePresetLabel}, quality {Math.round(imageOptions.quality * 100)}%, max side{" "}
                    {imageOptions.maxDimension}px
                  </strong>
                  <em>Batch up to 20 files, 25 MB each, processed locally.</em>
                </button>
                <input
                  ref={imageInputRef}
                  hidden
                  multiple
                  type="file"
                  accept={imageInputAccept}
                  onChange={(event) => handleImagesSelected(event.target.files)}
                />

                <div className={styles.controlGrid}>
                  <label>
                    <span>Output format</span>
                    <select
                      value={imageOptions.outputFormat}
                      onChange={(event) =>
                        setImageOptions((current) => ({
                          ...current,
                          outputFormat: event.target.value as ImageOutputFormat,
                        }))
                      }
                    >
                      {Object.entries(IMAGE_FORMAT_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Quality {Math.round(imageOptions.quality * 100)}%</span>
                    <input
                      type="range"
                      min="45"
                      max="92"
                      value={Math.round(imageOptions.quality * 100)}
                      onChange={(event) =>
                        setImageOptions((current) => ({
                          ...current,
                          quality: Number(event.target.value) / 100,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Longest side {imageOptions.maxDimension}px</span>
                    <input
                      type="range"
                      min="1200"
                      max="3200"
                      step="100"
                      value={imageOptions.maxDimension}
                      onChange={(event) =>
                        setImageOptions((current) => ({
                          ...current,
                          maxDimension: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.dropzone} ${isPdfDragging ? styles.dropzoneActive : ""}`}
                  onClick={() => pdfInputRef.current?.click()}
                  onDragEnter={(event) => handleDragState(event, "pdf", true)}
                  onDragOver={(event) => handleDragState(event, "pdf", true)}
                  onDragLeave={(event) => handleDragState(event, "pdf", false)}
                  onDrop={(event) => handleDroppedFiles(event, "pdf")}
                >
                  <span>Upload one PDF and rebuild it locally in the browser</span>
                  <strong>
                    Preset: {pdfOptions.dpi} DPI / JPEG {Math.round(pdfOptions.jpegQuality * 100)}%
                  </strong>
                  <em>One file at a time, up to 80 MB, best for scanned PDFs.</em>
                </button>
                <input
                  ref={pdfInputRef}
                  hidden
                  type="file"
                  accept={pdfInputAccept}
                  onChange={(event) => handlePdfSelected(event.target.files)}
                />

                <div className={styles.controlGrid}>
                  <label>
                    <span>Raster DPI {pdfOptions.dpi}</span>
                    <input
                      type="range"
                      min="96"
                      max="160"
                      step="8"
                      value={pdfOptions.dpi}
                      onChange={(event) =>
                        setPdfOptions((current) => ({
                          ...current,
                          dpi: Number(event.target.value),
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>JPEG quality {Math.round(pdfOptions.jpegQuality * 100)}%</span>
                    <input
                      type="range"
                      min="42"
                      max="82"
                      step="2"
                      value={Math.round(pdfOptions.jpegQuality * 100)}
                      onChange={(event) =>
                        setPdfOptions((current) => ({
                          ...current,
                          jpegQuality: Number(event.target.value) / 100,
                        }))
                      }
                    />
                  </label>

                  <div className={styles.noticeCard}>
                    <span>Best for scans</span>
                    <p>
                      Text-heavy or vector PDFs may only shrink a little because the
                      browser workflow rebuilds pages as compressed images.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelLabel}>Queue</p>
                <h2>Compression results</h2>
              </div>
            </div>

            <div className={styles.downloadPanel}>
              <div className={styles.downloadSummary}>
                <span>{downloadReadyJobs.length} ready</span>
                <p>
                  {completedImageJobs.length} images / {completedPdfJobs.length} PDFs prepared for
                  download
                </p>
                <small>Drag cards to reorder the session queue before you download.</small>
              </div>
              <div className={styles.downloadActions}>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => packageAndDownloadResults(downloadReadyJobs, "all")}
                  disabled={isPackagingDownloads || downloadReadyJobs.length === 0}
                >
                  {isPackagingDownloads ? "Packaging ZIP..." : `Download all (${downloadReadyJobs.length})`}
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => packageAndDownloadResults(completedImageJobs, "image")}
                  disabled={isPackagingDownloads || completedImageJobs.length === 0}
                >
                  Images ZIP
                </button>
                <button
                  type="button"
                  className={styles.ghostButton}
                  onClick={() => packageAndDownloadResults(completedPdfJobs, "pdf")}
                  disabled={isPackagingDownloads || completedPdfJobs.length === 0}
                >
                  PDFs ZIP
                </button>
              </div>
            </div>

            <div className={styles.queue}>
              {jobs.length === 0 ? (
                <div className={styles.emptyState}>
                  <p>No files yet.</p>
                  <span>
                    Start with an image batch or a scanned PDF to validate the local-only
                    workflow.
                  </span>
                </div>
              ) : (
                jobs.map((job) => {
                  const savedRatio =
                    job.outputSize && job.originalSize > 0
                      ? 1 - job.outputSize / job.originalSize
                      : 0;

                  return (
                    <article
                      key={job.id}
                      className={`${styles.jobCard} ${draggedJobId === job.id ? styles.jobCardDragging : ""}`}
                      draggable
                      onDragStart={() => setDraggedJobId(job.id)}
                      onDragEnd={() => setDraggedJobId(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (draggedJobId) {
                          moveJob(draggedJobId, job.id);
                        }
                        setDraggedJobId(null);
                      }}
                    >
                      <div className={styles.jobTopRow}>
                        <div className={styles.jobPreview}>
                          {job.kind === "image" && job.previewUrl ? (
                            // Browser-generated object URL keeps the preview local.
                            <Image
                              src={job.previewUrl}
                              alt={job.name}
                              fill
                              unoptimized
                              sizes="(max-width: 980px) 100vw, 88px"
                              className={styles.previewImage}
                            />
                          ) : (
                            <div className={styles.previewFallback}>
                              <span>{job.kind === "pdf" ? "PDF" : "IMG"}</span>
                            </div>
                          )}
                        </div>

                        <div className={styles.jobHeader}>
                          <div>
                            <p className={styles.jobKind}>{job.kind}</p>
                            <h3>{job.name}</h3>
                          </div>
                          <div className={styles.jobActions}>
                            <span
                              className={
                                job.status === "done"
                                  ? styles.statusDone
                                  : job.status === "cancelled"
                                    ? styles.statusCancelled
                                  : job.status === "error"
                                    ? styles.statusError
                                    : styles.statusRunning
                              }
                            >
                              {job.status}
                            </span>
                            {job.status === "processing" ? (
                              <button
                                type="button"
                                className={styles.cardAction}
                                onClick={() => cancelJob(job.id)}
                              >
                                Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={styles.cardAction}
                                onClick={() => removeJob(job.id)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${job.progress}%` }} />
                      </div>

                      <p className={styles.jobDetail}>{job.detail}</p>

                      <dl className={styles.jobMeta}>
                        <div>
                          <dt>Original</dt>
                          <dd>{formatBytes(job.originalSize)}</dd>
                        </div>
                        <div>
                          <dt>Output</dt>
                          <dd>{job.outputSize ? formatBytes(job.outputSize) : "--"}</dd>
                        </div>
                        <div>
                          <dt>Saved</dt>
                          <dd>{job.outputSize ? formatPercent(savedRatio) : "--"}</dd>
                        </div>
                        <div>
                          <dt>Time</dt>
                          <dd>{job.durationMs ? formatSeconds(job.durationMs / 1000) : "--"}</dd>
                        </div>
                      </dl>

                      {job.error ? <p className={styles.errorText}>{job.error}</p> : null}

                      {job.downloadUrl && job.downloadName ? (
                        <a className={styles.downloadLink} href={job.downloadUrl} download={job.downloadName}>
                          Download result
                        </a>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>

      <section className={styles.footerGrid}>
        <article className={styles.infoCard}>
          <p className={styles.panelLabel}>Privacy posture</p>
          <h2>Designed so the browser does the heavy lifting.</h2>
          <p>
            Files are not posted to a backend by default. This is aligned with a static
            deployment model on Vercel where the app serves code, not storage.
          </p>
        </article>

        <article className={styles.infoCard}>
          <p className={styles.panelLabel}>Git + Vercel flow</p>
          <h2>Ready for preview deployments.</h2>
          <p>
            Push feature work to Git, connect the repository to Vercel, and every pull
            request can publish a preview link for review.
          </p>
        </article>
      </section>
    </main>
  );
}
