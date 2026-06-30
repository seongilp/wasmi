import { useCallback, useRef, useState, type ReactNode } from "react";
import { FolderDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropzoneProps {
  onDrop: (dt: DataTransfer) => void;
  children: ReactNode;
}

/** Full-window drag target with an Apple-style frosted overlay. */
export function Dropzone({ onDrop, children }: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    depth.current += 1;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      onDrop(e.dataTransfer);
    },
    [onDrop]
  );

  return (
    <div
      className="relative h-full w-full"
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-6 transition-opacity duration-300 ease-spring",
          dragging ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="glass absolute inset-4 rounded-[2rem] ring-2 ring-sky-400/70" />
        <div
          className={cn(
            "relative flex flex-col items-center gap-4 text-center transition-transform duration-300 ease-spring",
            dragging ? "scale-100" : "scale-95"
          )}
        >
          <div className="grid size-20 place-items-center rounded-3xl bg-sky-500/15 ring-1 ring-sky-400/40">
            <FolderDown className="size-9 text-sky-300" />
          </div>
          <div>
            <p className="text-xl font-semibold text-slate-50">여기에 놓으세요</p>
            <p className="mt-1 text-sm text-slate-400">폴더 안의 모든 이미지를 불러옵니다</p>
          </div>
        </div>
      </div>
    </div>
  );
}
