// Slow motion over the IT room, on the GPU. The engine reads this file and never
// runs it as JavaScript. Every part is found in the Svg picture by its own colour.
//
// 1. Rack LEDs (#3DFF7A) dim and brighten, about one slow cycle every 5 seconds, each
//    row of the racks a little out of step with the next (far below 3 changes a second).
// 2. One status light (#B4FF3D) turns amber, holds, and fades back to green: 18 s a round.
// 3. The monitoring graph (#4FD1FF on #0A1F3A) scrolls left. Its wave repeats every 16
//    cells, so the still frame and the moving frame are the same picture.
//
// Under Reduce Motion the engine shows the plain Svg.
import {
  clamp,
  length,
  max,
  mix,
  mod,
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

const view = picture(p => {
  const calm = 1 - still
  const c = scene.sample(p.uv)
  const cell = 4 * max(size.x / 768, size.y / 544)

  // LEDs: dim toward the rack's own colour, out of step with each other by height.
  const led = 1 - smoothstep(0.05, 0.14, length(c.rgb - vec3(0.239, 1, 0.478)))
  const dim = (0.5 + 0.5 * sin(time * 1.3 * calm + p.point.y * 0.09 + p.point.x * 0.03)) * 0.75

  // The status light: amber, then back.
  const status = 1 - smoothstep(0.05, 0.14, length(c.rgb - vec3(0.706, 1, 0.239)))
  const round = mod(time * calm, 18)
  const amber = smoothstep(0, 1.5, round) * (1 - smoothstep(5, 9, round))

  // The graph: the line scrolls 2.5 cells a second to the left; a second copy one
  // period over fills the edge, since the wave repeats.
  const line = vec3(0.31, 0.82, 1)
  const back = vec3(0.039, 0.122, 0.227)
  const period = (16 * cell) / size.x
  const shift = mod((time * 2.5 * calm * cell) / size.x, period)
  const a = 1 - smoothstep(0.05, 0.14, length(scene.sample(p.uv + vec2(shift, 0)).rgb - line))
  const b = 1 - smoothstep(0.05, 0.14, length(scene.sample(p.uv + vec2(shift - period, 0)).rgb - line))
  const live = max(a, b)
  const resting = 1 - smoothstep(0.05, 0.14, length(c.rgb - line))
  const graph = max(live, resting)

  const dimColor = vec3(0.106, 0.125, 0.22)
  const amberColor = vec3(1, 0.7, 0.1)
  const rgb = dimColor * (led * dim) + amberColor * (status * amber) + mix(back, line, live) * graph
  const alpha = clamp(led * dim + status * amber + graph, 0, 1)
  return vec4(rgb, alpha)
})

export default shader({ fps: 30, passes: [view] })
