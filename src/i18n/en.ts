import type { ToldValues } from '#web/story/place-story.ts'
import { plural } from '#web/ui/format.ts'

export const EN = {
  brand: 'Watchover',
  modes: 'View',
  modePeople: 'People',
  modeBusiness: 'For business',
  myPlaces: 'My places',
  ascending: 'ascending',
  descending: 'descending',
  loading: 'Loading the place',
  loadError: 'This place could not be loaded. Check the connection and try again.',
  retry: 'Try again',
  globe: {
    goal: (days: number) =>
      `The NISAR radar visits each one every ${days} days, through clouds and at night.`,
    changes: (n: number) => `${n} ${plural(n, 'change', 'changes')} this year`,
    stories: 'Change stories this year',
    open: (place: string) => `Open ${place}`,
    places: 'Places',
    choose: 'Choose a place',
  },
  rest: {
    goal: (days: number) =>
      `NISAR radar visits this place every ${days} days, through clouds and at night.`,
    pressPlay: 'Press Play to watch the year in half a minute.',
    clearest: (n: number) => `The ${n} clearest of this year's changes.`,
    moreChanges: (n: number) => `More changes (${n})`,
    weather: (setAside: string, total: string, from: string, to: string) =>
      `Set aside as weather-like: ${setAside} of ${total} ground signals (${from} to ${to}).`,
    more: (parts: string, n: number) => `More: ${parts} (${n})`,
    moreParts: { image: 'image', sharpen: 'sharpen', sources: 'sources' },
    noStories: 'Radar images only. No change stories yet for this place.',
    image: 'Image',
    falseColour: 'False colour',
    falseColourLegend:
      'Green is vegetation, pink and white are buildings, black is calm water. R HH, G HV, B HH/HV.',
    sharpen: 'Sharpen the picture',
    sources: 'Passes and sources',
    business: {
      buildings: 'For owners and insurers: see which buildings move with heat',
      ground: 'For owners and insurers: see which ground moves',
      event: 'For owners and insurers: see what changed on the ground',
    },
  },
  card: {
    because: 'Because',
    source: (n: number) => `Source (${n})`,
    sourceLine: (product: string, date: string, utc: string, track: number, direction: string) =>
      `NISAR ${product}, ${date}, ${utc} UTC, track ${track} ${direction}`,
    scene: (scene: string) => `Scene ${scene}`,
    backscatter: (metric: string, change: string, before: string, after: string) =>
      `${metric} backscatter ${change}, from ${before} to ${after}`,
    coherence: (usual: string, now: string) => `Coherence ${usual} usually, ${now} in this pair`,
    throughClouds: 'See it through clouds',
    next: 'Next change',
    back: 'Back to all changes',
    early: 'Early (BETA) data',
    estimate: 'Estimate',
  },
  change: {
    forest: {
      title: 'Forest gone',
      sentence: (area: string) => `Trees stopped bouncing the radar back here: ${area} gone.`,
      sentenceClouds: (area: string) =>
        `Through clouds: trees stopped bouncing the radar back here, ${area} gone.`,
      look: (area: string) => `${area} of forest is gone here.`,
      because: (n: number) =>
        `Standing trees bounce the radar back, bare ground does not. Here the bounce dropped sharply and stayed low on all ${n} ${plural(n, 'visit', 'visits')} since.`,
      notClaimed: 'Cutting or storm damage; we see the trees are gone, not why.',
    },
    frost: {
      title: 'Forest froze',
      cardTitle: (date: string, when: string) =>
        `${date}, ${when}: the forest froze, the town did not.`,
      beforeDawn: 'before dawn',
      afterDusk: 'after dusk',
      sentence: 'The forest dimmed, the town did not. Frozen, not cut.',
      because: (view: string) =>
        `Frozen wood bounces the radar back weakly, so the forest dimmed over ${view} while buildings stayed the same.`,
      air: (temperature: string) => `Air was about ${temperature} (NASA POWER estimate).`,
      notCut: 'Frozen, not cut.',
      notClaimed: 'Harm to the trees; we see the wood froze, nothing more.',
    },
    fields: {
      title: 'Fields changed',
      sentence: (area: string) =>
        `Fields bounced the radar differently: ${area}, as when crops come off.`,
      cardSentence: (area: string, from: string, to: string) =>
        `${area} of fields changed here between ${from} and ${to}.`,
      because: (to: string) =>
        `The fields bounced the radar back differently after ${to}, as happens when a crop comes off.`,
      confirmed: 'The next visit showed the same.',
      once: 'Seen once.',
      notClaimed: 'A harvest or ploughing; we see the fields changed, not what was done.',
    },
    rework: {
      title: 'Ground reworked',
      sentence: (area: string) =>
        `${area} of ground here stopped matching its usual radar pattern.`,
      look: (area: string) => `${area} of ground was reworked here.`,
      because: (from: string, to: string) =>
        `Between ${from} and ${to} this ground stopped matching its usual radar pattern. Digging, paving or building do that; radar cannot tell which.`,
      notClaimed: 'Who did it or why; we see the ground change, not the work.',
    },
    water: {
      title: 'More water',
      sentence: (area: string) => `The ground turned dark like calm water: ${area} of new water.`,
      look: (area: string) => `${area} of new water here.`,
      because:
        'Calm water mirrors the radar away, so it looks dark. Here the ground turned dark like water.',
      notClaimed: 'A flood or a new pond; we see more water, not why.',
    },
    heat: {
      title: { building: 'Building', bridge: 'Bridge', levee: 'Embankment' },
      noun: { building: 'building', bridge: 'bridge', levee: 'embankment' },
      headline: (noun: string, lo: string, hi: string) =>
        `Warm days move this ${noun} ${lo}\u00a0to\u00a0${hi}.`,
      headlineAbout: (noun: string, hi: string) => `Warm days move this ${noun} about ${hi}.`,
      range: (lo: string, hi: string) => `${lo}\u00a0to\u00a0${hi}`,
      about: (mm: string) => `about ${mm}`,
      because: (spread: string, moved: string) =>
        `Across the ${spread} range of evening air temperatures it moves ${moved} towards the satellite. No patch of open ground nearby moved with heat this clearly.`,
      metaEvening: (k: string, err: string, n: number) =>
        `Evening orbit: ${k} ± ${err} mm per °C over ${n} ${plural(n, 'pass', 'passes')}.`,
      metaDawn: 'The dawn orbit rests on one warm morning, so we do not use it.',
      metaLine: "Along the radar's line of sight; one orbit cannot tell up from sideways.",
      metaAir: 'Air temperature: NASA POWER estimate.',
      notClaimed: 'Damage; steel and concrete grow a little when warm.',
    },
  },
  confidence: { high: 'clear', medium: 'likely', low: 'possible' },
  where: {
    centre: 'in the town centre',
    away: (distance: string, toward: string) => `${distance} ${toward} of the centre`,
    compass: {
      north: 'north',
      'north-east': 'north-east',
      east: 'east',
      'south-east': 'south-east',
      south: 'south',
      'south-west': 'south-west',
      west: 'west',
      'north-west': 'north-west',
    },
    awayShort: (distance: string, toward: string) => `${distance} ${toward}`,
    compassShort: {
      north: 'N',
      'north-east': 'NE',
      east: 'E',
      'south-east': 'SE',
      south: 'S',
      'south-west': 'SW',
      west: 'W',
      'north-west': 'NW',
    },
    view: {
      part: 'part of the view',
      half: 'about half of the view',
      most: 'most of the view',
      all: 'the whole view',
    },
  },
  nextLook: {
    label: 'Next look:',
    when: (day: string, time: string) => `${day}, ${time}.`,
    whenEstimated: (day: string, time: string) => `${day}, ${time} (estimated).`,
    picture: (date: string) => `Picture expected by about ${date}.`,
    hint: (days: number) =>
      `Estimated from the ${days}-day orbit. Pictures arrive 1-2 weeks after the pass.`,
    hintScheduled: 'Pictures arrive 1-2 weeks after the pass.',
  },
  panel: {
    play: 'Play the year',
    pause: 'Pause',
    resume: 'Resume',
    close: 'Close',
    fogMore: 'Coming soon: add this square as your place.',
  },
  recap: {
    forest: (n: number) => `${n} ${plural(n, 'patch', 'patches')} of forest gone`,
    fields: (n: number) => `${n} ${plural(n, 'field change', 'field changes')}`,
    rework: (n: number) => `${n} ${plural(n, 'ground rework', 'ground reworks')}`,
    frostMorning: (n: number) => `${n} frozen ${plural(n, 'morning', 'mornings')}`,
    frostEvening: (n: number) => `${n} frozen ${plural(n, 'evening', 'evenings')}`,
    water: (n: number) => `${n} ${plural(n, 'patch', 'patches')} of new water`,
    reports: (n: number) =>
      `Following this place, you would have had ${n} ${plural(n, 'report', 'reports')} this year, ${plural(n, 'with', 'each with')} a reason.`,
    clouds: (cloudy: number, days: number) =>
      `On ${cloudy} of ${days} pass days clouds spoiled ordinary satellite photos. The radar saw the ground every time.`,
    business: 'See which buildings move with heat',
    again: 'Play again',
  },
  sentence: {
    orbit: 'Keep an eye on the places you love.',
    nudge: (place: string) => `Click ${place} to start.`,
    rest: (place: string, n: number) =>
      `This year at ${place}: ${n} ${plural(n, 'change', 'changes')} seen by radar.`,
    gap: (from: string, to: string) => `No public NISAR data from ${from} to ${to}.`,
    quiet: 'All quiet.',
    fog: 'Not analysed yet. NISAR passes here too.',
    quietSpot: (n: number) =>
      `No change kept here this year. The radar looked ${n} ${plural(n, 'time', 'times')}.`,
    unanalysed: 'Not analysed for changes yet.',
    sharpen: (n: number) =>
      `${n} ${plural(n, 'visit', 'visits')} laid on top of each other: the grain fades.`,
    clouds: (pct: number) =>
      `Left: an ordinary satellite photo that day, ${pct}% cloud (estimated).`,
  },
  inset: {
    header: (place: string, date: string) => `New at ${place}, ${date}`,
    headerSpan: (place: string, from: string, to: string) => `Seen at ${place}, ${from} to ${to}`,
    counter: (n: number, total: number) => `${n} of ${total}`,
    facts: (where: string, confidence: string) => `${where}, ${confidence}`,
    open: (header: string, sentence: string, facts: string) =>
      `${header}. ${sentence} ${facts}. Open the details.`,
    teaser: 'For business: a building that moves with heat',
  },
  tile: {
    legendFalse:
      'False colour radar: R HH, G HV, B HH/HV. Green = trees, blue and violet = bare or smooth ground.',
    legendCoherence: 'Bright: the ground stopped matching its usual pattern.',
    legendFrost: 'White: where the frost dimmed the radar.',
    magnified: (pixel: string) => `NISAR radar, ${pixel} pixels, magnified.`,
    wholeView: (pixel: string) => `NISAR radar, the whole watched area, ${pixel} pixels.`,
    radarOnly: 'NISAR radar.',
    changeMap: (product: string, pixel: string) => `Change map: NISAR ${product}, ${pixel} pixels.`,
    changeMapOnly: 'Change map: NISAR.',
    pairs: 'NISAR radar, pairs of visits, magnified.',
    clouds: 'Ordinary satellite photo: NASA GIBS. Radar: NISAR. Both magnified.',
    chartFine:
      'Evening passes only; zero on the coldest evening. Air temperature: NASA POWER estimate.',
    chartAir: 'Air temperature',
    chartMove: (noun: string) => `${noun}, mm towards the satellite`,
    chartPass: (date: string, temperature: string) => `${date}, ${temperature}`,
    chartAlt: (noun: string, from: string, to: string) =>
      `Air temperature and how the ${noun} moved at each evening pass, ${from} to ${to}.`,
    span: (from: string, to: string) => `${from} to ${to}`,
    photo: (date: string, pct: number) => `Photo, ${date}, about ${pct}% cloud in the view`,
    radar: (date: string) => `Radar, ${date}`,
    alt: (before: string, after: string) => `Before: ${before}. After: ${after}.`,
    pause: 'Stop switching between before and after.',
    resume: 'Switch between before and after again.',
    paused: 'Paused',
    failed: 'This image could not be loaded.',
  },
  timeline: {
    label: 'NISAR radar visits',
    waiting: 'The timeline starts when you open a place.',
    gap: 'No public data',
    gapDates: (from: string, to: string) => `${from} to ${to}`,
  },
  map: {
    frameLabel: (width: string, height: string, pixel: string) =>
      `Watched area · ${width} x ${height} km · NISAR radar, ${pixel} m pixels`,
    placeChanges: (place: string, n: number) =>
      `${place}. ${n} ${plural(n, 'change', 'changes')} this year`,
    startHere: 'Start here',
    openPlace: (place: string) => `Open ${place}`,
    pinLabel: (title: string, facts: string) => `${title}, ${facts}`,
    plate: {
      frame: (level: string, date: string, utc: string, track: number, direction: string) =>
        `NISAR L-band ${level}, ${date}, ${utc} UTC, track ${track} ${direction}`,
      pixel: (metres: number) => `${metres} m`,
      pixelShown: (metres: number, shown: number) => `${metres} m data shown at ${shown} m`,
      ascending: 'ascending',
      descending: 'descending',
      falseColour: 'false colour: R HH, G HV, B HH/HV',
      frostMask: 'white: where the frost dimmed the radar',
      partial: 'radar covers part of this square',
      ground: (
        product: string,
        track: number,
        direction: string,
        from: string,
        to: string,
        metres: number,
      ) =>
        `ground motion: NISAR ${product}, track ${track} ${direction}, ${from} to ${to}, ${metres} m`,
      place:
        'NISAR data: NASA, ISRO, ASF DAAC. Basemap: OpenFreeMap © OpenMapTiles © OpenStreetMap contributors.',
      business:
        'NISAR data: NASA, ISRO, ASF DAAC. Temperature: NASA POWER. Buildings: © OpenStreetMap contributors. Basemap: OpenFreeMap © OpenMapTiles.',
      businessGround:
        'NISAR data: NASA, ISRO, ASF DAAC. District boundary: © OpenStreetMap contributors. Basemap: OpenFreeMap © OpenMapTiles.',
      change: (product: string, from: string, to: string) =>
        `change map: NISAR ${product}, ${from} to ${to}`,
      track: (track: number, direction: string) => `track ${track} ${direction}`,
      globe:
        'NISAR data: NASA, ISRO, ASF DAAC. Orbit: CelesTrak. Lights: NASA Black Marble. Map: OpenFreeMap © OpenMapTiles © OpenStreetMap contributors.',
    },
  },
  business: {
    question: 'Which of your buildings move with heat?',
    early: (passes: number, months: number) =>
      `${passes} ${plural(passes, 'pass', 'passes')} per orbit, ${months} ${plural(months, 'month', 'months')}: early result.`,
    sentence: (n: number, total: number) =>
      `${n} of ${total} structures ${plural(n, 'moves', 'move')} clearly with heat so far.`,
    unchecked: 'Building motion measured, not yet checked against open ground.',
    alone: {
      all: 'One by one, all are within ground noise.',
      most: 'One by one, almost all are within ground noise.',
      some: (k: number, m: number) =>
        `One by one, ${k} of ${m} ${plural(k, 'is', 'are')} within ground noise.`,
    },
    season: 'Too early to tell heat from season.',
    empty: 'No building series here yet.',
    play: (date: string, temperature: string) => `${date}, ${temperature} at the evening pass`,
    beforeSeries: (date: string) => `No building series before ${date}.`,
    keyClear: 'Moves clearly with heat',
    keyColour: {
      towards: 'Blue: moves towards the satellite when warm.',
      away: 'Red: moves away from the satellite when warm.',
      both: 'Blue: towards the satellite when warm; red: away.',
    },
    exaggeration: (times: string) =>
      `Height drawn ${times}x larger; motion is along the radar's line of sight.`,
    heightsBefore: (date: string) => `Blocks stand at their base height until ${date}.`,
    heightsPlate: (track: number, direction: string, date: string, utc: string) =>
      `heights: estimate, track ${track} ${direction}, ${date}, ${utc} UTC`,
    status: {
      clear: 'Clear: no patch of open ground did this',
      borderline: 'Borderline: a few patches of open ground did this too',
      noise: 'Within ground noise so far',
    },
    label: (noun: string, area: string, where: string) => `${noun}, ${area}, ${where}`,
    buildingType: {
      industrial: 'Industrial building',
      retail: 'Retail building',
      school: 'School',
      hospital: 'Hospital',
      office: 'Office building',
      construction: 'Building under construction',
    },
    watchTag: 'Worth watching',
    watch: (slope: string) =>
      `Worth a look: on warm evenings it moved away from the satellite (${slope}). Open ground sometimes does this too, so it is a candidate, not an alarm.`,
    population: (n: number, m: number) =>
      `${n} of ${m} buildings ${plural(n, 'tends', 'tend')} to move towards the satellite on warm evenings.`,
    slope: (k: string, err: string) => `${k} ± ${err} mm per °C`,
    noEvening: 'No evening series for this structure yet.',
    errorsWidened: (factor: string) => `Errors widened ${factor}x after testing open ground.`,
    chart: (name: string) =>
      `Air temperature and motion towards the satellite at each pass: ${name}`,
    axisTemperature: 'Air temperature, °C',
    axisMm: 'Towards the satellite, mm, from the coldest pass',
    readout: (date: string, temperature: string, mm: string) => `${date}: ${temperature}, ${mm}`,
    plusMinus: (value: string, err: string) => `${value} ± ${err}`,
    table: { day: 'Pass day', temperature: 'Air temperature', mm: 'Towards the satellite' },
    source: (n: number) => `Source (${n} ${plural(n, 'pass', 'passes')})`,
    sourcePasses: (
      product: string,
      track: number,
      direction: string,
      from: string,
      to: string,
      utc: string,
    ) => `NISAR ${product}, track ${track} ${direction}, ${from} to ${to}, ${utc} UTC`,
    sourceFootprint: (osm: string) => `Footprint: OpenStreetMap ${osm}`,
    sourceCheck: (squares: string) => `Checked against ${squares} patches of open ground`,
    more: (n: number) => `${n} more`,
    fewer: 'Show fewer',
    ground: {
      question: 'Is the ground under your buildings moving?',
      headline: (district: string, cm: string, days: number) =>
        `${district} moved ${cm} away from the radar in ${days} ${plural(days, 'day', 'days')}.`,
      facts: (district: string, from: string, to: string, confidence: string) =>
        `${district}, ${from} to ${to}, ${confidence}`,
      because: (pairs: number, steady: number, repeatDays: number, hills: number, within: string) =>
        `${pairs} NISAR ${plural(pairs, 'pair', 'pairs')} in a row, ${steady} of them ${repeatDays} days apart. ${hills} rock and lava ${plural(hills, 'hill', 'hills')} ended within ${within} of where they started.`,
      spread: (lo: string, hi: string) =>
        `Median of the district; most of it moved ${lo} to ${hi}.`,
      lineOfSight: (reference: string) =>
        `Along the radar's line of sight, relative to ${reference}.`,
      pixels: (metres: number) => `${metres} m pixels: districts, not buildings.`,
      atmosphere: 'No correction for the atmosphere yet.',
      notClaimed: 'We see the ground move, not why.',
      why: 'For owners and insurers: ground that keeps moving is worth a closer look.',
      key: (cm: string) =>
        `Map: red moved away from the radar, blue towards it; strongest colour at ${cm}.`,
      chart: (district: string) =>
        `How far ${district} and firm ground moved along the radar's line of sight at each pass`,
      axis: 'Towards the radar, cm, from the first pass',
      centre: (district: string) => `${district} centre`,
      firm: (hills: number) => `Firm ground, ${hills} ${plural(hills, 'hill', 'hills')}`,
      readout: (date: string, centre: string, firm: string) =>
        `${date}: centre ${centre}, firm ground ${firm}`,
      source: (pairs: number) => `Source (${pairs} ${plural(pairs, 'pair', 'pairs')})`,
      sourceLine: (
        product: string,
        track: number,
        direction: string,
        from: string,
        to: string,
        utc: string,
      ) => `NISAR ${product}, track ${track} ${direction}, ${from} to ${to}, ${utc} UTC`,
      sourceDistrict: (osm: string) => `District boundary: OpenStreetMap ${osm}`,
    },
    event: {
      question: 'What changed on the ground here?',
      why: {
        ground: 'For owners and insurers: ground that sank this much is worth a closer look.',
        volcano:
          'For owners and insurers: it maps where fresh deposits most likely lie, a record to check land against.',
        quake:
          'For owners and insurers: it shows how far the coast moved in the earthquakes, a record to check property against.',
        flood:
          'For owners and insurers: it maps land that most likely went under open water, a record to compare with insured sites.',
        other: 'For owners and insurers: a radar record of the change, to check property against.',
      },
      delay: 'NISAR pictures arrive 1-2 weeks after a pass, so this is a record, not a warning.',
    },
  },
  tools: {
    sharpenTitle: 'Sharpen the picture',
    onePass: (date: string) => `1 pass, ${date}`,
    averaged: (n: number) => plural(n, `${n} pass`, `${n} passes averaged`),
    averagedWords: (n: number) => plural(n, 'pass', 'passes averaged'),
    slider: 'Passes averaged',
    finePrint: 'Fields and roads stand out. Things that changed in between blur.',
    stackPlate: (n: number, part: string, track: number, from: string, to: string) =>
      n === 1
        ? `1 ${part} pass, track ${track}, ${from}`
        : `Average of ${n} ${part} passes, track ${track}, ${from} to ${to}`,
    part: { dawn: 'dawn', evening: 'evening' },
    loading: 'Loading the radar passes',
    loadError: 'The radar passes could not be loaded. Close and try again.',
    radarAttribution: 'NISAR data: NASA, ISRO, ASF DAAC.',
    cloudsTitle: 'See it through clouds',
    cloudsPhoto: (date: string, pct: number) =>
      `Ordinary satellite photo, ${date}, ${pct}% cloud (estimated)`,
    cloudsRadar: (date: string) => `NISAR radar, ${date}`,
    cloudsSplit: 'Move the line between the photo and the radar',
    cloudsSplitValue: (pct: number) => `${pct}% photo`,
    radarSource: (date: string, utc: string, track: number, direction: string, metres: number) =>
      `NISAR L-band GCOV, ${date}, ${utc} UTC, track ${track} ${direction}, ${metres} m`,
    photoSource: (source: string) => `Photo: ${source}; cloud share estimated`,
    direction: { ASCENDING: 'ascending', DESCENDING: 'descending' },
    cloudsAttribution: 'NISAR data: NASA, ISRO, ASF DAAC. Photo: NASA GIBS.',
  },
  satellite: {
    name: 'NISAR, the NASA and ISRO radar satellite, on its real path.',
    scale: (speedup: number) => `Shown ${speedup}x faster, drawn much bigger than it is.`,
    scaleStill: 'Drawn much bigger than it is.',
  },
  told: {
    range: (low: string, high: string) => `${low} to ${high}`,
    span: (low: string, high: string) => `${low}-${high}`,
    about: (value: string) => `about ${value}`,
    keyRange: (key: string, range: string) => `${key} (range ${range})`,
    estimate: 'estimate',
    centre: 'in the middle of the view',
    show: 'Show the change',
    next: 'Next change',
    caveatsTitle: 'Caveats',
    measured: (
      product: string,
      pairs: number,
      track: number,
      direction: string,
      from: string,
      to: string,
      utc: string,
    ) =>
      `Measured: NISAR ${product}${pairs > 1 ? `, ${pairs} pairs` : ''}, track ${track} ${direction}, ${from} to ${to}, ${utc} UTC`,
    image: (line: string) => `Image: ${line}`,
    builtFrom: (n: number) => `Built from ${n} NISAR ${plural(n, 'product', 'products')}:`,
    recapLine: (title: string, key: string, trust: string) => `${title}: ${key}, ${trust}`,
    chartAlt: (from: string, to: string) =>
      `How the ground moved at each radar visit, ${from} to ${to}.`,
    chartUnit: (unit: string) => `${unit}, from the first visit`,
    tableDay: 'Radar visit',
    counts: {
      days: (n: number) => plural(n, 'day', 'days'),
      pairs: (n: number) => plural(n, 'pair', 'pairs'),
      hills: (n: number) => plural(n, 'hill', 'hills'),
    },
    caveats: {
      line_of_sight: 'Measured along the radar line of sight',
      relative_to_reference: 'Relative to a reference spot',
      relative_to_central_caracas: 'Relative to central Caracas',
      no_atmosphere_correction: 'Not corrected for the atmosphere',
      no_ionosphere_correction: 'Not corrected for the ionosphere',
      ionosphere_layer_not_applied: 'Range: with and without the ionosphere correction',
      estimate: 'Includes an estimate',
      provisional_products: 'Provisional NISAR products',
      beta_pass: 'Early (BETA) data',
      single_pass: 'One look after the change only',
      area_depends_on_threshold: 'Area depends on the chosen threshold',
      north_south_motion_zero: 'Assumes no north-south motion',
      same_motion_in_both_pairs: 'Assumes the same motion in both pairs',
      east_west_from_two_orbits: 'East-west motion combined from two orbits',
      different_spans: 'The two orbits span different days',
      forest_decorrelation: 'Forest blurs the signal',
      unwrapping_cycles: 'Whole fringe cycles may be miscounted',
      few_pixels: 'Few pixels',
      radar_brightness_shift: 'Radar brightness shifted',
      flooded_vegetation_not_counted: 'Water under plants not counted',
      irrigation_not_separated: 'Irrigation not told apart from flooding',
      rising_pass_land_darker: 'Land looks darker on this pass',
      flood_after_5_jan: (t: ToldValues) => `The flood came after the look on ${t.from}`,
    },
    caveatOther: (code: string) => code.replaceAll('_', ' '),
    attribution: {
      district: 'District boundary: © OpenStreetMap contributors (ODbL).',
      volcano:
        'Eruption: NASA Earth Observatory. Volcano positions: Smithsonian Global Volcanism Program.',
      quake: 'Earthquake times: USGS earthquake catalog.',
      flood: 'Flood: NASA Earth Observatory, NASA Scientific Visualization Studio.',
    },
    chapter: {
      mexicoGround: {
        title: 'Ground moving in Nezahualcóyotl',
        sentence: (t: ToldValues) =>
          `Nezahualcóyotl moved ${t.n('moved_away', 'cm')} away from the radar in ${t.n('days', 'days')}.`,
        because: (t: ToldValues) =>
          `${t.v('pairs', 'pairs')} NISAR pairs in a row, ${t.v('pairs_12_days', 'pairs')} of them ${t.repeatDays} days apart, relative to Lomas de Chapultepec; ${t.v('firm_hills', 'hills')} rock and lava hills ended within ${t.cmUp('firm_hills_max_abs', 'mm')} of where they started. If all of it is vertical, that is about ${t.n('sinking_if_vertical', 'cm')} of sinking (estimate).`,
        businessBecause: null,
        notClaimed: 'We make no claim about single buildings or the cause.',
        legend: () => 'Red: moved away from the radar. Blue: moved towards it.',
        series: (t: ToldValues) => [
          'Nezahualcóyotl centre',
          `Firm ground, median of ${t.v('firm_hills', 'hills')} rock and lava hills`,
        ],
      },
      hayliStain: {
        title: 'Dark stain at Hayli Gubbi',
        sentence: (t: ToldValues) =>
          `Radar shows a dark stain of ${t.n('darkened_area', 'km2')}, most likely fresh deposits.`,
        because: (t: ToldValues) =>
          `On both NISAR orbits that ground turned about ${t.n('darkening', 'dB')} darker, while the pairs before the eruption showed no such darkening (${t.n('control_area', 'km2')}).`,
        businessBecause: (t: ToldValues) =>
          `After the eruption that ground turned about ${t.n('darkening', 'dB')} darker on the radar, while the same test on the pairs before it found ${t.n('control_area', 'km2')} of darkened ground.`,
        notClaimed: 'We make no claim about depth or volume, the exact day, people or buildings.',
        legend: () => 'Pink: the radar echo got darker. Green: brighter.',
        series: () => [],
      },
      ertaAleSinking: {
        title: 'Erta Ale summit area sank',
        sentence: (t: ToldValues) =>
          `The summit area of Erta Ale sank by up to ${t.n('sinking', 'cm')}.`,
        because: (t: ToldValues) =>
          `Both NISAR orbits saw it move up to ${t.v('los_away_165d', 'cm')} and ${t.n('los_away_172a', 'cm')} away from the radar, against about ${t.n('control_motion', 'cm')} in the pairs before the eruption. The sinking combines both views and assumes no north-south motion (estimate).`,
        businessBecause: (t: ToldValues) =>
          `It moved up to ${t.v('los_away_165d', 'cm')} and ${t.n('los_away_172a', 'cm')} away from the radar in the two views, against about ${t.n('control_motion', 'cm')} before the eruption. The sinking is worked out from both views and assumes no north-south motion (estimate).`,
        notClaimed: 'We make no claim about the exact day, the cause, people or buildings.',
        legend: () =>
          'Colour fringes: each full cycle of colours is one more step of motion towards or away from the radar.',
        series: () => [],
      },
      coastWest: {
        title: 'Coast moved west in the earthquakes',
        sentence: (t: ToldValues) =>
          `The coast moved about ${t.v('coast_west_low', 'cm')}-${t.n('coast_west_high', 'cm')} west relative to central Caracas.`,
        because: (t: ToldValues) =>
          `Two NISAR orbits looking from opposite sides agree on the westward motion, while the pairs before the earthquakes kept the same spots within ${t.n('control_max', 'cm')}. The range covers La Guaira and Macuto with and without the product's correction for the ionosphere, the charged upper air that also disturbs the radar signal: the correction raises the values but has known flaws over water and forest.`,
        businessBecause: (t: ToldValues) =>
          `The westward motion is worked out from two NISAR orbits looking from opposite sides, while the pairs before the earthquakes kept the same spots within ${t.n('control_max', 'cm')}. The range covers La Guaira and Macuto with and without the product's ionosphere correction (estimate).`,
        notClaimed: 'We make no claim about building damage, people, landslides or fault slip.',
        legend: () => 'Red: moved away from the radar. Blue: moved towards it.',
        series: () => [],
      },
      chokweFlood: {
        title: 'Land newly under open water',
        sentence: (t: ToldValues) =>
          `About ${t.n('new_water', 'km2')} of land newly under open water.`,
        because: (t: ToldValues) =>
          `The radar echo there fell from ${t.n('hh_before', 'dB')} to ${t.n('hh_after', 'dB')}, as dark as open water, and the HV channel agrees (${t.n('new_water_hv', 'km2')}). The same rule on two looks before the flood finds only ${t.n('control_new_water', 'km2')}.`,
        businessBecause: null,
        notClaimed:
          'We make no claim about people, damage, water depth, the cause or ground motion.',
        legend: () => 'Blue: land newly under open water.',
        series: () => [],
      },
    },
    summary: {
      mexico: {
        short: (t: ToldValues) =>
          `Nezahualcóyotl moved ${t.n('moved_away', 'cm')} away from the radar in ${t.n('days', 'days')}.`,
        long: (t: ToldValues) =>
          `Nezahualcóyotl moved ${t.n('moved_away', 'cm')} away from the radar in ${t.n('days', 'days')}, while ${t.v('firm_hills', 'hills')} rock and lava hills ended within ${t.cmUp('firm_hills_max_abs', 'mm')} of where they started.`,
      },
      hayliGubbi: {
        short: (t: ToldValues) =>
          `A dark stain of ${t.n('darkened_area', 'km2')} at Hayli Gubbi after its eruption.`,
        long: (t: ToldValues) =>
          `NISAR shows a dark stain of ${t.n('darkened_area', 'km2')} at Hayli Gubbi after its eruption, and Erta Ale's summit area sinking up to ${t.n('sinking', 'cm')} (estimate).`,
      },
      venezuela: {
        short: (t: ToldValues) =>
          `The coast moved about ${t.v('coast_west_low', 'cm')}-${t.n('coast_west_high', 'cm')} west relative to central Caracas.`,
        long: (t: ToldValues) =>
          `NISAR shows the coast at La Guaira and Macuto moved about ${t.v('coast_west_low', 'cm')}-${t.n('coast_west_high', 'cm')} west relative to central Caracas in the earthquakes of ${t.toMonth}.`,
      },
      mozambique: {
        short: (t: ToldValues) =>
          `About ${t.n('new_water', 'km2')} of land newly under open water on ${t.after}.`,
        long: (t: ToldValues) =>
          `NISAR radar shows about ${t.n('new_water', 'km2')} of land newly under open water on ${t.afterYear}, compared with ${t.beforeYear}.`,
      },
    },
  },
  units: {
    db: 'dB',
    m: 'm',
    mm: 'mm',
    cm: 'cm',
    km2: 'km²',
    ha: 'ha',
    km: 'km',
    celsius: '°C',
  },
} as const

export type Dictionary = typeof EN
