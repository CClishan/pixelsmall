export type Locale = "en" | "zh";

export interface MessageDescriptor {
  key?: string;
  raw?: string;
  values?: Record<string, string | number | undefined>;
}

export interface LocalizedCopy {
  locale: Locale;
  languageLabel: string;
  queueTitle: string;
  savingsLabel: string;
  imageSettingsLabel: string;
  pdfSettingsLabel: string;
  preferredOutputLabel: string;
  jpegPresetLabel: string;
  jpegQualityLabel: string;
  webpQualityLabel: string;
  pngModeLabel: string;
  oxipngLevelLabel: string;
  pngPaletteLabel: string;
  svgProfileLabel: string;
  advancedLabel: string;
  advancedHintLabel: string;
  maxDimensionLabel: string;
  keepResultLabel: string;
  compressionPresetLabel: string;
  rasterDpiLabel: string;
  jpegPageQualityLabel: string;
  pngThresholdLabel: string;
  pngThresholdHint: string;
  creditsLabel: string;
  creditsNote: string;
  downloadZipLabel: string;
  clearWorkspaceLabel: string;
  closeToastLabel: string;
  languageOptionEnglish: string;
  languageOptionChinese: string;
  templates: Record<string, string>;
  workspaces: {
    image: string;
    pdf: string;
  };
  tabs: {
    image: string;
    pdf: string;
    subtitle: string;
  };
  dropzone: {
    imageTitle: string;
    imageSubtitle: string;
    imageHint: string;
    pdfTitle: string;
    pdfSubtitle: string;
    pdfHint: string;
  };
  empty: {
    imageQueue: string;
    pdfQueue: string;
    noDownloads: string;
    noCompleted: string;
  };
  actions: {
    compressImage: string;
    compressPdf: string;
    processing: string;
    download: string;
    remove: string;
    cancel: string;
  };
  settings: {
    keepSource: string;
    keepSmallerResult: string;
    alwaysExportCompressed: string;
    safe: string;
    advanced: string;
    lossless: string;
    lossy: string;
  };
}

const STORAGE_KEY = "pixelsmall-locale";

