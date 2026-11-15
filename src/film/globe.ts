import type { FilmAssets, RasterName } from '#web/film/assets.ts'
import type { Camera } from '#web/film/camera.ts'
import { bboxAffine, fitAffine, type Affine, type Vec3 } from '#web/film/geo.ts'
import { FRAGMENT_SHADER, VERTEX_SHADER } from '#web/film/globe-shader.ts'
import { alongRange, passAffine } from '#web/film/pass.ts'
import { stripAxis } from '#web/film/strip.ts'

export type Rgb = readonly [number, number, number]

export interface GlobeLook {
  readonly bg: Rgb
  readonly ocean: Rgb
  readonly land: Rgb
  readonly lightGain: number
  readonly coverColor: Rgb
  readonly limbColor: Rgb
}

export interface GlobeParams {
  readonly camera: Camera
  readonly day: number
  readonly tearProgress: number
  readonly tearFromKm: number
  readonly tearToKm: number
  readonly swathShow: number
  readonly paint: number
  readonly windowShow: number
  readonly coverDay: number
  readonly coverShow: number
  readonly coverAlpha: number
  readonly freshAlpha: number
  readonly freshDays: number
  readonly limbShow: number
  readonly lights: number
  readonly windowInSwath: number
  readonly sun: Vec3 | null
  readonly twilight: number
}

export const QUIET: Omit<GlobeParams, 'camera'> = {
  sun: null,
  twilight: 0.04,
  day: 0,
  tearProgress: 0,
  tearFromKm: 0,
  tearToKm: 0,
  swathShow: 0,
  paint: 0,
  windowShow: 0,
  coverDay: 0,
  coverShow: 0,
  coverAlpha: 0.16,
  freshAlpha: 0.34,
  freshDays: 0.4,
  limbShow: 0,
  lights: 1,
  windowInSwath: 0,
}

type TextureName = RasterName | 'window' | 'coverage'

const UNITS: Readonly<Record<TextureName, { unit: number; sampler: string }>> = {
  'night-world': { unit: 0, sampler: 'uNightWorld' },
  'night-europe': { unit: 1, sampler: 'uNightEurope' },
  'night-poland': { unit: 2, sampler: 'uNightPoland' },
  'clouds-wide': { unit: 3, sampler: 'uCloudWide' },
  'clouds-detail': { unit: 4, sampler: 'uCloudDetail' },
  'strip-wide': { unit: 5, sampler: 'uStripWide' },
  window: { unit: 6, sampler: 'uWindow' },
  coverage: { unit: 7, sampler: 'uCoverage' },
  'clouds-europe': { unit: 8, sampler: 'uCloudEurope' },
  'strip-core': { unit: 9, sampler: 'uStripCore' },
  'clouds-world': { unit: 10, sampler: 'uCloudWorld' },
}

const affineUniform = (m: Affine): Float32Array =>
  new Float32Array([m[0], m[3], m[1], m[4], m[2], m[5]])

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (shader === null) throw new Error('WebGL: cannot create a shader')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    throw new Error(`WebGL shader: ${gl.getShaderInfoLog(shader) ?? 'unknown error'}`)
  }
  return shader
}

export class Globe {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly locations = new Map<string, WebGLUniformLocation | null>()

