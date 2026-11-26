// Gentle motion over the ACCA classroom, on the GPU. The engine reads this file
// and never runs it as JavaScript.
//
// 1. Ceiling fan: the fan's blades are the only cells painted teal (#1FA8A0), found
//    in the Svg picture itself, so the shade follows them at any crop of the window.
//    A slow band of shade travels along the blades, a turning fan seen side on.
// 2. Chalk dust: 6 specks drifting slowly and fading in and out over several
//    seconds each (well under three changes a second, so nothing flashes).
// 3. The board: the ink of the board (#5B2BB0) marks where it is; a soft warm glow
//    rises on it under the pointer, and fades after the pointer leaves.
//
// Every layer is faint on purpose: the conversation text stays readable. Under
// Reduce Motion the engine shows the plain Svg.
import {
  buffer,
  clamp,
  fract,
  length,
  picture,
  pointers,
  scene,
  shader,
  sin,
  size,
  smoothstep,
  still,
  time,
  vec2,
  vec3,
  vec4,
} from 'claude-code/shader'

// Red: the board ink; green: the fan blades. 1 where the picture is that colour.
const masks = buffer({ scale: 0.25, filter: 'mipmap' }, p => {
  const c = scene.sample(p.uv)
  const ink = 1 - smoothstep(0.05, 0.14, length(c.rgb - vec3(0.357, 0.169, 0.69)))
  const fan = 1 - smoothstep(0.05, 0.14, length(c.rgb - vec3(0.122, 0.659, 0.627)))
  return vec4(ink, fan, 0, 1)
})

const view = picture(p => {
  const calm = 1 - still

  // The fan: shade travelling along the blades, one band every 1.3 seconds or so.
  const blades = masks.sample(p.uv, 0).g
  const band = 0.5 + 0.5 * sin(p.point.x * 0.09 - time * 1.6 * calm)
  const shade = blades * band * 0.5

  // Chalk dust.
  let dust = 0
  for (let i = 0; i < 6; i++) {
    const a = fract(sin(i * 12.9898) * 43758.5453)
    const b = fract(sin(i * 78.233 + 1.7) * 24634.6345)
    const c = fract(sin(i * 39.346 + 4.1) * 51372.3217)
    const x = fract(a + time * (0.004 + 0.004 * b) * calm) + 0.01 * sin(time * 0.3 + i)
    const y = fract(c - time * (0.003 + 0.004 * a) * calm)
    const d = length((p.uv - vec2(x, y)) * size)
    const fade = 0.55 + 0.45 * sin(time * 0.35 * calm + i * 2.1)
    dust += smoothstep(5, 0.5, d) * fade
  }

  // The board glows softly under each pointer, and fades after it leaves.
  const board = smoothstep(0.01, 0.05, masks.sample(p.uv, 4).r)
  let light = 0
  for (const q of pointers) {
    light += smoothstep(240, 0, length(p.point - q.at)) * (1 - clamp(q.gone, 0, 1))
  }
  const glow = clamp(light, 0, 1) * board

  const warm = vec3(1, 0.93, 0.7)
  const chalk = vec3(1, 0.9, 0.7)
  const alpha = clamp(shade + clamp(dust, 0, 1) * 0.22 + glow * 0.3, 0, 0.5)
  const rgb = vec3(0.04, 0.1, 0.09) * shade + chalk * (clamp(dust, 0, 1) * 0.22) + warm * (glow * 0.3)
  return vec4(rgb, alpha)
})

export default shader({ fps: 30, passes: [masks, view] })
