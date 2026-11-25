// Gentle motion over the classroom scene, on the GPU. The engine reads this
// file and never runs it as JavaScript.
//
// 1. Lamp glow: the three lamp bulbs are the only cells of the scene painted a
//    pure lemon yellow, so a quarter-resolution buffer finds them in the Svg
//    picture itself and the glow follows them at any crop of the window.
// 2. Chalk dust: 6 specks drifting slowly and fading in and out over several
//    seconds each (well under three changes a second, so nothing flashes).
// 3. A soft highlight that follows the pointer.
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

// 1 where the picture is a lamp bulb: a very green-yellow cell with almost no blue.
const lamps = buffer({ scale: 0.25, filter: 'mipmap' }, p => {
  const c = scene.sample(p.uv)
  const m = smoothstep(0.66, 0.76, c.g - c.b)
  return vec4(m, m, m, 1)
})

const view = picture(p => {
  const calm = 1 - still

  // Lamp glow, breathing slowly (one cycle every 12 seconds or so).
  const breath = 0.88 + 0.12 * sin(time * 0.5) * calm
  const near = lamps.sample(p.uv, 3).r
  const wide = lamps.sample(p.uv, 5).r
  const glow = clamp(near * 1.6 + wide * 3.2, 0, 1) * breath

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

  // Soft highlight near each pointer, fading after it leaves.
  let light = 0
  for (const q of pointers) {
    light += smoothstep(170, 0, length(p.point - q.at)) * (1 - clamp(q.gone, 0, 1))
  }

  const warm = vec3(1, 0.8, 0.4)
  const chalk = vec3(1, 0.9, 0.7)
  const alpha = clamp(glow * 0.3 + clamp(dust, 0, 1) * 0.22 + light * 0.07, 0, 0.45)
  const rgb = warm * (glow * 0.3 + light * 0.07) + chalk * (clamp(dust, 0, 1) * 0.22)
  return vec4(rgb, alpha)
})

export default shader({ fps: 30, passes: [lamps, view] })
