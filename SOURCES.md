# Watchover: sources, libraries and AI use

The full list behind the app excerpt in this repository and the Watchover product, as required by the NASA Space Apps rules. Licence notices of bundled third-party files are in `THIRD-PARTY-NOTICES.md`.

## Data sources

| Source | What we use | Licence and attribution |
|---|---|---|
| NISAR (NASA-ISRO), archived by the Alaska Satellite Facility DAAC | L2 GCOV radar backscatter, GSLC, GUNW interferograms, L3 SME2 soil moisture, browse images and the product search API; in this excerpt the product lists (`catalog.json`) and every number in the JSON files | NASA open data policy; "NISAR data: NASA, ISRO, ASF DAAC" |
| NISAR L3 SME2 soil moisture (NASA-ISRO, ASF DAAC) | `soilMoisture`, `retrievalQualityFlag` and the per-algorithm `algorithmCandidates/{DSG,PMI,TSR}/soilMoisture` layers of 43 passes over Stalowa Wola (October 2025 to October 2026), cut around the place, and the attribute text of `retrievalQualityFlag` read from one P05023 granule: per-pass values, flag layout checks, algorithm mixes and method breaks (not in this excerpt) | NASA open data policy; "NISAR data: NASA, ISRO, ASF DAAC" |
| NASA GIBS | VIIRS Corrected Reflectance true colour (cloud cover on pass days, `stalowa-wola/clouds.json`; the images are not in this excerpt) | NASA open data policy; "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." |
| NASA Black Marble (VIIRS night lights, 2016 composite), through NASA GIBS | night lights of the globe the map opens on: one 4096 × 2048 image in EPSG:4326, `public/data/world/night-world.webp`, with its GIBS request in `night.json`; the app reprojects it to Web Mercator and draws it in grey below zoom 5.5 | NASA open data policy; the GIBS acknowledgement above |
| NASA HLS S30 (Harmonized Landsat and Sentinel-2) through NASA GIBS | true colour of the layer `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` (HLS Sentinel-2 MSI surface reflectance, 30 m, version 2.0) over the Stalowa Wola radar window on 1 July and 25 September 2025 and 28 April, 3 May and 1 August 2026, for the optical check of the felling strips and two images with the strip outlines (not in this excerpt) | NASA open data policy; the GIBS acknowledgement above; HLS: Masek et al., NASA EOSDIS Land Processes DAAC, doi:10.5067/HLS/HLSS30.002; "Contains modified Copernicus Sentinel-2 data" (images of 2025 and 2026) |
| NASA GEDI L4A Footprint Level Aboveground Biomass Density, Version 3 (CMR short name GEDI_L4A_AGB_Density_V3_2508, granules GEDI04_A, V003), archived by the ORNL DAAC | above-ground biomass density (`agbd`), the quality flags `l4a_quality_flag_rel3` and `degrade_flag`, the shot time and the lowest-mode position of the footprints over the Stalowa Wola window in the 2022 to 2025 granules (CMR collection C4212593885-ORNL_CLOUD), read through NASA OPeNDAP: 97 979 quality footprints over the window's bounding box, 91 318 of them from 71 granules on the radar grid (17 January 2022 to 17 May 2025), 125 inside the forest cuts; they weigh the stored CO2 lost in each cut (not in this excerpt) | NASA open data policy; cite as "Dubayah, R.O., J. Armston, J.R. Kellner, L. Duncanson, S.P. Healey, P.L. Patterson, S. Hancock, H. Tang, J.M. Bruening, M.A. Hofton, J.B. Blair, and S.B. Luthcke. 2026. GEDI L4A Footprint Level Aboveground Biomass Density, Version 3. ORNL DAAC, Oak Ridge, Tennessee, USA. https://doi.org/10.3334/ORNLDAAC/2508" |
| NASA POWER | hourly air temperature, precipitation and snow depth at each pass (`stalowa-wola/weather.json`), also the temperatures that structure motion is fitted against | "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division." |
| OpenStreetMap, through the Overpass API (overpass-api.de) | footprints of buildings, bridges and levees, also to keep the open-ground squares away from them (`stalowa-wola/insar/objects.json`, `objects.geojson`, `null_check.json`); the boundary of Nezahualcóyotl (relation 5606086) and of the Lago de Texcoco protected area (way 1070021021) for the district statistics in `mexico-city/ground.json`; the `waterway=river` lines around Langtang for the river corridors of that world event (not in this excerpt) | © OpenStreetMap contributors, Open Database License (ODbL) 1.0; our derived `insar/objects.json`, `insar/objects.geojson`, `insar/null_check.json`, `mexico-city/ground.json` and the Langtang `event.json` combine OSM geometry, names or way ids with our measurements and are available under ODbL 1.0 |
| OpenFreeMap (OpenMapTiles schema, OpenStreetMap data) | dark basemap style and its vector tiles; `scripts/fetch-basemap.mjs` saves an offline extract in `public/basemap/` (the style is in this repository, the tiles are not) | © OpenMapTiles © OpenStreetMap contributors; map data ODbL 1.0, the extract is a derivative database under ODbL 1.0 |
| CelesTrak GP data (celestrak.org) | the NISAR two-line element set (NORAD 65053, `NORAD/elements/gp.php?CATNR=65053&FORMAT=TLE`, epoch 14 Nov 2026) behind the 12-day ground track `public/film/orbit-track.bin`, `orbit.json` and the film's swath coverage map; `orbit.json` records the TLE, its epoch, the propagation model, the along-track timing shift fitted to 7 real GCOV frames and how far the predicted swath centre lands from each of their ASF footprints; the app's opening globe moves a drawn NISAR model along this track, sped up and labelled as such | orbital data from CelesTrak; the track is a propagation of public mean elements, not a NISAR product |
| Context for the world events, quoted and not measured: NASA Earth Observatory, NASA Scientific Visualization Studio, USGS earthquake catalog and Landslide Hazards Program, Smithsonian Global Volcanism Program, IRDR International, Himal Press | the `context` facts of each `event.json`; in `story.json` the Hayli Gubbi eruption (NASA Earth Observatory), the positions of Hayli Gubbi and Erta Ale that name the volcano nearest to a change (Global Volcanism Program) and the day of the Venezuela earthquakes (USGS), each named in `source_note` | each source named next to its fact; Global Volcanism Program, Smithsonian Institution |

