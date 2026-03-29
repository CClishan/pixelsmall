import imageCompression from "browser-image-compression";
import type { ImageCompressionResult, ImageOutputPreference, ImageWorkspaceState } from "./types";
import {
  arrayBufferToFile,
  buildFileName,
  buildMetrics,
  cancellationError,
  fileToImageData,
  getBaseName,
  imageDataToBlob,
  isSvgFile,
  readTextFile,
  throwIfAborted,
} from "./helpers";
import { encodeLosslessPng, encodeLossyPng, encodeMozJpeg, optimisePngBuffer, optimiseSvg } from "./codecs";

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

function resolveTargetFormat(file: File, targetFormat: ImageOutputPreference) {
  if (targetFormat !== "original") {
    return targetFormat;
  }

  if (isSvgFile(file)) {
    return "original";
  }

  if (file.type.includes("png") || file.type.includes("bmp") || file.type.includes("tiff")) {
    return "PNG";
  }

  if (file.type.includes("webp")) {
    return "WEBP";
  }

  return "JPG";
}

async function fallbackCompress(
  file: File,
  settings: ImageWorkspaceState,
  signal: AbortSignal | undefined,
  onProgress: ((progress: number) => void) | undefined,
  targetMimeType: string,
  quality: number | undefined,
  suffix: string,
  warning?: string,
  fallbackReason?: string,
): Promise<ImageCompressionResult> {
  const startedAt = performance.now();
  const compressed = await imageCompression(file, {
    useWebWorker: true,
    maxWidthOrHeight: settings.maxDimension,
    initialQuality: quality,
    fileType: targetMimeType,
    signal,
    onProgress,
  });

  const outputFile = new File([compressed], `${getBaseName(file.name)}-${suffix}.${extensionFromMime(targetMimeType)}`, {
    type: targetMimeType,
    lastModified: Date.now(),
  });

  return {
    file: outputFile,
    engine: "browser-fallback",
    targetFormat: settings.targetFormat,
    preset: settings.jpeg.preset,
    mode: "raster",
    warning,
    fallbackReason,
    metrics: buildMetrics(file.size, outputFile.size, performance.now() - startedAt),
  };
}

async function fallbackCanvasCompress(
  file: File,
  settings: ImageWorkspaceState,
  targetMimeType: string,
  quality: number | undefined,
  warning?: string,
  fallbackReason?: string,
): Promise<ImageCompressionResult> {
  const startedAt = performance.now();
  const imageData = await fileToImageData(file, settings.maxDimension);
  const blob = await imageDataToBlob(imageData, targetMimeType, quality);
  const outputFile = new File([blob], `${getBaseName(file.name)}-compressed.${extensionFromMime(targetMimeType)}`, {
    type: targetMimeType,
    lastModified: Date.now(),
  });

  return {
    file: outputFile,
    engine: "browser-fallback",
    targetFormat: settings.targetFormat,
    preset: settings.jpeg.preset,
    mode: "raster",
    warning,
    fallbackReason,
    metrics: buildMetrics(file.size, outputFile.size, performance.now() - startedAt),
  };
}

async function maybeKeepOriginal(
  originalFile: File,
  candidate: File,
  result: Omit<ImageCompressionResult, "file" | "retainedOriginal" | "metrics">,
  startedAt: number,
  keepOriginalIfLarger: boolean,
  warning: string,
): Promise<ImageCompressionResult> {
  if (keepOriginalIfLarger && candidate.size >= originalFile.size) {
    return {
      ...result,
      file: originalFile,
      retainedOriginal: true,
      warning,
      metrics: buildMetrics(originalFile.size, originalFile.size, performance.now() - startedAt),
    };
  }

  return {
    ...result,
    file: candidate,
    metrics: buildMetrics(originalFile.size, candidate.size, performance.now() - startedAt),
  };
}

async function compressSvgFile(
  file: File,
  settings: ImageWorkspaceState,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  const startedAt = performance.now();
  throwIfAborted(signal);
  onProgress?.(10);

  const source = await readTextFile(file);
  const optimized = await optimiseSvg(source, settings.svg);
  throwIfAborted(signal);
  onProgress?.(80);

  const outputFile = new File([optimized], buildFileName(file.name, "compressed", "svg"), {
    type: "image/svg+xml",
    lastModified: Date.now(),
  });

  onProgress?.(100);
  return maybeKeepOriginal(
    file,
    outputFile,
    {
      engine: "svgo",
      targetFormat: settings.targetFormat,
      preset: settings.svg.preset,
      mode: "vector",
    },
    startedAt,
    settings.keepOriginalIfLarger,
    "SVG output was not smaller, so PixelSmall kept the original file.",
  );
}

