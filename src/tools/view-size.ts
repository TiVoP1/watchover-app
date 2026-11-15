import { useEffect, useState } from 'react'
import type { Size } from '#web/tools/sharpen.ts'

export function useViewSize(): readonly [(element: HTMLElement | null) => void, Size | null] {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState<Size | null>(null)
  useEffect(() => {
    if (element === null) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element])
  return [setElement, size]
}
