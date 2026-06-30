import { memo, useState } from "react";
import { ImageOff } from "lucide-react";
import type { ImageItem } from "@/lib/types";
import { intToRgb } from "@/lib/utils";

interface ThumbProps {
  item: ImageItem;
  size: number;
  onOpen: (id: string) => void;
}

function ThumbBase({ item, size, onOpen }: ThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const bg = intToRgb(item.dominant || 0x1e293b);

  return (
    <button
      onClick={() => item.status === "ready" && onOpen(item.id)}
      style={{ width: size, height: size, backgroundColor: bg }}
      className="group relative overflow-hidden rounded-2xl ring-1 ring-slate-800/80 outline-none transition-[transform,box-shadow] duration-300 ease-spring hover:z-10 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-black/50 hover:ring-slate-600 focus-visible:ring-2 focus-visible:ring-sky-400"
    >
      {item.status === "error" ? (
        <div className="flex h-full w-full items-center justify-center text-slate-500">
          <ImageOff className="size-6" />
        </div>
      ) : (
        item.thumbUrl && (
          <img
            src={item.thumbUrl}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            style={{ opacity: loaded ? 1 : 0 }}
            className="h-full w-full object-cover transition-opacity duration-500 ease-spring group-hover:scale-[1.04] motion-safe:[transition:opacity_0.5s,transform_0.4s]"
          />
        )
      )}

      {/* Shimmer while pending */}
      {item.status === "pending" && (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-800/40 to-slate-900/40" />
      )}

      {/* Caption on hover */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2.5 pt-6 opacity-0 transition-all duration-300 ease-spring group-hover:translate-y-0 group-hover:opacity-100">
        <p className="truncate text-left text-[11px] font-medium text-white/90">
          {item.name}
        </p>
      </div>
    </button>
  );
}

export const Thumb = memo(ThumbBase);
