// Duplicate detection by content signature. Files with identical bytes share a
// hash regardless of name or folder, so this finds true copies with zero false
// positives. Within each group one item is kept and the rest are removable.

import type { ImageItem } from "./types";

export interface DupResult {
  /** Duplicate groups (each ≥ 2 items), keeper first. */
  groups: ImageItem[][];
  /** All duplicate items, flattened group-by-group for adjacent display. */
  ordered: ImageItem[];
  keeperIds: Set<string>;
  removableIds: Set<string>;
}

// Keeper = highest resolution, then largest file, then oldest, then name.
function keeperRank(a: ImageItem, b: ImageItem): number {
  const areaA = a.width * a.height;
  const areaB = b.width * b.height;
  if (areaA !== areaB) return areaB - areaA;
  if (a.size !== b.size) return b.size - a.size;
  if (a.lastModified !== b.lastModified) return a.lastModified - b.lastModified;
  return a.name.localeCompare(b.name, "ko");
}

export function findDuplicates(items: ImageItem[]): DupResult {
  const byHash = new Map<string, ImageItem[]>();
  for (const it of items) {
    if (it.status !== "ready" || !it.hash) continue;
    const bucket = byHash.get(it.hash);
    if (bucket) bucket.push(it);
    else byHash.set(it.hash, [it]);
  }

  const groups: ImageItem[][] = [];
  const keeperIds = new Set<string>();
  const removableIds = new Set<string>();

  for (const bucket of byHash.values()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort(keeperRank);
    keeperIds.add(sorted[0].id);
    for (let i = 1; i < sorted.length; i++) removableIds.add(sorted[i].id);
    groups.push(sorted);
  }

  // Largest groups first so the worst offenders are up top.
  groups.sort((a, b) => b.length - a.length);
  const ordered = groups.flat();
  return { groups, ordered, keeperIds, removableIds };
}
