import { describe, expect, it } from 'vitest'
import {
  colourKey,
  nounOf,
  objectLabel,
  populationLine,
  populationMeta,
  rowHeadline,
  statusText,
  watchSentence,
} from '#web/business/copy.ts'
import { businessRows, earlyResult, eveningPopulation } from '#web/business/motion.ts'
import { isNullCheck } from '#web/data/load.ts'
import type { Catalog, MotionObject, Objects, PlaceData, RadarMeta } from '#web/data/types.ts'
import { buildStory, heatOf, heatRange, type HeatRange } from '#web/story/chapters.ts'
import { areaText, buildingBecause, buildingHeadline, heatMeta } from '#web/story/story-text.ts'
import type { LonLat } from '#web/story/where.ts'

const files = import.meta.glob<unknown>(
  [
    '/public/data/stalowa-wola/{catalog,radar}.json',
    '/public/data/stalowa-wola/insar/{objects,null_check}.json',
  ],
  { eager: true, import: 'default' },
)

const file = (path: string): unknown => files[`/public/data/${path}`] ?? null
const nullCheck = file('stalowa-wola/insar/null_check.json')
const objects = file('stalowa-wola/insar/objects.json') as Objects
const catalog = file('stalowa-wola/catalog.json') as Catalog

const data: PlaceData = {
  slug: 'stalowa-wola',
  catalog,
  radar: file('stalowa-wola/radar.json') as RadarMeta,
  clouds: null,
  weather: null,
  insar: null,
  objects,
  events: null,
  footprints: null,
  nullCheck: isNullCheck(nullCheck) ? nullCheck : null,
  story: null,
  ground: null,
  play: null,
  eventPairs: null,
}

const NBSP = ' '
const centre: LonLat = [catalog.place.lon, catalog.place.lat]
const INFLATION = 1.2

function byOsm(osm: string): MotionObject {
  const found = objects.objects.find((o) => o.osm === osm)
  if (found === undefined) throw new Error(osm)
  return found
}

const STORY = byOsm('way/359317018')
const WATCH = byOsm('way/359422657')
const CELLFAST = byOsm('way/334830878')

const range = (lo: number, hi: number): HeatRange => ({
  loMm: lo,
  hiMm: hi,
  mmPerC: 0.3,
  mmPerCErr: 0.06,
  rangeC: 16.3,
  passes: 9,
})

describe('object labels', () => {
  it('names a building by kind, area and place when OSM has no name', () => {
    expect(objectLabel(STORY, centre)).toBe(
      `Building, 6.4${NBSP}ha, 3${NBSP}km south of the centre`,
    )
    expect(objectLabel(WATCH, centre)).toBe(`Building, 0.36${NBSP}ha, in the town centre`)
  })

  it('takes the building type from the OSM building tag only', () => {
    expect(nounOf(CELLFAST)).toBe('Industrial building')
    expect(nounOf(STORY)).toBe('Building')
    expect(nounOf({ ...STORY, building: 'hangar' })).toBe('Building')
    expect(nounOf({ ...STORY, building: 'constructor' })).toBe('Building')
  })

  it('calls every levee an embankment, since some are road embankments', () => {
    const levees = objects.objects.filter((o) => o.kind === 'levee')
    expect(levees.length).toBeGreaterThan(0)
    expect(new Set(levees.map(nounOf))).toEqual(new Set(['Embankment']))
  })

  it('rounds areas to two significant digits', () => {
    expect(areaText(6.4197)).toBe(`6.4${NBSP}ha`)
    expect(areaText(0.3611)).toBe(`0.36${NBSP}ha`)
    expect(areaText(12)).toBe(`12${NBSP}ha`)
  })
})

describe('status', () => {
  it('words each open-ground label plainly', () => {
    expect(statusText('beats_all')).toBe('Clear: no patch of open ground did this')
    expect(statusText('borderline')).toBe('Borderline: a few patches of open ground did this too')
    expect(statusText('like_open_ground')).toBe('Within ground noise so far')
  })
})