const copyByLocale: Record<Locale, LocalizedCopy> = {
  en: {
    locale: "en",
    languageLabel: "Language",
    queueTitle: "Queue List",
    savingsLabel: "Savings",
    imageSettingsLabel: "Image settings",
    pdfSettingsLabel: "PDF settings",
    preferredOutputLabel: "Preferred output",
    jpegPresetLabel: "JPEG preset",
    jpegQualityLabel: "JPEG quality",
    webpQualityLabel: "WEBP quality",
    pngModeLabel: "PNG mode",
    oxipngLevelLabel: "OxiPNG level",
    pngPaletteLabel: "Palette colors",
    svgProfileLabel: "SVG profile",
    advancedLabel: "Advanced",
    advancedHintLabel: "Suggested default",
    maxDimensionLabel: "Max dimension",
    keepResultLabel: "Result policy",
    compressionPresetLabel: "Compression preset",
    rasterDpiLabel: "Raster DPI",
    jpegPageQualityLabel: "JPEG page quality",
    pngThresholdLabel: "PNG page threshold",
    pngThresholdHint: "Lower = smaller files, Higher = cleaner flat graphics.",
    creditsLabel: "Acknowledgements",
    creditsNote: "Built with these browser-side codecs and PDF tools.",
    downloadZipLabel: "Download ZIP",
    clearWorkspaceLabel: "Clear workspace",
    closeToastLabel: "Close notification",
    languageOptionEnglish: "EN",
    languageOptionChinese: "中文",
    templates: {
      unsupportedFileType: "Unsupported file type: {{name}}",
      fileTooLarge: "File too large (max {{maxMb}}MB): {{name}}",
      largeImageWarning: "{{name}} is large. Compression may take longer on this device.",
      largePdfWarning: "{{name}} is a large PDF. Expect higher browser memory usage.",
      queueCleared: "{{workspace}} queue cleared.",
      cancelledOneRunningJob: "Cancelled one running job.",
      preparingPdfEstimate: "Preparing PDF page estimate...",
      readyBrowserCompression: "Ready for browser-side compression.",
      pdfPagesReady: "{{count}} {{pageLabel}} ready for scanned-PDF compression.",
      longPdfDetected: "Long PDF detected. Expect slower processing and higher browser memory usage.",
      longPdfToast: "Long PDF detected. Expect slower local processing.",
      pdfUploadedEstimateUnavailable: "PDF uploaded. Page estimate unavailable in this browser.",
      noPendingToCompress: "No pending {{workspace}} to compress.",
      preparingImagePipeline: "Preparing specialized image pipeline...",
      rasterizingPdfPages: "Rasterizing {{count}} {{pageLabel}} locally...",
      compressingImage: "Compressing image locally... {{progress}}%",
      compressingPdfPage: "Compressing PDF page {{currentPage}}/{{totalPages}}{{encoding}}...",
      keptOriginal: "Kept the original file because it was already smaller.",
      imageCompressedReady: "Image compressed and ready to download.",
      pdfCompressedReady: "PDF compressed and ready. JPEG pages: {{jpeg}}, PNG pages: {{png}}.",
      cancelledBeforeCompletion: "Cancelled before completion.",
      compressionFailedBrowser: "Compression failed in this browser.",
      compressionFailed: "Compression failed.",
      compressionFinished: "{{workspace}} compression finished.",
      fileNotReadyDownload: "This file is not ready to download yet.",
      downloadedFile: "Downloaded {{name}}.",
      noCompletedToDownload: "No completed {{workspace}} to download.",
      preparedZip: "Prepared {{count}} files in {{name}}.",
      queueCount: "{{count}} {{itemLabel}}",
      pageCount: "{{count}} {{pageLabel}}",
      imageSummary: "PNG mode: {{pngMode}}, JPEG preset: {{preset}}",
      pdfSummary: "Raster DPI: {{dpi}}, JPEG quality: {{quality}}%",
      completedOutputSummary: "Completed output: {{compressed}} from {{original}}",
      savingsSoFar: "Savings so far: -{{savings}}%",
      fallbackReasonPrefix: "Fallback: {{reason}}",
      browserCodecInitFailed: "Advanced image codec failed to initialize.",
      compressionCancelled: "Compression cancelled.",
      unableToDecodeImage: "Unable to decode image.",
      canvasUnavailable: "Canvas rendering is unavailable in this browser.",
      unableToExportImageData: "Unable to export image data.",
      mozjpegUnavailable: "MozJPEG was unavailable, so PixelSmall used the browser fallback path.",
      pngUnavailable: "Advanced PNG compression was unavailable, so PixelSmall used the browser fallback path.",
      specializedCodecUnavailable: "Specialized codec was unavailable, so PixelSmall used the browser fallback path.",
      webpCompatibilityEncoder: "WebP uses the browser compatibility encoder in this build.",
      webpSpecializedUnavailable: "Specialized WebP WASM is not enabled yet, so PixelSmall used the browser fallback path.",
      svgNotSmaller: "SVG output was not smaller, so PixelSmall kept the original file.",
      jpegNotSmaller: "JPEG output was not smaller, so PixelSmall kept the original file.",
      pngNotSmallerLossless: "Lossless PNG output was not smaller, so PixelSmall kept the original file.",
      pngNotSmallerQuantized: "Quantized PNG output was not smaller, so PixelSmall kept the original file.",
      pdfPngPagesWarning: "Some PDF pages were kept as PNG to preserve transparency or flat-color detail.",
      wasmBinaryLoadFailed: "{{label}} binary could not be loaded.",
      wasmBinaryInvalid: "{{label}} binary response was invalid. This usually means HTML was returned instead of WASM.",
      pageEncodingSuffix: " using {{encoding}}",
    },
    workspaces: {
      image: "images",
      pdf: "PDFs",
    },
    tabs: {
      image: "Images",
      pdf: "PDF",
      subtitle: "Workspace",
    },
    dropzone: {
      imageTitle: "Drag, drop, or browse for images",
      imageSubtitle: "Release to add images to the local queue",
      imageHint: "JPG PNG WEBP BMP TIFF SVG - up to 50MB each",
      pdfTitle: "Drag, drop, or browse for PDFs",
      pdfSubtitle: "Release to add PDFs to the local queue",
      pdfHint: "Scanned PDF - up to 50MB each",
    },
    empty: {
      imageQueue: "No images in queue",
      pdfQueue: "No PDFs in queue",
      noDownloads: "No downloads yet",
      noCompleted: "No completed output in this workspace yet.",
    },
    actions: {
      compressImage: "Compress images",
      compressPdf: "Compress PDFs",
      processing: "Processing...",
      download: "Download",
      remove: "Remove",
      cancel: "Cancel",
    },
    settings: {
      keepSource: "Keep source",
      keepSmallerResult: "Keep smaller",
      alwaysExportCompressed: "Force compressed",
      safe: "Safe",
      advanced: "Advanced",
      lossless: "Lossless",
      lossy: "Lossy",
    },
  },
  zh: {
    locale: "zh",
    languageLabel: "语言",
    queueTitle: "队列",
    savingsLabel: "压缩率",
    imageSettingsLabel: "图片设置",
    pdfSettingsLabel: "PDF 设置",
    preferredOutputLabel: "输出格式",
    jpegPresetLabel: "JPEG 预设",
    jpegQualityLabel: "JPEG 质量",
    webpQualityLabel: "WEBP 质量",
    pngModeLabel: "PNG 模式",
    oxipngLevelLabel: "OxiPNG 等级",
    pngPaletteLabel: "调色板颜色数",
    svgProfileLabel: "SVG 配置",
    advancedLabel: "高级设置",
    advancedHintLabel: "建议默认",
    maxDimensionLabel: "最大尺寸",
    keepResultLabel: "结果策略",
    compressionPresetLabel: "压缩预设",
    rasterDpiLabel: "栅格 DPI",
    jpegPageQualityLabel: "JPEG 页面质量",
    pngThresholdLabel: "PNG 页面阈值",
    pngThresholdHint: "低一些更省体积，高一些更适合线稿和纯色页面。",
    creditsLabel: "致谢",
    creditsNote: "当前工具基于这些浏览器端编解码与 PDF 开源方案。",
    downloadZipLabel: "下载 ZIP",
    clearWorkspaceLabel: "清空工作区",
    closeToastLabel: "关闭提示",
    languageOptionEnglish: "EN",
    languageOptionChinese: "中文",
    templates: {
      unsupportedFileType: "不支持的文件类型：{{name}}",
      fileTooLarge: "文件过大（最大 {{maxMb}}MB）：{{name}}",
      largeImageWarning: "{{name}} 文件较大，当前设备上压缩可能更慢。",
      largePdfWarning: "{{name}} 是较大的 PDF，浏览器内存占用会更高。",
      queueCleared: "已清空{{workspace}}队列。",
      cancelledOneRunningJob: "已取消一个正在处理的任务。",
      preparingPdfEstimate: "正在估算 PDF 页数...",
      readyBrowserCompression: "已就绪，可在浏览器本地压缩。",
      pdfPagesReady: "共 {{count}} {{pageLabel}}，可进行扫描 PDF 压缩。",
      longPdfDetected: "检测到长 PDF，处理会更慢且会占用更多浏览器内存。",
      longPdfToast: "检测到长 PDF，本地处理时间可能更长。",
      pdfUploadedEstimateUnavailable: "PDF 已上传，但当前浏览器无法估算页数。",
      noPendingToCompress: "没有待压缩的{{workspace}}。",
      preparingImagePipeline: "正在准备专用图片压缩管线...",
      rasterizingPdfPages: "正在本地栅格化 {{count}} {{pageLabel}}...",
      compressingImage: "正在本地压缩图片... {{progress}}%",
      compressingPdfPage: "正在压缩 PDF 第 {{currentPage}}/{{totalPages}} 页{{encoding}}...",
      keptOriginal: "原文件已经更小，已保留原文件。",
      imageCompressedReady: "图片已压缩完成，可以下载。",
      pdfCompressedReady: "PDF 已压缩完成。JPEG 页：{{jpeg}}，PNG 页：{{png}}。",
      cancelledBeforeCompletion: "已在完成前取消。",
      compressionFailedBrowser: "当前浏览器中压缩失败。",
      compressionFailed: "压缩失败。",
      compressionFinished: "{{workspace}}压缩完成。",
      fileNotReadyDownload: "这个文件还不能下载。",
      downloadedFile: "已下载 {{name}}。",
      noCompletedToDownload: "没有可下载的已完成{{workspace}}。",
      preparedZip: "已将 {{count}} 个文件打包为 {{name}}。",
      queueCount: "{{count}} 项",
      pageCount: "{{count}} {{pageLabel}}",
      imageSummary: "PNG 模式：{{pngMode}}，JPEG 预设：{{preset}}",
      pdfSummary: "栅格 DPI：{{dpi}}，JPEG 质量：{{quality}}%",
      completedOutputSummary: "已完成输出：{{compressed}}（原始 {{original}}）",
      savingsSoFar: "当前节省：-{{savings}}%",
      fallbackReasonPrefix: "回退原因：{{reason}}",
      browserCodecInitFailed: "高级图片编码器初始化失败。",
      compressionCancelled: "压缩已取消。",
      unableToDecodeImage: "无法解析图片内容。",
      canvasUnavailable: "当前浏览器不支持所需的 Canvas 渲染。",
      unableToExportImageData: "无法导出图片数据。",
      mozjpegUnavailable: "MozJPEG 不可用，因此已切换到浏览器回退路径。",
      pngUnavailable: "高级 PNG 压缩不可用，因此已切换到浏览器回退路径。",
      specializedCodecUnavailable: "专用编码器不可用，因此已切换到浏览器回退路径。",
      webpCompatibilityEncoder: "当前构建中的 WebP 使用浏览器兼容编码器。",
      webpSpecializedUnavailable: "当前未启用专用 WebP WASM，因此已切换到浏览器回退路径。",
      svgNotSmaller: "SVG 输出没有变小，因此保留了原文件。",
      jpegNotSmaller: "JPEG 输出没有变小，因此保留了原文件。",
      pngNotSmallerLossless: "无损 PNG 输出没有变小，因此保留了原文件。",
      pngNotSmallerQuantized: "量化 PNG 输出没有变小，因此保留了原文件。",
      pdfPngPagesWarning: "部分 PDF 页面为保留透明或纯色细节，继续使用 PNG。",
      wasmBinaryLoadFailed: "{{label}} 二进制资源加载失败。",
      wasmBinaryInvalid: "{{label}} 二进制响应无效，通常表示返回了 HTML 而不是 WASM。",
      pageEncodingSuffix: "，编码为 {{encoding}}",
    },
    workspaces: {
      image: "图片",
      pdf: "PDF",
    },
    tabs: {
      image: "图片",
      pdf: "PDF",
      subtitle: "工作区",
    },
    dropzone: {
      imageTitle: "拖拽、释放或点击选择图片",
      imageSubtitle: "松开即可加入本地处理队列",
      imageHint: "JPG PNG WEBP BMP TIFF SVG - 单个文件不超过 50MB",
      pdfTitle: "拖拽、释放或点击选择 PDF",
      pdfSubtitle: "松开即可加入本地处理队列",
      pdfHint: "扫描 PDF - 单个文件不超过 50MB",
    },
    empty: {
      imageQueue: "队列中还没有图片",
      pdfQueue: "队列中还没有 PDF",
      noDownloads: "还没有可下载文件",
      noCompleted: "当前工作区还没有完成的输出。",
    },
    actions: {
      compressImage: "压缩图片",
      compressPdf: "压缩 PDF",
      processing: "处理中...",
      download: "下载",
      remove: "移除",
      cancel: "取消",
    },
    settings: {
      keepSource: "保持源格式",
      keepSmallerResult: "保留更小结果",
      alwaysExportCompressed: "始终导出压缩结果",
      safe: "安全",
      advanced: "高级",
      lossless: "无损",
      lossy: "有损",
    },
  },
};

