// The backdrop scene: an isometric pixel-art ACCA classroom, drawn by code.
//
// Pure computation, no file or network access. The scene is painted on a grid
// of cells (one rect = one run of equal cells), then runs are merged so the
// markup stays far below the 131,072-character limit of an Svg.
//
// Projection: sx = OX + 2 * (x - y), sy = OY + (x + y) - z. The viewer stands
// at +x +y; the blackboard hangs on the wall y = 0 (right), a window on x = 0.

export const GRID_W = 200
export const GRID_H = 112

const OX = 100
const OY = 30
const ROOM = 34
const WALL = 26

const INK = '#1A1916'

// ---- colour helpers --------------------------------------------------------

const toRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const toHex = rgb =>
  '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mix = (a, b, t) => {
  const [r1, g1, b1] = toRgb(a)
  const [r2, g2, b2] = toRgb(b)
  return toHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t])
}
const lighten = (c, t) => mix(c, '#FFFFFF', t)
const darken = (c, t) => mix(c, INK, t)

// Dark mode keeps the same drawing in lamp-lit tones: colours sink toward ink,
// lit things (chalk, lamps, window glow) sink less.
const KEEP = new Set()
const darkOf = c => mix(c, INK, KEEP.has(c) ? 0.25 : 0.55)

// ---- the cell grid ---------------------------------------------------------

function makeCanvas(width, height, background) {
  const cells = new Array(width * height).fill(background)
  const put = (x, y, c) => {
    if (x >= 0 && y >= 0 && x < width && y < height) cells[y * width + x] = c
  }
  return { cells, put }
}

// ---- projection and polygons -----------------------------------------------

const proj = (x, y, z) => [OX + 2 * (x - y), OY + (x + y) - z]

function pointInPolygon(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function fillPoly(canvas, points3d, color) {
  const poly = points3d.map(p => proj(...p))
  const xs = poly.map(p => p[0])
  const ys = poly.map(p => p[1])
  const x0 = Math.floor(Math.min(...xs))
  const x1 = Math.ceil(Math.max(...xs))
  const y0 = Math.floor(Math.min(...ys))
  const y1 = Math.ceil(Math.max(...ys))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) canvas.put(x, y, color)
    }
  }
}

// A box with a lit top, a lit left face (y = y1) and a shaded right face (x = x1).
function box(canvas, [x0, x1], [y0, y1], [z0, z1], tones) {
  const { top, left, right } = tones
  fillPoly(canvas, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], right)
  fillPoly(canvas, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], left)
  fillPoly(canvas, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], top)
}

const tones = c => ({ top: lighten(c, 0.22), left: c, right: darken(c, 0.2) })

// A quad on the left-back wall (plane x = 0): y along the wall, z up.
const leftWall = (canvas, [ya, yb], [za, zb], color, inset = 0) =>
  fillPoly(canvas, [[inset, ya, za], [inset, yb, za], [inset, yb, zb], [inset, ya, zb]], color)

// A quad on the right-back wall (plane y = 0): x along the wall, z up.
const rightWall = (canvas, [xa, xb], [za, zb], color, inset = 0) =>
  fillPoly(canvas, [[xa, inset, za], [xb, inset, za], [xb, inset, zb], [xa, inset, zb]], color)

// ---- palette ---------------------------------------------------------------

const P = {
  bg: '#F2EEE6',
  floorA: '#E8D5AE',
  floorB: '#DDC698',
  wallLeft: '#FFF1D1',
  wallRight: '#F3E3BA',
  wainLeft: '#E9C97A',
  wainRight: '#D9B863',
  trim: '#C9C2B5',
  frame: '#946800',
  board: '#2A2823',
  boardEdge: '#3D3A33',
  chalk: '#F6F1E3',
  chalkGold: '#FFC23D',
  tray: '#C28800',
  wood: '#D9B27A',
  legs: '#6B4C00',
  seat: '#79736A',
  window: '#CFE3F5',
  windowSill: '#FAF8F3',
  windowFrame: '#FAF8F3',
  clockFace: '#FAF8F3',
  clockRim: '#57534A',
  shelf: '#A6834F',
  plant: '#1F8A5B',
  pot: '#C28800',
  skinA: '#F0C9A0',
  skinB: '#C98F5F',
  skinC: '#8E5B3A',
  hairA: '#2A2823',
  hairB: '#6B4C00',
  hairC: '#1A1916',
  gold: '#FFB700',
  amber: '#F59E0B',
  inkShirt: '#3D3A33',
  cream: '#FAF8F3',
  blue: '#2A6FDB',
  lampFixture: '#57534A',
  bulb: '#FFEE22',
  halo: '#FFEE22',
}
// Colours the dark mode keeps brighter.
for (const c of [P.chalk, P.chalkGold, P.window, P.clockFace]) KEEP.add(c)

