// Builds the pixel scenes of the SAPP themes from the MIT sprites in assets/
// (see assets/LICENSE-pixel-agents.txt):
//
//   classroom -> hooks/scene.js           the ACCA classroom (no computers)
//   marketing -> hooks/scene-marketing.js the marketing room
//   it        -> hooks/scene-it.js        the IT room (dark)
//
//   node plugins/sapp-mod/scripts/build-scene.mjs
//
// No network and nothing but the sprite files is read. Every sprite pixel is one
// cell of a 192 by 136 grid; objects missing from the sprite set are drawn by code
// in the same palette scale, cell by cell. Runs of one colour merge into one
// subpath of one <path> per colour, and the Svg is scaled by the integer SCALE
// (every coordinate is a cell times SCALE) with crisp edges. No raster image is
// embedded.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'

export const GRID_W = 192
export const GRID_H = 200
// The two zones of every room, in cells: the left one is cells 0 to `left`, the right one `right` to GRID_W.
// Between them the room is empty (wall and tiled floor) and layout.js draws that part itself, tiled to any window.
export const ZONES = { left: 88, right: 104 }
export const SCALE = 4

const here = new URL('../', import.meta.url)
const INK = '#1A1916'

// ---- PNG reading (8-bit RGBA, no interlace: what the sprites are) ----------

export function readPng(bytes) {
  if (bytes.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG')
  let width = 0
  let height = 0
  const data = []
  for (let at = 8; at < bytes.length; ) {
    const len = bytes.readUInt32BE(at)
    const type = bytes.toString('latin1', at + 4, at + 8)
    const body = bytes.subarray(at + 8, at + 8 + len)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error('need 8-bit RGBA, not interlaced')
    } else if (type === 'IDAT') data.push(body)
    at += 12 + len
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * 4
  const out = Buffer.alloc(height * stride)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    for (let i = 0; i < stride; i++) {
      const x = raw[y * (stride + 1) + 1 + i]
      const a = i >= 4 ? out[y * stride + i - 4] : 0
      const b = y > 0 ? out[(y - 1) * stride + i] : 0
      const c = i >= 4 && y > 0 ? out[(y - 1) * stride + i - 4] : 0
      let v
      if (filter === 0) v = x
      else if (filter === 1) v = x + a
      else if (filter === 2) v = x + b
      else if (filter === 3) v = x + ((a + b) >> 1)
      else {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      }
      out[y * stride + i] = v & 255
    }
  }
  return { width, height, rgba: out }
}

const cache = new Map()
const sprite = path => {
  if (!cache.has(path)) cache.set(path, readPng(readFileSync(new URL(`assets/${path}`, here))))
  return cache.get(path)
}

// ---- colours ---------------------------------------------------------------

const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const toHex = rgb =>
  '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => {
  const [r1, g1, b1] = toRgb(a)
  const [r2, g2, b2] = toRgb(b)
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t])
}

// The marker colours the shaders look for. Each is painted only in the lit layer
// (above the veil); a test checks that nothing else in the scene, seen through its
// veil, comes near one.
export const MARKERS = {
  classroom: { ink: '#5B2BB0', fan: '#1FA8A0' },
  marketing: { bar: '#2EE59D', ring: '#FFC21A', heart: '#FF3E6C' },
  it: { led: '#3DFF7A', status: '#B4FF3D', graph: '#4FD1FF' },
}
// The graph panel's own background: the it-room shader paints this over the resting line.
// The classroom board face is painted above the veils, like its ink, so the ink always has the same contrast on it.
export const BOARD_FACE = '#E6E2DE'
// The graph panel in cells: the it-room shader bounds the moving line by its left and right edges (x 4 times these).
export const GRAPH_PANEL = { x: 10, y: 8, w: 48, h: 24 }
export const GRAPH_BG = '#0A1F3A'

// Palette shared with the sprites (the whiteboard, the desk, the clock).
const P = {
  outline: '#4A4E4D',
  frame: '#B9BCBD',
  frameHi: '#D6D7D8',
  face: '#EFEBE8',
  tray: '#E9ECEE',
  woodHi: '#CFA86D',
  wood: '#B38857',
  woodSh: '#885C47',
  woodDk: '#532E3D',
  paper: '#F3F0E6',
  paperSh: '#CFC9B8',
  red: '#D64545',
  dark: '#2B2F3A',
  steel: '#757B7C',
  steelHi: '#B5BFC7',
  steelLo: '#4A4E55',
}

// ---- the canvas ---------------------------------------------------------------
// A cell is 'r#RRGGBB' (room) or 's#RRGGBB' (sprite or drawn object, never
// recoloured). The lit layer is painted after the veil.

