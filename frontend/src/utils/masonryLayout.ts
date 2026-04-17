import { peekMediaAspectRatio } from "./useMediaAspectRatio";

/**
 * Masonry column splitter.
 *
 * Distributes `items` into `columnCount` independent vertical columns so each
 * column flows on its own — eliminating the "shared row top" gap that a flex
 * `flexWrap` grid produces when neighbouring cards have different heights.
 *
 * Placement rule:
 * 1. If a media URI has already been measured (aspect-ratio cache hit), the
 *    item is added to the currently **shortest** column so column heights
 *    stay balanced. Relative item height ≈ 1 / ratio (+ a small constant for
 *    footer / text area so the algorithm still works for square medias).
 * 2. Otherwise we fall back to **alternating** assignment (index % columnCount)
 *    which yields a pleasant staggered feed on first paint, before ratios
 *    have been resolved.
 *
 * This runs at render time — as new ratios resolve into the cache, individual
 * cards re-layout in place (PostCard's `useMediaAspectRatio` already handles
 * that). A full re-split isn't required unless the data array itself changes.
 */
export function splitIntoMasonryColumns<T>(
  items: T[],
  getMediaUri: (item: T) => string | undefined,
  columnCount: number = 2,
  fallbackRatio: number = 3 / 4
): T[][] {
  const columns: T[][] = Array.from({ length: columnCount }, () => []);
  const heights: number[] = Array.from({ length: columnCount }, () => 0);

  // Non-media overhead (title + footer area) keeps the algorithm sane for
  // square / landscape items where 1 / ratio alone would under-weight them.
  const FOOTER_WEIGHT = 0.3;

  items.forEach((item, index) => {
    const uri = getMediaUri(item);
    const cached = peekMediaAspectRatio(uri);

    let targetColumn: number;
    if (cached !== undefined) {
      targetColumn = 0;
      for (let c = 1; c < columnCount; c++) {
        if (heights[c] < heights[targetColumn]) targetColumn = c;
      }
    } else {
      targetColumn = index % columnCount;
    }

    columns[targetColumn].push(item);
    const ratio = cached ?? fallbackRatio;
    heights[targetColumn] += 1 / ratio + FOOTER_WEIGHT;
  });

  return columns;
}
