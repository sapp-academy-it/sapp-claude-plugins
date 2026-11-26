// The notes of the idea board lift under the pointer, on the GPU. The engine reads
// this file and never runs it as JavaScript. Yellow (#FFE07A) and white (#FFFFFF)
// notes are found in the Svg picture by colour; near a pointer they brighten a little
// and throw a soft shadow down and to the right, as if raised off the board. The lift
// eases in and out with the pointer: nothing flashes. Without a pointer, the board is still.
import {
  clamp,
  length,
  max,
  picture,
  pointers,
  scene,
  shader,
  size,
  smoothstep,
  vec2,
  vec3,
  vec4,
} from 'claude-code/shader'

const view = picture(p => {
  const yellow = vec3(1, 0.878, 0.478)
  const white = vec3(1, 1, 1)
  const here = scene.sample(p.uv).rgb
  const note = max(1 - smoothstep(0.05, 0.14, length(here - yellow)), 1 - smoothstep(0.05, 0.14, length(here - white)))
  // A shadow pixel is one whose neighbour up and to the left is a note (y points up).
  const off = vec2(7, 7) / size
  const behind = scene.sample(p.uv + vec2(-off.x, off.y)).rgb
  const cast = max(1 - smoothstep(0.05, 0.14, length(behind - yellow)), 1 - smoothstep(0.05, 0.14, length(behind - white)))

  let near = 0
  for (const q of pointers) {
    near += smoothstep(150, 30, length(p.point - q.at)) * (1 - clamp(q.gone, 0, 1))
  }
  const lift = clamp(near, 0, 1)

  const shadow = cast * (1 - note) * lift * 0.28
  const shine = note * lift * 0.22
  const alpha = clamp(shadow + shine, 0, 0.5)
  return vec4(vec3(0.12, 0.09, 0.04) * shadow + vec3(1, 1, 0.95) * shine, alpha)
})

export default shader({ fps: 30, passes: [view] })
