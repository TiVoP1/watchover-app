import { describe, expect, it } from 'vitest'
import { altitudeKm, groundAt, groundCamera, hiddenBySphere, project } from '#web/film/camera.ts'
import { fromLonLat, toLonLat } from '#web/film/geo.ts'

const VIEW = {
  target: [22.05, 50.55] as const,
  rangeKm: 900,
  offNadirDeg: 30,
  headingDeg: 337,
  fovYDeg: 38,
}

describe('camera', () => {
  it('puts the ground target in the middle of the frame', () => {
    const cam = groundCamera(VIEW, 1920, 1080)
    const p = project(cam, fromLonLat(VIEW.target))
    expect(p?.x).toBeCloseTo(960, 6)
    expect(p?.y).toBeCloseTo(540, 6)
  })

  it('casts the frame centre back onto the target', () => {
    const cam = groundCamera(VIEW, 1920, 1080)
    const hit = groundAt(cam, 960, 540)
    expect(hit).not.toBeNull()
    if (hit === null) return
    const [lon, lat] = toLonLat(hit)
    expect(lon).toBeCloseTo(22.05, 6)
    expect(lat).toBeCloseTo(50.55, 6)
  })

  it('hides the far side of the Earth and keeps the near side', () => {
    const cam = groundCamera({ ...VIEW, offNadirDeg: 0, rangeKm: 20000 }, 1920, 1080)
    expect(hiddenBySphere(cam, fromLonLat([22.05, 50.55]))).toBe(false)
    expect(hiddenBySphere(cam, fromLonLat([-157.95, -50.55]))).toBe(true)
  })

  it('reports the eye altitude above the sphere', () => {
    const cam = groundCamera({ ...VIEW, offNadirDeg: 0, rangeKm: 747 }, 1920, 1080)
    expect(altitudeKm(cam)).toBeCloseTo(747, 6)
  })
})
