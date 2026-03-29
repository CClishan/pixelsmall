import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { PdfCompressionInput, PdfCompressionResult, PdfPageEncoding } from "./types";
import {
  arrayBufferToFile,
  buildMetrics,
  cancellationError,
  estimateColorDiversity,
  hasTransparency,
  throwIfAborted,
} from "./helpers";
import { encodeLosslessPng, encodeMozJpeg } from "./codecs";

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;
let pdfLibPromise: Promise<typeof import("pdf-lib")> | null = null;

function buildPdfDocumentOptions(data: Uint8Array) {
  return {
    data,
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

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      module.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return module;
    });
  }

  return pdfJsPromise;
}

async function loadPdfLib() {
  if (!pdfLibPromise) {
    pdfLibPromise = import("pdf-lib");
  }

  return pdfLibPromise;
}

function choosePdfPageEncoding(imageData: ImageData, options: PdfCompressionInput): PdfPageEncoding {
  if (hasTransparency(imageData, 8)) {
    return "png";
  }

  if (estimateColorDiversity(imageData, 8) <= options.pngColorThreshold) {
    return "png";
  }

  return "jpeg";
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
  onPageProgress?: (currentPage: number, totalPages: number, encoding?: PdfPageEncoding) => void,
): Promise<PdfCompressionResult> {
  const startedAt = performance.now();
  throwIfAborted(signal);

  const [{ PDFDocument }, pdfjs] = await Promise.all([loadPdfLib(), loadPdfJs()]);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument(buildPdfDocumentOptions(sourceBytes));
  const onAbort = () => {
    void loadingTask.destroy();
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const sourcePdf = await loadingTask.promise;
    const outputPdf = await PDFDocument.create();
    const pageEncodings: Record<PdfPageEncoding, number> = { jpeg: 0, png: 0 };

    for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
      throwIfAborted(signal);

      const page = await sourcePdf.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const renderScale = options.dpi / 72;
      const renderViewport = page.getViewport({ scale: renderScale });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { alpha: true });

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

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const encoding = choosePdfPageEncoding(imageData, options);
      onPageProgress?.(pageNumber, sourcePdf.numPages, encoding);
      throwIfAborted(signal);

      if (encoding === "png") {
        const pngBytes = await encodeLosslessPng(imageData, options.pngLossless);
        const image = await outputPdf.embedPng(pngBytes);
        const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);
        outputPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
        pageEncodings.png += 1;
      } else {
        const jpegBytes = await encodeMozJpeg(imageData, {
          preset: options.preset,
          quality: Math.round(options.jpegQuality * 100),
          progressive: options.preset !== "fast",
          chromaSubsampling: true,
          trellisLoops: options.preset === "smallest" ? 3 : options.preset === "balanced" ? 2 : 1,
        });
        const image = await outputPdf.embedJpg(jpegBytes);
        const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);
        outputPage.drawImage(image, { x: 0, y: 0, width: baseViewport.width, height: baseViewport.height });
        pageEncodings.jpeg += 1;
      }

      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }

    const outputBytes = await outputPdf.save({ useObjectStreams: true });
    const slicedBytes = outputBytes.buffer.slice(outputBytes.byteOffset, outputBytes.byteOffset + outputBytes.byteLength);
    const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
    const outputFile = arrayBufferToFile(slicedBytes, `${baseName}-compressed.pdf`, "application/pdf");

    return {
      file: outputFile,
      engine: "pdf-raster",
      pageEncodings,
      warning:
        pageEncodings.png > 0
          ? "Some PDF pages were kept as PNG to preserve transparency or flat-color detail."
          : undefined,
      metrics: buildMetrics(file.size, outputFile.size, performance.now() - startedAt),
    };
  } catch (error) {
    if (signal?.aborted) {
      throw cancellationError(signal);
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
    await loadingTask.destroy();
  }
}
