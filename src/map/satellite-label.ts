export type LabelSide = 'left' | 'right'

export interface Box {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

export interface LabelSize {
  readonly reachPx: number
  readonly heightPx: number
}

export function labelBox(side: LabelSide, at: ScreenPoint, size: LabelSize): Box {
  const top = at.y - size.heightPx / 2
  const bottom = top + size.heightPx
  return side === 'left'
    ? { left: at.x - size.reachPx, top, right: at.x, bottom }
    : { left: at.x, top, right: at.x + size.reachPx, bottom }
}

const overlaps = (a: Box, b: Box): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

const within = (box: Box, view: Box): boolean =>
  box.left >= view.left &&
  box.right <= view.right &&
  box.top >= view.top &&
  box.bottom <= view.bottom

export function labelSide(
  preferred: LabelSide,
  at: ScreenPoint,
  size: LabelSize,
  view: Box,
  taken: readonly Box[],
): LabelSide | null {
  const other: LabelSide = preferred === 'left' ? 'right' : 'left'
  const free = (side: LabelSide) => {
    const box = labelBox(side, at, size)
    return within(box, view) && !taken.some((used) => overlaps(box, used))
  }
  return [preferred, other].find(free) ?? null
}