export function getCopy(locale: Locale) {
  return copyByLocale[locale];
}

export function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "zh") {
    return saved;
  }

  return window.navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function persistLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, locale);
}

export function message(key: string, values?: MessageDescriptor["values"]): MessageDescriptor {
  return { key, values };
}

export function rawMessage(raw: string): MessageDescriptor {
  return { raw };
}

export function translateMessage(locale: Locale, input?: MessageDescriptor | string | null) {
  if (!input) {
    return "";
  }

  const messageValue = typeof input === "string" ? { raw: input } : input;
  const copy = getCopy(locale);

  if (messageValue.key && copy.templates[messageValue.key]) {
    return formatTemplate(copy.templates[messageValue.key], messageValue.values);
  }

  if (messageValue.raw) {
    return localizeRawMessage(locale, messageValue.raw);
  }

  return "";
}

export function localizeRawMessage(locale: Locale, raw: string) {
  const copy = getCopy(locale);

  if (raw === "Some PDF pages were kept as PNG to preserve transparency or flat-color detail.") {
    return copy.templates.pdfPngPagesWarning;
  }
  if (raw === "SVG output was not smaller, so PixelSmall kept the original file.") {
    return copy.templates.svgNotSmaller;
  }
  if (raw === "JPEG output was not smaller, so PixelSmall kept the original file.") {
    return copy.templates.jpegNotSmaller;
  }
  if (raw === "Lossless PNG output was not smaller, so PixelSmall kept the original file.") {
    return copy.templates.pngNotSmallerLossless;
  }
  if (raw === "Quantized PNG output was not smaller, so PixelSmall kept the original file.") {
    return copy.templates.pngNotSmallerQuantized;
  }
  if (raw === "Advanced PNG compression was unavailable, so PixelSmall used the browser fallback path.") {
    return copy.templates.pngUnavailable;
  }
  if (raw === "MozJPEG was unavailable, so PixelSmall used the browser fallback path.") {
    return copy.templates.mozjpegUnavailable;
  }
  if (raw === "Specialized codec was unavailable, so PixelSmall used the browser fallback path.") {
    return copy.templates.specializedCodecUnavailable;
  }
  if (raw === "WebP uses the browser compatibility encoder in this build.") {
    return copy.templates.webpCompatibilityEncoder;
  }
  if (raw === "Specialized WebP WASM is not enabled yet, so PixelSmall used the browser fallback path.") {
    return copy.templates.webpSpecializedUnavailable;
  }
  if (raw === "Compression cancelled.") {
    return copy.templates.compressionCancelled;
  }
  if (raw === "Unable to decode image.") {
    return copy.templates.unableToDecodeImage;
  }
  if (raw === "Canvas rendering is unavailable in this browser.") {
    return copy.templates.canvasUnavailable;
  }
  if (raw === "Unable to export image data.") {
    return copy.templates.unableToExportImageData;
  }
  if (raw === "Advanced image codec failed to initialize.") {
    return copy.templates.browserCodecInitFailed;
  }

  const binaryLoadMatch = raw.match(/^(MozJPEG|OxiPNG) binary could not be loaded(?: \((\d+)\))?\.$/);
  if (binaryLoadMatch) {
    return formatTemplate(copy.templates.wasmBinaryLoadFailed, { label: binaryLoadMatch[1] });
  }

  const binaryInvalidMatch = raw.match(/^(MozJPEG|OxiPNG) binary response was invalid\..*$/);
  if (binaryInvalidMatch) {
    return formatTemplate(copy.templates.wasmBinaryInvalid, { label: binaryInvalidMatch[1] });
  }

  return raw;
}

