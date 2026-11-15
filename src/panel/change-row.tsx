import { selectZone, useStore } from '#web/state/store.ts'
import type { StoryItem } from '#web/story/chapters.ts'
import { KindDisc } from '#web/story/kind-disc.tsx'
import { factsText, itemTitle } from '#web/story/story-text.ts'

interface ChangeRowProps {
  readonly item: StoryItem
  readonly current: boolean
  readonly latestPass: string
}

export function ChangeRow({ item, current, latestPass }: ChangeRowProps) {
  const openItem = useStore((s) => s.openItem)
  const zone = useStore(selectZone)
  return (
    <li className={`border-b border-line last:border-b-0 ${current ? 'bg-raised' : ''}`}>
      <button
        type="button"
        aria-current={current ? 'step' : undefined}
        onClick={() => {
          openItem(item.id)
        }}
        className="grid w-full grid-cols-[auto_1fr] gap-x-3 px-4 py-2.5 text-left hover:bg-raised"
      >
        <KindDisc kind={item.kind} />
        <span className="self-center text-body font-medium text-text">{itemTitle(item)}</span>
        <span className="col-start-2 tnum text-meta text-text-2">
          {factsText(item, zone, latestPass)}
        </span>
      </button>
    </li>
  )
}