// 3 by 5 pixel letters and digits, for boards, screens and labels.
const FONT3 = {
  ' ': ['000', '000', '000', '000', '000'],
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  A: ['010', '101', '111', '101', '101'],
  C: ['111', '100', '100', '100', '111'],
  E: ['111', '100', '111', '100', '111'],
  I: ['111', '010', '010', '010', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  P: ['111', '101', '111', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  U: ['101', '101', '101', '101', '111'],
  '+': ['000', '010', '111', '010', '000'],
  '=': ['000', '111', '000', '111', '000'],
}
// 5 by 7 pixel capitals for the word on the board.
const FONT5 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
}

export class Canvas {
  constructor(base) {
    this.cells = new Array(GRID_W * GRID_H).fill('r' + base)
    this.lit = new Map()
    // What was drawn, in order: sprite blits and seats, for the seating tests.
    this.trace = []
  }
  inside(x, y) {
    return x >= 0 && y >= 0 && x < GRID_W && y < GRID_H
  }
  room(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (this.inside(x + i, y + j)) this.cells[(y + j) * GRID_W + x + i] = 'r' + c
  }
  px(x, y, c) {
    if (this.inside(x, y)) this.cells[y * GRID_W + x] = 's' + c
  }
  box(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c)
  }
  litPx(x, y, c) {
    if (this.inside(x, y)) this.lit.set(y * GRID_W + x, c)
  }
  litBox(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.litPx(x + i, y + j, c)
  }
  disc(cx, cy, r, c, put = 'px') {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this[put](cx + x, cy + y, c)
  }
  ring(cx, cy, r0, r1, c, put = 'px') {
    for (let y = -r1; y <= r1; y++) {
      for (let x = -r1; x <= r1; x++) {
        const d = x * x + y * y
        if (d <= r1 * r1 + r1 * 0.6 && d > r0 * r0 + r0 * 0.6) this[put](cx + x, cy + y, c)
      }
    }
  }
  line(x0, y0, x1, y1, c, put = 'px') {
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this[put](x0, y0, c)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
  }
  // Alpha-blend one sprite pixel over what is already there.
  spritePx(x, y, [r, g, b, a]) {
    if (!this.inside(x, y) || a === 0) return
    const under = this.cells[y * GRID_W + x].slice(1)
    this.cells[y * GRID_W + x] = 's' + mix(under, toHex([r, g, b]), a / 255)
  }
  // Draw a rectangle of a sprite sheet at (x, y); `flip` mirrors it left to right.
  blit(path, x, y, { sx = 0, sy = 0, w, h, flip = false } = {}) {
    this.trace.push({ path, x, y, sx, sy })
    const img = sprite(path)
    const sw = w ?? img.width - sx
    const sh = h ?? img.height - sy
    for (let j = 0; j < sh; j++) {
      for (let i = 0; i < sw; i++) {
        const fx = flip ? sw - 1 - i : i
        const o = ((sy + j) * img.width + sx + fx) * 4
        this.spritePx(x + i, y + j, [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2], img.rgba[o + 3]])
      }
    }
  }
  // One frame of a character sheet: 16 by 32, column 0..6, row 0 front, 1 back, 2 right.
  person(n, col, row, x, y, opts = {}) {
    this.blit(`characters/char_${n}.png`, x, y, { sx: col * 16, sy: row * 32, w: 16, h: 32, ...opts })
  }
  // A sprite painted in the lit layer (pixels at least half opaque), as it is drawn.
  litBlit(path, x, y) {
    this.trace.push({ path, x, y, lit: true })
    const img = sprite(path)
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const o = (j * img.width + i) * 4
        if (img.rgba[o + 3] >= 128) this.litPx(x + i, y + j, toHex([img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]]))
      }
    }
  }
  // The same frame painted in the lit layer, above the veils: sprite colours as drawn, so the
  // person stays clearly visible in a scene that is muted on purpose. Pixels at least half opaque.
  litPerson(n, col, row, x, y, { flip = false } = {}) {
    this.trace.push({ path: `characters/char_${n}.png`, x, y, lit: true })
    const img = sprite(`characters/char_${n}.png`)
    for (let j = 0; j < 32; j++) {
      for (let i = 0; i < 16; i++) {
        const o = ((row * 32 + j) * img.width + col * 16 + (flip ? 15 - i : i)) * 4
        if (img.rgba[o + 3] >= 128) this.litPx(x + i, y + j, toHex([img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]]))
      }
    }
  }
  text(str, x, y, c, put = 'px') {
    let at = x
    for (const ch of str) {
      FONT3[ch].forEach((row, r) => [...row].forEach((bit, i) => bit === '1' && this[put](at + i, y + r, c)))
      at += 4
    }
  }
  word5(str, x, y, c, put = 'px') {
    ;[...str].forEach((ch, k) => FONT5[ch].forEach((row, r) => [...row].forEach((bit, i) => bit === '1' && this[put](x + k * 6 + i, y + r, c))))
  }
}

// ---- people --------------------------------------------------------------------

// The most common colour of a patch of a sprite, among pixels `keep` accepts.
function patchColor(path, sx, sy, w, h, keep) {
  const img = sprite(path)
  const count = new Map()
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = ((sy + j) * img.width + sx + i) * 4
      if (img.rgba[o + 3] < 250) continue
      const c = toHex([img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]])
      if (keep(toRgb(c))) count.set(c, (count.get(c) ?? 0) + 1)
    }
  }
  return [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0]
}
// The skin of a character, as drawn on its own face; the shirt as drawn on its back.
const skinOf = n => patchColor(`characters/char_${n}.png`, 3, 8, 10, 7, ([r, g, b]) => r > 190 && g > 130 && b > 90 && r > g && g > b)
const shirtOf = n => patchColor(`characters/char_${n}.png`, 3 * 16 + 4, 32 + 18, 8, 4, () => true)

// A seated student from behind with one hand up: the sleeve and the hand are drawn
// from the character's own shirt and skin; the face is never touched.
function raisedHand(cv, n, x, y) {
  const sleeve = shirtOf(n)
  const skin = skinOf(n)
  cv.box(x + 13, y + 16, 4, 2, sleeve)
  cv.box(x + 15, y + 8, 3, 8, sleeve)
  cv.box(x + 14, y + 4, 4, 4, skin)
}

// ---- seating, as the viz office does it ----------------------------------------------------------
// In gotechcom/vibemaestro-viz (screens/office: layout.ts chairSpot, scene.tsx drawCharacter, room.ts drawDesk)
// a desk is drawn at (d.x - 24, d.y - 16), its PC at (d.x - 8, d.y - 22), and a person at work uses the
// back-view typing frame (columns 3 and 4 of the back row), centred on the desk with the sprite's top at
// d.y - 8. Then the chair back is drawn OVER the person, at the same top-left corner: the order is desk,
// person, chair back. In scene cells, for a desk sprite at (dx, dy): the person and the chair sit at
// (dx + 16, dy + 8). The chair's opaque rows 15 to 31 cover the person's lower body, so they read as seated.
export const SEAT = { x: 16, y: 8 }
export const CHAIR_ROWS = [15, 31]
export const SEATED_BOTTOM_ROW = 25

