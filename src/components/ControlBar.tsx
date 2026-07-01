import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RectangleHorizontal,
  Copy,
} from "lucide-react";
import { Dropdown, type DropdownOption } from "./ui/Dropdown";
import { cn } from "@/lib/utils";
import {
  ORIENTATION_LABELS,
  SORT_LABELS,
  type Orientation,
  type SortKey,
  type ViewState,
} from "@/lib/view";

interface ControlBarProps {
  view: ViewState;
  onChange: (patch: Partial<ViewState>) => void;
  title: string;
  shown: number;
  total: number;
  dupCount: number;
  dupMode: boolean;
  onToggleDup: () => void;
}

const sortOptions: DropdownOption<SortKey>[] = (
  Object.keys(SORT_LABELS) as SortKey[]
).map((k) => ({ value: k, label: SORT_LABELS[k] }));

const orientationOptions: DropdownOption<Orientation>[] = (
  Object.keys(ORIENTATION_LABELS) as Orientation[]
).map((o) => ({ value: o, label: ORIENTATION_LABELS[o] }));

export function ControlBar({
  view,
  onChange,
  title,
  shown,
  total,
  dupCount,
  dupMode,
  onToggleDup,
}: ControlBarProps) {
  return (
    <div className="glass sticky top-[60px] z-20 border-b border-slate-800/60">
      <div className="flex flex-wrap items-center gap-2 px-5 py-2.5">
        {/* Current selection title + count */}
        <div className="mr-1 flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">{title}</span>
          <span className="shrink-0 text-xs tabular-nums text-slate-500">
            {shown === total
              ? `${total.toLocaleString()}`
              : `${shown.toLocaleString()} / ${total.toLocaleString()}`}
          </span>
        </div>

        {/* Orientation filter */}
        <Dropdown
          value={view.orientation}
          options={orientationOptions}
          onChange={(orientation) => onChange({ orientation })}
          icon={RectangleHorizontal}
          ariaLabel="방향 필터"
        />

        {/* Duplicate cleanup entry — only when copies exist */}
        {(dupCount > 0 || dupMode) && (
          <button
            onClick={onToggleDup}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-200 ease-spring",
              dupMode
                ? "border-rose-400/50 bg-rose-500/15 text-rose-200"
                : "border-slate-700/60 bg-slate-800/60 text-slate-200 hover:bg-slate-700/60"
            )}
          >
            <Copy className="size-3.5" />
            중복
            {dupCount > 0 && (
              <span
                className={cn(
                  "tabular-nums",
                  dupMode ? "text-rose-300/80" : "text-slate-500"
                )}
              >
                {dupCount}
              </span>
            )}
          </button>
        )}

        {/* Sort — pushed to the right */}
        <div className="ml-auto flex items-center gap-2">
          <Dropdown
            value={view.sortKey}
            options={sortOptions}
            onChange={(sortKey) => onChange({ sortKey })}
            icon={ArrowUpDown}
            ariaLabel="정렬 기준"
            align="right"
          />
          <button
            onClick={() => onChange({ sortDir: view.sortDir === "asc" ? "desc" : "asc" })}
            aria-label={view.sortDir === "asc" ? "오름차순" : "내림차순"}
            title={view.sortDir === "asc" ? "오름차순" : "내림차순"}
            className="grid size-8 place-items-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-300 transition-colors hover:bg-slate-700/60"
          >
            {view.sortDir === "asc" ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
