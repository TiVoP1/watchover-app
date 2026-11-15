import { project, type Camera, type ScreenPoint } from '#web/film/camera.ts'
import { add, cross, dot, mix, normalize, scale, sub, type Vec3 } from '#web/film/geo.ts'
import type { Rgb } from '#web/film/globe.ts'
import { rgbBytes } from '#web/film/look.ts'

export interface SatellitePose {
  readonly position: Vec3
  readonly forward: Vec3
  readonly up: Vec3
}

type Quad = readonly [Vec3, Vec3, Vec3, Vec3]
type Outline = readonly (readonly [number, number])[]

interface Material {
  readonly base: Rgb
  readonly shine: Rgb
  readonly gloss: number
  readonly specular: number
}

interface Grid {
  readonly cols: number
  readonly rows: number
  readonly colour: string
}

interface Patch {
  readonly kind: 'patch'
  readonly centre: Vec3
  readonly points: readonly Vec3[]
  readonly face: Vec3
  readonly normal: Vec3
  readonly front: Material
  readonly back: Material | null
  readonly grid: Grid | null
}

interface Tube {
  readonly kind: 'tube'
  readonly centre: Vec3
  readonly from: Vec3
  readonly to: Vec3
  readonly radiusM: number
  readonly material: Material
}

type Part = Patch | Tube

interface Frame {
  readonly origin: Vec3
  readonly a: Vec3
  readonly b: Vec3
  readonly z: Vec3
}

interface Bar {
  readonly from: Vec3
  readonly to: Vec3
  readonly shade: number
}

interface Bay {
  readonly middle: Vec3
  readonly bars: readonly Bar[]
}

interface View {
  readonly cam: Camera
  readonly sun: Vec3
  readonly zenith: Vec3
  readonly turn: (m: Vec3) => Vec3
  readonly world: (m: Vec3) => Vec3
  readonly screen: (m: Vec3) => ScreenPoint | null
  readonly pxPerMetre: (depth: number) => number
}

const METRE = 1 / 6371000
const RAD = Math.PI / 180

const GOLD_FOIL = '#b5822f'
const SILVER_FOIL = '#9aa0a9'
const FOIL_SHINE = '#fff0cc'
const SOLAR_CELL = '#24345e'
const SOLAR_SHINE = '#8ea4d6'
const SOLAR_GRID = '#6c82b3'
const SOLAR_BACK = '#4b402d'
const FEED_TILE = '#d3cebf'
const FEED_GRID = '#8a8576'
const BOOM_TUBE = '#868c95'
const PIN_STEEL = '#b9bec6'
const BRACKET_METAL = '#5d636d'
const MESH_GOLD = '#d2a64e'
const RIB_GOLD = '#b88d3e'
const RIB_SHINE = '#ffe6a6'
const TRUSS_GOLD = '#8f7645'
const WHITE_SHINE = '#ffffff'

const AMBIENT = 0.36
const SKY_FILL = 0.2
const DIFFUSE = 0.6
const ROD_DIFFUSE = 0.45
const ROD_EDGE_SHADE = 0.58
const CRINKLE = 0.32
const FOIL_JITTER = 0.5

const POSE_TO_LENS = { pitchDeg: 35, yawDeg: 0, rollDeg: 35 }
const HERO_OFFSET = { rightM: -3.2, upM: 1.1, towardsLensM: 1.5 }
const HERO_DRIFT_MAX_DEG = 8
const HERO_DRIFT_DEG_PER_M = 1.8
const HERO_DRIFT_CENTRE_M = 18.3

const REFLECTOR_RADIUS_M = 6
const REFLECTOR_SAG_M = 0.9
const REFLECTOR_CENTRE: Vec3 = [-4.5, 0, 0]
const REFLECTOR_CONCAVE_SIDE: Vec3 = [0, -1, 0]
const REFLECTOR_U: Vec3 = [1, 0, 0]
const REFLECTOR_V: Vec3 = [0, 0, 1]
const RIM_SEGMENTS = 72
const RIBS = 24
const RIB_STEPS = 5
const HUB_RADIUS_M = 0.5
const HOOP_RADII_M = [HUB_RADIUS_M, 2.4, 4.3]
const NET_PITCH_M = 0.3
const NET_STEPS = 6
const TRUSS_BAYS = 32
const TRUSS_UNDER_M = 0.15
const TRUSS_OVER_M = -0.9
const TRUSS_UNDER_SHADE = 0.6
const TRUSS_BEHIND_SHADE = 0.55
const MESH_ALPHA = 0.08
const MESH_LIT_ALPHA = 0.14
const MESH_SHEEN_ALPHA = 0.14
const NET_ALPHA = 0.17
const FITTING_STANDOFF_M = 0.07
const FITTING_REACH_M = 0.6
const BOOM_ARCH_M = 0.8

