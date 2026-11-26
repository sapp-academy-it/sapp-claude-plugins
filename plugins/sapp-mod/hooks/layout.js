// How a scene sits in the window. The Backdrop fills the whole Desktop window, under the opaque sidebar, the title bar and the
// frosted chat column in the middle, so anything drawn there is covered. Every room is therefore two composed zones (see ZONES
// in scripts/build-scene.mjs): the left zone starts INSET px from the left edge (just past the sidebar), the right zone is
// anchored to the right edge, and the whole room starts TOP px down (under the title bar), at a whole number of CSS pixels per
// sprite cell. The room between the zones is empty: the wall's flat bands run on, and the floor is tiled with the room's own two
// floor tiles, never stretched. Nothing is scaled to the window, so a bigger window shows more empty room, not a bigger one.
//
// The hooks API gives a Backdrop hook no window size and no column width (props are scene, plugin, glass and
// overrideColorScheme), so the layout is built from what an Svg can read: percentages of its own box. The sizes come from a
// measured Desktop window (below), and no `@media` rule is used.

export const UNIT = 4 // scene units per sprite cell (build-scene.mjs SCALE)
export const GRID_W = 192
export const GRID_H = 200
// Rows of the wall (the floor starts below row 42) and the size of a floor tile, in cells.
export const WALL_ROWS = 42
export const TILE = 16
// Reaching past any window: a wall band runs this far toward the middle.
const FAR = 4000
// Tiles drawn from the window's centre each way: 40 columns and 44 rows of 16 cells cover a window up to 3840 CSS px wide and
// 2112 tall at 3 px a cell.
const TILE_COLS = 40
const TILE_ROWS = 44

// The geometry measured on a real Desktop window (Code tab, sidebar open), in CSS px: the sidebar is 283 wide and opaque,
// the title bar 40 tall, the chat column 768 wide and centred in the panel to the right of the sidebar. The Backdrop
// itself spans the whole window, under both.
export const SIDEBAR = 283
export const TITLEBAR = 40
export const CHAT = 768
// The dots are a picture of 136 rows, centred on the window's height.
export const DOT_ROWS = 136
// A fixed integer scale: `cells` CSS px for each sprite cell, whatever the window; `inset` and `top` (CSS px) move the room right
// and down, so the left zone starts just past the sidebar and the room starts under the title bar.
export const INSET = SIDEBAR + 3
export const TOP = TITLEBAR + 4
// What the mod ships. A room is composed 74 cells wide a side (222 px at 3 px a cell), which fits the 228 px gutter that is left
// beside the chat column at 1506 wide with the sidebar open.
export const D13 = { cells: 3, inset: INSET, top: TOP }
export const SCALE = D13