async function compressToJpeg(
  file: File,
  settings: ImageWorkspaceState,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  const startedAt = performance.now();
  onProgress?.(8);
  const imageData = await fileToImageData(file, settings.maxDimension);
  throwIfAborted(signal);
  onProgress?.(40);

  const encoded = await encodeMozJpeg(imageData, settings.jpeg);
  throwIfAborted(signal);
  onProgress?.(92);

  const outputFile = arrayBufferToFile(encoded, buildFileName(file.name, "compressed", "jpg"), "image/jpeg");
  onProgress?.(100);

  return maybeKeepOriginal(
    file,
    outputFile,
    {
      engine: "mozjpeg",
      targetFormat: settings.targetFormat,
      preset: settings.jpeg.preset,
      mode: "raster",
    },
    startedAt,
    settings.keepOriginalIfLarger,
    "JPEG output was not smaller, so PixelSmall kept the original file.",
  );
}

async function compressToPng(
  file: File,
  settings: ImageWorkspaceState,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  const startedAt = performance.now();
  onProgress?.(6);
  let encoded: ArrayBuffer;
  const engine: ImageCompressionResult["engine"] = settings.pngMode === "lossless" ? "oxipng" : "upng";

  if (settings.pngMode === "lossless" && file.type === "image/png" && settings.targetFormat === "original") {
    encoded = await optimisePngBuffer(await file.arrayBuffer(), settings.pngLossless);
  } else {
    const imageData = await fileToImageData(file, settings.maxDimension);
    throwIfAborted(signal);
    onProgress?.(50);
    encoded =
      settings.pngMode === "lossless"
        ? await encodeLosslessPng(imageData, settings.pngLossless)
        : await encodeLossyPng(imageData, settings.pngLossy, settings.pngLossless);
  }

  throwIfAborted(signal);
  onProgress?.(96);
  const outputFile = arrayBufferToFile(encoded, buildFileName(file.name, "compressed", "png"), "image/png");
  onProgress?.(100);

  return maybeKeepOriginal(
    file,
    outputFile,
    {
      engine,
      targetFormat: settings.targetFormat,
      preset: settings.jpeg.preset,
      mode: settings.pngMode,
    },
    startedAt,
    settings.keepOriginalIfLarger,
    `${settings.pngMode === "lossless" ? "Lossless" : "Quantized"} PNG output was not smaller, so PixelSmall kept the original file.`,
  );
}

async function compressToWebp(
  file: File,
  settings: ImageWorkspaceState,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  return fallbackCompress(
    file,
    settings,
    signal,
    onProgress,
    "image/webp",
    settings.webpQuality / 100,
    "compressed",
    "WebP uses the browser compatibility encoder in this build.",
    "Specialized WebP WASM is not enabled yet, so PixelSmall used the browser fallback path.",
  );
}

export async function compressImageFile(
  file: File,
  settings: ImageWorkspaceState,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
): Promise<ImageCompressionResult> {
  throwIfAborted(signal);

  const sourceIsSvg = isSvgFile(file);
  const target = resolveTargetFormat(file, settings.targetFormat);

  try {
    if (sourceIsSvg && settings.targetFormat === "original") {
      return compressSvgFile(file, settings, signal, onProgress);
    }

    if (target === "JPG") {
      return compressToJpeg(file, settings, signal, onProgress);
    }

    if (target === "PNG") {
      return compressToPng(file, settings, signal, onProgress);
    }

    if (target === "WEBP") {
      return compressToWebp(file, settings, signal, onProgress);
    }

    if (sourceIsSvg) {
      return compressSvgFile(file, settings, signal, onProgress);
    }

    return compressToJpeg(file, settings, signal, onProgress);
  } catch (error) {
    if (signal?.aborted) {
      throw cancellationError(signal);
    }

    if (target === "WEBP") {
      throw error;
    }

    const fallbackMimeType = target === "PNG" ? "image/png" : target === "JPG" ? "image/jpeg" : "image/webp";
    const fallbackQuality =
      target === "PNG" ? undefined : target === "JPG" ? settings.jpeg.quality / 100 : settings.webpQuality / 100;
    const warning =
      target === "PNG"
        ? "Advanced PNG compression was unavailable, so PixelSmall used the browser fallback path."
        : target === "JPG"
          ? "MozJPEG was unavailable, so PixelSmall used the browser fallback path."
          : "Specialized codec was unavailable, so PixelSmall used the browser fallback path.";

    if (sourceIsSvg) {
      return fallbackCanvasCompress(
        file,
        settings,
        fallbackMimeType,
        fallbackQuality,
        warning,
        error instanceof Error ? error.message : "Advanced image codec failed to initialize.",
      );
    }

    return fallbackCompress(
      file,
      settings,
      signal,
      onProgress,
      fallbackMimeType,
      fallbackQuality,
      "compressed",
      warning,
      error instanceof Error ? error.message : "Advanced image codec failed to initialize.",
    );
  }
}