describe('row headline', () => {
  it('gives a millimetre range only to a structure that beats open ground', () => {
    expect(rowHeadline(STORY, 'beats_all', range(4, 5))).toBe(
      `Warm days move this building 4${NBSP}to${NBSP}5${NBSP}mm.`,
    )
    expect(rowHeadline(CELLFAST, 'borderline', range(4, 5))).toBeNull()
    expect(rowHeadline(CELLFAST, 'like_open_ground', range(7, 7))).toBeNull()
    expect(rowHeadline(WATCH, 'beats_all', { ...range(-5, -4), mmPerC: -0.27 })).toBeNull()
  })
})

describe('story building', () => {
  const heat = heatOf(objects, STORY)

  it('headlines a range, or one number when both ends round alike', () => {
    expect(buildingHeadline('building', range(4, 5))).toBe(
      `Warm days move this building 4${NBSP}to${NBSP}5${NBSP}mm.`,
    )
    expect(buildingHeadline('building', range(5, 5))).toBe(
      `Warm days move this building about 5${NBSP}mm.`,
    )
  })

  it('explains with the evening fit across the evening temperatures, never with two passes', () => {
    const evening = heat.evening
    const fitted = evening === null ? null : heatRange(evening, INFLATION)
    if (fitted === null) throw new Error('no evening fit')
    expect(buildingBecause(fitted)).toBe(
      `Across the 16${NBSP}°C range of evening air temperatures it moves 4${NBSP}to${NBSP}5${NBSP}mm towards the satellite. No patch of open ground nearby moved with heat this clearly.`,
    )
    expect(buildingBecause(range(5, 5))).toBe(
      `Across the 16${NBSP}°C range of evening air temperatures it moves about 5${NBSP}mm towards the satellite. No patch of open ground nearby moved with heat this clearly.`,
    )
    expect(buildingBecause({ ...range(3, 4), rangeC: 12.6 })).toMatch(/^Across the 13\u00a0°C /)
  })

  it('states the evening slope and why the dawn orbit is set aside', () => {
    expect(heatMeta(heat, INFLATION)).toBe(
      "Evening orbit: +0.30 ± 0.07 mm per °C over 9 passes. The dawn orbit rests on one warm morning, so we do not use it. Along the radar's line of sight; one orbit cannot tell up from sideways. Air temperature: NASA POWER estimate.",
    )
  })

  it('drops the dawn clause once more than one warm morning carries the dawn slope', () => {
    const dawn = heat.dawn
    if (dawn === null) throw new Error('no dawn orbit')
    expect(heatMeta({ ...heat, dawn: { ...dawn, warmPasses: 3 } }, 1)).toBe(
      "Evening orbit: +0.30 ± 0.06 mm per °C over 9 passes. Along the radar's line of sight; one orbit cannot tell up from sideways. Air temperature: NASA POWER estimate.",
    )
  })
})

describe('watch candidate meta', () => {
  it('leaves out the slope that the watch sentence already gives', () => {
    expect(heatMeta(heatOf(objects, WATCH), INFLATION, false)).toBe(
      "The dawn orbit rests on one warm morning, so we do not use it. Along the radar's line of sight; one orbit cannot tell up from sideways. Air temperature: NASA POWER estimate.",
    )
  })
})

describe('watch candidate', () => {
  it('calls the building that moved away on warm evenings a candidate, along the line of sight', () => {
    expect(watchSentence(heatOf(objects, WATCH), INFLATION)).toBe(
      'Worth a look: on warm evenings it moved away from the satellite (−0.27 ± 0.07 mm per °C). Open ground sometimes does this too, so it is a candidate, not an alarm.',
    )
  })

  it('states the population as a tendency of warm evenings, with the verb agreeing', () => {
    expect(populationLine({ towards: 74, total: 105, noise: 103 })).toBe(
      '74 of 105 buildings tend to move towards the satellite on warm evenings.',
    )
    expect(populationLine({ towards: 1, total: 105, noise: 103 })).toBe(
      '1 of 105 buildings tends to move towards the satellite on warm evenings.',
    )
  })
})