const RECT = /M(-?\d+) (-?\d+)h(\d+)v(\d+)h-\d+z/g
const rects = d => [...d.matchAll(RECT)].map(m => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }))
const PATH = /<path ((?:class|fill)="[^"]*") d="([^"]*)"\/>/g
const draw = list => list.map(r => `M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}z`).join('')

const WALL_UNITS = WALL_ROWS * UNIT
// The rects of the left zone. A room rect of the wall that touches the cut runs on toward the middle;
// the floor is left to the tiles, which `tiles` draws.
// `out` (an option with an inset or a top offset): a wall band that touches the left edge or the top runs on past it,
// so the inset and the title bar show wall and not the bare background.
const leftZone = (list, cut, room, out = {}) =>
  list
    .filter(r => r.x < cut && !(room && r.y >= WALL_UNITS))
    .map(r => {
      const reach = room && r.x + r.w >= cut ? cut + FAR : Math.min(r.x + r.w, cut)
      const x = room && out.left && r.x === 0 ? -FAR : r.x
      const y = room && out.up && r.y === 0 ? -FAR : r.y
      return { x, y, w: reach - x, h: r.h + (r.y - y) }
    })
const rightZone = (list, cut, room, out = {}) =>
  list
    .filter(r => r.x + r.w > cut && !(room && r.y >= WALL_UNITS))
    .map(r => {
      const start = room && r.x <= cut ? cut - FAR : Math.max(r.x, cut)
      const y = room && out.up && r.y === 0 ? -FAR : r.y
      return { x: start, y, w: r.x + r.w - start, h: r.h + (r.y - y) }
    })

// The floor, tile by tile, in scene units, from the window's centre: `.fb` underneath and `.fa` on the tiles
// the room paints with it (tile column i, row j: `.fa` where i + j is odd, as paintRoom does). One checker runs
// across the whole width, with a tile edge on the centre line, so no two tiles meet badly at any window width:
// a floor counted from each edge instead breaks the pattern wherever the width is not a whole number of tiles.
const floor = (rows = TILE_ROWS, cols = TILE_COLS) => {
  const size = TILE * UNIT
  const odd = []
  for (let j = 0; j < rows; j++) {
    for (let i = -cols; i < cols; i++) {
      if ((((i + j) % 2) + 2) % 2 === 1) odd.push({ x: i * size, y: WALL_UNITS + j * size, w: size, h: size })
    }
  }
  return (
    `<path class="fb" d="${draw([{ x: -FAR, y: WALL_UNITS, w: 2 * FAR, h: rows * size }])}"/>` +
    `<path class="fa" d="${draw(odd)}"/>`
  )
}

// `middle`: rows of a picture centred on the window's height (the dots); 0 puts the top of the picture at the window's top.
const place = (k, side, middle = 0, inset = 0, top = 0) => `translate(${side === 'right' ? -GRID_W * k : inset} ${middle ? -(middle / 2) * k : top}) scale(${k / UNIT})`

// `left`, `right`: the markup of each zone, in scene units; `lit`: the same for what is drawn over the
// veil. `middle`: rows of a picture that sits on the window's vertical middle (the dots); else the room's top is the window's top.
const frame = ({ style, floor: tiles = '', left, right, litLeft, litRight, veil, option, middle = 0 }) => {
  const k = option.cells
  const at = side => place(k, side, middle, option.inset ?? 0, option.top ?? 0)
  const centre = middle > 0
  const zone = (side, inner) =>
    side === 'left'
      ? `<svg width="50%" height="100%"><svg y="${centre ? '50%' : 0}" overflow="visible"><g class="pl" transform="${at('left')}">${inner}</g></svg></svg>`
      : `<svg x="50%" width="50%" height="100%"><svg x="100%" y="${centre ? '50%' : 0}" overflow="visible"><g class="pr" transform="${at('right')}">${inner}</g></svg></svg>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" shape-rendering="crispEdges">` +
    `<style>${style}</style>` +
    `<rect class="bg" width="100%" height="100%"/>` +
    (tiles ? `<svg x="50%" overflow="visible"><g class="pf" transform="${option.top ? `translate(0 ${option.top}) ` : ''}scale(${k / UNIT})">${tiles}</g></svg>` : '') +
    zone('left', left) +
    zone('right', right) +
    (veil ? `<rect class="veil" width="100%" height="100%"/>` : '') +
    (litLeft ? zone('left', litLeft) + zone('right', litRight) : '') +
    `</svg>`
  )
}

// A pixel scene (the generated Svg of build-scene.mjs): bg rect, one path per colour, the veil,
// then the lit paths. `left` is the first cell of the empty middle, `right` its last.
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
      const edge = { left: (option.inset ?? 0) > 0, up: (option.top ?? 0) > 0 }
      const l = draw(leftZone(list, cl, own, edge))
      const r = draw(rightZone(list, cr, own, edge))
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
    option,
  })
}

// Zones drawn by code (the dots): `left` and `right` are markup in scene units, already cut.
export const frameCode = ({ style, left, right }, option = SCALE) =>
  frame({ style, left, right, veil: false, option, middle: DOT_ROWS })