// ---- the classroom ---------------------------------------------------------

const FONT = {
  A: ['010', '101', '111', '101', '101'],
  C: ['011', '100', '100', '100', '011'],
}

function paintRoom(canvas) {
  // Floor: warm wood in two checkered tones, found by inverting the projection.
  for (let sy = 0; sy < GRID_H; sy++) {
    for (let sx = 0; sx < GRID_W; sx++) {
      const a = sx + 0.5 - OX
      const b = sy + 0.5 - OY
      const x = (b + a / 2) / 2
      const y = (b - a / 2) / 2
      if (x >= 0 && x < ROOM && y >= 0 && y < ROOM) {
        const checker = (Math.floor(x / 3) + Math.floor(y / 3)) % 2
        canvas.put(sx, sy, checker ? P.floorA : P.floorB)
      }
    }
  }

  // Back walls.
  leftWall(canvas, [0, ROOM], [0, WALL], P.wallLeft)
  rightWall(canvas, [0, ROOM], [0, WALL], P.wallRight)
  leftWall(canvas, [0, ROOM], [0, 7], P.wainLeft)
  rightWall(canvas, [0, ROOM], [0, 7], P.wainRight)
  leftWall(canvas, [0, ROOM], [7, 8], P.trim)
  rightWall(canvas, [0, ROOM], [7, 8], P.trim)
  leftWall(canvas, [0, ROOM], [WALL - 1, WALL], P.trim)
  rightWall(canvas, [0, ROOM], [WALL - 1, WALL], P.trim)

  // Window on the left wall.
  leftWall(canvas, [9, 25], [10, 22], P.windowFrame)
  leftWall(canvas, [10, 24], [11, 21], P.window)
  leftWall(canvas, [16.6, 17.4], [11, 21], P.windowFrame)
  leftWall(canvas, [10, 24], [15.6, 16.4], P.windowFrame)
  leftWall(canvas, [8, 26], [9, 10], P.windowSill)

  // Clock and a small poster on the right wall.
  rightWall(canvas, [16, 20], [21, 25], P.clockRim)
  rightWall(canvas, [16.6, 19.4], [21.6, 24.4], P.clockFace)
  rightWall(canvas, [17.8, 18.2], [22.4, 23.8], P.inkShirt)
  rightWall(canvas, [17.8, 19], [22.8, 23.2], P.inkShirt)
  rightWall(canvas, [30, 33], [9, 16], P.gold)
  rightWall(canvas, [30.4, 32.6], [10, 15], P.cream)
  rightWall(canvas, [30.8, 32.2], [12.2, 12.6], P.amber)

  // Blackboard: frame, board, chalk tray.
  rightWall(canvas, [5, 29], [8, 23], P.frame)
  rightWall(canvas, [5.6, 28.4], [9, 22.4], P.board)
  rightWall(canvas, [5.6, 28.4], [21.8, 22.4], P.boardEdge)
  rightWall(canvas, [6, 28], [8, 9], P.tray)

  // ACCA in chalk, 3 by 5 font pixels per letter.
  const text = 'ACCA'
  const unitW = 1.4
  const unitH = 1.7
  const textW = (text.length * 3 + (text.length - 1)) * unitW
  const startU = (5.6 + 28.4) / 2 - textW / 2
  const startV = 12.6
  text.split('').forEach((ch, index) => {
    FONT[ch].forEach((row, r) => {
      row.split('').forEach((bit, c) => {
        if (bit !== '1') return
        const u = startU + (index * 4 + c) * unitW
        const v = startV + (4 - r) * unitH
        rightWall(canvas, [u, u + unitW], [v, v + unitH], P.chalk, 0.01)
      })
    })
  })
  // A T-account under the word, drawn in gold chalk.
  rightWall(canvas, [12, 22], [11.6, 12.2], P.chalkGold, 0.01)
  rightWall(canvas, [16.7, 17.3], [9.6, 12.2], P.chalkGold, 0.01)
  rightWall(canvas, [13, 15.5], [10.4, 10.8], P.chalk, 0.01)
  rightWall(canvas, [18.5, 21], [10.4, 10.8], P.chalk, 0.01)

  // Bookshelf under the window side of the left wall.
  box(canvas, [0, 3], [27, 33], [0, 15], tones(P.shelf))
  const books = [P.gold, P.cream, P.amber, P.blue, P.gold, P.inkShirt]
  books.forEach((b, i) => leftWall(canvas, [27.5 + i * 0.9, 28.2 + i * 0.9], [9, 13], b, 3.01))
  books.forEach((b, i) => leftWall(canvas, [27.5 + i * 0.9, 28.2 + i * 0.9], [3.5, 7.5], b, 3.01))

  // Plant in the right corner.
  box(canvas, [29, 32], [2, 5], [0, 3], tones(P.pot))
  box(canvas, [29.4, 31.6], [2.4, 4.6], [3, 9], tones(P.plant))
}

