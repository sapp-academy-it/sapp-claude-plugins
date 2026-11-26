// Renders preview.png: one still frame of the backdrop Svg, light mode on the
// left and dark mode on the right (the shader's motion is not in it).
// Needs rsvg-convert and ImageMagick 7 (`magick`); run by hand, not by CI.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SCENE_SVG } from '../hooks/scene.js'

const out = fileURLToPath(new URL('../preview.png', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'sapp-preview-'))

try {
  // rsvg-convert ignores prefers-color-scheme, so the dark half is the same
  // style sheet with its dark block lifted out of the media query.
  const dark = SCENE_SVG.replace('@media (prefers-color-scheme: dark){', '').replace('}</style>', '</style>')
  writeFileSync(join(dir, 'light.svg'), SCENE_SVG)
  writeFileSync(join(dir, 'dark.svg'), dark)
  for (const name of ['light', 'dark']) {
    execFileSync('rsvg-convert', ['-w', '1000', '-h', '708', '-o', join(dir, `${name}.png`), join(dir, `${name}.svg`)])
  }
  execFileSync('magick', [join(dir, 'light.png'), join(dir, 'dark.png'), '+append', out])
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(`wrote ${out}`)
