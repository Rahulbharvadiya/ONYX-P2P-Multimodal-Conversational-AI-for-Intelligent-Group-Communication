import { cn } from "@/lib/utils";

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden />;
}

export function ConversationListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-2" aria-label="Loading conversations" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[--r-md] px-2 py-2.5">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 rounded" style={{ width: `${52 + ((i * 13) % 34)}%` }} />
            <Skeleton className="h-2.5 rounded" style={{ width: `${68 + ((i * 7) % 24)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessageListSkeleton() {
  const rows = [
    { ai: false, w: [46] },
    { ai: true, w: [94, 88, 62] },
    { ai: false, w: [34] },
    { ai: true, w: [90, 74] },
  ];
  return (
    <div className="space-y-7 px-4 py-6" role="status" aria-label="Loading messages">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-2.5 w-24 rounded" />
            {r.w.map((w, j) => (
              <Skeleton key={j} className="h-3 rounded" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