Film scenes (rendered in the browser from code that is not in this excerpt; their assets are not in this repository either):

| Asset | Source | Licence and attribution |
|---|---|---|
| night lights of the world, Europe and Poland | NASA Black Marble 2016 (VIIRS_Black_Marble) through NASA GIBS | NASA open data policy; the GIBS acknowledgement above |
| clouds of the world, Europe and two closer views | VIIRS Corrected Reflectance true colour of 26 Oct 2026 from NOAA-20 (VIIRS_NOAA20_CorrectedReflectance_TrueColor) through NASA GIBS; the world image fills the gaps between NOAA-20 swaths from NOAA-21 and then Suomi NPP | NASA open data policy; the GIBS acknowledgement above |
| radar swath strip | HH channel of the NISAR L2 GCOV browse images of track 28 ascending, 26 Oct 2026, frames 21 to 28, placed on their ASF footprints | "NISAR data: NASA, ISRO, ASF DAAC" |
| 12-day coverage map (green channel) | MODIS Terra land and water mask (MODIS_Terra_L3_Land_Water_Mask, 2015) through NASA GIBS | NASA open data policy; the GIBS acknowledgement above |
| factory outline | footprint of OSM way 359317018 through the Overpass API | © OpenStreetMap contributors, ODbL 1.0 |

The NISAR satellite on the app's opening globe (`src/map/satellite-sprite.ts`) and in the film is a model drawn in code (`src/film/satellite.ts`) from public descriptions of the spacecraft, not to scale; it is not a NASA or ISRO image.

## Use of AI and external resources

Disclosed as required by the NASA Space Apps rules.

- **AI:** the team uses Claude (Anthropic) through Claude Code for research, code generation, documentation and review. The data pipeline, the web app and its scripts were drafted with it, including all the code and tests in this excerpt, and it helped draft the film script and the submission texts. ElevenLabs (paid plan) generated the narration voice (a voice from the ElevenLabs voice library, model eleven_multilingual_v2), the music (Eleven Music, music_v2_5) and the sound effects (eleven_text_to_sound_v3) of the demo film. OpenAI image generation was used only for concept sketches of the logo; no generated image is part of the app or this repository, and no AI-generated image or video appears in the app or the film. The logo and the favicon are SVG written as code with Claude Code. The team reviews every change and owns every technical decision.
- **Fonts, icons and colour maps:**

