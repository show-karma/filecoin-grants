/** Small input checks shared by the editor's API routes. */

/** A position on a page ({y, h} in CSS pixels), or null. */
export function focusOf(value: unknown): { y: number; h: number } | null {
  if (!value || typeof value !== "object") return null;
  const { y, h } = value as Record<string, unknown>;
  if (
    typeof y !== "number" ||
    typeof h !== "number" ||
    !Number.isFinite(y) ||
    !Number.isFinite(h)
  )
    return null;
  if (y < 0 || y > 100_000 || h < 0 || h > 100_000) return null;
  return { y: Math.round(y), h: Math.round(h) };
}
