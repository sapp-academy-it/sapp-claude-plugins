// Builds hooks/scene.js: the backdrop Svg, an ACCA classroom composed from the
// pixel sprites in assets/ (see assets/LICENSE-pixel-agents.txt).
//
//   node plugins/sapp-brand/scripts/build-scene.mjs
//
// No network and nothing but the sprite files is read. Every sprite pixel is one
// cell of a grid; horizontal runs of one colour merge into one rect, and the Svg
// is scaled by the integer SCALE (width and height are SCALE times the viewBox) with crisp edges. No raster image is embedded.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inflateSync } from 'node:zlib'

export const GRID_W = 192
export const GRID_H = 136
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

// The room (wall, floor, trim) is our own; sprites keep their colours as drawn.
const ROOM = {
  wall: '#EADFC4',
  wallTop: '#DCCFAE',
  rail: '#BFA77A',
  wain: '#CDB584',
  base: '#8F7650',
  floorA: '#C9A56B',
  floorB: '#BE9A60',
}

// The screen glow marker the shader looks for: the only cell colour with green
// far above both red and blue (see the glow test).
export const SCREEN_LIT = '#00FF8C'
const SCREEN_GLYPH = '#60c677'

// ---- the cell grid -----------------------------------------------------------
// A cell is 'r#RRGGBB' (room) or 's#RRGGBB' (sprite, never recoloured).

const cells = new Array(GRID_W * GRID_H).fill('r' + ROOM.wall)
const lit = new Map() // post-veil cells: index -> '#RRGGBB'

const inside = (x, y) => x >= 0 && y >= 0 && x < GRID_W && y < GRID_H
const putRoom = (x, y, c) => {
  if (inside(x, y)) cells[y * GRID_W + x] = 'r' + c
}
const rect = (x, y, w, h, c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) putRoom(x + i, y + j, c)
}

// Alpha-blend one sprite pixel over what is already there.
function putSprite(x, y, [r, g, b, a]) {
  if (!inside(x, y) || a === 0) return
  const under = cells[y * GRID_W + x].slice(1)
  cells[y * GRID_W + x] = 's' + mix(under, toHex([r, g, b]), a / 255)
}

// Draw a rectangle of a sprite sheet at (x, y).
function blit(path, x, y, { sx = 0, sy = 0, w, h, onPixel } = {}) {
  const img = sprite(path)
  const sw = w ?? img.width - sx
  const sh = h ?? img.height - sy
  for (let j = 0; j < sh; j++) {
    for (let i = 0; i < sw; i++) {
      const o = ((sy + j) * img.width + sx + i) * 4
      const px = [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2], img.rgba[o + 3]]
      if (onPixel?.(i, j, px)) continue
      putSprite(x + i, y + j, px)
    }
  }
}

const frame = (n, col, row, x, y) => blit(`characters/char_${n}.png`, x, y, { sx: col * 16, sy: row * 32, w: 16, h: 32 })

// ---- the room ------------------------------------------------------------------

const WALL_H = 40

function paintRoom() {
  rect(0, 0, GRID_W, WALL_H, ROOM.wall)
  rect(0, 0, GRID_W, 3, ROOM.wallTop)
  rect(0, 28, GRID_W, 12, ROOM.wain)
  rect(0, 28, GRID_W, 1, ROOM.rail)
  rect(0, WALL_H, GRID_W, 2, ROOM.base)
  for (let y = WALL_H + 2; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const checker = (Math.floor(x / 16) + Math.floor((y - WALL_H - 2) / 16)) % 2
      putRoom(x, y, checker ? ROOM.floorA : ROOM.floorB)
    }
  }
}

// ---- the board: the whiteboard sprite, widened, with ACCA at the sprite's scale ----

// 5 by 7 pixel letters.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
}
const BOARD_EXTRA = 12 // columns repeated to widen the 32-pixel sprite
const BOARD_REPEAT = 14 // a plain column of the board face

function paintBoard(x0, y0) {
  const img = sprite('furniture/WHITEBOARD.png')
  const at = (x, y) => {
    const o = (y * img.width + x) * 4
    return [img.rgba[o], img.rgba[o + 1], img.rgba[o + 2], img.rgba[o + 3]]
  }
  const face = toHex(at(BOARD_REPEAT, 14))
  const ink = toHex(at(7, 13)) // the colour of the sprite's own marks
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width + BOARD_EXTRA; x++) {
      const from = x < BOARD_REPEAT ? x : x < BOARD_REPEAT + BOARD_EXTRA ? BOARD_REPEAT : x - BOARD_EXTRA
      const px = at(from, y)
      // The sprite's sample scribbles give way to the word.
      if (y >= 12 && y <= 20 && from >= 5 && from <= 26 && toHex(px) === ink) {
        putSprite(x0 + x, y0 + y, [...toRgb(face), 255])
      } else putSprite(x0 + x, y0 + y, px)
    }
  }
  const text = 'ACCA'
  const width = text.length * 5 + (text.length - 1)
  const left = x0 + 5 + Math.floor((22 + BOARD_EXTRA - width) / 2)
  const top = y0 + 12 + 1
  text.split('').forEach((ch, index) => {
    FONT[ch].forEach((row, r) => {
      row.split('').forEach((bit, c) => {
        if (bit === '1') putSprite(left + index * 6 + c, top + r, [...toRgb(ink), 255])
      })
    })
  })
}