| Asset | License | Use |
|---|---|---|
| Fira Sans (400, 500, 600) and Fira Sans Condensed (500), © 2012-2015 The Mozilla Foundation and Telefonica S.A. | SIL Open Font License 1.1, see `public/fonts/OFL.txt` | interface type and map labels |
| Phosphor Icons 2.1.1 (`@phosphor-icons/core`) | MIT | interface icons |
| Scientific colour map berlin (Crameri 2018, doi:10.5281/zenodo.1243862) | MIT | colours for structure motion on the map (`src/tokens.ts`), for the Mexico City ground motion map and for the Venezuela line-of-sight maps |
| Scientific colour maps romaO and vanimo (Crameri 2018, doi:10.5281/zenodo.1243862), the 256-step tables of cmcrameri 1.10, kept with their licence in the private pipeline | MIT | romaO: the wrapped GUNW phase of the world events (one colour cycle per 2π); vanimo: the HH change maps of Hayli Gubbi and Langtang |

- **Basemap** (offline extract in `public/basemap/`, made by `scripts/fetch-basemap.mjs`):

| Resource | License | Use |
|---|---|---|
| OpenStreetMap data, © OpenStreetMap contributors | Open Database License (ODbL) 1.0; the extract is a derivative database under the same licence | water, rivers, roads, boundaries and town names |
| Natural Earth (naturalearthdata.com), inside the OpenMapTiles tiles at low zooms | public domain | water, rivers, roads and boundaries at the world and Europe zooms |
| OpenMapTiles vector tile schema, © OpenMapTiles | code BSD-3-Clause, schema design CC-BY 4.0 | tile layers and attributes |
| OpenFreeMap vector tiles (planet build of 1 Nov 2026) and its dark style, forked from OpenMapTiles Dark Matter | OpenFreeMap MIT; Dark Matter code BSD-3-Clause, design derived from CARTO basemaps (CC-BY 3.0) | tile source and base style, recoloured with the app tokens at runtime |

- **Web app libraries** (exact versions in `package.json`):

| Package | Version | License | Use |
|---|---|---|---|
| react, react-dom | 19.3.0 | MIT | user interface |
| zustand | 5.0.15 | MIT | shared state |
| maplibre-gl | 6.11.2 | BSD-3-Clause | map rendering |
| vite | 8.3.2 | MIT | build tool and dev server |
| @vitejs/plugin-react | 6.1.1 | MIT | React support in Vite |
| tailwindcss, @tailwindcss/vite | 4.3.3 | MIT | styling |
| typescript | 6.0.3 | Apache-2.0 | language and type checker |
| vitest | 4.1.11 | MIT | unit tests |
| @playwright/test | 1.63.0 | Apache-2.0 | headless browser for manual screenshot checks (no end-to-end tests in this repository) |
| eslint | 10.12.0 | MIT | linting |
| @eslint/js | 10.0.1 | MIT | lint rules |
| typescript-eslint | 8.71.0 | MIT | TypeScript lint rules |
| eslint-plugin-react-hooks | 7.1.1 | MIT | React hooks lint rules |
| prettier | 3.9.9 | MIT | formatting |
| @types/react, @types/react-dom | 19.3.0 | MIT | type definitions |
| @types/node | 24.19.1 | MIT | type definitions |
| @types/geojson | 7946.0.16 | MIT | type definitions |
| @phosphor-icons/core | 2.1.1 | MIT | icon source |

- **Toolchain:** Node.js 24.21.0 (downloaded by pnpm) and pnpm 10.28.2.
- **Private pipeline libraries** (Python 3.12, not in this repository):

| Package | License | Use |
|---|---|---|
| numpy, scipy | BSD-3-Clause | raster processing |
| h5py | BSD-3-Clause | reading NISAR HDF5 products |
| fsspec, aiohttp | BSD-3-Clause, Apache-2.0 | ranged HTTPS reads of remote products |
| requests, certifi | Apache-2.0, MPL-2.0 | ASF search API, Earthdata redirects, GIBS, POWER, Overpass and CelesTrak requests |
| pyproj | MIT | map projections |
| Pillow | MIT-CMU | image encoding |
| tzdata | Apache-2.0 | IANA time zone data for `zoneinfo` where the system has none (Windows) |

- **Film editing:** ffmpeg.
