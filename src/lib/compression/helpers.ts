import type { CompressionMetrics } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isSvgFile(file: File) {
  return file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
}

export function getBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "file";
}

export function buildFileName(fileName: string, suffix: string, extension: string) {
  return `${getBaseName(fileName)}-${suffix}.${extension}`;
}

export function buildMetrics(originalSize: number, compressedSize: number, durationMs: number): CompressionMetrics {
  return {
    originalSize,
    compressedSize,
    durationMs,
    ratio: originalSize > 0 ? compressedSize / originalSize : 1,
  };
}

export function arrayBufferToFile(buffer: ArrayBuffer, name: string, type: string) {
  return new File([buffer], name, {
    type,
    lastModified: Date.now(),
  });
}

export function blobToFile(blob: Blob, name: string, type = blob.type) {
  return new File([blob], name, {
    type,
    lastModified: Date.now(),
  });
}

export function readTextFile(file: File) {
  return file.text();
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw cancellationError(signal);
  }
}

export function cancellationError(signal?: AbortSignal) {
  const reason = signal?.reason;
  return reason instanceof Error ? reason : new Error("Compression cancelled.");
}

export async function loadImageElement(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;

  try {
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to decode image."));
      });
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  return image;
}

export async function fileToImageData(file: File, maxDimension: number) {
  const image = await loadImageElement(file);
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas rendering is unavailable in this browser.");
  }

  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

export async function imageDataToBlob(imageData: ImageData, mimeType: string, quality?: number) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas rendering is unavailable in this browser.");
  }

  context.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to export image data."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export function copyImageBuffer(imageData: ImageData) {
  return imageData.data.buffer.slice(0);
}

export function hasTransparency(imageData: ImageData, step = 16) {
  const { data } = imageData;
  for (let index = 3; index < data.length; index += 4 * step) {
    if (data[index] < 250) {
      return true;
    }
  }

  return false;
}

export function estimateColorDiversity(imageData: ImageData, step = 16) {
  const colors = new Set<number>();
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4 * step) {
    const color = (data[index] << 16) | (data[index + 1] << 8) | data[index + 2];
    colors.add(color);
    if (colors.size > 512) {
      break;
    }
  }

  return colors.size;
}
