import type { Config } from "svgo/browser";
import type { JpegOptions, PngLosslessOptions, PngLossyOptions, SvgOptions } from "./types";
import { clamp, copyImageBuffer } from "./helpers";
import jpegEncodeWasmUrl from "@jsquash/jpeg/codec/enc/mozjpeg_enc.wasm?url";
import oxipngWasmUrl from "@jsquash/oxipng/codec/pkg/squoosh_oxipng_bg.wasm?url";

let jpegModulePromise: Promise<typeof import("@jsquash/jpeg/encode.js")> | null = null;
let oxipngModulePromise: Promise<typeof import("@jsquash/oxipng/optimise.js")> | null = null;
let upngModulePromise: Promise<typeof import("upng-js")> | null = null;
let svgoPromise: Promise<typeof import("svgo/browser")> | null = null;
let jpegWasmPromise: Promise<ArrayBuffer> | null = null;
let oxipngWasmPromise: Promise<ArrayBuffer> | null = null;

const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;

async function fetchValidatedWasm(url: string, label: string) {
  const response = await fetch(url, { credentials: "same-origin" });

  if (!response.ok) {
    throw new Error(`${label} binary could not be loaded (${response.status}).`);
  }

  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hasValidMagic = WASM_MAGIC.every((value, index) => bytes[index] === value);

  if (!hasValidMagic) {
    const preview = Array.from(bytes.slice(0, 24))
      .map((value) => (value >= 32 && value <= 126 ? String.fromCharCode(value) : "."))
      .join("")
      .trim();

    throw new Error(
      `${label} binary response was invalid.${preview ? ` Received: ${preview}` : ""} This usually means HTML was returned instead of WASM.`,
    );
  }

  return buffer;
}

function loadJpegWasmBinary() {
  if (!jpegWasmPromise) {
    jpegWasmPromise = fetchValidatedWasm(jpegEncodeWasmUrl, "MozJPEG");
  }

  return jpegWasmPromise;
}

function loadOxipngWasmBinary() {
  if (!oxipngWasmPromise) {
    oxipngWasmPromise = fetchValidatedWasm(oxipngWasmUrl, "OxiPNG");
  }

  return oxipngWasmPromise;
}

function loadJpegModule() {
  if (!jpegModulePromise) {
    jpegModulePromise = import("@jsquash/jpeg/encode.js").then(async (module) => {
      const wasmBinary = await loadJpegWasmBinary();

      await module.init({ wasmBinary });
      return module;
    });
  }

  return jpegModulePromise;
}

function loadOxipngModule() {
  if (!oxipngModulePromise) {
    oxipngModulePromise = import("@jsquash/oxipng/optimise.js").then(async (module) => {
      await module.init(await loadOxipngWasmBinary());
      return module;
    });
  }

  return oxipngModulePromise;
}

async function loadUpngModule() {
  if (!upngModulePromise) {
    upngModulePromise = import("upng-js");
  }

  const module = (await upngModulePromise) as typeof import("upng-js") & {
    default?: typeof import("upng-js");
  };
  return module.default ?? module;
}

function loadSvgoModule() {
  if (!svgoPromise) {
    svgoPromise = import("svgo/browser");
  }

  return svgoPromise;
}

function buildMozJpegOptions(options: JpegOptions) {
  const quality = Math.round(clamp(options.quality, 35, 92));

  switch (options.preset) {
    case "fast":
      return {
        quality,
        progressive: false,
        baseline: true,
        optimize_coding: true,
        smoothing: 0,
        color_space: 3,
        quant_table: 2,
        trellis_multipass: false,
        trellis_opt_zero: false,
        trellis_opt_table: false,
        trellis_loops: 1,
        auto_subsample: false,
        chroma_subsample: options.chromaSubsampling ? 2 : 1,
        separate_chroma_quality: false,
        chroma_quality: quality,
        arithmetic: false,
      };
    case "smallest":
      return {
        quality,
        progressive: options.progressive,
        baseline: false,
        optimize_coding: true,
        smoothing: 0,
        color_space: 3,
        quant_table: 3,
        trellis_multipass: true,
        trellis_opt_zero: true,
        trellis_opt_table: true,
        trellis_loops: Math.max(2, options.trellisLoops),
        auto_subsample: false,
        chroma_subsample: options.chromaSubsampling ? 2 : 1,
        separate_chroma_quality: false,
        chroma_quality: quality,
        arithmetic: false,
      };
    case "custom":
      return {
        quality,
        progressive: options.progressive,
        baseline: !options.progressive,
        optimize_coding: true,
        smoothing: 0,
        color_space: 3,
        quant_table: 3,
        trellis_multipass: options.trellisLoops > 1,
        trellis_opt_zero: true,
        trellis_opt_table: true,
        trellis_loops: Math.max(1, options.trellisLoops),
        auto_subsample: false,
        chroma_subsample: options.chromaSubsampling ? 2 : 1,
        separate_chroma_quality: false,
        chroma_quality: quality,
        arithmetic: false,
      };
    case "balanced":
    default:
      return {
        quality,
        progressive: options.progressive,
        baseline: false,
        optimize_coding: true,
        smoothing: 0,
        color_space: 3,
        quant_table: 3,
        trellis_multipass: true,
        trellis_opt_zero: true,
        trellis_opt_table: true,
        trellis_loops: Math.max(1, options.trellisLoops),
        auto_subsample: false,
        chroma_subsample: options.chromaSubsampling ? 2 : 1,
        separate_chroma_quality: false,
        chroma_quality: quality,
        arithmetic: false,
      };
  }
}

export async function encodeMozJpeg(imageData: ImageData, options: JpegOptions) {
  const module = await loadJpegModule();
  return module.default(imageData, buildMozJpegOptions(options));
}

export async function optimisePngBuffer(data: ArrayBuffer, options: PngLosslessOptions) {
  const module = await loadOxipngModule();
  return module.default(data, {
    level: clamp(Math.round(options.level), 1, 6),
    interlace: options.interlace,
    optimiseAlpha: options.optimiseAlpha,
  });
}

export async function encodeLosslessPng(imageData: ImageData, options: PngLosslessOptions) {
  const UPNG = await loadUpngModule();
  const encoded = UPNG.encode([copyImageBuffer(imageData)], imageData.width, imageData.height, 0);
  return optimisePngBuffer(encoded, options);
}

export async function encodeLossyPng(imageData: ImageData, options: PngLossyOptions, losslessOptions: PngLosslessOptions) {
  const UPNG = await loadUpngModule();
  const colors = Math.round(clamp(options.colors, 16, 256));
  const encoded = UPNG.encode([copyImageBuffer(imageData)], imageData.width, imageData.height, colors);

  if (!losslessOptions.interlace && !losslessOptions.optimiseAlpha && losslessOptions.level <= 1) {
    return encoded;
  }

  return optimisePngBuffer(encoded, losslessOptions);
}

function buildSvgConfig(options: SvgOptions): Config {
  return {
    multipass: options.multipass,
    js2svg: { indent: 2, pretty: false },
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            cleanupIds: false,
          },
        },
      },
      options.removeDimensions ? "removeDimensions" : null,
      "sortAttrs",
      options.preset === "advanced"
        ? {
            name: "cleanupIds",
            active: true,
          }
        : null,
    ].filter(Boolean) as Config["plugins"],
  };
}

export async function optimiseSvg(svg: string, options: SvgOptions) {
  const { optimize } = await loadSvgoModule();
  return optimize(svg, buildSvgConfig(options)).data;
}