function desk(canvas, x0, y0) {
  // Legs, then the top.
  const legTone = tones(P.legs)
  for (const [lx, ly] of [[x0, y0], [x0 + 5, y0], [x0, y0 + 3], [x0 + 5, y0 + 3]]) {
    box(canvas, [lx, lx + 1], [ly, ly + 1], [0, 6], legTone)
  }
  box(canvas, [x0, x0 + 6], [y0, y0 + 4], [6, 7], tones(P.wood))
}

function chair(canvas, x0, y0) {
  box(canvas, [x0 + 2, x0 + 4], [y0 + 5, y0 + 7], [3, 4], tones(P.seat))
  box(canvas, [x0 + 2, x0 + 4], [y0 + 5, y0 + 5.5], [0, 3], tones(P.legs))
  box(canvas, [x0 + 2, x0 + 4], [y0 + 7, y0 + 7.6], [4, 7], tones(P.seat))
}

function student(canvas, x0, y0, { shirt, skin, hair }) {
  const torso = tones(shirt)
  box(canvas, [x0 + 2, x0 + 4], [y0 + 5, y0 + 7], [4, 10], torso)
  // Arms resting toward the desk.
  box(canvas, [x0 + 1.4, x0 + 2], [y0 + 4.2, y0 + 6.4], [7, 9], torso)
  box(canvas, [x0 + 4, x0 + 4.6], [y0 + 4.2, y0 + 6.4], [7, 9], torso)
  box(canvas, [x0 + 2.2, x0 + 3.8], [y0 + 5.2, y0 + 6.8], [10, 13], tones(skin))
  box(canvas, [x0 + 2.1, x0 + 3.9], [y0 + 5.9, y0 + 6.9], [11.4, 13.6], tones(hair))
}

function teacher(canvas, x0, y0) {
  const suit = tones(P.inkShirt)
  box(canvas, [x0 + 0.2, x0 + 1.3], [y0 + 0.3, y0 + 1.4], [0, 8], tones(INK))
  box(canvas, [x0 + 1.5, x0 + 2.6], [y0 + 0.3, y0 + 1.4], [0, 8], tones(INK))
  box(canvas, [x0, x0 + 2.8], [y0 + 0.1, y0 + 1.6], [8, 16], suit)
  box(canvas, [x0 + 1, x0 + 1.8], [y0 + 1.6, y0 + 1.8], [10, 15], tones(P.gold))
  box(canvas, [x0 + 0.3, x0 + 2.5], [y0 + 0.3, y0 + 1.5], [16, 19.4], tones(P.skinB))
  box(canvas, [x0 + 0.2, x0 + 2.6], [y0 + 0.5, y0 + 1.6], [18, 20.2], tones(P.hairC))
  // The raised arm and its pointer toward the board.
  box(canvas, [x0 + 2.6, x0 + 3.4], [y0 + 0.4, y0 + 1.2], [13, 16], suit)
  box(canvas, [x0 + 2.9, x0 + 3.2], [y0 - 3.5, y0 + 0.4], [15.2, 15.6], tones(P.tray))
}

const SEATS = [
  { x: 4, y: 8, who: { shirt: P.gold, skin: P.skinA, hair: P.hairA } },
  { x: 20, y: 8, who: null },
  { x: 4, y: 15, who: null },
  { x: 20, y: 15, who: { shirt: P.cream, skin: P.skinB, hair: P.hairC } },
  { x: 4, y: 22, who: { shirt: P.amber, skin: P.skinC, hair: P.hairA } },
  { x: 20, y: 22, who: { shirt: P.blue, skin: P.skinA, hair: P.hairB } },
]

