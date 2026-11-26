// Gentle motion over the marketing room, on the GPU. The engine reads this file
// and never runs it as JavaScript. Every part is found in the Svg picture by its
// own colour, so it follows the scene at any crop of the window.
//
// 1. KPI bars (mint #2EE59D): each bar grows a cell or two taller and back, slowly, the
//    phase different bar to bar. Nothing here changes more than once a second.
// 2. Ring light (#FFC21A): a warm halo breathing over about 9 seconds.
// 3. A heart (#FF3E6C) lifts off the phone's screen every 9 seconds, floats up
//    about 28 cells swaying a little, and fades. One at a time, no flashing.
//
// Under Reduce Motion the engine shows the plain Svg.
import {
  buffer,
  clamp,
  fract,
  length,
  max,
  PI,
  picture,
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

// The ring light, on its own, so a wide mip makes its halo.
const ring = buffer({ scale: 0.25, filter: 'mipmap' }, p => {
  const c = scene.sample(p.uv)
  const m = 1 - smoothstep(0.05, 0.14, length(c.rgb - vec3(1, 0.761, 0.102)))
  return vec4(m, m, m, 1)
})

const view = picture(p => {
  const calm = 1 - still
  // One grid cell, in points: the scene is 768 by 544 units of 4 per cell, slice-fitted.
  const cell = 4 * max(size.x / 768, size.y / 544)

  // The bars swell.
  const bar = vec3(0.18, 0.898, 0.616)
  const own = 1 - smoothstep(0.05, 0.14, length(scene.sample(p.uv).rgb - bar))
  const swell = ((1.2 + 0.8 * sin(time * 0.8 * calm + p.uv.x * 16)) * cell) / size.y
  const up = 1 - smoothstep(0.05, 0.14, length(scene.sample(p.uv - vec2(0, swell)).rgb - bar))
  const grown = up * (1 - own)

  // The ring light's halo.
  const breath = 0.75 + 0.25 * sin(time * 0.7 * calm)
  const halo = clamp(ring.sample(p.uv, 4).r * 6, 0, 1) * breath

  // The heart: rises for the first 5 of every 9 seconds, then rests.
  const phase = fract(time / 9)
  const t = clamp(phase / 0.55, 0, 1)
  const rise = (t * 28 * cell) / size.y
  const sway = (sin(t * 6) * 2 * cell) / size.x
  const mark = vec3(1, 0.243, 0.424)
  const seen = 1 - smoothstep(0.05, 0.14, length(scene.sample(p.uv - vec2(sway, rise)).rgb - mark))
  const heart = seen * sin(t * PI) * calm

  const alpha = clamp(grown * 0.9 + halo * 0.3 + heart * 0.85, 0, 0.9)
  const rgb = bar * (grown * 0.9) + vec3(1, 0.93, 0.6) * (halo * 0.3) + mark * (heart * 0.85)
  return vec4(rgb, alpha)
})

export default shader({ fps: 30, passes: [ring, view] })
