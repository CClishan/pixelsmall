const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PDF_TYPES = new Set(["application/pdf"]);

export const IMAGE_LIMITS = {
  maxFiles: 20,
  maxSizeBytes: 25 * 1024 * 1024,
};

export const PDF_LIMITS = {
  maxFiles: 1,
  maxSizeBytes: 80 * 1024 * 1024,
};

type ValidationResult = {
  accepted: File[];
  errors: string[];
  warnings: string[];
};

export function validateImageFiles(files: File[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (files.length > IMAGE_LIMITS.maxFiles) {
    errors.push(`Images: up to ${IMAGE_LIMITS.maxFiles} files per batch.`);
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > 60 * 1024 * 1024) {
    warnings.push("Large image batch: compression may take longer on low-memory devices.");
  }

  const accepted = files
    .slice(0, IMAGE_LIMITS.maxFiles)
    .filter((file) => {
      if (!IMAGE_TYPES.has(file.type)) {
        errors.push(`${file.name}: unsupported image format.`);
        return false;
      }

      if (file.size > IMAGE_LIMITS.maxSizeBytes) {
        errors.push(`${file.name}: image exceeds 25 MB limit.`);
        return false;
      }

      if (file.size > 10 * 1024 * 1024) {
        warnings.push(`${file.name}: large image, expect slower local processing.`);
      }

      return true;
    });

  return { accepted, errors, warnings };
}

export function validatePdfFiles(files: File[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (files.length > PDF_LIMITS.maxFiles) {
    errors.push("PDF: upload one file at a time.");
  }

  const accepted = files
    .slice(0, PDF_LIMITS.maxFiles)
    .filter((file) => {
      if (!PDF_TYPES.has(file.type)) {
        errors.push(`${file.name}: only PDF files are supported.`);
        return false;
      }

      if (file.size > PDF_LIMITS.maxSizeBytes) {
        errors.push(`${file.name}: PDF exceeds 80 MB browser-safe limit.`);
        return false;
      }

      if (file.size > 40 * 1024 * 1024) {
        warnings.push(`${file.name}: large PDF, expect higher memory usage during browser compression.`);
      }

      return true;
    });

  return { accepted, errors, warnings };
}
