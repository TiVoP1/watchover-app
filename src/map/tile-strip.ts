const WIRE_VARINT = 0
const WIRE_FIXED64 = 1
const WIRE_BYTES = 2
const WIRE_FIXED32 = 5

const TILE_LAYER = 3
const LAYER_NAME = 1
const LAYER_FEATURE = 2
const LAYER_KEY = 3
const LAYER_VALUE = 4
const FEATURE_TAGS = 2
const LAYER_TABLES = new Set([LAYER_FEATURE, LAYER_KEY, LAYER_VALUE])

const TRANSLATED_NAME = /^name[:_]/
const KEPT_NAMES = new Set(['name_en', 'name:latin', 'name:nonlatin'])

const EMPTY: Uint8Array = new Uint8Array(0)
const text = new TextDecoder()
const utf8 = new TextEncoder()

interface Field {
  readonly field: number
  readonly raw: Uint8Array
  readonly body: Uint8Array
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function readVarint(bytes: Uint8Array, start: number): readonly [value: number, next: number] {
  let value = 0
  let pos = start
  for (let shift = 0; pos < bytes.length; shift += 7) {
    const byte = bytes[pos++] ?? 0
    value += (byte & 0x7f) * 2 ** shift
    if (byte < 0x80) return [value, pos]
  }
  throw new Error('truncated protobuf varint')
}

export function varint(value: number): Uint8Array {
  const out: number[] = []
  let rest = value
  while (rest >= 0x80) {
    out.push((rest % 0x80) | 0x80)
    rest = Math.floor(rest / 0x80)
  }
  out.push(rest)
  return Uint8Array.from(out)
}

export const bytesField = (field: number, body: Uint8Array): Uint8Array =>
  concat([varint((field << 3) | WIRE_BYTES), varint(body.length), body])

function fields(bytes: Uint8Array): Field[] {
  const out: Field[] = []
  let pos = 0
  while (pos < bytes.length) {
    const [tag, afterTag] = readVarint(bytes, pos)
    const wire = tag & 7
    let body = EMPTY
    let end: number
    if (wire === WIRE_BYTES) {
      const [length, start] = readVarint(bytes, afterTag)
      end = start + length
      body = bytes.subarray(start, end)
    } else if (wire === WIRE_VARINT) {
      end = readVarint(bytes, afterTag)[1]
    } else if (wire === WIRE_FIXED64) {
      end = afterTag + 8
    } else if (wire === WIRE_FIXED32) {
      end = afterTag + 4
    } else {
      throw new Error(`unsupported protobuf wire type ${wire}`)
    }
    out.push({ field: tag >>> 3, raw: bytes.subarray(pos, end), body })
    pos = end
  }
  return out
}

function packedPairs(bytes: Uint8Array): (readonly [key: number, value: number])[] {
  const pairs: (readonly [number, number])[] = []
  let pos = 0
  while (pos < bytes.length) {
    const [key, afterKey] = readVarint(bytes, pos)
    const [value, next] = readVarint(bytes, afterKey)
    pairs.push([key, value])
    pos = next
  }
  return pairs
}

const droppedKey = (key: string | undefined): boolean =>
  key !== undefined && TRANSLATED_NAME.test(key) && !KEPT_NAMES.has(key)

function stripLayer(layer: Uint8Array): Uint8Array {
  const parts = fields(layer)
  const keys = parts.filter((p) => p.field === LAYER_KEY).map((p) => text.decode(p.body))
  const values = parts.filter((p) => p.field === LAYER_VALUE).map((p) => p.raw)
  const keyIds = new Map<number, number>()
  const valueIds = new Map<number, number>()
  const idOf = (ids: Map<number, number>, old: number): number => {
    const id = ids.get(old) ?? ids.size
    ids.set(old, id)
    return id
  }
  const retag = (tags: Uint8Array): Uint8Array => {
    const kept: Uint8Array[] = []
    for (const [key, value] of packedPairs(tags)) {
      if (droppedKey(keys[key])) continue
      kept.push(varint(idOf(keyIds, key)), varint(idOf(valueIds, value)))
    }
    return bytesField(FEATURE_TAGS, concat(kept))
  }
  const features = parts
    .filter((p) => p.field === LAYER_FEATURE)
    .map((feature) =>
      bytesField(
        LAYER_FEATURE,
        concat(fields(feature.body).map((f) => (f.field === FEATURE_TAGS ? retag(f.body) : f.raw))),
      ),
    )
  return concat([
    ...parts.filter((p) => !LAYER_TABLES.has(p.field)).map((p) => p.raw),
    ...features,
    ...[...keyIds.keys()].map((old) => bytesField(LAYER_KEY, utf8.encode(keys[old]))),
    ...[...valueIds.keys()].map((old) => values[old] ?? EMPTY),
  ])
}

const layerName = (layer: Uint8Array): string =>
  text.decode(fields(layer).find((f) => f.field === LAYER_NAME)?.body)

export function stripTile(tile: Uint8Array, sourceLayers: ReadonlySet<string>): Uint8Array {
  return concat(
    fields(tile)
      .filter((l) => l.field === TILE_LAYER && sourceLayers.has(layerName(l.body)))
      .map((l) => bytesField(TILE_LAYER, stripLayer(l.body))),
  )
}
