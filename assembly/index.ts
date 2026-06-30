// Flash Viewer — WASM thumbnail engine (AssemblyScript)
//
// Runs inside a Web Worker. Receives a decoded RGBA buffer (from
// createImageBitmap → OffscreenCanvas → getImageData) and produces a
// downscaled RGBA thumbnail using an area-averaging (box) filter, plus a
// dominant-color estimate used for blur-up placeholders.
//
// Using `--runtime stub` means we own memory manually via heap.alloc/free.
// The JS side reads `memory` directly, so all buffers live in linear memory.

/** Allocate `size` bytes in linear memory; returns a pointer. */
export function alloc(size: i32): usize {
  return heap.alloc(size);
}

/** Free a previously allocated pointer. */
export function release(ptr: usize): void {
  heap.free(ptr);
}

/**
 * Area-average downscale from src (sw×sh RGBA) to dst (dw×dh RGBA).
 * Each destination pixel averages the block of source pixels it maps to,
 * which yields clean, alias-free thumbnails — better than nearest-neighbor
 * and faster than the browser's general-purpose resampler for many small jobs.
 */
export function downscale(
  srcPtr: usize,
  sw: i32,
  sh: i32,
  dstPtr: usize,
  dw: i32,
  dh: i32
): void {
  for (let dy = 0; dy < dh; dy++) {
    let sy0 = (dy * sh) / dh;
    let sy1 = ((dy + 1) * sh) / dh;
    if (sy1 <= sy0) sy1 = sy0 + 1;

    for (let dx = 0; dx < dw; dx++) {
      let sx0 = (dx * sw) / dw;
      let sx1 = ((dx + 1) * sw) / dw;
      if (sx1 <= sx0) sx1 = sx0 + 1;

      let r: u32 = 0;
      let g: u32 = 0;
      let b: u32 = 0;
      let a: u32 = 0;
      let count: u32 = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        let rowBase = srcPtr + (<usize>(sy * sw)) * 4;
        for (let sx = sx0; sx < sx1; sx++) {
          let p = rowBase + (<usize>sx) * 4;
          r += <u32>load<u8>(p);
          g += <u32>load<u8>(p, 1);
          b += <u32>load<u8>(p, 2);
          a += <u32>load<u8>(p, 3);
          count++;
        }
      }

      let d = dstPtr + (<usize>(dy * dw + dx)) * 4;
      store<u8>(d, <u8>(r / count));
      store<u8>(d, <u8>(g / count), 1);
      store<u8>(d, <u8>(b / count), 2);
      store<u8>(d, <u8>(a / count), 3);
    }
  }
}

/**
 * Compute the average (dominant) color of an RGBA buffer, packed as
 * 0x00RRGGBB. Sampled with a stride for speed on large images.
 */
export function dominantColor(srcPtr: usize, pixels: i32): u32 {
  let r: u64 = 0;
  let g: u64 = 0;
  let b: u64 = 0;
  let n: u64 = 0;

  // Sample at most ~4096 pixels regardless of image size.
  let stride = pixels > 4096 ? pixels / 4096 : 1;

  for (let i = 0; i < pixels; i += stride) {
    let p = srcPtr + (<usize>i) * 4;
    r += <u64>load<u8>(p);
    g += <u64>load<u8>(p, 1);
    b += <u64>load<u8>(p, 2);
    n++;
  }
  if (n == 0) return 0;

  let rr = <u32>(r / n);
  let gg = <u32>(g / n);
  let bb = <u32>(b / n);
  return (rr << 16) | (gg << 8) | bb;
}