// Seats a person at a desk sprite drawn at (dx, dy): the person, then (if given) what the person does
// with a hand, then the chair back over the legs. `lit` paints person and chair in the lit layer.
function seat(cv, { who, col, dx, dy, hand = false, lit = false, rim = () => {} }) {
  const x = dx + SEAT.x
  const y = dy + SEAT.y
  if (who !== null) {
    rim(who, col, x, y)
    if (lit) cv.litPerson(who, col, 1, x, y)
    else cv.person(who, col, 1, x, y)
    if (hand) raisedHand(cv, who, x, y)
  }
  if (lit) cv.litBlit('furniture/WOODEN_CHAIR_BACK.png', x, y)
  else cv.blit('furniture/WOODEN_CHAIR_BACK.png', x, y)
  cv.trace.push({ seat: true, who, x, y, desk: { x: dx, y: dy } })
}

// ---- merging cells into paths ---------------------------------------------------

function toRuns(get, background) {
  // Greedy cover: take the first free cell in reading order, grow it right while
  // the colour holds, then down while the whole row of that width matches.
  const done = new Uint8Array(GRID_W * GRID_H)
  const rects = []
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const c = get(y * GRID_W + x)
      if (done[y * GRID_W + x] || c === background) continue
      let w = 1
      while (x + w < GRID_W && !done[y * GRID_W + x + w] && get(y * GRID_W + x + w) === c) w++
      let h = 1
      grow: while (y + h < GRID_H) {
        for (let i = 0; i < w; i++) {
          if (done[(y + h) * GRID_W + x + i] || get((y + h) * GRID_W + x + i) !== c) break grow
        }
        h++
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) done[(y + j) * GRID_W + x + i] = 1
      rects.push({ x, y, w, h, c })
    }
  }
  return rects
}

const sub = r => `M${r.x * SCALE} ${r.y * SCALE}h${r.w * SCALE}v${r.h * SCALE}h-${r.w * SCALE}z`

// Dark mode sinks the room's own colours toward ink; sprites are never recoloured
// (the veil alone mutes them).
const darkOf = c => mix(c, INK, 0.55)

const W = GRID_W * SCALE
const H = GRID_H * SCALE

// opts: bg, veil {light, dark} as [colour, opacity], dark = { bg, of } sinks a room
// colour in a dark window (null = the room is the same in both modes).
let lastTrace = []
function serialize(cv, { bg, veil, dark, floor }) {
  lastTrace = cv.trace
  const rects = toRuns(i => cv.cells[i], null)
  const keys = [...new Set(rects.map(r => r.c))].sort()
  const classOf = new Map(keys.map((k, i) => [k, `c${i}`]))
  // `.fa` and `.fb` are the two floor tiles: layout.js tiles them across the empty middle of the room.
  const css = [`.bg{fill:${bg}}`, `.veil{fill:${veil.light[0]};opacity:${veil.light[1]}}`, `.fa{fill:${floor[0]}}`, `.fb{fill:${floor[1]}}`, ...keys.map(k => `.${classOf.get(k)}{fill:${k.slice(1)}}`)]
  if (dark) {
    css.push(
      '@media (prefers-color-scheme: dark){',
      `.bg{fill:${dark.bg}}`,
      `.veil{fill:${veil.dark[0]};opacity:${veil.dark[1]}}`,
      `.fa{fill:${dark.of(floor[0])}}`,
      `.fb{fill:${dark.of(floor[1])}}`,
      ...keys.filter(k => k[0] === 'r').map(k => `.${classOf.get(k)}{fill:${dark.of(k.slice(1))}}`),
      '}',
    )
  }
  const paths = keys.map(k => `<path class="${classOf.get(k)}" d="${rects.filter(r => r.c === k).map(sub).join('')}"/>`)
  const litRects = toRuns(i => cv.lit.get(i) ?? null, null)
  const litColors = [...new Set(litRects.map(r => r.c))].sort()
  const litPaths = litColors.map(c => `<path fill="${c}" d="${litRects.filter(r => r.c === c).map(sub).join('')}"/>`)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ` +
    `preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
    `<style>${css.join('')}</style>` +
    `<rect class="bg" width="${W}" height="${H}"/>` +
    paths.join('') +
    `<rect class="veil" width="${W}" height="${H}"/>` +
    litPaths.join('') +
    `</svg>`
  )
}

const DAY_VEIL = { light: ['#FAF8F3', '.34'], dark: [INK, '.5'] }
const DAY_DARK = { bg: INK, of: darkOf }

// A wall with a wainscot and a floor of two-tone squares.
function paintRoom(cv, r) {
  cv.room(0, 0, GRID_W, 40, r.wall)
  cv.room(0, 0, GRID_W, 3, r.wallTop)
  cv.room(0, 28, GRID_W, 12, r.wain)
  cv.room(0, 28, GRID_W, 1, r.rail)
  cv.room(0, 40, GRID_W, 2, r.base)
  for (let y = 42; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) cv.room(x, y, 1, 1, (Math.floor(x / 16) + Math.floor((y - 42) / 16)) % 2 ? r.floorA : r.floorB)
  }
}

// ---- things drawn by code, in the sprites' palette scale ---------------------------

