// Renders preview.png: a still of every theme in light (left) and dark (right), each
// labelled with the theme's name. A theme with a backdrop is its own Svg (the still
// frame, with no shader motion); a theme with none is its colours: page, panel, text
// and the accent, as Desktop paints them.
// Needs rsvg-convert and ImageMagick 7 (`magick`); run by hand, not by CI.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { THEMES } from '../hooks/themes.js'

const out = fileURLToPath(new URL('../preview.png', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'sapp-preview-'))
const TW = 640
const TH = 453
const LABEL = 44

const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// rsvg-convert ignores prefers-color-scheme, so the dark half is the same style
// sheet with its dark block lifted out of the media query.
const darkOf = svg => svg.replace('@media (prefers-color-scheme: dark){', '').replace('}</style>', '</style>')

// What a theme with no backdrop looks like: its page colour, a panel, two text lines.
const swatch = (theme, mode) => {
  const c = theme.colors.inputs[mode]
  const [page, panel, text, muted, accent] =
    mode === 'light'
      ? [c['gray-20'], '#ffffff', c['gray-900'], c['gray-400'], '#FFB700']
      : [c['gray-900'], c['gray-800'], c['gray-50'], c['gray-400'], '#FFB700']
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 544">` +
    `<rect width="768" height="544" fill="${page}"/>` +
    `<rect x="96" y="120" width="576" height="304" rx="16" fill="${panel}"/>` +
    `<rect x="136" y="164" width="120" height="16" rx="8" fill="${accent}"/>` +
    `<text x="136" y="232" font-family="sans-serif" font-size="32" font-weight="bold" fill="${text}">SAPP đang xử lý…</text>` +
    `<text x="136" y="284" font-family="sans-serif" font-size="22" fill="${muted}">Chỉ màu SAPP, không có nền</text>` +
    `</svg>`
  )
}

const png = (name, svg, width, height) => {
  writeFileSync(join(dir, `${name}.svg`), svg)
  execFileSync('rsvg-convert', ['-w', String(width), '-h', String(height), '-o', join(dir, `${name}.png`), join(dir, `${name}.svg`)])
  return join(dir, `${name}.png`)
}

const label = (name, text, dark) =>
  png(
    name,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${LABEL}">` +
      `<rect width="${TW}" height="${LABEL}" fill="${dark ? '#1A1916' : '#FAF8F3'}"/>` +
      `<text x="16" y="29" font-family="sans-serif" font-size="22" font-weight="bold" fill="${dark ? '#FAF8F3' : '#1A1916'}">${escapeXml(text)}</text></svg>`,
    TW,
    LABEL,
  )

try {
  const rows = THEMES.map((theme, index) => {
    const tiles = ['light', 'dark'].map(mode => {
      const base = theme.svg ?? swatch(theme, mode)
      const art = mode === 'dark' && theme.svg ? darkOf(base) : base
      const tile = png(`t${index}-${mode}`, art, TW, TH)
      const text = label(`l${index}-${mode}`, `${theme.title} (${mode === 'light' ? 'sáng' : 'tối'})`, mode === 'dark')
      const joined = join(dir, `j${index}-${mode}.png`)
      execFileSync('magick', [text, tile, '-append', joined])
      return joined
    })
    const row = join(dir, `row${index}.png`)
    execFileSync('magick', [...tiles, '+append', row])
    return row
  })
  execFileSync('magick', [...rows, '-append', out])
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(`wrote ${out}`)
