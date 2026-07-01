import { Copy, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import type { DupMode } from "@/lib/dedup";

interface DuplicateBarProps {
  groupCount: number;
  removableCount: number;
  kind: DupMode;
  onKindChange: (kind: DupMode) => void;
  onDeleteAll: () => void;
  onExit: () => void;
}

const KINDS: { value: DupMode; label: string }[] = [
  { value: "exact", label: "동일 파일" },
  { value: "similar", label: "유사 포함" },
];

/**
 * Review bar for duplicate cleanup. Each group keeps one image (green "유지")
 * and marks the rest removable (red "중복"); one click clears the copies.
 */
export function DuplicateBar({
  groupCount,
  removableCount,
  kind,
  onKindChange,
  onDeleteAll,
  onExit,
}: DuplicateBarProps) {
  return (
    <div className="animate-fade-up border-b border-rose-500/20 bg-rose-500/10 px-5 py-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <Copy className="size-4 shrink-0 text-rose-300" />

        {/* Exact vs perceptual toggle */}
        <div className="flex shrink-0 rounded-lg border border-slate-700/60 bg-slate-900/50 p-0.5">
          {KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => onKindChange(k.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                kind === k.value
                  ? "bg-slate-700/70 text-slate-50"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-200">
          {kind === "similar" ? "비슷한 사진" : "동일한 사진"}{" "}
          <span className="font-semibold text-rose-200">{groupCount}</span>
          묶음 · 각 묶음 <span className="text-emerald-300">1장 유지</span>,{" "}
          <span className="font-semibold text-rose-200">{removableCount}장</span> 삭제 가능
          <span className="ml-1 hidden text-slate-400 sm:inline">
            {kind === "similar"
              ? "(리사이즈·재저장된 비슷한 이미지까지)"
              : "(이름·폴더 달라도 동일 파일)"}
          </span>
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
