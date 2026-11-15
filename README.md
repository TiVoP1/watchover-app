# Watchover: app excerpt

Keep an eye on the places you love. From orbit.

Watchover shows what changed in the places you care about each time NISAR, the NASA and ISRO radar satellite, passes over them, through clouds and at night. Built by team Pikachu Space Agency for the 2026 NASA Space Apps Challenge ("Dancing with the SARs", Stalowa Wola, 14-15 November 2026).

- Live app: https://watchover.pl
- Video (29 s): https://www.youtube.com/watch?v=2YSIORVTzYM

## What this repository is

An excerpt of the web app (React, TypeScript, MapLibre) with its tests and a small JSON demo dataset for its five places. The NISAR data pipeline and the radar images stay private; the full app runs at https://watchover.pl. Code and data files are copied unchanged from commit `de4e7ea` of the private repository.

## Run it

Requires pnpm 10.28.2 (it downloads Node.js 24.21.0 by itself).

```sh
pnpm install
pnpm test
pnpm dev      # http://localhost:5180
```

## Licence

MIT (`LICENSE`); third-party notices in `THIRD-PARTY-NOTICES.md`. Data sources, libraries and AI use are listed in `SOURCES.md` (code drafted with Claude Code, film audio generated with ElevenLabs).