const BOOM_RADIUS_M = 0.11
const TRUSS_RADIUS_M = 0.032
const RIB_RADIUS_M = 0.02
const ROD_MIN_PX = 1.2
const TRUSS_MIN_PX = 1.5

const BUS_ORIGIN: Vec3 = [3.6, -9, 0]
const BUS_STACK_AXIS: Vec3 = [-0.67, 0.74, 0]
const BUS_WING_HINT: Vec3 = [0.35, 0.3, -1]
const BUS_HALF_M = 0.95
const BUS_FLOOR_M = -2.2
const BUS_TOP_M = -0.3
const RADAR_RADIUS_M = 1.15
const RADAR_TOP_M = 1.3
const FEED_Z_M = 1.62
const WING_Z_M = -1.25
const WING_PANELS = 2
const WING_PANEL_M = 1.5
const WING_WIDTH_M = 1.9
const WING_GAP_M = 0.08
const WING_YOKE_M = 0.7

const material = (base: string, shine: string, gloss: number, specular: number): Material => ({
  base: rgbBytes(base),
  shine: rgbBytes(shine),
  gloss,
  specular,
})

const GOLD = material(GOLD_FOIL, FOIL_SHINE, 12, 0.5)
const SILVER = material(SILVER_FOIL, WHITE_SHINE, 10, 0.3)
const CELLS = material(SOLAR_CELL, SOLAR_SHINE, 26, 0.5)
const CELLS_BACK = material(SOLAR_BACK, FOIL_SHINE, 8, 0.15)
const FEED = material(FEED_TILE, WHITE_SHINE, 10, 0.2)
const BOOM = material(BOOM_TUBE, WHITE_SHINE, 40, 0.45)
const PIN = material(PIN_STEEL, WHITE_SHINE, 30, 0.4)
const BRACKET = material(BRACKET_METAL, WHITE_SHINE, 30, 0.3)
const RIB = material(RIB_GOLD, RIB_SHINE, 26, 0.6)
const TRUSS = material(TRUSS_GOLD, RIB_SHINE, 40, 0.45)

function noise(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function centroid(points: readonly Vec3[]): Vec3 {
  return scale(
    points.reduce<Vec3>((acc, p) => add(acc, p), [0, 0, 0]),
    1 / points.length,
  )
}

function crinkled(face: Vec3, across: Vec3, along: Vec3, id: number): Vec3 {
  return normalize(
    add(
      face,
      add(
        scale(across, (noise(id) - 0.5) * CRINKLE),
        scale(along, (noise(id + 0.37) - 0.5) * CRINKLE),
      ),
    ),
  )
}

function foilSheet(
  [p00, p10, p11, p01]: Quad,
  face: Vec3,
  front: Material,
  cols: number,
  rows: number,
  seed: number,
): Patch[] {
  const at = (s: number, t: number) => mix(mix(p00, p10, s), mix(p01, p11, s), t)
  const across = normalize(sub(p10, p00))
  const along = normalize(sub(p01, p00))
  const shift = (i: number, count: number, id: number) =>
    i === 0 || i === count ? 0 : (noise(id) - 0.5) * FOIL_JITTER
  const node = (c: number, r: number) => {
    const id = seed * 31 + r * (cols + 1) + c
    return at((c + shift(c, cols, id + 0.11)) / cols, (r + shift(r, rows, id + 0.73)) / rows)
  }
  const out: Patch[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const points = [node(c, r), node(c + 1, r), node(c + 1, r + 1), node(c, r + 1)]
      out.push({
        kind: 'patch',
        centre: centroid(points),
        points,
        face,
        normal: crinkled(face, across, along, seed * 97 + r * cols + c),
        front,
        back: null,
        grid: null,
      })
    }
  }
  return out
}

