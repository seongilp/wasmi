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

// Average luminance of the source block that maps to grid cell (gx, gy) of a
// GW×GH grid. Used to build the perceptual hash.
function cellGray(
  srcPtr: usize,
  sw: i32,
  sh: i32,
  gx: i32,
  gy: i32,
  gw: i32,
  gh: i32
): f32 {
  let sx0 = (gx * sw) / gw;
  let sx1 = ((gx + 1) * sw) / gw;
  if (sx1 <= sx0) sx1 = sx0 + 1;
  let sy0 = (gy * sh) / gh;
  let sy1 = ((gy + 1) * sh) / gh;
  if (sy1 <= sy0) sy1 = sy0 + 1;

  let sum: f32 = 0;
  let n: i32 = 0;
  for (let sy = sy0; sy < sy1; sy++) {
    let rowBase = srcPtr + (<usize>(sy * sw)) * 4;
    for (let sx = sx0; sx < sx1; sx++) {
      let p = rowBase + (<usize>sx) * 4;
      let r = <f32>load<u8>(p);
      let g = <f32>load<u8>(p, 1);
      let b = <f32>load<u8>(p, 2);
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      n++;
    }
  }
  return sum / <f32>n;
}

/**
 * 64-bit difference hash (dHash). Reduces the image to a 9×8 luminance grid and
 * sets one bit per horizontal neighbor comparison. Perceptually similar images
 * (resized, re-encoded, lightly edited) produce hashes a few bits apart, which
 * lets the app find near-duplicates, not just byte-identical files.
 *
 * Writes two little-endian u32 words at `outPtr` (lo at +0, hi at +4).
 */
export function dhash(srcPtr: usize, sw: i32, sh: i32, outPtr: usize): void {
  const GW = 9;
  const GH = 8;
  let lo: u32 = 0;
  let hi: u32 = 0;
  let bit = 0;

  for (let gy = 0; gy < GH; gy++) {
    for (let gx = 0; gx < GW - 1; gx++) {
      let left = cellGray(srcPtr, sw, sh, gx, gy, GW, GH);
      let right = cellGray(srcPtr, sw, sh, gx + 1, gy, GW, GH);
      if (left > right) {
        if (bit < 32) lo |= (<u32>1) << (<u32>bit);
        else hi |= (<u32>1) << (<u32>(bit - 32));
      }
      bit++;
    }
  }

  store<u32>(outPtr, lo);
  store<u32>(outPtr, hi, 4);
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