// ---- desks, PCs, chairs, people ------------------------------------------------

const COLS = [14, 72, 130]
const ROWS = [43, 83]
// char file, typing frame column (3 or 4), PC frame (1 to 3; 0 = off, empty seat)
const SEATS = [
  [[0, 3, 1], [1, 4, 2], [2, 3, 3]],
  [[null, 0, 0], [3, 4, 1], [4, 3, 2]],
]

function station(dx, dy, [who, col, pc]) {
  blit('furniture/DESK_FRONT.png', dx, dy)
  const pcName = pc === 0 ? 'PC_FRONT_OFF' : `PC_FRONT_ON_${pc}`
  const px = dx + 6
  const py = dy - 1
  blit(`furniture/${pcName}.png`, px, py)
  if (pc !== 0) {
    // The lit screen sits above the veil: its glyph cells carry the glow marker.
    const img = sprite(`furniture/${pcName}.png`)
    for (let j = 5; j <= 9; j++) {
      for (let i = 3; i <= 12; i++) {
        const o = (j * img.width + i) * 4
        const c = toHex([img.rgba[o], img.rgba[o + 1], img.rgba[o + 2]])
        lit.set((py + j) * GRID_W + px + i, c.toLowerCase() === SCREEN_GLYPH ? SCREEN_LIT : c)
      }
    }
  }
  const sx = dx + 24
  const sy = dy + 13
  if (who !== null) frame(who, col, 1, sx, sy)
  blit('furniture/WOODEN_CHAIR_BACK.png', sx, sy + 9)
}

// ---- merging cells into rects --------------------------------------------------

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

const scaled = r =>
  `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`

// Dark mode sinks the room's own colours toward ink; sprites are never recoloured
// (the dark veil alone mutes them).
const darkOf = c => mix(c, INK, 0.55)

export function buildScene() {
  cells.fill('r' + ROOM.wall)
  lit.clear()
  paintRoom()

  // Wall: board, clock, plants.
  paintBoard(74, 1)
  blit('furniture/CLOCK.png', 38, -1)
  blit('furniture/PLANT.png', 10, 14)
  blit('furniture/PLANT.png', 166, 14)
  // The teacher beside the board, holding the clipboard.
  frame(5, 5, 0, 118, 18)

  // Rows from far to near, so nearer things cover farther ones.
  SEATS.forEach((row, r) => row.forEach((seat, c) => station(COLS[c], ROWS[r], seat)))

  const rects = toRuns(i => cells[i], null)
  const keys = [...new Set(rects.map(r => r.c))].sort()
  const classOf = new Map(keys.map((k, i) => [k, `c${i}`]))

  const css = [
    `.bg{fill:${ROOM.wall}}`,
    '.veil{fill:#FAF8F3;opacity:.34}',
    ...keys.map(k => `.${classOf.get(k)}{fill:${k.slice(1)}}`),
    '@media (prefers-color-scheme: dark){',
    `.bg{fill:${INK}}`,
    '.veil{fill:' + INK + ';opacity:.5}',
    ...keys.filter(k => k[0] === 'r').map(k => `.${classOf.get(k)}{fill:${darkOf(k.slice(1))}}`),
    '}',
  ].join('')

  const groups = keys.map(k => {
    const body = rects
      .filter(r => r.c === k)
      .map(scaled)
      .join('')
    return `<g class="${classOf.get(k)}">${body}</g>`
  })

  const litRects = toRuns(i => lit.get(i) ?? null, null)
  const litColors = [...new Set(litRects.map(r => r.c))].sort()
  const litGroups = litColors.map(
    c =>
      `<g fill="${c}">${litRects
        .filter(r => r.c === c)
        .map(scaled)
        .join('')}</g>`,
  )

  const W = GRID_W
  const H = GRID_H
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * SCALE}" height="${H * SCALE}" ` +
    `preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
    `<style>${css}</style>` +
    `<rect class="bg" width="${W}" height="${H}"/>` +
    groups.join('') +
    `<rect class="veil" width="${W}" height="${H}"/>` +
    litGroups.join('') +
    `</svg>`
  )
}

export const SCENE_ALT =
  'Lớp học ACCA kiểu pixel art: bảng trắng ghi ACCA, thầy giáo cạnh bảng, học viên ngồi trước máy tính, chậu cây và đồng hồ'

export function buildSceneModule() {
  return (
    '// Generated by scripts/build-scene.mjs from the sprites in assets/. Do not edit by hand:\n' +
    '// run `npm run build:scene` and commit the result. Sprites: see assets/LICENSE-pixel-agents.txt.\n' +
    `export const SCENE_SVG = ${JSON.stringify(buildScene())}\n` +
    `export const SCENE_ALT = ${JSON.stringify(SCENE_ALT)}\n`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = fileURLToPath(new URL('hooks/scene.js', here))
  const source = buildSceneModule()
  writeFileSync(out, source)
  console.log(`wrote ${out} (${source.length} characters)`)
}