/** The outline runs anticlockwise seen from above; a clockwise one turns every side inside out and culls it. */
function prism(
  outline: Outline,
  z0: number,
  z1: number,
  front: Material,
  cols: number,
  rows: number,
  seed: number,
): Patch[] {
  const out: Patch[] = []
  const top: Vec3 = [0, 0, 1]
  const middle = centroid(outline.map(([a, b]): Vec3 => [a, b, z1]))
  outline.forEach(([a0, b0], i) => {
    const [a1, b1] = outline[(i + 1) % outline.length] ?? [a0, b0]
    const face = normalize([b1 - b0, a0 - a1, 0])
    out.push(
      ...foilSheet(
        [
          [a0, b0, z0],
          [a1, b1, z0],
          [a1, b1, z1],
          [a0, b0, z1],
        ],
        face,
        front,
        cols,
        rows,
        seed + i,
      ),
    )
    const points: Vec3[] = [middle, [a0, b0, z1], [a1, b1, z1]]
    out.push({
      kind: 'patch',
      centre: centroid(points),
      points,
      face: top,
      normal: crinkled(top, [1, 0, 0], [0, 1, 0], seed * 53 + i),
      front,
      back: null,
      grid: null,
    })
  })
  return out
}

function tube(from: Vec3, to: Vec3, radiusM: number, mat: Material): Tube {
  return { kind: 'tube', centre: mix(from, to, 0.5), from, to, radiusM, material: mat }
}

function sheet(
  points: readonly Vec3[],
  face: Vec3,
  front: Material,
  back: Material,
  grid: Grid | null,
): Patch {
  return { kind: 'patch', centre: centroid(points), points, face, normal: face, front, back, grid }
}

const turned = (f: Frame, m: Vec3): Vec3 =>
  add(add(scale(f.a, m[0]), scale(f.b, m[1])), scale(f.z, m[2]))
const placed = (f: Frame, m: Vec3): Vec3 => add(f.origin, turned(f, m))
const local = (f: Frame, v: Vec3): Vec3 => [dot(v, f.a), dot(v, f.b), dot(v, f.z)]

function relocate(part: Part, f: Frame): Part {
  if (part.kind === 'tube') {
    return tube(placed(f, part.from), placed(f, part.to), part.radiusM, part.material)
  }
  return {
    ...part,
    centre: placed(f, part.centre),
    points: part.points.map((p) => placed(f, p)),
    face: turned(f, part.face),
    normal: turned(f, part.normal),
  }
}

function reflectorPoint(x: number, y: number): Vec3 {
  const lift = -REFLECTOR_SAG_M * (1 - (x * x + y * y) / REFLECTOR_RADIUS_M ** 2)
  return add(
    REFLECTOR_CENTRE,
    add(add(scale(REFLECTOR_U, x), scale(REFLECTOR_V, y)), scale(REFLECTOR_CONCAVE_SIDE, lift)),
  )
}

function ringPoint(turnFraction: number, radiusM: number, offsetM: number): Vec3 {
  const a = turnFraction * Math.PI * 2
  return add(
    REFLECTOR_CENTRE,
    add(
      add(scale(REFLECTOR_U, Math.cos(a) * radiusM), scale(REFLECTOR_V, Math.sin(a) * radiusM)),
      scale(REFLECTOR_CONCAVE_SIDE, offsetM),
    ),
  )
}

function ring(radiusM: number): Vec3[] {
  return Array.from({ length: RIM_SEGMENTS }, (_, i) => {
    const a = (i / RIM_SEGMENTS) * Math.PI * 2
    return reflectorPoint(Math.cos(a) * radiusM, Math.sin(a) * radiusM)
  })
}

function netLines(): Vec3[][] {
  const out: Vec3[][] = []
  const count = Math.floor(REFLECTOR_RADIUS_M / NET_PITCH_M)
  for (const deg of [0, 60, 120]) {
    const along = [Math.cos(deg * RAD), Math.sin(deg * RAD)] as const
    const across = [-along[1], along[0]] as const
    for (let k = -count; k <= count; k++) {
      const offset = k * NET_PITCH_M
      const half = Math.sqrt(Math.max(0, REFLECTOR_RADIUS_M ** 2 - offset ** 2))
      out.push(
        Array.from({ length: NET_STEPS + 1 }, (_, i) => {
          const s = -half + (2 * half * i) / NET_STEPS
          return reflectorPoint(
            across[0] * offset + along[0] * s,
            across[1] * offset + along[1] * s,
          )
        }),
      )
    }
  }
  return out
}

