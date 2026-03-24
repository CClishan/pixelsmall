import { PDFDocument } from "pdf-lib";

export type PdfCompressionOptions = {
  dpi: number;
  jpegQuality: number;
};

function createCancellationError(signal?: AbortSignal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new Error("Compression cancelled.");
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createCancellationError(signal);
  }
}

let pdfJsPromise: Promise<typeof import("pdfjs-dist/legacy/build/pdf.mjs")> | null = null;

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      if (typeof window !== "undefined") {
        module.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
      }

      return module;
    });
  }

  return pdfJsPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Failed to convert canvas to JPEG blob."));
      },
      "image/jpeg",
      quality,
    );
  });
}

export async function compressPdfFile(
  file: File,
  options: PdfCompressionOptions,
  signal?: AbortSignal,
  onPageProgress?: (currentPage: number, totalPages: number) => void,
) {
  throwIfAborted(signal);
  const pdfjs = await loadPdfJs();
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: sourceBytes });
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
        throw new Error("Canvas 2D context is unavailable in this browser.");
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
          throw createCancellationError(signal);
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

export async function estimatePdfPages(file: File) {
  const pdfjs = await loadPdfJs();
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data: sourceBytes });

  try {
    const sourcePdf = await loadingTask.promise;
    return sourcePdf.numPages;
  } finally {
    await loadingTask.destroy();
  }
}
