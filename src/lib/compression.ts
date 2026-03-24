import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export type ImageOutputFormat = "JPG" | "PNG" | "WEBP" | "BMP" | "TIFF";

export type ImageCompressionInput = {
  outputFormat: ImageOutputFormat;
  quality: number;
};

export type PdfCompressionInput = {
  dpi: number;
  jpegQuality: number;
};

export type ImageCompressionResult = {
  file: File;
  warning?: string;
};

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

function buildPdfDocumentOptions(data: Uint8Array) {
  return {
    data,
    // Favor the most compatible browser path for local uploads.
    disableRange: true,
    disableStream: true,
    disableAutoFetch: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    isOffscreenCanvasSupported: false,
    isImageDecoderSupported: false,
    stopAtErrors: true,
  };
}

function extensionFromMime(mimeType: string) {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

function resolveImageOutput(format: ImageOutputFormat) {
  switch (format) {
    case "JPG":
      return { mimeType: "image/jpeg", extension: "jpg" };
    case "PNG":
      return { mimeType: "image/png", extension: "png" };
    case "WEBP":
      return { mimeType: "image/webp", extension: "webp" };
    case "BMP":
    case "TIFF":
      return {
        mimeType: "image/png",
        extension: "png",
        warning: `${format} export is not supported in standard browser encoders yet. PixelSmall will output PNG instead.`,
      };
    default:
      return { mimeType: "image/jpeg", extension: "jpg" };
  }
}

export async function compressImageFile(
  file: File,
  options: ImageCompressionInput,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<ImageCompressionResult> {
  const target = resolveImageOutput(options.outputFormat);
  const compressed = await imageCompression(file, {
    useWebWorker: true,
    fileType: target.mimeType,
    initialQuality: Math.min(Math.max(options.quality / 100, 0.1), 0.95),
    maxWidthOrHeight: 2800,
    signal,
    onProgress,
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const extension = target.extension || extensionFromMime(target.mimeType);

  return {
    file: new File([compressed], `${baseName}-compressed.${extension}`, {
      type: target.mimeType,
      lastModified: Date.now(),
    }),
    warning: target.warning,
  };
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return module;
    });
  }

  return pdfJsPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to generate compressed PDF page image."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

function cancellationError(signal?: AbortSignal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new Error("Compression cancelled.");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw cancellationError(signal);
  }
}

export async function estimatePdfPages(file: File) {
  const pdfjs = await loadPdfJs();
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument(buildPdfDocumentOptions(sourceBytes));

  try {
    const sourcePdf = await loadingTask.promise;
    return sourcePdf.numPages;
  } finally {
    await loadingTask.destroy();
  }
}

export async function compressPdfFile(
  file: File,
  options: PdfCompressionInput,
  signal?: AbortSignal,
  onPageProgress?: (currentPage: number, totalPages: number) => void,
) {
  throwIfAborted(signal);

  const pdfjs = await loadPdfJs();
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument(buildPdfDocumentOptions(sourceBytes));
  const onAbort = () => {
    void loadingTask.destroy();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const sourcePdf = await loadingTask.promise;
    const outputPdf = await PDFDocument.create();

    for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
      throwIfAborted(signal);
      onPageProgress?.(pageNumber, sourcePdf.numPages);

      const page = await sourcePdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const renderScale = options.dpi / 72;
      const renderViewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        throw new Error("Canvas rendering is unavailable in this browser.");
      }

      canvas.width = Math.ceil(renderViewport.width);
      canvas.height = Math.ceil(renderViewport.height);

      const renderTask = page.render({ canvas, canvasContext: context, viewport: renderViewport });
      const cancelRender = () => renderTask.cancel();
      signal?.addEventListener("abort", cancelRender, { once: true });

      try {
        await renderTask.promise;
      } catch (error) {
        if (signal?.aborted) {
          throw cancellationError(signal);
        }
        throw error;
      } finally {
        signal?.removeEventListener("abort", cancelRender);
      }

      throwIfAborted(signal);
      const blob = await canvasToBlob(canvas, options.jpegQuality);
      const imageBytes = new Uint8Array(await blob.arrayBuffer());
      const image = await outputPdf.embedJpg(imageBytes);
      const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);

      outputPage.drawImage(image, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height,
      });

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }

    const outputBytes = await outputPdf.save({ useObjectStreams: true });
    const outputBuffer = new ArrayBuffer(outputBytes.length);
    new Uint8Array(outputBuffer).set(outputBytes);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "document";

    return new File([outputBuffer], `${baseName}-compressed.pdf`, {
      type: "application/pdf",
      lastModified: Date.now(),
    });
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await loadingTask.destroy();
  }
}
