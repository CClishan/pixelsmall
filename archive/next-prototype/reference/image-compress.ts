import imageCompression from "browser-image-compression";

export type ImageOutputFormat = "keep" | "image/jpeg" | "image/webp";

export type ImageCompressionOptions = {
  quality: number;
  maxDimension: number;
  outputFormat: ImageOutputFormat;
};

export const IMAGE_FORMAT_LABELS: Record<ImageOutputFormat, string> = {
  keep: "Keep original format",
  "image/jpeg": "Convert to JPG",
  "image/webp": "Convert to WebP",
};

function extensionFromType(mimeType: string) {
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

export async function compressImageFile(
  file: File,
  options: ImageCompressionOptions,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void,
) {
  const targetType = options.outputFormat === "keep" ? file.type : options.outputFormat;
  const compressed = await imageCompression(file, {
    useWebWorker: true,
    initialQuality: options.quality,
    maxWidthOrHeight: options.maxDimension,
    fileType: targetType,
    signal,
    onProgress,
  });

  const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
  const extension = extensionFromType(targetType);

  return new File([compressed], `${baseName}-compressed.${extension}`, {
    type: targetType,
    lastModified: Date.now(),
  });
}