function paintFurniture(canvas) {
  // Far to near, so nearer things cover farther ones.
  const things = SEATS.map(seat => ({ depth: seat.x + seat.y, seat }))
  things.push({ depth: 3, teacher: true })
  things.sort((a, b) => a.depth - b.depth)
  for (const thing of things) {
    if (thing.teacher) {
      teacher(canvas, 1.2, 1.5)
      continue
    }
    const { x, y, who } = thing.seat
    desk(canvas, x, y)
    chair(canvas, x, y)
    if (who) student(canvas, x, y, who)
  }
}

// ---- lamps (drawn last, above the veil, so they stay the brightest cells) --

const LAMPS = [
  { wall: 'left', at: 4.5, z: 19 },
  { wall: 'left', at: 30.5, z: 19 },
  { wall: 'right', at: 31.5, z: 21 },
]

function lampCells() {
  const cells = []
  for (const lamp of LAMPS) {
    const [cx, cy] =
      lamp.wall === 'left' ? proj(0.01, lamp.at, lamp.z) : proj(lamp.at, 0.01, lamp.z)
    cells.push({ cx, cy })
  }
  return cells
}

// ---- merging cells into rects ----------------------------------------------

function toRuns(cells, width, height, background) {
  // Horizontal runs per row, then stack identical runs of consecutive rows.
  const open = new Map()
  const rects = []
  for (let y = 0; y < height; y++) {
    const rowRuns = new Map()
    let x = 0
    while (x < width) {
      const c = cells[y * width + x]
      let end = x + 1
      while (end < width && cells[y * width + end] === c) end++
      if (c !== background) rowRuns.set(`${x}:${end - x}:${c}`, { x, w: end - x, c })
      x = end
    }
    for (const [key, run] of open) {
      if (rowRuns.has(key)) {
        run.h += 1
        rowRuns.delete(key)
      } else {
        rects.push(run)
        open.delete(key)
      }
    }
    for (const [key, run] of rowRuns) open.set(key, { ...run, y, h: 1 })
  }
  rects.push(...open.values())
  return rects
}

// ---- the markup ------------------------------------------------------------

export function buildScene() {
  const canvas = makeCanvas(GRID_W, GRID_H, P.bg)
  paintRoom(canvas)
  paintFurniture(canvas)

  const rects = toRuns(canvas.cells, GRID_W, GRID_H, P.bg)
  const colors = [...new Set(rects.map(r => r.c))].sort()
  const classOf = new Map(colors.map((c, i) => [c, `c${i}`]))

  const css = [
    `.bg{fill:${P.bg}}`,
    '.veil{fill:#FAF8F3;opacity:.3}',
    ...colors.map(c => `.${classOf.get(c)}{fill:${c}}`),
    '@media (prefers-color-scheme: dark){',
    `.bg{fill:${INK}}`,
    `.veil{fill:${INK};opacity:.45}`,
    ...colors.map(c => `.${classOf.get(c)}{fill:${darkOf(c)}}`),
    '}',
  ].join('')

  const groups = colors.map(c => {
    const body = rects
      .filter(r => r.c === c)
      .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`)
      .join('')
    return `<g class="${classOf.get(c)}">${body}</g>`
  })

  const lamps = lampCells()
  const fixtures = lamps
    .map(({ cx, cy }) => `<rect x="${cx - 2}" y="${cy - 2}" width="4" height="1"/>`)
    .join('')
  const halos = lamps
    .map(({ cx, cy }) =>
      [
        `<rect x="${cx - 6}" y="${cy - 3}" width="12" height="7" opacity=".10"/>`,
        `<rect x="${cx - 4}" y="${cy - 4}" width="8" height="9" opacity=".12"/>`,
      ].join(''),
    )
    .join('')
  const bulbs = lamps
    .map(({ cx, cy }) => `<rect x="${cx - 1}" y="${cy - 1}" width="3" height="3"/>`)
    .join('')

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID_W} ${GRID_H}" ` +
    `preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
    `<style>${css}</style>` +
    `<rect class="bg" width="${GRID_W}" height="${GRID_H}"/>` +
    groups.join('') +
    `<rect class="veil" width="${GRID_W}" height="${GRID_H}"/>` +
    `<g fill="${P.lampFixture}">${fixtures}</g>` +
    `<g fill="${P.halo}">${halos}</g>` +
    `<g fill="${P.bulb}">${bulbs}</g>` +
    `</svg>`
  )
}

export const SCENE_SVG = buildScene()
export const SCENE_ALT = 'Lớp học ACCA kiểu pixel art: bảng đen ghi ACCA, bàn học và vài học viên'
