/// <reference lib="webworker" />
// Thumbnail worker: decode → WASM downscale → encode → persist to OPFS.
// All heavy lifting happens here so the main thread never janks while the
// user scrolls a freshly-dropped folder of thousands of images.

import { writeThumb, writeOriginalStream } from "../lib/opfs";
import type { ThumbRequest, ThumbResponse } from "../lib/types";

const THUMB_MAX = 320; // longest edge of the stored thumbnail
const DECODE_MAX = 640; // longest edge fed into the WASM box filter

interface WasmExports {
  memory: WebAssembly.Memory;
  alloc(size: number): number;
  release(ptr: number): void;
  downscale(
    srcPtr: number,
    sw: number,
    sh: number,
    dstPtr: number,
    dw: number,
    dh: number
  ): void;
  dominantColor(srcPtr: number, pixels: number): number;
}

let wasmReady: Promise<WasmExports> | null = null;

function initWasm(): Promise<WasmExports> {
  if (wasmReady) return wasmReady;
  wasmReady = (async () => {
    const importObject = {
      env: {
        abort() {
          throw new Error("wasm: abort()");
        },
      },
    };
    // Respect Vite's base path (e.g. "/wasmi/") so the .wasm resolves both on
    // localhost ("/") and under the GitHub Pages project subpath.
    const url = new URL(`${import.meta.env.BASE_URL}wasm/thumb.wasm`, self.location.href).href;
    let instance: WebAssembly.Instance;
    try {
      const res = await WebAssembly.instantiateStreaming(fetch(url), importObject);
      instance = res.instance;
    } catch {
      // Fallback when the server doesn't send application/wasm.
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      const res = await WebAssembly.instantiate(bytes, importObject);
      instance = res.instance;
    }
    return instance.exports as unknown as WasmExports;
  })();
  return wasmReady;
}

function fit(w: number, h: number, max: number): [number, number] {
  const scale = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

async function makeThumb(
  wasm: WasmExports,
  file: File
): Promise<{ width: number; height: number; dominant: number; thumb: Blob }> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const natW = bmp.width;
  const natH = bmp.height;

  // 1) GPU-assisted downscale to a bounded intermediate, then read RGBA.
  const [dw, dh] = fit(natW, natH, DECODE_MAX);
  const stage = new OffscreenCanvas(dw, dh);
  const sctx = stage.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(bmp, 0, 0, dw, dh);
  bmp.close();
  const src = sctx.getImageData(0, 0, dw, dh);

  // 2) WASM area-average box filter to the final thumbnail size.
  const [tw, th] = fit(dw, dh, THUMB_MAX);
  const srcLen = src.data.length;
  const srcPtr = wasm.alloc(srcLen);
  new Uint8Array(wasm.memory.buffer, srcPtr, srcLen).set(src.data);

  const dstLen = tw * th * 4;
  const dstPtr = wasm.alloc(dstLen); // may grow memory; srcPtr stays valid
  wasm.downscale(srcPtr, dw, dh, dstPtr, tw, th);
  const dominant = wasm.dominantColor(srcPtr, dw * dh);

  const out = new Uint8ClampedArray(dstLen);
  out.set(new Uint8Array(wasm.memory.buffer, dstPtr, dstLen));
  wasm.release(srcPtr);
  wasm.release(dstPtr);

  // 3) Encode the thumbnail.
  const tc = new OffscreenCanvas(tw, th);
  tc.getContext("2d")!.putImageData(new ImageData(out, tw, th), 0, 0);
  const thumb = await tc.convertToBlob({ type: "image/webp", quality: 0.82 });

  return { width: natW, height: natH, dominant, thumb };
}

self.onmessage = async (e: MessageEvent<ThumbRequest>) => {
  const { id, file, persistOriginal } = e.data;
  try {
    const wasm = await initWasm();
    const { width, height, dominant, thumb } = await makeThumb(wasm, file);

    // Persist results to OPFS for instant reloads. Persistence is best-effort:
    // if OPFS is unavailable we still return the thumbnail for display.
    try {
      await writeThumb(id, thumb);
      if (persistOriginal) {
        // Fire-and-forget: don't block thumbnail delivery on the larger write.
        writeOriginalStream(id, file).catch(() => void 0);
      }
    } catch {
      /* no OPFS — in-memory only */
    }

    const res: ThumbResponse = { id, ok: true, width, height, dominant, thumb };
    self.postMessage(res);
  } catch (err) {
    const res: ThumbResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(res);
  }
};
