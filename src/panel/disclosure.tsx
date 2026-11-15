import type { ReactNode } from 'react'
import { Icon } from '#web/ui/icon.tsx'

interface DisclosureProps {
  readonly summary: string
  readonly flush?: boolean
  readonly children: ReactNode
}

export function Disclosure({ summary, flush = false, children }: DisclosureProps) {
  return (
    <details className="group border-b border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-body text-text-2 hover:text-text">
        <Icon name="caret-right" size={16} className="shrink-0 group-open:rotate-90" />
        {summary}
      </summary>
      <div className={flush ? 'pb-2' : 'px-4 pb-4'}>{children}</div>
    </details>
  )
}
