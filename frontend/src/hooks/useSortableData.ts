import { useCallback, useState } from "react";

export type SortDirection = "asc" | "desc";

export type SortableState<K extends string> = {
  sortKey: K;
  sortDir: SortDirection;
  /** Toggle direction when the same key is clicked; switch key (reset to asc) otherwise. */
  toggleSort: (key: K) => void;
  /** Value for the column header's aria-sort attribute. */
  ariaSort: (key: K) => "ascending" | "descending" | undefined;
  /** +1 for asc, -1 for desc — multiply comparator results by this. */
  dirFactor: number;
};

/**
 * Shared sort-state for tables: one source of truth for the
 * key/direction/toggle/aria-sort pattern previously hand-rolled per workspace.
 */
export function useSortableData<K extends string>(
  initialKey: K,
  initialDir: SortDirection = "asc",
): SortableState<K> {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<SortDirection>(initialDir);

  const toggleSort = useCallback((key: K) => {
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const ariaSort = useCallback(
    (key: K) => (key === sortKey ? (sortDir === "asc" ? "ascending" as const : "descending" as const) : undefined),
    [sortKey, sortDir],
  );

  return { sortKey, sortDir, toggleSort, ariaSort, dirFactor: sortDir === "asc" ? 1 : -1 };
}
