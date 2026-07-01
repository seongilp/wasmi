import { useCallback, useEffect, useRef, useState } from "react";
import { ThumbPool } from "./thumb-pool";
import {
  clearAll,
  deleteItem,
  ensurePersistent,
  estimateUsage,
  opfsSupported,
  readManifest,
  readOriginal,
  readThumb,
  writeManifest,
} from "./opfs";
import type { Collected } from "./collect";
import { exportLibrary, exportMeta as buildMetaBackup, importLibrary } from "./backup";
import { fileKey } from "./utils";
import type { ImageItem, ManifestItem, ThumbResponse } from "./types";

export interface ImportProgress {
  done: number;
  total: number;
}

export interface LibraryState {
  items: ImageItem[];
  importing: boolean;
  progress: ImportProgress;
  usage: number;
  ready: boolean;
  supported: boolean;
  restoredCount: number;
}

function toManifest(item: ImageItem): ManifestItem {
  return {
    id: item.id,
    name: item.name,
    relPath: item.relPath,
    type: item.type,
    size: item.size,
    lastModified: item.lastModified,
    width: item.width,
    height: item.height,
    dominant: item.dominant,
    favorite: item.favorite,
    hash: item.hash,
    phash: item.phash,
  };
}

export function useLibrary() {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ done: 0, total: 0 });
  const [usage, setUsage] = useState(0);
  const [ready, setReady] = useState(false);
  // How many items were restored from OPFS at startup (drives the trust banner).
  const [restoredCount, setRestoredCount] = useState(0);

  const supported = opfsSupported();

  // Authoritative copy mirrors `items` so async callbacks mutate the latest.
  const itemsRef = useRef<ImageItem[]>([]);
  const indexRef = useRef<Map<string, number>>(new Map());
  const poolRef = useRef<ThumbPool | null>(null);
  const flushScheduled = useRef(false);

  const getPool = useCallback(() => {
    if (!poolRef.current) poolRef.current = new ThumbPool();
    return poolRef.current;
  }, []);

  const reindex = useCallback(() => {
    const map = new Map<string, number>();
    itemsRef.current.forEach((it, i) => map.set(it.id, i));
    indexRef.current = map;
  }, []);

  // Persist the manifest of every successfully-decoded item (favorites included).
  const persistManifest = useCallback(async () => {
    const manifest = itemsRef.current
      .filter((it) => it.status === "ready")
      .map(toManifest);
    await writeManifest(manifest);
  }, []);

  // Coalesce many per-thumbnail updates into one render per frame.
  const scheduleFlush = useCallback(() => {
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    requestAnimationFrame(() => {
      flushScheduled.current = false;
      setItems(itemsRef.current.slice());
    });
  }, []);

  const refreshUsage = useCallback(() => {
    estimateUsage().then(setUsage);
  }, []);

  // Rebuild the in-memory library from the OPFS manifest + thumbnails. Used on
  // first mount and after importing a backup.
  const restoreFromOpfs = useCallback(
    async (markRestored: boolean) => {
      const manifest = await readManifest();
      const restored: ImageItem[] = [];
      for (const m of manifest) {
        const thumb = await readThumb(m.id);
        restored.push({
          ...m,
          favorite: m.favorite ?? false,
          hash: m.hash,
          phash: m.phash,
          status: thumb ? "ready" : "pending",
          thumbUrl: thumb ? URL.createObjectURL(thumb) : undefined,
        });
      }
      for (const it of itemsRef.current) {
        if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      itemsRef.current = restored;
      reindex();
      setItems(restored.slice());
      if (markRestored) setRestoredCount(restored.length);
      refreshUsage();
    },
    [reindex, refreshUsage]
  );

  // ---- Restore from OPFS on first mount --------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supported) {
        setReady(true);
        return;
      }
      await ensurePersistent();
      if (alive) await restoreFromOpfs(true);
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [supported, restoreFromOpfs]);

  // Clean up object URLs + workers on unmount.
  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) {
        if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      poolRef.current?.terminate();
    };
  }, []);

  const applyResult = useCallback(
    (res: ThumbResponse) => {
      const idx = indexRef.current.get(res.id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      if (res.ok) {
        itemsRef.current[idx] = {
          ...prev,
          status: "ready",
          width: res.width,
          height: res.height,
          dominant: res.dominant,
          hash: res.hash,
          phash: res.phash,
          thumbUrl: URL.createObjectURL(res.thumb),
        };
      } else {
        itemsRef.current[idx] = { ...prev, status: "error" };
      }
      scheduleFlush();
    },
    [scheduleFlush]
  );

  const importFiles = useCallback(
    async (collected: Collected[]) => {
      if (collected.length === 0) return;

      // Decide what to process. New files get a placeholder item; files that
      // match an existing (e.g. meta-restored) placeholder are re-processed in
      // place so favorites/organization survive.
      const newItems: ImageItem[] = [];
      const jobs: { id: string; file: File }[] = [];
      const seen = new Set<string>();
      for (const { file, relPath } of collected) {
        const id = fileKey(relPath, file.size, file.lastModified);
        if (seen.has(id)) continue; // dup within this drop
        seen.add(id);
        const existingIdx = indexRef.current.get(id);
        if (existingIdx !== undefined) {
          if (itemsRef.current[existingIdx].status === "ready") continue; // already have pixels
          jobs.push({ id, file }); // fill existing placeholder, keep its favorite
        } else {
          newItems.push({
            id,
            name: file.name,
            relPath,
            type: file.type || "image/*",
            size: file.size,
            lastModified: file.lastModified,
            width: 0,
            height: 0,
            dominant: 0x1e293b, // slate-800 placeholder
            status: "pending",
            favorite: false,
          });
          jobs.push({ id, file });
        }
      }

      if (jobs.length === 0) return;

      // Show placeholders immediately.
      if (newItems.length > 0) {
        itemsRef.current = itemsRef.current.concat(newItems);
        reindex();
      }
      setItems(itemsRef.current.slice());

      setImporting(true);
      setProgress({ done: 0, total: jobs.length });

      const pool = getPool();
      let done = 0;
      await Promise.all(
        jobs.map(({ id, file }) =>
          pool
            .process({ id, file, persistOriginal: true })
            .then((res) => {
              applyResult(res);
              done++;
              setProgress({ done, total: jobs.length });
            })
        )
      );

      // Persist the manifest of everything that decoded successfully.
      await persistManifest();

      setImporting(false);
      refreshUsage();
    },
    [applyResult, getPool, persistManifest, reindex, refreshUsage]
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      itemsRef.current[idx] = { ...prev, favorite: !prev.favorite };
      setItems(itemsRef.current.slice());
      persistManifest();
    },
    [persistManifest]
  );

  // Replace an item's pixels with an edited version: overwrite OPFS original,
  // regenerate thumbnail + hashes + dimensions, keeping the same id/name/favorite.
  const replaceItem = useCallback(
    async (id: string, file: File) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const prev = itemsRef.current[idx];
      if (prev.thumbUrl) URL.revokeObjectURL(prev.thumbUrl);
      itemsRef.current[idx] = {
        ...prev,
        size: file.size,
        status: "pending",
        thumbUrl: undefined,
      };
      setItems(itemsRef.current.slice());

      const res = await getPool().process({ id, file, persistOriginal: true });
      applyResult(res);
      await persistManifest();
      refreshUsage();
    },
    [applyResult, getPool, persistManifest, refreshUsage]
  );

  const removeItem = useCallback(
    async (id: string) => {
      const idx = indexRef.current.get(id);
      if (idx === undefined) return;
      const target = itemsRef.current[idx];
      if (target.thumbUrl) URL.revokeObjectURL(target.thumbUrl);
      itemsRef.current = itemsRef.current.filter((it) => it.id !== id);
      reindex();
      setItems(itemsRef.current.slice());
      await deleteItem(id);
      await persistManifest();
      refreshUsage();
    },
    [persistManifest, reindex, refreshUsage]
  );

  const removeMany = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const set = new Set(ids);
      for (const it of itemsRef.current) {
        if (set.has(it.id) && it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      itemsRef.current = itemsRef.current.filter((it) => !set.has(it.id));
      reindex();
      setItems(itemsRef.current.slice());
      await Promise.all(ids.map((id) => deleteItem(id)));
      await persistManifest();
      refreshUsage();
    },
    [persistManifest, reindex, refreshUsage]
  );

  const clear = useCallback(async () => {
    for (const it of itemsRef.current) {
      if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
    }
    itemsRef.current = [];
    reindex();
    setItems([]);
    await clearAll();
    refreshUsage();
  }, [reindex, refreshUsage]);

  const openOriginal = useCallback((id: string): Promise<File | null> => {
    return readOriginal(id);
  }, []);

  const exportBackup = useCallback(() => exportLibrary(itemsRef.current), []);
  const exportMetaBackup = useCallback(() => buildMetaBackup(itemsRef.current), []);

  const importBackup = useCallback(
    async (file: File) => {
      const result = await importLibrary(file);
      await restoreFromOpfs(false);
      return result;
    },
    [restoreFromOpfs]
  );

  const state: LibraryState = {
    items,
    importing,
    progress,
    usage,
    ready,
    supported,
    restoredCount,
  };
  return {
    ...state,
    importFiles,
    clear,
    openOriginal,
    toggleFavorite,
    removeItem,
    removeMany,
    replaceItem,
    exportBackup,
    exportMetaBackup,
    importBackup,
  };
}
