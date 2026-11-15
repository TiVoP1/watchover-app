import { describe, expect, it } from 'vitest'
import { bytesField, concat, stripTile, varint } from '#web/map/tile-strip.ts'

const utf8 = new TextEncoder()
const varintField = (field: number, value: number) => concat([varint(field << 3), varint(value)])
const packed = (values: readonly number[]) => concat(values.map(varint))
const stringField = (field: number, value: string) => bytesField(field, utf8.encode(value))
const stringValue = (value: string) => bytesField(4, stringField(1, value))

const feature = (tags: readonly number[]) =>
  bytesField(
    2,
    concat([
      varintField(1, 7),
      bytesField(2, packed(tags)),
      varintField(3, 3),
      bytesField(4, packed([9, 50, 34])),
    ]),
  )

const layer = (
  name: string,
  keys: readonly string[],
  values: readonly string[],
  tags: readonly number[],
) =>
  bytesField(
    3,
    concat([
      stringField(1, name),
      feature(tags),
      ...keys.map((key) => stringField(3, key)),
      ...values.map(stringValue),
      varintField(5, 4096),
      varintField(15, 2),
    ]),
  )

describe('varint', () => {
  it('encodes seven bits per byte, low bits first', () => {
    expect([...varint(1)]).toEqual([0x01])
    expect([...varint(300)]).toEqual([0xac, 0x02])
  })
})

describe('stripTile', () => {
  const water = layer(
    'water',
    ['name', 'name:de', 'class', 'name_en', 'name_de'],
    ['Wisła', 'Weichsel', 'river', 'Vistula'],
    [0, 0, 1, 1, 2, 2, 3, 3, 4, 1],
  )

  it('drops translated names and renumbers the kept keys and values', () => {
    const expected = bytesField(
      3,
      concat([
        stringField(1, 'water'),
        varintField(5, 4096),
        varintField(15, 2),
        feature([0, 0, 1, 1, 2, 2]),
        stringField(3, 'name'),
        stringField(3, 'class'),
        stringField(3, 'name_en'),
        stringValue('Wisła'),
        stringValue('river'),
        stringValue('Vistula'),
      ]),
    )
    expect([...stripTile(water, new Set(['water']))]).toEqual([...expected])
  })

  it('drops layers the map does not draw', () => {
    const poi = layer('poi', ['name'], ['Shop'], [0, 0])
    const stripped = stripTile(concat([poi, water]), new Set(['water']))
    expect([...stripped]).toEqual([...stripTile(water, new Set(['water']))])
  })

  it('returns an empty tile when no layer is drawn', () => {
    expect(stripTile(water, new Set(['place'])).length).toBe(0)
  })
})
