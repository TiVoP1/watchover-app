import { useEffect, useState } from 'react'
import { loadStory } from '#web/data/load.ts'
import { PLACES } from '#web/places.ts'
import { toldCount } from '#web/story/place-story.ts'

const counts = new Map<string, Promise<number | null>>()

function countOf(slug: string): Promise<number | null> {
  const known = counts.get(slug)
  if (known !== undefined) return known
  const loaded = loadStory(slug).then(
    (story) => (story === null ? null : toldCount(slug, story)),
    () => null,
  )
  counts.set(slug, loaded)
  return loaded
}

export function usePlaceCounts(): ReadonlyMap<string, number> {
  const [found, setFound] = useState<ReadonlyMap<string, number>>(new Map())
  useEffect(() => {
    let live = true
    for (const { slug } of PLACES.filter((p) => p.files.includes('story.json'))) {
      void countOf(slug).then((count) => {
        if (live && count !== null) setFound((previous) => new Map(previous).set(slug, count))
      })
    }
    return () => {
      live = false
    }
  }, [])
  return found
}
