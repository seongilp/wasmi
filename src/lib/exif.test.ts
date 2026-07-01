import { describe, it, expect } from "vitest";
import { mapExif } from "./exif";

describe("mapExif", () => {
  it("returns empty for null/undefined", () => {
    expect(mapExif(null)).toEqual({});
    expect(mapExif(undefined)).toEqual({});
    expect(mapExif({})).toEqual({});
  });

  it("extracts capture time from DateTimeOriginal", () => {
    const d = new Date(2023, 5, 1, 12, 0);
    expect(mapExif({ DateTimeOriginal: d }).takenAt).toBe(d.getTime());
  });

  it("falls back to CreateDate", () => {
    const d = new Date(2021, 0, 2, 3, 4);
    expect(mapExif({ CreateDate: d }).takenAt).toBe(d.getTime());
  });

  it("ignores invalid dates", () => {
    expect(mapExif({ DateTimeOriginal: new Date("nope") }).takenAt).toBeUndefined();
  });

  it("combines make and model into a camera string", () => {
    expect(mapExif({ Make: "SONY", Model: "ILCE-7M4" }).camera).toBe("SONY ILCE-7M4");
    expect(mapExif({ Model: "iPhone 15" }).camera).toBe("iPhone 15");
  });

  it("omits camera when make/model absent", () => {
    expect(mapExif({ DateTimeOriginal: new Date() }).camera).toBeUndefined();
  });

  it("extracts GPS coordinates", () => {
    const r = mapExif({ latitude: 37.5665, longitude: 126.978 });
    expect(r.lat).toBe(37.5665);
    expect(r.lon).toBe(126.978);
  });

  it("omits GPS when only one coordinate is present", () => {
    expect(mapExif({ latitude: 37.5 }).lat).toBeUndefined();
  });
});