describe('population copy', () => {
  const tonight = eveningPopulation(objects, data.nullCheck)
  const months = earlyResult(data)?.months ?? null

  it('counts the tendency from objects.json and qualifies it with ground noise and the short season', () => {
    if (tonight === null) throw new Error('no population')
    expect(populationLine(tonight)).toBe(
      '74 of 105 buildings tend to move towards the satellite on warm evenings.',
    )
    expect(populationMeta(tonight, months)).toBe(
      'One by one, almost all are within ground noise. Too early to tell heat from season.',
    )
  })

  it('says all are within ground noise only when every one is', () => {
    expect(populationMeta({ towards: 60, total: 100, noise: 100 }, 4)).toBe(
      'One by one, all are within ground noise. Too early to tell heat from season.',
    )
  })

  it('counts the noise when many buildings stand out, with the verb agreeing', () => {
    expect(populationMeta({ towards: 60, total: 100, noise: 70 }, 1)).toBe(
      'One by one, 70 of 100 are within ground noise. Too early to tell heat from season.',
    )
    expect(populationMeta({ towards: 3, total: 4, noise: 1 }, 1)).toBe(
      'One by one, 1 of 4 is within ground noise. Too early to tell heat from season.',
    )
  })

  it('claims nothing about ground noise without the check', () => {
    expect(populationMeta({ towards: 74, total: 105, noise: null }, 4)).toBe(
      'Too early to tell heat from season.',
    )
    expect(populationMeta({ towards: 74, total: 105, noise: null }, null)).toBeNull()
  })

  it('drops the season caveat once the series covers a whole year', () => {
    expect(populationMeta({ towards: 60, total: 100, noise: 95 }, 12)).toBe(
      'One by one, almost all are within ground noise.',
    )
  })

  it('never claims two agreeing orbits, a tilt, vertical motion or a verdict on one building', () => {
    if (tonight === null) throw new Error('no population')
    const text = `${populationLine(tonight)} ${populationMeta(tonight, months) ?? ''}`
    expect(text).toMatch(/warm evenings/)
    expect(text).not.toMatch(
      /two orbits|\blean|\btilt|\b(rise|rises|rising)\b|\bsink|lift|taller|\bhall\b/i,
    )
    expect(text).not.toMatch(/[\u2013\u2014]/u)
  })
})

describe('colour key', () => {
  const rows = businessRows(data, buildStory(data))
  const withSlope = (mmPerC: number) =>
    rows.map((row) =>
      row.label === 'beats_all' && row.heat.evening !== null
        ? { ...row, heat: { ...row.heat, evening: { ...row.heat.evening, mmPerC } } }
        : row,
    )

  it('names only the colours the clear buildings show tonight', () => {
    expect(colourKey(rows)).toBe('Blue: moves towards the satellite when warm.')
  })

  it('switches to red, both or nothing with the clear buildings', () => {
    expect(colourKey(withSlope(-0.2))).toBe('Red: moves away from the satellite when warm.')
    const [first] = rows.filter((r) => r.label === 'beats_all' && r.object.kind === 'building')
    const evening = first?.heat.evening
    if (first === undefined || evening === null || evening === undefined) {
      throw new Error('Stalowa Wola has a clear building')
    }
    const awayRow = { ...first, heat: { ...first.heat, evening: { ...evening, mmPerC: -0.2 } } }
    const mixed = [...rows, awayRow]
    expect(colourKey(mixed)).toBe('Blue: towards the satellite when warm; red: away.')
    expect(colourKey(rows.filter((r) => r.label !== 'beats_all'))).toBeNull()
  })
})

describe('honesty sweep over every row', () => {
  const population = eveningPopulation(objects, data.nullCheck)
  const texts = businessRows(data, buildStory(data)).flatMap((row) => [
    objectLabel(row.object, centre),
    rowHeadline(row.object, row.label, row.range) ?? '',
    row.label === null ? '' : statusText(row.label),
    heatMeta(row.heat, INFLATION) ?? '',
    row.range === null ? '' : buildingBecause(row.range),
    watchSentence(row.heat, INFLATION) ?? '',
    population === null ? '' : populationLine(population),
    population === null ? '' : (populationMeta(population, 4) ?? ''),
  ])

  it('never claims vertical motion, two agreeing orbits or a hall', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/\b(rise|rises|rising|sink|sinks|sinking)\b|lift|taller/i)
      expect(text).not.toMatch(/two orbits|\bhall\b/i)
    }
  })

  it('never puts the two-pass difference beside the open-ground check', () => {
    for (const text of texts) {
      expect(text).not.toMatch(/give or take|closer to the satellite than|coldest to the warmest/i)
    }
  })

  it('uses no em or en dashes', () => {
    for (const text of texts) expect(text).not.toMatch(new RegExp('[\u2013\u2014]'))
  })
})
