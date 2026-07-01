// Map a raw exifr result into the small subset of metadata we keep. Kept
// separate from the worker so the mapping logic is unit-testable.

export interface Exif {
  takenAt?: number;
  camera?: string;
  lat?: number;
  lon?: number;
}

/** Fields we ask exifr to extract. */
export const EXIF_PICK = [
  "DateTimeOriginal",
  "CreateDate",
  "Make",
  "Model",
  "GPSLatitude",
  "GPSLongitude",
];

interface RawExif {
  DateTimeOriginal?: Date | number;
  CreateDate?: Date | number;
  Make?: unknown;
  Model?: unknown;
  latitude?: number;
  longitude?: number;
}

export function mapExif(data: RawExif | null | undefined): Exif {
  if (!data) return {};
  const out: Exif = {};

  const date = data.DateTimeOriginal ?? data.CreateDate;
  if (date instanceof Date && !isNaN(date.getTime())) out.takenAt = date.getTime();
  else if (typeof date === "number" && isFinite(date)) out.takenAt = date;

  const make = (data.Make ?? "").toString().trim();
  const model = (data.Model ?? "").toString().trim();
  const camera = [make, model].filter(Boolean).join(" ");
  if (camera) out.camera = camera;

  if (typeof data.latitude === "number" && typeof data.longitude === "number") {
    out.lat = data.latitude;
    out.lon = data.longitude;
  }
  return out;
}