// An open book flat on a desk, 9 by 6: two pages and a cover.
function notebook(cv, x, y, cover) {
  cv.box(x, y + 1, 9, 5, cover)
  cv.box(x + 1, y, 7, 5, P.paper)
  cv.box(x + 4, y, 1, 5, P.paperSh)
  for (const r of [1, 3]) {
    cv.box(x + 2, y + r, 2, 1, P.paperSh)
    cv.box(x + 5, y + r, 2, 1, P.paperSh)
  }
}
// Books in a stack, 9 wide.
function books(cv, x, y, colors, width = 9) {
  colors.forEach((c, i) => {
    const w = width - (i % 2)
    cv.box(x, y - i * 2, w, 2, c)
    cv.box(x, y - i * 2, w, 1, mix(c, '#FFFFFF', 0.25))
    cv.px(x + w - 1, y - i * 2 + 1, mix(c, '#000000', 0.3))
  })
}
// A handheld calculator, 5 by 7.
function calculator(cv, x, y) {
  cv.box(x, y, 5, 7, P.steelLo)
  cv.box(x + 1, y + 1, 3, 2, '#8FD3A0')
  for (const j of [4, 6]) for (const i of [1, 3]) cv.px(x + i, y + j, P.steelHi)
  cv.px(x + 1, y + 5, P.steelHi)
  cv.px(x + 3, y + 5, P.red)
}
// A laptop seen from the front, 12 wide: a dark lid with a screen, on a base.
function laptop(cv, x, y, screen) {
  cv.box(x, y, 12, 8, P.dark)
  cv.box(x + 1, y + 1, 10, 6, screen)
  cv.box(x - 1, y + 8, 14, 2, P.steel)
  cv.box(x, y + 8, 12, 1, P.steelHi)
}
// A whiteboard-style frame: outline, light rim, face. Returns the face rectangle.
function boardFrame(cv, x, y, w, h, face = P.face) {
  cv.box(x, y, w, h, P.outline)
  cv.box(x + 1, y + 1, w - 2, 1, P.frameHi)
  cv.box(x + 1, y + 2, 1, h - 4, P.frame)
  cv.box(x + 2, y + 2, w - 3, h - 5, P.outline)
  cv.box(x + 3, y + 3, w - 5, h - 7, face)
  cv.box(x + 2, y + h - 3, w - 3, 2, P.tray)
  cv.box(x + 1, y + h - 3, 1, 2, P.frame)
  return { x: x + 3, y: y + 3, w: w - 5, h: h - 7 }
}

// ---- the classroom ----------------------------------------------------------------

const ROOM = {
  wall: '#EADFC4',
  wallTop: '#DCCFAE',
  rail: '#BFA77A',
  wain: '#CDB584',
  base: '#8F7650',
  floorA: '#C9A56B',
  floorB: '#BE9A60',
}

// char file, typing frame column (3 or 4); null = an empty seat. `hand` raises a hand.
// Two zones (see ZONES): the lecture at the board on the left, the rows of students on the right.
const FRONT_SEATS = [
  { dx: 20, dy: 70, who: 0, col: 3, hand: true },
  { dx: 20, dy: 110, who: 3, col: 4 },
]
const BACK_SEATS = [
  { dx: 118, dy: 46, who: 1, col: 4 },
  { dx: 118, dy: 86, who: 2, col: 3, hand: true },
  { dx: 118, dy: 126, who: 4, col: 4 },
]
const COVERS = ['#3F6FA8', '#A8483F', '#4C8C5A', '#7A5FA8', '#C9892B', '#3F8C8C']

function desk(cv, dx, dy, who, k) {
  cv.blit('furniture/DESK_FRONT.png', dx, dy)
  // What is on the desk, at its two ends: the middle is where the student sits.
  notebook(cv, dx + 5, dy + 15, COVERS[k % COVERS.length])
  calculator(cv, dx + 34, dy + 14)
  books(cv, dx + 38, dy + 23, [COVERS[(k + 2) % 6], COVERS[(k + 4) % 6]].slice(0, 1 + (k % 2)), 6)
  seat(cv, { who: who.who, col: who.col, dx, dy, hand: who.hand })
}

