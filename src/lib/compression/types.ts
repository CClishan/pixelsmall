export type CompressionPreset = "fast" | "balanced" | "smallest" | "custom";
export type ImageOutputPreference = "original" | "JPG" | "PNG" | "WEBP";
export type PngCompressionMode = "lossless" | "lossy";
export type SvgCompressionPreset = "safe" | "advanced";
export type ImageCompressionEngine = "mozjpeg" | "oxipng" | "upng" | "svgo" | "browser-fallback";
export type PdfCompressionEngine = "pdf-raster";
export type PdfPageEncoding = "jpeg" | "png";

export interface JpegOptions {
  preset: CompressionPreset;
  quality: number;
  progressive: boolean;
  chromaSubsampling: boolean;
  trellisLoops: number;
}

export interface PngLosslessOptions {
  level: number;
  interlace: boolean;
  optimiseAlpha: boolean;
}

export interface PngLossyOptions {
  colors: number;
  interlace: boolean;
}

export interface SvgOptions {
  preset: SvgCompressionPreset;
  multipass: boolean;
  removeDimensions: boolean;
}

export interface ImageWorkspaceState {
  targetFormat: ImageOutputPreference;
  pngMode: PngCompressionMode;
  maxDimension: number;
  keepOriginalIfLarger: boolean;
  webpQuality: number;
  jpeg: JpegOptions;
  pngLossless: PngLosslessOptions;
  pngLossy: PngLossyOptions;
  svg: SvgOptions;
}

export interface PdfCompressionInput {
  preset: CompressionPreset;
  dpi: number;
  jpegQuality: number;
  pngColorThreshold: number;
  pngLossless: PngLosslessOptions;
}

export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  ratio: number;
  durationMs: number;
}

export interface ImageCompressionResult {
  file: File;
  engine: ImageCompressionEngine;
  targetFormat: ImageOutputPreference;
  preset: CompressionPreset | SvgCompressionPreset;
  mode: PngCompressionMode | "vector" | "raster";
  warning?: string;
  fallbackReason?: string;
  retainedOriginal?: boolean;
  metrics: CompressionMetrics;
}

export interface PdfCompressionResult {
  file: File;
  engine: PdfCompressionEngine;
  pageEncodings: Record<PdfPageEncoding, number>;
  warning?: string;
  fallbackReason?: string;
  metrics: CompressionMetrics;
}
