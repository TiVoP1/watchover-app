import { GroundChart } from '#web/business/ground-chart.tsx'
import {
  type GroundExample,
  groundBecause,
  groundFacts,
  groundKey,
  groundMeta,
  groundSource,
} from '#web/business/ground.ts'
import { EN } from '#web/i18n/en.ts'
import { Disclosure } from '#web/panel/disclosure.tsx'

export interface GroundViewProps {
  readonly example: GroundExample
  readonly timeZone: string
}

function RampKey({ example }: { readonly example: GroundExample }) {
  return (
    <div className="mt-3">
      <div className="flex h-2.5 w-48 overflow-hidden rounded-sm" aria-hidden>
        {example.ground.map.ramp.map(([cm, colour]) => (
          <span key={cm} className="flex-1" style={{ backgroundColor: colour }} />
        ))}
      </div>
      <p className="mt-1 text-meta text-text-3">{groundKey(example)}</p>
    </div>
  )
}

function Source({ example }: { readonly example: GroundExample }) {
  const source = groundSource(example)
  if (source === null) return null
  return (
    <div className="border-t border-line">
      <Disclosure summary={EN.business.ground.source(example.pairs)}>
        <div className="space-y-1 text-meta text-text-3">
          <p className="tnum">{source.line}</p>
          <ul className="break-all">
            {source.scenes.map((scene) => (
              <li key={scene}>{scene}</li>
            ))}
          </ul>
          <p>{source.district}</p>
        </div>
      </Disclosure>
    </div>
  )
}

export function GroundView({ example, timeZone }: GroundViewProps) {
  return (
    <>
      <div className="px-4 pt-4 pb-4">
        <h2 className="text-card font-semibold">{EN.business.ground.question}</h2>
        <p className="mt-1 text-meta text-text-3">{groundFacts(example, timeZone)}</p>
        <RampKey example={example} />
        <div className="mt-4">
          <GroundChart example={example} timeZone={timeZone} />
        </div>
        <p className="mt-2 text-meta text-text-3">{EN.card.because}</p>
        <p className="text-body text-text">{groundBecause(example)}</p>
        <p className="mt-2 text-meta text-text-3">{groundMeta(example)}</p>
        <p className="mt-3 text-body text-text-2">{EN.business.ground.why}</p>
      </div>
      <Source example={example} />
    </>
  )
}