function classroom() {
  const cv = new Canvas(ROOM.wall)
  const m = MARKERS.classroom
  paintRoom(cv, ROOM)

  // ---- left zone: the lecture. The board: ACCA, a formula and a small balance sheet, in the marker ink.
  const face = boardFrame(cv, 4, 3, 68, 29)
  const fx = face.x
  const fy = face.y
  cv.litBox(face.x, face.y, face.w, face.h, BOARD_FACE)
  cv.word5('ACCA', fx + 3, fy + 2, m.ink, 'litPx')
  cv.text('A=L+E', fx + 3, fy + 13, m.ink, 'litPx')
  cv.litBox(fx + 28, fy + 2, 1, 20, P.paperSh)
  cv.litBox(fx + 29, fy + 9, 31, 1, P.paperSh)
  cv.text('A', fx + 36, fy + 3, m.ink, 'litPx')
  cv.text('L+E', fx + 46, fy + 3, m.ink, 'litPx')
  cv.text('120', fx + 32, fy + 12, m.ink, 'litPx')
  cv.text('70', fx + 48, fy + 12, m.ink, 'litPx')
  cv.text('50', fx + 48, fy + 18, m.ink, 'litPx')
  cv.blit('furniture/PLANT.png', 4, 40)

  // The two front students.
  FRONT_SEATS.forEach((s, k) => desk(cv, s.dx, s.dy, s, k))

  // The teacher beside the board, facing the students, pointing with a ruler.
  cv.person(5, 0, 0, 68, 12)
  cv.line(70, 34, 52, 16, '#D9A441')
  for (const [x, y] of [[67, 31], [64, 28], [61, 25], [58, 22], [55, 19]]) cv.px(x, y, '#7A5A1E')
  cv.box(51, 15, 2, 2, P.red)

  // ---- right zone: the rows of students. The exam calendar: a red header, rings, a grid of days, one day circled red.
  const cx = 152
  const cy = 6
  cv.box(cx, cy, 20, 26, P.outline)
  cv.box(cx + 1, cy + 1, 18, 24, P.paper)
  cv.box(cx + 1, cy + 1, 18, 5, P.red)
  cv.box(cx + 4, cy - 1, 2, 3, P.steelLo)
  cv.box(cx + 14, cy - 1, 2, 3, P.steelLo)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) cv.box(cx + 3 + c * 3, cy + 8 + r * 4, 2, 2, P.steel)
  cv.ring(cx + 3 + 3 * 3 + 1, cy + 8 + 2 * 4 + 1, 2, 3, P.red)
  cv.box(cx + 3 + 3 * 3, cy + 8 + 2 * 4, 2, 2, P.paper)

  // The clock and a plant.
  cv.blit('furniture/CLOCK.png', 174, -8)
  cv.blit('furniture/PLANT.png', 176, 40)

  // A ceiling fan, side on: a rod, a hub and two blades; the blades are the marker.
  cv.box(129, 3, 2, 3, P.steel)
  cv.box(128, 6, 4, 2, P.steelLo)
  cv.litBox(114, 8, 32, 2, m.fan)
  cv.box(114, 10, 32, 1, P.steelLo)

  // Three rows of desks, far to near, so nearer things cover farther ones.
  BACK_SEATS.forEach((s, k) => desk(cv, s.dx, s.dy, s, k + 2))

  return serialize(cv, { bg: ROOM.wall, veil: DAY_VEIL, dark: DAY_DARK, floor: [ROOM.floorA, ROOM.floorB] })
}

export const SCENE_ALT =
  'Lớp học ACCA kiểu pixel art, hai nhóm hai bên: bên trái thầy giáo chỉ bảng ghi ACCA cùng công thức và bảng cân đối, hai học viên ngồi bàn đầu; bên phải ba hàng học viên ngồi bàn có sách vở và máy tính cầm tay, vài bạn giơ tay, lịch thi khoanh đỏ, quạt trần và đồng hồ; ở giữa là sàn lớp trống'

// ---- the marketing room --------------------------------------------------------------

const MROOM = {
  wall: '#F0E2D6',
  wallTop: '#E4D2C2',
  rail: '#C9A58F',
  wain: '#DCC0AC',
  base: '#9A7560',
  floorA: '#D9B48A',
  floorB: '#CFA97F',
}

