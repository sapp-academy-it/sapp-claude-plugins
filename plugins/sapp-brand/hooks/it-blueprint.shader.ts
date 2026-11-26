// Slow motion over the network blueprint, on the GPU. The engine reads this file
// and never runs it as JavaScript. The links are the only lines painted #3E7BD9, found
// in the Svg picture itself; packets run along them, one every ~200 points, creeping
// at about 24 points a second. A packet is a short orange dash that fades in and out: orange reads on the pale paper of a light window and on the deep blue of a dark one.
// Under Reduce Motion the engine shows the plain Svg.
import {
  abs,
  clamp,
  fract,
  length,
  picture,
  scene,
  shader,
  smoothstep,
  still,
  time,
  vec3,
  vec4,
} from 'claude-code/shader'

const view = picture(p => {
  const calm = 1 - still
  const link = 1 - smoothstep(0.05, 0.14, length(scene.sample(p.uv).rgb - vec3(0.243, 0.482, 0.851)))
  // Along a link that runs across or up, x + y grows, so one diagonal stripe pattern
  // reads as a packet travelling along every link.
  const along = fract((p.point.x + p.point.y) / 200 - time * 0.12 * calm)
  const packet = (1 - smoothstep(0, 0.045, abs(along - 0.5))) * link
  const alpha = clamp(packet * 0.95, 0, 0.95)
  return vec4(vec3(1, 0.55, 0.12) * alpha, alpha)
})

export default shader({ fps: 30, passes: [view] })