function ribLines(): Vec3[][] {
  return Array.from({ length: RIBS }, (_, i) => {
    const a = (i / RIBS) * Math.PI * 2
    return Array.from({ length: RIB_STEPS + 1 }, (_, step) => {
      const r = HUB_RADIUS_M + ((REFLECTOR_RADIUS_M - HUB_RADIUS_M) * step) / RIB_STEPS
      return reflectorPoint(Math.cos(a) * r, Math.sin(a) * r)
    })
  })
}

function trussBays(): Bay[] {
  return Array.from({ length: TRUSS_BAYS }, (_, i) => {
    const here = i / TRUSS_BAYS
    const next = (i + 1) / TRUSS_BAYS
    const under = ringPoint(here, REFLECTOR_RADIUS_M, TRUSS_UNDER_M)
    const over = ringPoint(here, REFLECTOR_RADIUS_M, TRUSS_OVER_M)
    const nextUnder = ringPoint(next, REFLECTOR_RADIUS_M, TRUSS_UNDER_M)
    const nextOver = ringPoint(next, REFLECTOR_RADIUS_M, TRUSS_OVER_M)
    const zig = i % 2 === 0
    return {
      middle: mix(under, nextOver, 0.5),
      bars: [
        { from: under, to: nextUnder, shade: TRUSS_UNDER_SHADE },
        { from: under, to: over, shade: 0.8 },
        { from: zig ? under : over, to: zig ? nextOver : nextUnder, shade: 0.8 },
        { from: over, to: nextOver, shade: 1 },
      ],
    }
  })
}

const RIM = ring(REFLECTOR_RADIUS_M)
const HOOPS = HOOP_RADII_M.map(ring)
const NET = netLines()
const RIB_LINES = ribLines()
const BAYS = trussBays()

function busFrame(): Frame {
  const z = normalize(BUS_STACK_AXIS)
  const b = normalize(sub(BUS_WING_HINT, scale(z, dot(BUS_WING_HINT, z))))
  return { origin: BUS_ORIGIN, a: cross(b, z), b, z }
}

const BUS = busFrame()

function heroTurn(m: Vec3, driftDeg: number): Vec3 {
  const pitch = POSE_TO_LENS.pitchDeg * RAD
  const yaw = (POSE_TO_LENS.yawDeg + driftDeg) * RAD
  const roll = POSE_TO_LENS.rollDeg * RAD
  const y = m[1] * Math.cos(pitch) - m[2] * Math.sin(pitch)
  const z = m[1] * Math.sin(pitch) + m[2] * Math.cos(pitch)
  const x = m[0] * Math.cos(yaw) + z * Math.sin(yaw)
  return [
    x * Math.cos(roll) - y * Math.sin(roll),
    x * Math.sin(roll) + y * Math.cos(roll),
    -m[0] * Math.sin(yaw) + z * Math.cos(yaw),
  ]
}

const TOWARDS_LENS: Vec3 = [
  heroTurn([1, 0, 0], 0)[2],
  heroTurn([0, 1, 0], 0)[2],
  heroTurn([0, 0, 1], 0)[2],
]

function wing(side: 1 | -1): Part[] {
  const lens = local(BUS, TOWARDS_LENS)
  const face = normalize([lens[0], 0, lens[2]])
  const halfWidth = scale([face[2], 0, -face[0]], WING_WIDTH_M / 2)
  const spine = (d: number): Vec3 => [0, side * d, WING_Z_M]
  const first = BUS_HALF_M + WING_YOKE_M
  const parts: Part[] = [
    tube(spine(BUS_HALF_M), add(spine(first), scale(halfWidth, 0.8)), 0.045, BOOM),
    tube(spine(BUS_HALF_M), sub(spine(first), scale(halfWidth, 0.8)), 0.045, BOOM),
    tube(add(spine(first), halfWidth), sub(spine(first), halfWidth), 0.05, BRACKET),
    tube(spine(BUS_HALF_M - 0.05), spine(BUS_HALF_M + 0.12), 0.13, PIN),
  ]
  for (let i = 0; i < WING_PANELS; i++) {
    const start = first + i * (WING_PANEL_M + WING_GAP_M)
    const end = start + WING_PANEL_M
    parts.push(
      sheet(
        [
          sub(spine(start), halfWidth),
          add(spine(start), halfWidth),
          add(spine(end), halfWidth),
          sub(spine(end), halfWidth),
        ],
        face,
        CELLS,
        CELLS_BACK,
        { cols: 4, rows: 5, colour: SOLAR_GRID },
      ),
    )
  }
  return parts
}