  constructor(canvas: HTMLCanvasElement, assets: FilmAssets, look: GlobeLook) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true })
    if (gl === null) throw new Error('WebGL2 is not available')
    this.gl = gl
    const program = gl.createProgram()
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER))
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER))
    gl.linkProgram(program)
    if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
      throw new Error(`WebGL program: ${gl.getProgramInfoLog(program) ?? 'unknown error'}`)
    }
    this.program = program
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    this.upload(assets)
    this.setStatic(assets, look)
  }

  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.locations.has(name))
      this.locations.set(name, this.gl.getUniformLocation(this.program, name))
    return this.locations.get(name) ?? null
  }

  private texture(name: TextureName, source: TexImageSource, nearest: boolean, repeatX: boolean) {
    const gl = this.gl
    const { unit, sampler } = UNITS[name]
    const tex = gl.createTexture()
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source)
    if (nearest) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    } else {
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeatX ? gl.REPEAT : gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform1i(this.uniform(sampler), unit)
  }

  private upload(assets: FilmAssets) {
    for (const name of Object.keys(assets.rasters) as RasterName[]) {
      this.texture(
        name,
        assets.rasters[name].image,
        false,
        name === 'night-world' || name === 'clouds-world',
      )
    }
    this.texture('window', assets.window.image, false, false)
    this.texture('coverage', assets.orbit.coverage, true, true)
  }

  private setStatic(assets: FilmAssets, look: GlobeLook) {
    const gl = this.gl
    const r = assets.rasters
    const mat = (name: string, m: Affine) => {
      gl.uniformMatrix3x2fv(this.uniform(name), false, affineUniform(m))
    }
    mat('uNightWorldM', bboxAffine(r['night-world'].bbox))
    mat('uNightEuropeM', bboxAffine(r['night-europe'].bbox))
    mat('uNightPolandM', bboxAffine(r['night-poland'].bbox))
    mat('uCloudWorldM', bboxAffine(r['clouds-world'].bbox))
    mat('uCloudEuropeM', bboxAffine(r['clouds-europe'].bbox))
    mat('uCloudWideM', bboxAffine(r['clouds-wide'].bbox))
    mat('uCloudDetailM', bboxAffine(r['clouds-detail'].bbox))
    mat('uStripWideM', bboxAffine(r['strip-wide'].bbox))
    mat('uStripCoreM', bboxAffine(r['strip-core'].bbox))
    const axis = stripAxis(assets.strip)
    gl.uniform3f(this.uniform('uStripStart'), ...axis.start)
    gl.uniform3f(this.uniform('uStripPole'), ...axis.pole)
    const windowCorners: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]
    mat('uWindowM', fitAffine(assets.window.corners, windowCorners))
    mat('uPassM', passAffine(assets.pass))
    gl.uniform2f(this.uniform('uPaintRange'), ...alongRange(assets.pass, assets.window.corners))
    gl.uniform3f(this.uniform('uBg'), ...look.bg)
    gl.uniform3f(this.uniform('uOcean'), ...look.ocean)
    gl.uniform3f(this.uniform('uLand'), ...look.land)
    gl.uniform1f(this.uniform('uLightGain'), look.lightGain)
    gl.uniform3f(this.uniform('uCoverColor'), ...look.coverColor)
    gl.uniform3f(this.uniform('uLimbColor'), ...look.limbColor)
  }

  render(params: GlobeParams, dpr: number) {
    const gl = this.gl
    const width = Math.round(params.camera.width * dpr)
    const height = Math.round(params.camera.height * dpr)
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width
      this.canvas.height = height
    }
    gl.viewport(0, 0, width, height)
    const cam = params.camera
    gl.uniform2f(this.uniform('uSize'), width, height)
    gl.uniform3f(this.uniform('uEye'), ...cam.eye)
    gl.uniform3f(this.uniform('uRight'), ...cam.right)
    gl.uniform3f(this.uniform('uUp'), ...cam.up)
    gl.uniform3f(this.uniform('uFwd'), ...cam.forward)
    gl.uniform1f(this.uniform('uFocal'), cam.focalPx * dpr)
    gl.uniform1f(this.uniform('uDay'), params.day)
    gl.uniform1f(this.uniform('uTear'), params.tearProgress)
    gl.uniform2f(this.uniform('uTearKm'), params.tearFromKm, params.tearToKm)
    gl.uniform1f(this.uniform('uSwathShow'), params.swathShow)
    gl.uniform1f(this.uniform('uPaint'), params.paint)
    gl.uniform1f(this.uniform('uWindowShow'), params.windowShow)
    gl.uniform1f(this.uniform('uCoverDay'), params.coverDay)
    gl.uniform1f(this.uniform('uCoverShow'), params.coverShow)
    gl.uniform1f(this.uniform('uCoverAlpha'), params.coverAlpha)
    gl.uniform1f(this.uniform('uFreshAlpha'), params.freshAlpha)
    gl.uniform1f(this.uniform('uFreshDays'), params.freshDays)
    gl.uniform1f(this.uniform('uLimbShow'), params.limbShow)
    gl.uniform1f(this.uniform('uLights'), params.lights)
    gl.uniform1f(this.uniform('uWindowInSwath'), params.windowInSwath)
    gl.uniform3f(this.uniform('uSun'), ...(params.sun ?? [1, 0, 0]))
    gl.uniform1f(this.uniform('uSunMode'), params.sun === null ? 0 : 1)
    gl.uniform1f(this.uniform('uTwilight'), params.twilight)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  clear(bg: Rgb, width: number, height: number, dpr: number) {
    const gl = this.gl
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(bg[0], bg[1], bg[2], 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
  }
}
