import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pack a 0x00RRGGBB integer into a CSS rgb() string. */
export function intToRgb(n: number): string {
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgb(${r} ${g} ${b})`;
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Stable id for a file based on its path + size + mtime. Lets us cache
 * thumbnails/originals in OPFS and skip re-decoding on re-import.
 */
export function fileKey(relPath: string, size: number, lastModified: number): string {
  let h = 2166136261 >>> 0;
  const s = `${relPath}:${size}:${lastModified}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