function feed(): Part[] {
  const halfA = 0.62
  const halfB = 0.95
  const corners: Quad = [
    [-halfA, -halfB, FEED_Z_M],
    [halfA, -halfB, FEED_Z_M],
    [halfA, halfB, FEED_Z_M],
    [-halfA, halfB, FEED_Z_M],
  ]
  return [
    ...corners.map(([a, b, z]) => tube([a * 0.8, b * 0.8, RADAR_TOP_M], [a, b, z], 0.035, BRACKET)),
    sheet(corners, [0, 0, 1], FEED, SILVER, { cols: 4, rows: 6, colour: FEED_GRID }),
  ]
}

function knuckle(at: Vec3, towardsA: Vec3, towardsB: Vec3): Tube[] {
  const a = normalize(sub(towardsA, at))
  const b = normalize(sub(towardsB, at))
  const pin = normalize(cross(a, b))
  const out = [tube(sub(at, scale(pin, 0.3)), add(at, scale(pin, 0.3)), 0.15, PIN)]
  for (const arm of [a, b]) {
    for (const side of [1, -1]) {
      const cheek = add(at, scale(pin, side * 0.2))
      out.push(tube(cheek, add(cheek, scale(arm, 0.6)), 0.05, BRACKET))
    }
  }
  return out
}

const FITTING_MID_M = (TRUSS_UNDER_M + TRUSS_OVER_M) / 2
const RIM_PIVOT = ringPoint(
  0,
  REFLECTOR_RADIUS_M + FITTING_STANDOFF_M + FITTING_REACH_M,
  FITTING_MID_M,
)

function boomJoints(): readonly [Vec3, Vec3, Vec3, Vec3, Vec3] {
  const towardsRim = local(BUS, sub(RIM_PIVOT, BUS_ORIGIN))
  const side = normalize([towardsRim[0], towardsRim[1], 0])
  const out = (reachM: number): Vec3 => placed(BUS, [side[0] * reachM, side[1] * reachM, 0.6])
  const root = out(RADAR_RADIUS_M + 0.45)
  const arch = scale(REFLECTOR_U, BOOM_ARCH_M)
  return [
    out(RADAR_RADIUS_M * 0.9),
    root,
    add(mix(root, RIM_PIVOT, 0.3), arch),
    add(mix(root, RIM_PIVOT, 0.74), arch),
    RIM_PIVOT,
  ]
}

function boom(): Part[] {
  const [foot, root, elbow, wrist, pivot] = boomJoints()
  return [
    tube(foot, root, 0.13, BRACKET),
    tube(root, elbow, BOOM_RADIUS_M, BOOM),
    tube(elbow, wrist, BOOM_RADIUS_M, BOOM),
    tube(wrist, pivot, BOOM_RADIUS_M, BOOM),
    ...knuckle(root, foot, elbow),
    ...knuckle(elbow, root, wrist),
    ...knuckle(wrist, elbow, pivot),
  ]
}

