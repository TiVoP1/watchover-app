export interface Rect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export function largestValidRect(
  mask: Uint8Array,
  width: number,
  height: number,
  aspect: number,
): Rect | null {
  const sum = new Float64Array((width + 1) * (height + 1))
  for (let y = 0; y < height; y++) {
    let row = 0
    for (let x = 0; x < width; x++) {
      row += (mask[y * width + x] ?? 0) > 0 ? 1 : 0
      sum[(y + 1) * (width + 1) + x + 1] = (sum[y * (width + 1) + x + 1] ?? 0) + row
    }
  }
  const at = (x: number, y: number) => sum[y * (width + 1) + x] ?? 0
  const full = Math.min(width, height * aspect)
  for (let s = 1; s >= 0.2; s -= 0.01) {
    const w = Math.floor(full * s)
    const h = Math.floor(w / aspect)
    if (w < 2 || h < 2) break
    let best: Rect | null = null
    let bestDist = Infinity
    for (let y = 0; y + h <= height; y++) {
      for (let x = 0; x + w <= width; x++) {
        const valid = at(x + w, y + h) - at(x, y + h) - at(x + w, y) + at(x, y)
        if (valid < w * h) continue
        const dist = Math.hypot(x + w / 2 - width / 2, y + h / 2 - height / 2)
        if (dist < bestDist) {
          best = { x, y, w, h }
          bestDist = dist
        }
      }
    }
    if (best !== null) return best
  }
  return null
}
