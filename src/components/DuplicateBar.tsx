import { Copy, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";

interface DuplicateBarProps {
  groupCount: number;
  removableCount: number;
  onDeleteAll: () => void;
  onExit: () => void;
}

/**
 * Review bar for duplicate cleanup. Each group keeps one image (green "유지")
 * and marks the rest removable (red "중복"); one click clears the copies.
 */
export function DuplicateBar({
  groupCount,
  removableCount,
  onDeleteAll,
  onExit,
}: DuplicateBarProps) {
  return (
    <div className="animate-fade-up border-b border-rose-500/20 bg-rose-500/10 px-5 py-2.5">
      <div className="flex items-center gap-3">
        <Copy className="size-4 shrink-0 text-rose-300" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-200">
          동일한 사진{" "}
          <span className="font-semibold text-rose-200">{groupCount}</span>
          묶음 발견 · 각 묶음에서 <span className="text-emerald-300">1장 유지</span>,{" "}
          <span className="font-semibold text-rose-200">{removableCount}장</span> 삭제 가능
          <span className="ml-1 hidden text-slate-400 sm:inline">(이름·폴더 달라도 동일 파일)</span>
        </p>
        <Button
          size="sm"
          variant="danger"
          onClick={onDeleteAll}
          disabled={removableCount === 0}
          className="shrink-0"
        >
          <Trash2 />
          중복 {removableCount}장 삭제
        </Button>
        <button
          onClick={onExit}
          title="나가기"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-slate-200"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
