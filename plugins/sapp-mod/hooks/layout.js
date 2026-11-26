// How a scene sits in the window. The Backdrop fills the whole Desktop window, but the
// chat column stands in the middle of it, so anything drawn there is covered and blurred.
// Every room is therefore two composed zones (see ZONES in scripts/build-scene.mjs): the left
// zone is anchored to the window's left edge, the right zone to its right edge, each at a whole
// number of CSS pixels per sprite cell. The room between them is empty: the wall's flat bands
// run on, and the floor is tiled with the room's own two floor tiles, never stretched. Nothing
// is scaled to the window, so a bigger window shows more empty room, not a bigger one.
//
// The hooks API gives a Backdrop hook no window size and no column width (props are scene,
// plugin, glass and overrideColorScheme), so the layout is built from what an Svg can read:
// percentages of its own box and `@media` size queries, which read the scene's own box.
// The column width below is an assumption, not a measurement.

export const UNIT = 4 // scene units per sprite cell (build-scene.mjs SCALE)
export const GRID_W = 192
export const GRID_H = 200
// Rows of the wall (the floor starts below row 42) and the size of a floor tile, in cells.
export const WALL_ROWS = 42
export const TILE = 16
// Assumed width of the chat column, CSS px, centred in the window.
export const COLUMN = 760
// Reaching past any window: a wall band runs this far toward the middle.
const FAR = 4000
// Tiles drawn from the window's centre each way: 30 columns and 24 rows of 16 cells cover a window up to
// 3840 CSS px wide and 1536 tall at 4 px a cell.
const TILE_COLS = 30
const TILE_ROWS = 24

// Option A: a fixed integer scale. Option B: the largest whole scale at which a zone
// still fits its gutter and the room still fits the window's height, never above `max`.
export const FIXED = { mode: 'fixed', cells: 4 }
// The dots are a picture of 136 rows, centred on the window's height.
export const DOT_ROWS = 136
export const CAPPED = { mode: 'capped', max: 6, min: 2 }
// The option the mod ships.
export const SCALE = FIXED

