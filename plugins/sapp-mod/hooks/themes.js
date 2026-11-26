// The registry of SAPP themes. Every theme has an id, a Vietnamese display name,
// colours for light and dark, and optionally a backdrop (an Svg, which is also the
// still frame shown under reduced motion) with an optional shader over it.
// The shape follows Anthropic's theme-examples (Apache-2.0): one table, one row per
// theme, the id as the key everything else looks up; see README for the attribution.
import { frameCode, frameScene } from './layout.js'
import { makeColors } from './make-colors.js'
import { IT_ALT, IT_SVG } from './scene-it.js'
import { MARKETING_ALT, MARKETING_SVG } from './scene-marketing.js'
import { SCENE_ALT, SCENE_SVG } from './scene.js'
import { tokens } from './tokens.js'

export const DEFAULT_THEME_ID = 'acca-classroom'

const W = 768
const H = 544

// A grid of SAPP-yellow dots that swell toward the bottom-right corner: pure code,
// no sprite. 24 by 17 cells of 32 units; every number is fixed to one decimal. Laid out
// like the rooms: the 8 columns at each side go to the window's edges (see layout.js),
// and the middle, under the chat, stays plain.
const DOT_SIDE_COLUMNS = 8
const dotsArt = () => {
  const left = []
  const right = []
  const far = Math.hypot(W, H)
  for (let row = 0; row < 17; row++) {
    for (let col = 0; col < 24; col++) {
      const x = col * 32 + 16
      const y = row * 32 + 16
      const near = 1 - Math.hypot(W - x, H - y) / far
      const r = Math.max(0, 14 * near * near * 1.6 - 1)
      if (r < 1) continue
      const dot = `<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>`
      if (col < DOT_SIDE_COLUMNS) left.push(dot)
      else if (col >= 24 - DOT_SIDE_COLUMNS) right.push(dot)
    }
  }
  return { left, right }
}
export const dotsSvg = option => {
  const { left, right } = dotsArt()
  return frameCode(
    {
      style:
        '.bg{fill:#FAF8F3}.dot{fill:#FFB700;opacity:.55}' +
        '@media (prefers-color-scheme: dark){.bg{fill:#1A1916}.dot{opacity:.32}}',
      left: `<g class="dot">${left.join('')}</g>`,
      right: `<g class="dot">${right.join('')}</g>`,
    },
    option,
  )
}
// The dots as one flat picture of the whole 768 by 544 grid, for preview.png only.
export const dotsFlat = () => {
  const { left, right } = dotsArt()
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 544">' +
    '<style>.bg{fill:#FAF8F3}.dot{fill:#FFB700;opacity:.55}@media (prefers-color-scheme: dark){.bg{fill:#1A1916}.dot{opacity:.32}}</style>' +
    '<rect class="bg" width="768" height="544"/><g class="dot">' + left.join('') + right.join('') + '</g></svg>'
  )
}
export const DOTS_ALT = 'Lưới chấm vàng SAPP, các chấm to dần về góc dưới bên phải'

const sapp = makeColors({
  label: 'SAPP',
  roles: tokens.roles,
  light: { gray: { anchors: tokens.light } },
  dark: { gray: { anchors: tokens.dark } },
})

// The IT themes follow the window: the SAPP cream in a light window, a deep night blue in a dark one.
const sappIt = makeColors({
  label: 'SAPP IT',
  roles: tokens.roles,
  light: { gray: { anchors: tokens.light } },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0E1430',
        'surface-1': '#18213F',
        'surface-2': '#18213F',
        'surface-3': '#18213F',
        'text-primary': '#EEF1F8',
        'text-secondary': '#B8C0D8',
        'text-muted': '#98A2C0',
      },
    },
  },
})

// The two zones of every room, in sprite cells (the same numbers as ZONES in scripts/build-scene.mjs, a test
// holds them together): the left zone is cells 0 to 74, the right zone cells 118 to 192, and layout.js draws
// the empty room between them itself.
const ZONES = { left: 74, right: 118 }
export const CUTS = { classroom: ZONES, marketing: ZONES, it: ZONES }

const GLASS = { blur: 14, opacity: 0.72 }

// `shader` names one of the shader files register.js plays over the Svg (each file
// is written out there as a literal path, which is how the engine reads it); absent,
// the Svg shows alone. `team` is who the theme is for. No theme forces a window kind: every Svg and every
// palette has a light and a dark look, and the engine picks by the window.
export const THEMES = [
  {
    id: 'acca-classroom',
    team: 'ACCA',
    title: 'Lớp học ACCA',
    blurb: 'Lớp học pixel art: bảng ACCA, thầy chỉ bảng, quạt trần quay chậm (mặc định)',
    colors: sapp.theme,
    problems: sapp.problems,
    scene: 'sapp-acca-classroom',
    art: SCENE_SVG,
    svg: frameScene(SCENE_SVG, CUTS.classroom),
    alt: SCENE_ALT,
    shader: 'classroom',
    glass: GLASS,
  },
  {
    id: 'marketing-room',
    team: 'Marketing',
    title: 'Phòng Marketing',
    blurb: 'Phòng Marketing pixel art: bàn chiến dịch, bảng KPI, góc quay nội dung',
    colors: sapp.theme,
    problems: sapp.problems,
    scene: 'sapp-marketing-room',
    art: MARKETING_SVG,
    svg: frameScene(MARKETING_SVG, CUTS.marketing),
    alt: MARKETING_ALT,
    shader: 'marketing',
    glass: GLASS,
  },
  {
    id: 'it-room',
    team: 'IT',
    title: 'Phòng IT',
    blurb: 'Phòng IT pixel art: tủ rack, màn hình giám sát, đèn LED nhấp nháy chậm; sáng ban ngày, tối về đêm',
    colors: sappIt.theme,
    problems: sappIt.problems,
    scene: 'sapp-it-room',
    art: IT_SVG,
    svg: frameScene(IT_SVG, CUTS.it),
    alt: IT_ALT,
    shader: 'it-room',
    glass: GLASS,
  },
  {
    id: 'sapp-dots',
    title: 'Chấm vàng SAPP',
    blurb: 'Lưới chấm vàng SAPP tĩnh, nhẹ',
    colors: sapp.theme,
    problems: sapp.problems,
    scene: 'sapp-dots',
    art: dotsFlat(),
    svg: dotsSvg(),
    alt: DOTS_ALT,
    glass: { blur: 10, opacity: 0.72 },
  },
]

export const themeOf = id => (typeof id === 'string' ? THEMES.find(t => t.id === id) : undefined)
export const defaultTheme = () => themeOf(DEFAULT_THEME_ID)
// A stored id that is unknown, or no longer in THEMES, gives the default.
export const themeOrDefault = id => themeOf(id) ?? defaultTheme()

export const plain = text =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .trim()

// What a person typed after /sapp-theme: a number from the list, an id, or the title
// (any case, with or without accents). Undefined when nothing matches.
export const pickTheme = text => {
  const word = plain(text)
  if (word === '') return undefined
  if (/^\d+$/.test(word)) return THEMES[Number(word) - 1]
  return THEMES.find(t => t.id === word || plain(t.title) === word)
}