function fitting(): Part[] {
  const node = (bay: number, offsetM: number) =>
    ringPoint(bay / TRUSS_BAYS, REFLECTOR_RADIUS_M + FITTING_STANDOFF_M, offsetM)
  const hubLine = add(REFLECTOR_CENTRE, scale(REFLECTOR_CONCAVE_SIDE, FITTING_MID_M))
  const parts: Part[] = []
  for (const bay of [-1, 0]) {
    parts.push(
      sheet(
        [
          node(bay, TRUSS_UNDER_M),
          node(bay + 1, TRUSS_UNDER_M),
          node(bay + 1, TRUSS_OVER_M),
          node(bay, TRUSS_OVER_M),
        ],
        normalize(sub(node(bay + 0.5, FITTING_MID_M), hubLine)),
        BRACKET,
        BRACKET,
        null,
      ),
    )
    for (const offsetM of [TRUSS_UNDER_M, TRUSS_OVER_M]) {
      parts.push(tube(node(bay, offsetM), node(bay + 1, offsetM), 0.07, BRACKET))
    }
  }
  for (const bay of [-1, 0, 1]) {
    parts.push(tube(node(bay, TRUSS_UNDER_M), node(bay, TRUSS_OVER_M), 0.06, BRACKET))
  }
  for (const side of [1, -1]) {
    const cheek = scale(REFLECTOR_V, side * 0.24)
    parts.push(tube(add(node(0, FITTING_MID_M), cheek), add(RIM_PIVOT, cheek), 0.07, BRACKET))
  }
  parts.push(
    tube(
      sub(RIM_PIVOT, scale(REFLECTOR_V, 0.38)),
      add(RIM_PIVOT, scale(REFLECTOR_V, 0.38)),
      0.14,
      PIN,
    ),
  )
  return parts
}

const BUS_OUTLINE: Outline = [
  [-BUS_HALF_M, -BUS_HALF_M],
  [BUS_HALF_M, -BUS_HALF_M],
  [BUS_HALF_M, BUS_HALF_M],
  [-BUS_HALF_M, BUS_HALF_M],
]

const RADAR_OUTLINE: Outline = Array.from({ length: 8 }, (_, i) => {
  const a = (22.5 + i * 45) * RAD
  return [Math.cos(a) * RADAR_RADIUS_M, Math.sin(a) * RADAR_RADIUS_M] as const
})

const PARTS: readonly Part[] = [
  ...[
    ...prism(BUS_OUTLINE, BUS_FLOOR_M, BUS_TOP_M, GOLD, 8, 8, 1),
    ...prism(RADAR_OUTLINE, BUS_TOP_M, RADAR_TOP_M, SILVER, 4, 8, 11),
    ...feed(),
    ...wing(1),
    ...wing(-1),
  ].map((part) => relocate(part, BUS)),
  ...boom(),
  ...fitting(),
]

function paint(mat: Material, diffuse: number, specular: number): string {
  const channel = (i: 0 | 1 | 2) =>
    Math.round(Math.min(255, mat.base[i] * diffuse + mat.shine[i] * specular))
  return `rgb(${String(channel(0))}, ${String(channel(1))}, ${String(channel(2))})`
}

function surfaceTone(mat: Material, normal: Vec3, toEye: Vec3, view: View): string {
  const n = dot(normal, toEye) < 0 ? scale(normal, -1) : normal
  const lit = Math.max(0, dot(n, view.sun))
  const half = normalize(add(view.sun, toEye))
  const specular = lit > 0 ? Math.max(0, dot(n, half)) ** mat.gloss * mat.specular : 0
  return paint(mat, AMBIENT + SKY_FILL * Math.max(0, dot(n, view.zenith)) + DIFFUSE * lit, specular)
}

function rodLight(
  mat: Material,
  axis: Vec3,
  toEye: Vec3,
  view: View,
): { diffuse: number; specular: number } {
  const across = (d: Vec3) => Math.sqrt(Math.max(0, 1 - dot(axis, d) ** 2))
  const half = normalize(add(view.sun, toEye))
  return {
    diffuse: AMBIENT + ROD_DIFFUSE * across(view.sun),
    specular: across(half) ** mat.gloss * mat.specular,
  }
}