function marketing() {
  const cv = new Canvas(MROOM.wall)
  const m = MARKERS.marketing
  paintRoom(cv, MROOM)

  // ---- left zone: the discussion.
  // The moodboard: a cork board with pinned pictures and notes.
  const o = -2
  cv.box(6 + o, 3, 48, 28, P.woodSh)
  cv.box(7 + o, 4, 46, 26, '#C99A66')
  const pins = [
    [9, 6, 12, 9, '#E86F8F'],
    [23, 6, 9, 12, '#5FA8D9'],
    [34, 6, 16, 8, '#F2C94C'],
    [9, 18, 10, 9, '#7BC28A'],
    [21, 21, 12, 7, '#FFFFFF'],
    [35, 17, 14, 10, '#9B7FD6'],
  ]
  pins.forEach(([x, y, w, h, c]) => {
    cv.box(x + o, y, w, h, c)
    cv.box(x + o, y + h - 1, w, 1, mix(c, '#000000', 0.2))
    cv.px(x + o + (w >> 1), y, P.red)
  })
  cv.disc(16 + o, 10, 2, '#FFFFFF')
  cv.box(26 + o, 10, 4, 1, '#FFFFFF')
  cv.box(26 + o, 13, 4, 1, '#FFFFFF')
  cv.box(38 + o, 9, 8, 1, '#FFFFFF')
  cv.box(24 + o, 24, 8, 1, P.paperSh)

  // A poster.
  cv.box(62, 4, 18, 25, P.outline)
  cv.box(63, 5, 16, 23, '#7A5FD0')
  cv.disc(71, 13, 4, '#FFD166')
  cv.box(65, 21, 12, 2, '#FFFFFF')
  cv.box(65, 25, 8, 1, '#D9CCF5')

  // The campaign table. People behind it (front view) and at its ends (sides) are
  // drawn first, so the table covers their legs.
  const tx = 18
  const ty = 70
  cv.person(2, 0, 0, tx + 16, ty - 18)
  cv.person(4, 1, 2, tx - 12, ty - 12)
  cv.person(0, 1, 2, tx + 48, ty - 12, { flip: true })
  cv.box(tx, ty, 48, 22, P.woodSh)
  cv.box(tx + 1, ty + 1, 46, 19, P.wood)
  cv.box(tx + 1, ty + 1, 46, 1, P.woodHi)
  cv.box(tx, ty + 22, 48, 3, P.woodDk)
  cv.box(tx + 3, ty + 25, 4, 9, P.woodDk)
  cv.box(tx + 41, ty + 25, 4, 9, P.woodDk)
  // The plan spread on it: a big sheet, a timeline, sticky notes, a pen.
  cv.box(tx + 4, ty + 3, 26, 15, P.paper)
  cv.box(tx + 4, ty + 17, 26, 1, P.paperSh)
  cv.box(tx + 6, ty + 5, 10, 2, '#5FA8D9')
  cv.box(tx + 10, ty + 8, 12, 2, '#E86F8F')
  cv.box(tx + 14, ty + 11, 12, 2, '#7BC28A')
  cv.box(tx + 6, ty + 14, 8, 1, P.paperSh)
  cv.box(tx + 33, ty + 4, 6, 6, '#F2C94C')
  cv.box(tx + 40, ty + 6, 6, 6, '#F4A6BE')
  cv.box(tx + 33, ty + 12, 6, 6, '#B9E0A5')
  cv.line(tx + 20, ty + 16, tx + 25, ty + 18, P.red)
  // The near person, from behind, leaning over the table.
  cv.person(5, 1, 1, tx + 16, ty + 8)
  // Two speech bubbles: they are talking.
  const bubble = (x, y) => {
    cv.box(x, y, 12, 7, P.outline)
    cv.box(x + 1, y + 1, 10, 5, '#FFFFFF')
    for (const i of [3, 6, 9]) cv.px(x + i, y + 3, P.steel)
    cv.box(x + 3, y + 7, 2, 2, P.outline)
  }
  bubble(tx + 8, ty - 28)
  bubble(tx + 40, ty - 24)

  // The content corner, below the table (left zone): see after the desks.
  // ---- right zone: the work. The KPI board: a title and bars that rise, in the marker colour.
  const kf = boardFrame(cv, 108, 3, 44, 29)
  cv.text('KPI', kf.x + 2, kf.y + 2, P.steelLo)
  cv.line(kf.x + 14, kf.y + 16, kf.x + 36, kf.y + 6, '#E58A3A')
  ;[4, 7, 10, 13, 16].forEach((h, i) => cv.litBox(kf.x + 3 + i * 7, kf.y + 22 - h, 5, h, m.bar))
  cv.box(kf.x + 1, kf.y + 22, kf.w - 2, 1, P.paperSh)

  // A plant and the clock on the wall.
  cv.blit('furniture/PLANT.png', 176, 14)
  cv.blit('furniture/CLOCK.png', 156, -8)

  // Three desks with PCs.
  const station = (dx, dy, who, col, pc) => {
    cv.blit('furniture/DESK_FRONT.png', dx, dy)
    cv.blit(`furniture/PC_FRONT_ON_${pc}.png`, dx + 16, dy - 6)
    notebook(cv, dx + 5, dy + 15, '#C9892B')
    seat(cv, { who, col, dx, dy })
  }
  // 57 rows apart: from a monitor's top to the chair above it there are 11 rows of floor, as between the ACCA desks.
  station(112, 44, 3, 4, 1)
  station(112, 101, 1, 3, 2)
  station(112, 158, 4, 4, 3)

  // The content corner: a ring light and a camera on a tripod, and a phone.
  const rx = 6
  const ry = 118
  cv.box(rx + 5, ry + 16, 2, 30, P.steelLo)
  cv.line(rx + 6, ry + 46, rx, ry + 52, P.steelLo)
  cv.line(rx + 6, ry + 46, rx + 12, ry + 52, P.steelLo)
  cv.ring(rx + 6, ry + 8, 5, 8, m.ring, 'litPx')
  cv.disc(rx + 6, ry + 8, 4, P.dark)
  cv.px(rx + 6, ry + 8, P.steel)
  const kx = 32
  const ky = 126
  cv.box(kx, ky, 12, 8, P.dark)
  cv.box(kx + 1, ky - 2, 4, 2, P.steelLo)
  cv.disc(kx + 6, ky + 4, 3, P.steel)
  cv.disc(kx + 6, ky + 4, 2, '#3B4A63')
  cv.px(kx + 6, ky + 3, '#9DB7E0')
  cv.px(kx + 10, ky + 1, P.red)
  cv.box(kx + 5, ky + 8, 2, 6, P.steelLo)
  cv.line(kx + 6, ky + 14, kx, ky + 40, P.steelLo)
  cv.line(kx + 6, ky + 14, kx + 12, ky + 40, P.steelLo)
  cv.line(kx + 6, ky + 14, kx + 6, ky + 42, P.steelLo)
  // The phone on a small table, a heart on its screen.
  cv.blit('furniture/SMALL_TABLE_FRONT.png', 50, 132)
  const hx = 62
  const hy = 132
  cv.box(hx, hy, 9, 13, P.dark)
  cv.box(hx + 1, hy + 1, 7, 10, '#F4A6BE')
  cv.box(hx + 3, hy + 12, 3, 1, P.steel)
  ;['01010', '11111', '01110', '00100'].forEach((row, r) => [...row].forEach((bit, i) => bit === '1' && cv.litPx(hx + 2 + i, hy + 3 + r, m.heart)))

  return serialize(cv, { bg: MROOM.wall, veil: DAY_VEIL, dark: DAY_DARK, floor: [MROOM.floorA, MROOM.floorB] })
}

export const MARKETING_ALT =
  'Phòng Marketing kiểu pixel art, hai nhóm hai bên: bên trái nhóm bàn bạc quanh bàn chiến dịch trải kế hoạch, tường dán bảng ý tưởng và poster; bên phải nhóm làm việc ở ba bàn máy tính, bảng KPI cột đang tăng, góc nội dung có đèn ring light và máy quay trên chân đế; ở giữa là sàn phòng trống'

// ---- the IT room (dark) ---------------------------------------------------------------

// The IT room by day (a light wall and floor, lights on) and by night. The two differ only in
// the room's own cells; racks, desks, people and the lit layer are the same in both.
const IROOM_DAY = {
  wall: '#DCE5F2',
  wallTop: '#C9D5E8',
  rail: '#9FB2D4',
  wain: '#C3D1E8',
  base: '#7F93B8',
  floorA: '#CFD9EA',
  floorB: '#C3CFE4',
}
const IROOM_NIGHT = {
  wall: '#1D2545',
  wallTop: '#161C38',
  rail: '#2D3866',
  wain: '#232C52',
  base: '#10152B',
  floorA: '#1A2140',
  floorB: '#171D38',
}
const itNight = c => Object.entries(IROOM_DAY).find(([, v]) => v === c.toUpperCase())?.[0]