const RECT = /M(-?\d+) (-?\d+)h(\d+)v(\d+)h-\d+z/g
const rects = d => [...d.matchAll(RECT)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }))
const PATH = /<path ((?:class|fill)="[^"]*") d="([^"]*)"\/>/g
const draw = list => list.map(r => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`).join('')

const WALL_UNITS = WALL_ROWS * UNIT
// The rects of the left zone. A room rect of the wall that touches the cut runs on toward the middle;
// the floor is left to the tiles, which `tiles` draws.
const leftZone = (list, cut, room) =>
  list
    .filter(r => r.x < cut && !(room && r.y >= WALL_UNITS))
    .map(r => {
      const reach = room && r.x + r.w >= cut ? cut + FAR : Math.min(r.x + r.w, cut)
      return { x: r.x, y: r.y, w: reach - r.x, h: r.h }
    })
const rightZone = (list, cut, room) =>
  list
    .filter(r => r.x + r.w > cut && !(room && r.y >= WALL_UNITS))
    .map(r => {
      const start = room && r.x <= cut ? cut - FAR : Math.max(r.x, cut)
      return { x: start, y: r.y, w: r.x + r.w - start, h: r.h }
    })

// The floor, tile by tile, in scene units, from the window's centre: `.fb` underneath and `.fa` on the tiles
// the room paints with it (tile column i, row j: `.fa` where i + j is odd, as paintRoom does). One checker runs
// across the whole width, with a tile edge on the centre line, so no two tiles meet badly at any window width:
// a floor counted from each edge instead breaks the pattern wherever the width is not a whole number of tiles.
const floor = () => {
  const size = TILE * UNIT
  const odd = []
  for (let j = 0; j < TILE_ROWS; j++) {
    for (let i = -TILE_COLS; i < TILE_COLS; i++) {
      if ((((i + j) % 2) + 2) % 2 === 1) odd.push({ x: i * size, y: WALL_UNITS + j * size, w: size, h: size })
    }
  }
  return (
    `<path class="fb" d="${draw([{ x: -FAR, y: WALL_UNITS, w: 2 * FAR, h: TILE_ROWS * size }])}"/>` +
    `<path class="fa" d="${draw(odd)}"/>`
  )
}

// The whole scale rule, as the CSS bands and the shaders share it: the whole scale k fits when
// the gutter holds the widest zone and the window is as tall as the room.
export const scaleFor = (option, [w, h], zoneCells, rows = GRID_H) => {
  if (option.mode === 'fixed') return option.cells
  const fit = Math.min((w - COLUMN) / 2 / zoneCells, h / rows)
  return Math.max(option.min, Math.min(option.max, Math.floor(fit)))
}

// `middle`: rows of a picture centred on the window's height (the dots); 0 puts the top of the picture at the window's top.
const place = (k, side, middle = 0) => `translate(${side === 'right' ? -GRID_W * k : 0} ${-(middle / 2) * k}) scale(${k / UNIT})`

// The same placement as a CSS value, which wants commas and units where the attribute takes spaces.
const placeCss = (k, side, middle = 0) => `translate(${side === 'right' ? -GRID_W * k : 0}px,${-(middle / 2) * k}px) scale(${k / UNIT})`

// The size rules of option B: from the smallest scale up, each band wins over the one before.
const bands = (option, zoneCells, rows, middle) => {
  if (option.mode !== 'capped') return ''
  let css = ''
  for (let k = option.min + 1; k <= option.max; k++) {
    css +=
      `@media (min-width:${COLUMN + 2 * zoneCells * k}px) and (min-height:${rows * k}px){` +
      `.pf{transform:scale(${k / UNIT})}.pl{transform:${placeCss(k, 'left', middle)}}.pr{transform:${placeCss(k, 'right', middle)}}}`
  }
  return css
}

const startK = option => (option.mode === 'fixed' ? option.cells : option.min)

// `left`, `right`: the markup of each zone, in scene units; `lit`: the same for what is drawn over the
// veil. `middle`: rows of a picture that sits on the window's vertical middle (the dots); else the room's top is the window's top.
const frame = ({ style, floor: tiles = '', left, right, litLeft, litRight, veil, zoneCells, option, rows = GRID_H, middle = 0 }) => {
  const k = startK(option)
  const at = side => place(k, side, middle)
  const centre = middle > 0
  const zone = (side, inner) =>
    side === 'left'
      ? `<svg width="50%" height="100%"><svg y="${centre ? '50%' : 0}" overflow="visible"><g class="pl" transform="${at('left')}">${inner}</g></svg></svg>`
      : `<svg x="50%" width="50%" height="100%"><svg x="100%" y="${centre ? '50%' : 0}" overflow="visible"><g class="pr" transform="${at('right')}">${inner}</g></svg></svg>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" shape-rendering="crispEdges">` +
    `<style>${style}${bands(option, zoneCells, rows, middle)}</style>` +
    `<rect class="bg" width="100%" height="100%"/>` +
    (tiles ? `<svg x="50%" overflow="visible"><g class="pf" transform="scale(${k / UNIT})">${tiles}</g></svg>` : '') +
    zone('left', left) +
    zone('right', right) +
    (veil ? `<rect class="veil" width="100%" height="100%"/>` : '') +
    (litLeft ? zone('left', litLeft) + zone('right', litRight) : '') +
    `</svg>`
  )
}

// A pixel scene (the generated Svg of build-scene.mjs): bg rect, one path per colour, the veil,
// then the lit paths. `zones.left` is the first cell of the empty middle, `zones.right` its last.
export const frameScene = (svg, { left, right }, option = SCALE) => {
  const style = svg.match(/<style>(.*?)<\/style>/s)[1]
  const veilAt = svg.indexOf('<rect class="veil"')
  const body = svg.slice(svg.indexOf('</style>') + 8, veilAt)
  const lit = svg.slice(svg.indexOf('/>', veilAt) + 2, svg.lastIndexOf('</svg>'))
  const cl = left * UNIT
  const cr = right * UNIT
  // The room's own colours are the classes the dark window recolours (the sprites keep theirs).
  const dark = style.slice(style.indexOf('@media'))
  const room = new Set([...dark.matchAll(/\.(c\d+)\{/g)].map(m => `class="${m[1]}"`))
  const paths = (markup, isRoom) => {
    const out = { left: '', right: '' }
    for (const [, attr, d] of markup.matchAll(PATH)) {
      const list = rects(d)
      const own = isRoom && room.has(attr)
      const l = draw(leftZone(list, cl, own))
      const r = draw(rightZone(list, cr, own))
      if (l) out.left += `<path ${attr} d="${l}"/>`
      if (r) out.right += `<path ${attr} d="${r}"/>`
    }
    return out
  }
  const main = paths(body, true)
  const over = paths(lit, false)
  return frame({
    style,
    floor: floor(),
    left: main.left,
    right: main.right,
    litLeft: over.left,
    litRight: over.right,
    veil: true,
    zoneCells: Math.max(left, GRID_W - right),
    option,
  })
}

// Zones drawn by code (the dots): `left` and `right` are markup in scene units, already cut.
export const frameCode = ({ style, left, right, pieceCells }, option = SCALE) =>
  frame({ style, left, right, veil: false, zoneCells: pieceCells, option, rows: DOT_ROWS, middle: DOT_ROWS })
