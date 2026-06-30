import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dropzone } from "./components/Dropzone";
import { Toolbar } from "./components/Toolbar";
import { Grid } from "./components/Grid";
import { EmptyState } from "./components/EmptyState";
import { RestoreBanner } from "./components/RestoreBanner";
import { Lightbox } from "./components/Lightbox";
import { useLibrary } from "./lib/useLibrary";
import { ThumbPool } from "./lib/thumb-pool";
import {
  collectFromDataTransfer,
  collectFromDirectoryPicker,
  directoryPickerSupported,
} from "./lib/collect";

export default function App() {
  const lib = useLibrary();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const canPick = directoryPickerSupported();

  // Surface the trust banner once a restored-from-cache library is detected.
  useEffect(() => {
    if (lib.ready && lib.restoredCount > 0) setShowRestore(true);
  }, [lib.ready, lib.restoredCount]);

  const handleDrop = useCallback(
    async (dt: DataTransfer) => {
      const collected = await collectFromDataTransfer(dt);
      lib.importFiles(collected);
    },
    [lib]
  );

  const handlePick = useCallback(async () => {
    try {
      const collected = await collectFromDirectoryPicker();
      lib.importFiles(collected);
    } catch {
      /* user cancelled the picker */
    }
  }, [lib]);

  const openById = useCallback(
    (id: string) => {
      const idx = lib.items.findIndex((it) => it.id === id);
      if (idx >= 0) setLightboxIndex(idx);
    },
    [lib.items]
  );

  const hasItems = lib.items.length > 0;

  return (
    <Dropzone onDrop={handleDrop}>
      <div className="flex h-full w-full flex-col">
        {hasItems && (
          <Toolbar
            count={lib.items.length}
            usage={lib.usage}
            importing={lib.importing}
            progress={lib.progress}
            canPick={canPick}
            onPick={handlePick}
            onClear={lib.clear}
            workerCount={ThumbPool.defaultSize()}
          />
        )}

        {hasItems && showRestore && (
          <RestoreBanner
            count={lib.restoredCount}
            onClear={() => {
              setShowRestore(false);
              lib.clear();
            }}
            onDismiss={() => setShowRestore(false)}
          />
        )}

        <main className="relative min-h-0 flex-1">
          {!lib.ready ? (
            <div className="grid h-full place-items-center text-slate-500">
              <div className="size-6 animate-spin rounded-full border-2 border-slate-700 border-t-sky-400" />
            </div>
          ) : hasItems ? (
            <Grid items={lib.items} onOpen={openById} />
          ) : (
            <EmptyState onPick={handlePick} canPick={canPick} />
          )}
        </main>

        {!lib.supported && (
          <div className="glass absolute inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t border-amber-500/20 px-4 py-2 text-xs text-amber-300/90">
            <AlertTriangle className="size-3.5" />
            이 브라우저는 OPFS를 지원하지 않아 새로고침 시 캐시가 유지되지 않습니다.
          </div>
        )}
      </div>

      {lightboxIndex !== null && lib.items[lightboxIndex] && (
        <Lightbox
          items={lib.items}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          loadOriginal={lib.openOriginal}
        />
      )}
    </Dropzone>
  );
}