// A server rack 18 wide and 44 tall: eight slots, each with LEDs.
function rack(cv, x, y, open, m) {
  cv.box(x, y, 18, 44, P.dark)
  cv.box(x + 1, y + 1, 16, 42, '#323A5E')
  cv.box(x + 1, y + 1, 16, 1, '#4A5585')
  for (let u = 0; u < 8; u++) {
    const uy = y + 3 + u * 5
    cv.box(x + 2, uy, 14, 4, '#1B2038')
    cv.box(x + 2, uy, 14, 1, '#3D4770')
    cv.box(x + 4, uy + 2, 6, 1, '#4A5585')
    cv.litPx(x + 12, uy + 2, u === 3 && !open ? m.status : m.led)
    cv.litPx(x + 14, uy + 2, m.led)
  }
  cv.box(x + 3, y + 44, 12, 2, P.dark)
  if (open) {
    // The door swung wide to the left: a perforated panel seen at an angle.
    cv.box(x - 7, y - 1, 7, 46, P.outline)
    cv.box(x - 6, y, 5, 44, '#3A4470')
    for (let r = 0; r < 14; r++) cv.px(x - 4, y + 4 + r * 3, '#1B2038')
    cv.box(x - 1, y + 20, 2, 5, P.steelHi)
  }
}

// A one-cell dark rim around each person, in the lit layer (the pixel-art outline): the sprite itself is
// never touched, and the person reads against a light day wall and a dark night wall alike.
export const RIM = '#0B1636'
// People with darker hair and clothes (the two at desks) get a light rim instead: dark on light reads in a light room
// and in a dark one alike, where a dark rim would melt into the night wall.
export const RIM_LIGHT = '#DDE5F7'

// Who is in the IT room (character sheets). One person tends the monitoring dashboard on the left (from
// behind), one tends the server racks on the right (side view); four engineers sit at desks, two in each zone.
export const DASH_TENDER = 3
export const RACK_TENDER = 2
// The desks' sprite corners (the first two are in the left zone, the last two in the right one); a person at
// a desk sits at the viz seat of it (SEAT). Rows are 57 apart: 11 rows of floor show between a monitor and the chair above it, as between the ACCA desks.
export const IT_DESKS = [
  { x: 20, y: 80, who: 1, col: 4, pcs: [1, 2] },
  { x: 20, y: 137, who: 4, col: 3, pcs: [3, 1] },
  { x: 108, y: 80, who: 0, col: 3, pcs: [2, 3] },
  { x: 108, y: 137, who: 5, col: 4, pcs: [1, 3] },
]
export const IT_PEOPLE = [
  { n: DASH_TENDER, col: 1, row: 1, x: 36, y: 40, rim: RIM },
  { n: RACK_TENDER, col: 1, row: 2, x: 134, y: 30, rim: RIM_LIGHT },
  ...IT_DESKS.map(d => ({ n: d.who, col: d.col, row: 1, x: d.x + SEAT.x, y: d.y + SEAT.y, rim: RIM_LIGHT })),
]
// The coffee cup stands on the last desk's top surface (desk sprite rows 12 to 24): its opaque rows are 0 to 6.
export const COFFEE_AT = { x: IT_DESKS[3].x + 28, y: IT_DESKS[3].y + 16 }
// The cells a frame paints (pixels at least half opaque), as 'x,y' keys.
export function personCells({ n, col, row, x, y }) {
  const img = sprite(`characters/char_${n}.png`)
  const out = new Set()
  for (let j = 0; j < 32; j++) for (let i = 0; i < 16; i++) if (img.rgba[((row * 32 + j) * img.width + col * 16 + i) * 4 + 3] >= 128) out.add(`${x + i},${y + j}`)
  return out
}

