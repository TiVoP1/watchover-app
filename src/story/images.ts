const loading = new Map<string, Promise<HTMLImageElement>>()
const decoded = new Map<string, HTMLImageElement>()

export const decodedImage = (url: string): HTMLImageElement | undefined => decoded.get(url)

export function loadImage(url: string): Promise<HTMLImageElement> {
  const pending = loading.get(url)
  if (pending !== undefined) return pending
  const image = new Image()
  image.decoding = 'async'
  image.src = url
  const ready = image.decode().then(() => {
    decoded.set(url, image)
    return image
  })
  ready.catch(() => {
    loading.delete(url)
  })
  loading.set(url, ready)
  return ready
}