function trace(
  ctx: CanvasRenderingContext2D,
  points: readonly (ScreenPoint | null)[],
  close: boolean,
): boolean {
  if (points.some((p) => p === null)) return false
  ctx.beginPath()
  points.forEach((p, i) => {
    if (p === null) return
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  if (close) ctx.closePath()
  return true
}

function eyeFrom(view: View, m: Vec3): Vec3 {
  return normalize(sub(view.cam.eye, view.world(m)))
}

function drawGrid(ctx: CanvasRenderingContext2D, screen: readonly ScreenPoint[], grid: Grid) {
  const [a, b, c, d] = screen
  if (!a || !b || !c || !d) return
  const between = (p: ScreenPoint, q: ScreenPoint, t: number) => ({
    x: p.x + (q.x - p.x) * t,
    y: p.y + (q.y - p.y) * t,
  })
  ctx.strokeStyle = grid.colour
  ctx.globalAlpha = 0.6
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 1; i < grid.rows; i++) {
    const p = between(a, d, i / grid.rows)
    const q = between(b, c, i / grid.rows)
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
  }
  for (let i = 1; i < grid.cols; i++) {
    const p = between(a, b, i / grid.cols)
    const q = between(d, c, i / grid.cols)
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
  }
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawPatch(ctx: CanvasRenderingContext2D, view: View, part: Patch) {
  const toEye = eyeFrom(view, part.centre)
  const facing = dot(view.turn(part.face), toEye) > 0
  const mat = facing ? part.front : part.back
  if (mat === null) return
  const screen = part.points.map(view.screen)
  if (!trace(ctx, screen, true)) return
  const tone = surfaceTone(mat, view.turn(part.normal), toEye, view)
  ctx.fillStyle = tone
  ctx.strokeStyle = tone
  ctx.lineWidth = 0.7
  ctx.fill()
  ctx.stroke()
  if (facing && part.grid !== null) {
    drawGrid(
      ctx,
      screen.filter((p) => p !== null),
      part.grid,
    )
  }
}

function drawRod(
  ctx: CanvasRenderingContext2D,
  view: View,
  from: Vec3,
  to: Vec3,
  radiusM: number,
  mat: Material,
  minPx: number,
  shade: number,
) {
  const a = view.screen(from)
  const b = view.screen(to)
  if (a === null || b === null) return
  const axis = normalize(view.turn(sub(to, from)))
  const light = rodLight(mat, axis, eyeFrom(view, mix(from, to, 0.5)), view)
  const width = Math.max(minPx, 2 * radiusM * view.pxPerMetre((a.depth + b.depth) / 2))
  const stroke = (tone: string, widthPx: number) => {
    ctx.strokeStyle = tone
    ctx.lineWidth = widthPx
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
  }
  if (width < 3) {
    stroke(paint(mat, light.diffuse * shade, light.specular * shade), width)
    return
  }
  stroke(paint(mat, light.diffuse * shade * ROD_EDGE_SHADE, 0), width)
  stroke(paint(mat, light.diffuse * shade, 0), width * 0.62)
  stroke(paint(mat, light.diffuse * shade, light.specular * shade), width * 0.24)
}

function drawBays(ctx: CanvasRenderingContext2D, view: View, bays: readonly Bay[], shade: number) {
  for (const bay of bays) {
    for (const bar of bay.bars) {
      drawRod(ctx, view, bar.from, bar.to, TRUSS_RADIUS_M, TRUSS, TRUSS_MIN_PX, bar.shade * shade)
    }
  }
}

function meshAlpha(view: View, towardsSun: Vec3, side: 1 | -1, toEye: Vec3): number {
  const slope = (2 * REFLECTOR_SAG_M) / REFLECTOR_RADIUS_M
  const normal = normalize(sub(view.turn(REFLECTOR_CONCAVE_SIDE), scale(towardsSun, side * slope)))
  const half = normalize(add(view.sun, toEye))
  return Math.min(
    0.5,
    MESH_ALPHA +
      MESH_LIT_ALPHA * Math.abs(dot(normal, view.sun)) +
      MESH_SHEEN_ALPHA * Math.abs(dot(normal, half)) ** 10,
  )
}

function fillMesh(ctx: CanvasRenderingContext2D, view: View) {
  if (!trace(ctx, RIM.map(view.screen), true)) return
  const u = view.turn(REFLECTOR_U)
  const v = view.turn(REFLECTOR_V)
  const su = dot(view.sun, u)
  const sv = dot(view.sun, v)
  const inPlane = Math.hypot(su, sv)
  const [ex, ey] = inPlane < 0.05 ? [1, 0] : [su / inPlane, sv / inPlane]
  const near = view.screen(reflectorPoint(ex * REFLECTOR_RADIUS_M, ey * REFLECTOR_RADIUS_M))
  const far = view.screen(reflectorPoint(-ex * REFLECTOR_RADIUS_M, -ey * REFLECTOR_RADIUS_M))
  if (near === null || far === null) return
  const towardsSun = add(scale(u, ex), scale(v, ey))
  const toEye = eyeFrom(view, REFLECTOR_CENTRE)
  const [r, g, b] = rgbBytes(MESH_GOLD)
  const tint = (alpha: number) =>
    `rgba(${String(r)}, ${String(g)}, ${String(b)}, ${alpha.toFixed(3)})`
  const gradient = ctx.createLinearGradient(near.x, near.y, far.x, far.y)
  gradient.addColorStop(0, tint(meshAlpha(view, towardsSun, 1, toEye)))
  gradient.addColorStop(1, tint(meshAlpha(view, towardsSun, -1, toEye)))
  ctx.fillStyle = gradient
  ctx.fill()
}

function drawDish(ctx: CanvasRenderingContext2D, view: View) {
  const centre = view.screen(REFLECTOR_CENTRE)
  if (centre === null) return
  const depthOf = (m: Vec3) => view.screen(m)?.depth ?? centre.depth
  const behind = BAYS.filter((bay) => depthOf(bay.middle) > centre.depth)
  const inFront = BAYS.filter((bay) => depthOf(bay.middle) <= centre.depth)

  drawBays(ctx, view, behind, TRUSS_BEHIND_SHADE)
  fillMesh(ctx, view)

  ctx.strokeStyle = MESH_GOLD
  ctx.globalAlpha = NET_ALPHA
  ctx.lineWidth = 1
  for (const line of NET) {
    if (trace(ctx, line.map(view.screen), false)) ctx.stroke()
  }
  ctx.globalAlpha = 0.4
  for (const hoop of HOOPS) {
    if (trace(ctx, hoop.map(view.screen), true)) ctx.stroke()
  }
  ctx.globalAlpha = 1

  for (const rib of RIB_LINES) {
    rib.forEach((point, i) => {
      const next = rib[i + 1]
      if (next !== undefined) drawRod(ctx, view, point, next, RIB_RADIUS_M, RIB, ROD_MIN_PX, 1)
    })
  }
  drawBays(ctx, view, inFront, 1)
}

export function drawSatellite(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  pose: SatellitePose,
  sun: Vec3,
  sizeScale: number,
) {
  const unit = METRE * sizeScale
  const alongM = dot(sub(pose.position, cam.eye), normalize(pose.forward)) / unit
  const driftDeg =
    HERO_DRIFT_MAX_DEG *
    Math.tanh(((alongM - HERO_DRIFT_CENTRE_M) * HERO_DRIFT_DEG_PER_M) / HERO_DRIFT_MAX_DEG)
  const towardsLens = scale(cam.forward, -1)
  const lens = (h: Vec3): Vec3 =>
    add(add(scale(cam.right, h[0]), scale(cam.up, h[1])), scale(towardsLens, h[2]))
  const offset = lens([HERO_OFFSET.rightM, HERO_OFFSET.upM, HERO_OFFSET.towardsLensM])
  const anchor = add(pose.position, scale(offset, unit))
  const turn = (m: Vec3): Vec3 => {
    const h = heroTurn(m, driftDeg)
    return lens(h)
  }
  const world = (m: Vec3): Vec3 => add(anchor, scale(turn(m), unit))
  const view: View = {
    cam,
    sun: normalize(sun),
    zenith: normalize(pose.up),
    turn,
    world,
    screen: (m) => project(cam, world(m)),
    pxPerMetre: (depth) => (unit * cam.focalPx) / depth,
  }

  const order = PARTS.map((part) => ({
    part,
    depth: dot(sub(world(part.centre), cam.eye), cam.forward),
  })).sort((p, q) => q.depth - p.depth)

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  const lensOnConcaveSide = dot(turn(REFLECTOR_CONCAVE_SIDE), eyeFrom(view, REFLECTOR_CENTRE)) > 0
  const beyondMesh = (part: Part) =>
    dot(sub(part.centre, REFLECTOR_CENTRE), REFLECTOR_CONCAVE_SIDE) > TRUSS_UNDER_M !==
    lensOnConcaveSide
  const drawPart = (part: Part) => {
    if (part.kind === 'patch') drawPatch(ctx, view, part)
    else drawRod(ctx, view, part.from, part.to, part.radiusM, part.material, ROD_MIN_PX, 1)
  }
  for (const { part } of order) if (beyondMesh(part)) drawPart(part)
  drawDish(ctx, view)
  for (const { part } of order) if (!beyondMesh(part)) drawPart(part)
  ctx.restore()
}
