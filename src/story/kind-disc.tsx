import { type ChangeKind, KIND_STYLE } from '#web/story/kinds.ts'
import { Icon } from '#web/ui/icon.tsx'

export function KindDisc({ kind }: { readonly kind: ChangeKind }) {
  const style = KIND_STYLE[kind]
  return (
    <span
      className={`flex size-6 shrink-0 items-center justify-center rounded-full border border-ink ${style.disc}`}
    >
      <Icon name={style.icon} size={14} />
    </span>
  )
}