export function itemCountLabel(locale: Locale, count: number) {
  if (locale === "zh") {
    return formatTemplate(getCopy(locale).templates.queueCount, { count });
  }

  return formatTemplate(getCopy(locale).templates.queueCount, {
    count,
    itemLabel: count === 1 ? "Item" : "Items",
  });
}

export function pageCountLabel(locale: Locale, count: number) {
  const pageLabel = locale === "zh" ? "页" : count === 1 ? "page" : "pages";
  return formatTemplate(getCopy(locale).templates.pageCount, { count, pageLabel });
}

export function pageReadyLabel(locale: Locale, count: number) {
  const pageLabel = locale === "zh" ? "页" : count === 1 ? "page" : "pages";
  return message("pdfPagesReady", { count, pageLabel });
}

export function noPendingLabel(locale: Locale, workspace: "image" | "pdf") {
  return message("noPendingToCompress", { workspace: getCopy(locale).workspaces[workspace] });
}

export function compressionFinishedLabel(locale: Locale, workspace: "image" | "pdf") {
  return message("compressionFinished", { workspace: getCopy(locale).workspaces[workspace] });
}

export function clearedWorkspaceLabel(locale: Locale, workspace: "image" | "pdf") {
  return message("queueCleared", { workspace: getCopy(locale).workspaces[workspace] });
}

export function noCompletedToDownloadLabel(locale: Locale, workspace: "image" | "pdf") {
  return message("noCompletedToDownload", { workspace: getCopy(locale).workspaces[workspace] });
}

export function formatTemplate(template: string, values?: Record<string, string | number | undefined>) {
  return template.replace(/{{(.*?)}}/g, (_, key) => String(values?.[key.trim()] ?? ""));
}
