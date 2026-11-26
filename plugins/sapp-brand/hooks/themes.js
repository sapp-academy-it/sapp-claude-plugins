// The registry of SAPP themes. Every theme has an id, a Vietnamese display name,
// colours for light and dark, and optionally a backdrop (an Svg, which is also the
// still frame shown under reduced motion) with an optional shader over it.
// The shape follows Anthropic's theme-examples (Apache-2.0): one table, one row per
// theme, the id as the key everything else looks up; see README for the attribution.
import { makeColors } from './make-colors.js'
import { SCENE_ALT, SCENE_SVG } from './scene.js'
import { tokens } from './tokens.js'

export const DEFAULT_THEME_ID = 'acca-classroom'

const W = 768
const H = 544

// The night classroom is the day classroom under one more veil of deep blue, drawn
// after the room and before the lit PC screens, so the screens stay lit.
export const nightOf = svg => {
  const veil = `<rect class="veil" width="${W}" height="${H}"/>`
  if (!svg.includes(veil) || !svg.includes('<style>')) throw new Error('scene has no veil to dim')
  return svg
    .replace('<style>', '<style>.dusk{fill:#0B1636;opacity:.5}')
    .replace(veil, `${veil}<rect class="dusk" width="${W}" height="${H}"/>`)
}

// A grid of SAPP-yellow dots that swell toward the bottom-right corner: pure code,
// no sprite. 24 by 17 cells of 32 units; every number is fixed to one decimal.
export const dotsSvg = () => {
  const dots = []
  const far = Math.hypot(W, H)
  for (let row = 0; row < 17; row++) {
    for (let col = 0; col < 24; col++) {
      const x = col * 32 + 16
      const y = row * 32 + 16
      const near = 1 - Math.hypot(W - x, H - y) / far
      const r = Math.max(0, 14 * near * near * 1.6 - 1)
      if (r >= 1) dots.push(`<circle cx="${x}" cy="${y}" r="${r.toFixed(1)}"/>`)
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
    '<style>.bg{fill:#FAF8F3}.dot{fill:#FFB700;opacity:.55}' +
    '@media (prefers-color-scheme: dark){.bg{fill:#1A1916}.dot{opacity:.32}}</style>' +
    `<rect class="bg" width="${W}" height="${H}"/><g class="dot">${dots.join('')}</g></svg>`
  )
}
export const DOTS_ALT = 'Lưới chấm vàng SAPP, các chấm to dần về góc dưới bên phải'
export const NIGHT_ALT = `${SCENE_ALT}, vào buổi tối`

const sapp = makeColors({
  label: 'SAPP',
  roles: tokens.roles,
  light: { gray: { anchors: tokens.light } },
  dark: { gray: { anchors: tokens.dark } },
})

const night = makeColors({
  label: 'SAPP Night',
  roles: tokens.roles,
  light: {
    gray: {
      anchors: {
        'surface-0': '#EEF1F8',
        'surface-1': '#FFFFFF',
        'surface-2': '#FFFFFF',
        'text-primary': '#111A33',
        'text-secondary': '#46506B',
        'text-muted': '#667090',
      },
    },
  },
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

const GLASS = { blur: 14, opacity: 0.72 }

export const THEMES = [
  {
    id: 'acca-classroom',
    title: 'Lớp học ACCA',
    blurb: 'Lớp học pixel art có ánh sáng từ màn hình máy tính (mặc định)',
    colors: sapp.theme,
    problems: sapp.problems,
    scene: 'sapp-acca-classroom',
    svg: SCENE_SVG,
    alt: SCENE_ALT,
    shader: true,
    glass: GLASS,
  },
  {
    id: 'acca-night',
    title: 'Lớp học ACCA ban đêm',
    blurb: 'Lớp học pixel art về đêm, màu giao diện xanh đêm',
    colors: night.theme,
    problems: night.problems,
    colorScheme: 'dark',
    scene: 'sapp-acca-night',
    svg: nightOf(SCENE_SVG),
    alt: NIGHT_ALT,
    shader: true,
    glass: GLASS,
  },
  {
    id: 'sapp-dots',
    title: 'Chấm vàng SAPP',
    blurb: 'Lưới chấm vàng SAPP tĩnh, nhẹ',
    colors: sapp.theme,
    problems: sapp.problems,
    scene: 'sapp-dots',
    svg: dotsSvg(),
    alt: DOTS_ALT,
    shader: false,
    glass: { blur: 10, opacity: 0.72 },
  },
  {
    id: 'sapp-plain',
    title: 'SAPP cơ bản',
    blurb: 'Chỉ màu SAPP, không nền',
    colors: sapp.theme,
    problems: sapp.problems,
  },
]

export const themeOf = id => (typeof id === 'string' ? THEMES.find(t => t.id === id) : undefined)
export const defaultTheme = () => themeOf(DEFAULT_THEME_ID)
// A stored id that is unknown, or no longer in THEMES, gives the default.
export const themeOrDefault = id => themeOf(id) ?? defaultTheme()

const plain = text =>
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
