import type { CSSProperties } from "react";

type SkeletonProps = {
  width?: CSSProperties["width"];
  height?: CSSProperties["height"];
  className?: string;
};

export function SkeletonLine({ width = "100%", height = 12, className }: SkeletonProps) {
  return <span className={["skeleton-line", className].filter(Boolean).join(" ")} style={{ width, height, display: "block" }} aria-hidden="true" />;
}

export function SkeletonCircle({ width = 10, height = 10, className }: SkeletonProps) {
  return <span className={["skeleton-circle", className].filter(Boolean).join(" ")} style={{ width, height, display: "block" }} aria-hidden="true" />;
}

/** Placeholder rows matching the standard table rhythm while data loads. */
export function TableSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  const widths = ["55%", "70%", "40%", "60%", "45%", "65%"];
  return (
    <div className="nm-skeleton-table" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div className="skeleton-row" key={rowIndex}>
          <SkeletonCircle />
          {Array.from({ length: columns }, (_, colIndex) => (
            <SkeletonLine key={colIndex} width={widths[(rowIndex + colIndex) % widths.length]} height={11} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Placeholder panel: header line plus body lines. */
export function PanelSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="nm-skeleton-panel" role="status" aria-label="Loading">
      <SkeletonLine width="35%" height={14} />
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonLine key={index} width={`${85 - (index % 3) * 18}%`} height={11} />
      ))}
    </div>
  );
}

/** Full-workspace placeholder used as the route-level Suspense fallback. */
export function WorkspaceSkeleton() {
  return (
    <div className="nm-skeleton-workspace" role="status" aria-label="Loading workspace">
      <div className="nm-skeleton-workspace-toolbar">
        <SkeletonLine width={180} height={28} />
        <SkeletonLine width={120} height={28} />
        <SkeletonLine width={220} height={28} />
      </div>
      <div className="nm-skeleton-workspace-stats">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonLine key={index} height={64} />
        ))}
      </div>
      <TableSkeleton rows={9} columns={5} />
    </div>
  );
}
