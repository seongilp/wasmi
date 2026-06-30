import { Info, X } from "lucide-react";
import { Button } from "./ui/button";

interface RestoreBannerProps {
  count: number;
  onClear: () => void;
  onDismiss: () => void;
}

/**
 * Shown once when a library is restored from OPFS on load, so returning users
 * understand *why* their images are already here — and that nothing left the
 * device. Removes the "wait, who saved my photos?" surprise.
 */
export function RestoreBanner({ count, onClear, onDismiss }: RestoreBannerProps) {
  return (
    <div className="animate-fade-up border-b border-slate-800/70 bg-slate-900/40 px-5 py-2.5">
      <div className="flex items-center gap-3">
        <Info className="size-4 shrink-0 text-sky-400" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-slate-300">
          이전에 본{" "}
          <span className="font-semibold text-slate-100">{count.toLocaleString()}장</span>
          을 이 브라우저에 저장된 캐시에서 복원했어요.{" "}
          <span className="text-slate-400">
            모두 기기 안에만 있고 어디에도 업로드되지 않습니다.
          </span>
        </p>
        <Button variant="ghost" size="sm" onClick={onClear} className="shrink-0 text-slate-300">
          지우기
        </Button>
        <button
          onClick={onDismiss}
          title="닫기"
          className="grid size-7 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800/70 hover:text-slate-300"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
