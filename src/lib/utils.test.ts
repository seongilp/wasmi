import { describe, it, expect } from "vitest";
import { cn, intToRgb, formatBytes, fileKey, formatDate } from "./utils";

describe("cn", () => {
  it("merges class names and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", "font-bold")).toBe("text-sm font-bold");
  });
});

describe("intToRgb", () => {
  it("unpacks 0xRRGGBB into an rgb() string", () => {
    expect(intToRgb(0x336699)).toBe("rgb(51 102 153)");
    expect(intToRgb(0x000000)).toBe("rgb(0 0 0)");
    expect(intToRgb(0xffffff)).toBe("rgb(255 255 255)");
  });
});

describe("formatDate", () => {
  it("formats a timestamp as YYYY.MM.DD HH:mm", () => {
    // Local-time construction so the assertion is timezone-independent.
    const ms = new Date(2023, 6, 4, 9, 5).getTime(); // 2023-07-04 09:05
    expect(formatDate(ms)).toBe("2023.07.04 09:05");
  });
});

describe("formatBytes", () => {
  it("formats byte counts into human units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });
});

describe("fileKey", () => {
  it("is deterministic for the same inputs", () => {
    expect(fileKey("a/b.png", 100, 5)).toBe(fileKey("a/b.png", 100, 5));
  });

  it("differs when path, size, or mtime differ", () => {
    const base = fileKey("a/b.png", 100, 5);
    expect(fileKey("a/c.png", 100, 5)).not.toBe(base);
    expect(fileKey("a/b.png", 101, 5)).not.toBe(base);
    expect(fileKey("a/b.png", 100, 6)).not.toBe(base);
  });

  it("returns an 8-char hex string", () => {
    expect(fileKey("x.png", 1, 1)).toMatch(/^[0-9a-f]{8}$/);
  });
});
