// Renders preview.png: a still of every theme as Desktop lays it out, in a light window 1728 by 1117 px
// (a MacBook), each labelled with the theme's name and shrunk to half size. A theme with a backdrop is its
// own Svg (the still frame, with no shader motion), drawn in a headless Chromium at the window's size; a
// theme with none is its colours: page, panel, text and the accent, as Desktop paints them.
// Needs a Chromium-family browser (set CHROME to its path, or have chromium or google-chrome on the PATH),
// rsvg-convert and ImageMagick 7 (`magick`); run by hand, not by CI.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { THEMES } from '../hooks/themes.js'

const out = fileURLToPath(new URL('../preview.png', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'sapp-preview-'))
const WINDOW = [1728, 1117]
const TW = 864
const TH = 559
const LABEL = 44

const escapeXml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const browser = () => {
  if (process.env.CHROME) return process.env.CHROME
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      execFileSync(name, ['--version'], { stdio: 'ignore' })
      return name
    } catch {
      // Not this one.
    }
  }
  throw new Error('no Chromium-family browser: set CHROME to its path')
}

// What a theme with no backdrop looks like: its page colour, a panel, two text lines.
const swatch = theme => {
  const c = theme.colors.inputs.light
  const [page, panel, text, muted, accent] = [c['gray-20'], '#ffffff', c['gray-900'], c['gray-400'], '#FFB700']
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

// The Svg as Desktop shows it: the browser's window is the Backdrop's box.
const shot = (name, svg, chrome) => {
  const file = join(dir, `${name}.svg`)
  const png = join(dir, `${name}.png`)
  writeFileSync(file, svg)
  execFileSync(chrome, ['--headless', '--no-sandbox', '--hide-scrollbars', `--window-size=${WINDOW.join(',')}`, `--screenshot=${png}`, `file://${file}`], { stdio: 'ignore' })
  return png
}

const flat = (name, svg) => {
  writeFileSync(join(dir, `${name}.svg`), svg)
  execFileSync('rsvg-convert', ['-w', String(TW), '-h', String(TH), '-o', join(dir, `${name}.png`), join(dir, `${name}.svg`)])
  return join(dir, `${name}.png`)
}

const label = (name, text) => {
  writeFileSync(
    join(dir, `${name}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TW}" height="${LABEL}">` +
      `<rect width="${TW}" height="${LABEL}" fill="#FAF8F3"/>` +
      `<text x="16" y="29" font-family="sans-serif" font-size="22" font-weight="bold" fill="#1A1916">${escapeXml(text)}</text></svg>`,
  )
  execFileSync('rsvg-convert', ['-w', String(TW), '-h', String(LABEL), '-o', join(dir, `${name}.png`), join(dir, `${name}.svg`)])
  return join(dir, `${name}.png`)
}

try {
  const chrome = THEMES.some(t => t.svg) ? browser() : undefined
  const tiles = THEMES.map((theme, index) => {
    const tile = theme.svg
      ? (() => {
          const full = shot(`t${index}`, theme.svg, chrome)
          const small = join(dir, `s${index}.png`)
          execFileSync('magick', [full, '-filter', 'Box', '-resize', `${TW}x${TH}!`, small])
          return small
        })()
      : flat(`t${index}`, swatch(theme))
    const joined = join(dir, `j${index}.png`)
    execFileSync('magick', [label(`l${index}`, `${theme.title} (${WINDOW.join('x')})`), tile, '-append', joined])
    return joined
  })
  const rows = []
  for (let i = 0; i < tiles.length; i += 2) {
    const row = join(dir, `row${i}.png`)
    execFileSync('magick', [...tiles.slice(i, i + 2), '+append', row])
    rows.push(row)
  }
  execFileSync('magick', [...rows, '-append', out])
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log(`wrote ${out}`)