// `people: false` builds the same room with nobody in it (the contrast test measures them against it).
// The seated people and their chairs have no outline (an outline round person and chair together made the chair look lifted
// off the floor); only the two who stand are outlined.
function itRoom({ people = true, outline = true } = {}) {
  const cv = new Canvas(IROOM_DAY.wall)
  const m = MARKERS.it
  paintRoom(cv, IROOM_DAY)
  // Ceiling lights: two long panels, on, one over each zone.
  for (const x of [20, 128]) cv.box(x, 0, 28, 2, '#FFF6D8')

  // ---- left zone: one person at the monitoring wall. The big screen: three panels, the left one a graph.
  cv.box(4, 3, 80, 33, P.outline)
  cv.box(5, 4, 78, 31, '#10152B')
  cv.box(5, 4, 78, 1, '#4A5585')
  // Panel 1: a line chart (the marker line on its own background), a wave that
  // repeats every 16 cells so the shader can scroll it.
  cv.litBox(GRAPH_PANEL.x, GRAPH_PANEL.y, GRAPH_PANEL.w, GRAPH_PANEL.h, GRAPH_BG)
  const wave = [14, 13, 11, 8, 6, 5, 6, 9, 11, 12, 10, 7, 5, 4, 7, 11]
  for (let i = 0; i < GRAPH_PANEL.w; i++) {
    const y = 8 + wave[i % 16] + 4
    const yn = 8 + wave[(i + 1) % 16] + 4
    for (let k = Math.min(y, yn); k <= Math.max(y, yn); k++) if (i + 1 < GRAPH_PANEL.w || k === y) cv.litPx(GRAPH_PANEL.x + i, k, m.graph)
  }
  cv.text('CPU', 12, 10, '#8FA3D6', 'litPx')
  // Panel 2: bars. Panel 3: status lights and text lines.
  cv.litBox(61, 8, 22, 11, '#13203A')
  ;[5, 8, 4, 9, 6].forEach((h, i) => cv.litBox(63 + i * 4, 18 - h, 3, h, '#E0A53A'))
  cv.litBox(61, 21, 22, 11, '#13203A')
  for (let r = 0; r < 3; r++) {
    cv.litBox(63, 23 + r * 3, 2, 2, r === 1 ? '#E0A53A' : '#5FD08A')
    cv.litBox(67, 23 + r * 3, 8 + r * 3, 1, '#4A5585')
  }
  cv.blit('furniture/PLANT.png', 64, 40)

  // The people are in the lit layer, each with a one-cell rim.
  const rim = person => {
    if (!outline) return
    const own = personCells(person)
    for (const k of own) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [x, y] = k.split(',').map(Number)
        if (!own.has(`${x + dx},${y + dy}`)) cv.litPx(x + dx, y + dy, person.rim)
      }
    }
  }
  if (people) {
    for (const person of IT_PEOPLE.slice(0, 2)) {
      rim(person)
      cv.litPerson(person.n, person.col, person.row, person.x, person.y)
    }
  }
  // ---- right zone: the engineers. Racks along the wall: three, the middle one open, LEDs in the marker colour.
  rack(cv, 116, 6, false, m)
  rack(cv, 142, 6, true, m)
  rack(cv, 168, 6, false, m)

  // Tidy cables: a tray along the top of the racks, drops, and floor trunking.
  cv.box(114, 3, 76, 2, P.steelLo)
  const cables = ['#3F6BFF', '#F2C94C', '#FF8A5C', '#5FD08A']
  cables.forEach((c, i) => {
    cv.box(121 + i, 5, 1, 3, c)
    cv.box(173 + i, 5, 1, 3, c)
  })
  cv.box(112, 56, 76, 3, P.dark)
  cv.box(112, 56, 76, 1, '#3D4770')
  ;[122, 148, 174].forEach((x, i) => {
    cables.slice(0, 3).forEach((c, k) => cv.box(x + k * 2, 50, 1, 6, c))
    cv.box(x + 6, 50, 1, 6, cables[(i + 1) % 4])
  })

  // Four desks, each with two monitors flanking the person at it (desk, monitors, person, chair back over the legs).
  for (const desk of IT_DESKS) {
    cv.blit('furniture/DESK_FRONT.png', desk.x, desk.y)
    cv.blit(`furniture/PC_FRONT_ON_${desk.pcs[0]}.png`, desk.x + 2, desk.y - 6)
    cv.blit(`furniture/PC_FRONT_ON_${desk.pcs[1]}.png`, desk.x + 30, desk.y - 6)
    seat(cv, { who: people ? desk.who : null, col: desk.col, dx: desk.x, dy: desk.y, lit: true })
  }
  // A coffee cup on the last desk's top surface, a plant by the wall and a big one in the corner.
  cv.blit('furniture/COFFEE.png', COFFEE_AT.x, COFFEE_AT.y)
  cv.blit('furniture/PLANT.png', 182, 18)
  cv.blit('furniture/LARGE_PLANT.png', 158, 124)

  return serialize(cv, {
    bg: IROOM_DAY.wall,
    veil: { light: ['#FAF8F3', '.18'], dark: ['#0B1636', '.36'] },
    dark: { bg: IROOM_NIGHT.wall, of: c => IROOM_NIGHT[itNight(c)] ?? c },
    floor: [IROOM_DAY.floorA, IROOM_DAY.floorB],
  })
}

export const IT_ALT =
  'Phòng IT kiểu pixel art, sáng ban ngày và tối về đêm, hai nhóm hai bên: bên trái hai người đứng họp trước màn hình giám sát lớn, bàn nhỏ có laptop; bên phải ba tủ rack có đèn LED và một tủ đang mở cửa, hai kỹ sư ngồi bàn hai màn hình, cáp gọn gàng, cốc cà phê và chậu cây; ở giữa là sàn phòng trống'

// ---- the modules -----------------------------------------------------------------------

export const SCENES = {
  classroom: { build: classroom, out: 'hooks/scene.js', names: ['SCENE_SVG', 'SCENE_ALT'], alt: SCENE_ALT },
  marketing: { build: marketing, out: 'hooks/scene-marketing.js', names: ['MARKETING_SVG', 'MARKETING_ALT'], alt: MARKETING_ALT },
  it: { build: itRoom, out: 'hooks/scene-it.js', names: ['IT_SVG', 'IT_ALT'], alt: IT_ALT },
}

export const buildScene = (name = 'classroom') => SCENES[name].build()
// What a scene draws, in order (sprite blits and seats), for the seating tests.
export function buildTrace(name) {
  SCENES[name].build()
  return lastTrace
}
// The IT room with nobody in it, for measuring the people against their surroundings.
export const buildItWithoutPeople = () => itRoom({ people: false })
export const buildItWithoutRim = () => itRoom({ outline: false })

export function buildSceneModule(name = 'classroom') {
  const { build, names, alt } = SCENES[name]
  return (
    '// Generated by scripts/build-scene.mjs from the sprites in assets/. Do not edit by hand:\n' +
    '// run `npm run build:scene` and commit the result. Sprites: see assets/LICENSE-pixel-agents.txt.\n' +
    `export const ${names[0]} = ${JSON.stringify(build())}\n` +
    `export const ${names[1]} = ${JSON.stringify(alt)}\n`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const name of Object.keys(SCENES)) {
    const out = fileURLToPath(new URL(SCENES[name].out, here))
    const source = buildSceneModule(name)
    writeFileSync(out, source)
    console.log(`wrote ${out} (${source.length} characters)`)
  }
}
