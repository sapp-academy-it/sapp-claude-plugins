import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { CHAT, D13, INSET, SIDEBAR, TITLEBAR, TOP, frameScene } from '../hooks/layout.js'
import { CUTS, THEMES, dotsSvg } from '../hooks/themes.js'
import { GRID_H, GRID_W, ZONES } from '../scripts/build-scene.mjs'

const hooks = new URL('../hooks/', import.meta.url)
// The same placement without the inset and the title-bar offset: what the edge extensions below are measured against.
const BARE = { cells: 3, inset: 0, top: 0 }
const ROOMS = { 'acca-classroom': 'classroom', 'marketing-room': 'marketing', 'it-room': 'it' }
const rooms = () => THEMES.filter(t => ROOMS[t.id])

// A scene by hand: a wall that touches both side edges and the top (a room colour: the dark window recolours it),
// a board whose frame straddles the cut at x = 200 (a sprite colour), and one floor rect (room colour, below row 42).
// Cells are 4 units.
const TOY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 800" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">' +
  '<style>.bg{fill:#111111}.veil{fill:#FFFFFF;opacity:.3}.fa{fill:#AAAAAA}.fb{fill:#999999}.c0{fill:#222222}.c1{fill:#333333}.c2{fill:#444444}' +
  '@media (prefers-color-scheme: dark){.bg{fill:#000000}.c0{fill:#050505}.c2{fill:#070707}}</style>' +
  '<rect class="bg" width="768" height="800"/>' +
  '<path class="c0" d="M0 0h768v40h-768z"/>' +
  '<path class="c2" d="M0 200h768v64h-768z"/>' +
  '<path class="c1" d="M100 100h200v40h-200z"/>' +
  '<rect class="veil" width="768" height="800"/>' +
  '<path fill="#00FF00" d="M120 120h4v4h-4zM500 120h4v4h-4z"/>' +
  '</svg>'
const TOY_ZONES = { left: 50, right: 100 } // units 200 and 400

const pathsOf = (svg, attr) => [...svg.matchAll(new RegExp(`<path ${attr} d="([^"]*)"/>`, 'g'))].map(m => m[1])
// The two zone blocks of a framed Svg (the main ones, before the veil): `left` and `right`.
const zonesOf = svg => ({
  left: svg.match(/<svg width="50%".*?<\/g>/s)[0],
  right: svg.match(/<svg x="50%" width="50%".*?<\/g>/s)[0],
})
const roomClasses = svg => {
  const style = svg.match(/<style>(.*?)<\/style>/s)[1]
  return new Set([...style.slice(style.indexOf('@media')).matchAll(/\.(c\d+)\{/g)].map(m => m[1]))
}

test('a sprite that straddles the cut is clipped at it, never stretched into the middle; a wall band runs on', () => {
  const svg = frameScene(TOY, TOY_ZONES, D13)

  // The board (x 100 to 300) lies in the left zone up to the cut at 200 and in no right zone (right starts at 400).
  assert.deepEqual(pathsOf(svg, 'class="c1"'), ['M100 100h100v40h-100z'])
  // The wall touches the cut: it runs 4000 on toward the middle from each side (and, with an inset and a top offset, 4000 past the left
  // edge and the top: see the wall edge test).
  assert.deepEqual(pathsOf(svg, 'class="c0"'), ['M-4000 -4000h8200v4040h-8200z', 'M-3600 -4000h4368v4040h-4368z'])
})

// Which tiles `.fa` paints, as 'column,row' (columns count from the window's centre, rows from the wall), read from the Svg.
const oddTiles = svg => new Set([...pathsOf(svg, 'class="fa"')[0].matchAll(/M(-?\d+) (\d+)h64v64h-64z/g)].map(m => `${Number(m[1]) / 64},${(Number(m[2]) - 168) / 64}`))

test('the floor is tiled, not stretched: the floor rect of the scene is dropped, and one checker of tiles runs out from the window centre', () => {
  const svg = frameScene(TOY, TOY_ZONES, D13)

  // The room colour below row 42 (the c2 rect at y 200) is not drawn from the scene.
  assert.deepEqual(pathsOf(svg, 'class="c2"'), [])
  // One base colour and one path of odd tiles, in a group whose origin is the window's centre (x = 50%).
  assert.equal(pathsOf(svg, 'class="fb"').length, 1)
  assert.equal(pathsOf(svg, 'class="fa"').length, 1)
  assert.ok(svg.includes('<svg x="50%" overflow="visible"><g class="pf" transform="translate(0 44) scale(0.75)">'))
  // The tile edge is on the centre line: column -1 and column 0 differ on every row.
  const odd = oddTiles(svg)
  assert.ok(odd.has('-1,0') && !odd.has('0,0') && odd.has('0,1') && !odd.has('-1,1'))
  // The whole grid is one checker (column + row odd), left and right of the centre alike.
  for (let j = 0; j < 44; j++) for (let i = -40; i < 40; i++) assert.equal(odd.has(`${i},${j}`), (((i + j) % 2) + 2) % 2 === 1, `${i},${j}`)
})

// The floor of the first layout, for the control: tiles counted from each window edge at 4 px a cell. A window cell `c` of a
// window `w` px wide shows tile floor(c / 16) on the left half and, on the right half, the tile of the scene cell c - (w / 4 - 192).
const colourFromEdges = (w, c, row) => {
  const left = c < w / 8
  const tile = Math.floor((left ? c : c - (w / 4 - 192)) / 16)
  return (tile + row) % 2
}
// A seam: the colour changes across the centre line at a cell pair with no tile edge of the checker between them.
const seamAtCentre = (w, colour) => {
  const centre = w / 8
  const edgeBetween = Math.floor((centre - 1) / 16) !== Math.floor((centre + 1) / 16)
  return !edgeBetween && colour(w, centre - 1, 0) !== colour(w, centre + 1, 0)
}

test('no seam in the floor at the window centre at any width, where counting the tiles from each edge had one at 1440', () => {
  // Control: the first layout has the seam at 1440 (centre at cell 180, mid-tile) and none at 1536 (centre at cell 192, a tile edge).
  assert.equal(seamAtCentre(1440, colourFromEdges), true)
  assert.equal(seamAtCentre(1536, colourFromEdges), false)
  // The new layout: the group's origin is the centre and column -1 / 0 alternate there, so every width has a tile edge on the
  // centre line and the colour only changes across it.
  const odd = oddTiles(frameScene(TOY, TOY_ZONES, D13))
  for (const w of [1280, 1366, 1440, 1512, 1728, 1920]) {
    const colour = (width, c, row) => (odd.has(`${Math.floor((c - width / 8) / 16)},${row}`) ? 1 : 0)
    assert.equal(colour(w, w / 8 - 1, 0) !== colour(w, w / 8 + 1, 0), true, `${w}`)
    // Away from the centre the colour holds across a tile: two cells inside the same tile are the same colour.
    assert.equal(colour(w, w / 8 + 3, 0), colour(w, w / 8 + 4, 0), `${w}`)
  }
})

test('the lit cells go to the zone they are in, once, and are never stretched', () => {
  const svg = frameScene(TOY, TOY_ZONES, D13)

  assert.deepEqual(pathsOf(svg, 'fill="#00FF00"'), ['M120 120h4v4h-4z', 'M500 120h4v4h-4z'])
})

test('the zones are placed by the measured geometry: left zone from the inset, right zone at the right edge, the room under the title bar; the veil lies over both, under the lit cells', () => {
  const svg = frameScene(TOY, TOY_ZONES, D13)

  assert.equal(INSET, 286)
  assert.equal(TOP, 44)
  assert.ok(svg.includes('<g class="pl" transform="translate(286 44) scale(0.75)">'))
  assert.ok(svg.includes('<g class="pr" transform="translate(-576 44) scale(0.75)">'))
  const veil = svg.indexOf('<rect class="veil" width="100%" height="100%"/>')
  assert.ok(veil > svg.indexOf('class="c1"'))
  assert.ok(veil < svg.indexOf('fill="#00FF00"'))
  assert.equal(svg.includes('@media (min-width'), false)
})

test('the wall runs on past the left edge and past the top, so the inset and the title bar show wall and not the bare background', () => {
  // The extended wall rects, by name: a room-colour rect that starts at x = -4000 (left edge) or at y = -4000 (top).
  const extended = (svg, block) => {
    const room = roomClasses(svg)
    const out = { left: 0, up: 0 }
    for (const [, cls, d] of zonesOf(svg)[block].matchAll(/<path class="(c\d+)" d="([^"]*)"\/>/g)) {
      if (!room.has(cls)) continue
      for (const [, x, y] of d.matchAll(/M(-?\d+) (-?\d+)h\d+v\d+h-\d+z/g)) {
        if (Number(x) === -4000) out.left++
        if (Number(y) === -4000) out.up++
      }
    }
    return out
  }
  for (const t of rooms()) {
    const svg = frameScene(t.art, CUTS[ROOMS[t.id]], D13)
    const bare = frameScene(t.art, CUTS[ROOMS[t.id]], BARE)

    assert.ok(extended(svg, 'left').left > 0, `${t.id}: no wall band runs on past the left edge`)
    assert.ok(extended(svg, 'left').up > 0 && extended(svg, 'right').up > 0, `${t.id}: no wall band runs on past the top`)
    // Control: with no inset and no top offset nothing is extended that way.
    assert.deepEqual(extended(bare, 'left'), { left: 0, up: 0 })
    assert.deepEqual(extended(bare, 'right'), { left: 0, up: 0 })
  }
})

// The wall bands each zone runs on across the middle: wall row (0 to 41) -> room class, from the zone's extended rects.
const bandsOf = (svg, block) => {
  const room = roomClasses(svg)
  const rows = new Array(42).fill(null)
  for (const [, cls, d] of zonesOf(svg)[block].matchAll(/<path class="(c\d+)" d="([^"]*)"\/>/g)) {
    if (!room.has(cls)) continue
    for (const [, , y, w, h] of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v(\d+)h-\d+z/g)) {
      if (Number(w) < 3000) continue
      for (let row = Math.max(0, Number(y) / 4); row < Math.min(42, (Number(y) + Number(h)) / 4); row++) rows[row] = cls
    }
  }
  return rows
}

test('in every room the left and the right zone run the same wall bands across the middle: the cut columns are clear of furniture', () => {
  for (const t of rooms()) {
    const svg = frameScene(t.art, CUTS[ROOMS[t.id]], D13)
    const [l, r] = [bandsOf(svg, 'left'), bandsOf(svg, 'right')]

    assert.ok(l.every(c => c !== null), `${t.id}: a wall row has no band on the left`)
    assert.deepEqual(r, l, t.id)
  }
  // Control: a zone that loses a band at its cut (a board over the cut column) reads as different. The right zone here has no
  // `.c2` rows 28 to 29, as the marketing room had when its KPI board stood on column 118.
  const block = (side, parts) => `<svg ${side}="50%" width="50%"><svg><g>${parts.map(([c, y, h]) => `<path class="${c}" d="M-4000 ${y}h8000v${h}h-8000z"/>`).join('')}</g></svg>`
  const same = [['c0', 0, 112], ['c2', 112, 8], ['c0', 120, 48]]
  const hole = [['c0', 0, 112], ['c0', 120, 48]]
  const fake = parts => `<svg><style>@media (prefers-color-scheme: dark){.c0{fill:#000000}.c2{fill:#000000}}</style>${block('width', same)}</g></svg></svg>${block('x', parts)}</g></svg></svg></svg>`
  assert.deepEqual(bandsOf(fake(same), 'right'), bandsOf(fake(same), 'left'))
  assert.notDeepEqual(bandsOf(fake(hole), 'right'), bandsOf(fake(hole), 'left'))
})

test('every room is cut at the zones its builder composed, and keeps the middle empty: no sprite colour between the zones', () => {
  assert.deepEqual(ZONES, { left: 74, right: 118 })
  assert.equal(GRID_W, 192)
  assert.equal(GRID_H, 200)
  for (const t of rooms()) {
    const key = ROOMS[t.id]
    assert.deepEqual(CUTS[key], ZONES, t.id)
    const svg = frameScene(t.art, CUTS[key], D13)
    // Rects that are not a wall band running on (4000 long) and not floor tiles must lie wholly outside the middle.
    let seen = 0
    for (const [, cls, d] of svg.matchAll(/<path (class="c\d+"|fill="#[0-9A-Fa-f]{6}") d="([^"]*)"\/>/g)) {
      for (const [, x, w] of d.matchAll(/M(-?\d+) -?\d+h(\d+)v\d+h-\d+z/g)) {
        if (Number(w) >= 3000) continue
        seen++
        const [a, b] = [Number(x), Number(x) + Number(w)]
        assert.ok(b <= ZONES.left * 4 || a >= ZONES.right * 4, `${t.id} ${cls}: ${a} to ${b}`)
      }
    }
    assert.ok(seen > 1000, `${t.id} ${seen}`)
  }
})

// The sprite and lit rects of a scene that lie over a zone line (cells `lines`), as 'from-to' in units.
const straddling = (art, lines) => {
  const room = roomClasses(art)
  const out = []
  for (const [, cls, d] of art.matchAll(/<path (?:class="(c\d+)"|fill="#[0-9A-Fa-f]{6}") d="([^"]*)"\/>/g)) {
    if (cls && room.has(cls)) continue
    for (const [, x, w] of d.matchAll(/M(\d+) \d+h(\d+)v\d+h-\d+z/g)) {
      const [a, b] = [Number(x), Number(x) + Number(w)]
      if (lines.some(line => a < line * 4 && b > line * 4)) out.push(`${a}-${b}`)
    }
  }
  return out
}

test('no sprite of a room is cut by a zone line: nothing but wall bands crosses cell 74 or cell 118', () => {
  for (const t of rooms()) assert.deepEqual(straddling(t.art, [74, 118]), [], t.id)
  // Control: a sprite over cell 74 (units 296) and one over cell 118 (units 472) are found, and a wall band (a room colour) is not.
  const toy = '<svg><style>.c1{fill:#333333}@media (prefers-color-scheme: dark){.c0{fill:#000000}}</style><path class="c1" d="M280 0h40v8h-40zM460 0h40v8h-40z"/><path class="c0" d="M0 0h768v8h-768z"/></svg>'
  assert.deepEqual(straddling(toy, [74, 118]), ['280-320', '460-500'])
})

test('the dots keep their detail to the 8 columns at each side: none in the middle 8 columns', () => {
  const svg = dotsSvg(D13)
  const xs = [...svg.matchAll(/<circle cx="(\d+)"/g)].map(m => Number(m[1]))

  assert.ok(xs.length > 60)
  assert.equal(xs.filter(x => x > 256 && x < 512).length, 0)
  // Control: both sides do hold dots, so the empty middle is the layout and not an empty reader.
  assert.ok(xs.some(x => x < 256))
  assert.ok(xs.some(x => x >= 512))
})

// ---- the real Desktop geometry ----------------------------------------------------------------------------------

// Measured on a Mac Desktop Code tab (see layout.js): an opaque sidebar 283 CSS px wide at the left, a title bar 40 tall, and a
// chat column 768 wide centred in the panel to the right of the sidebar. The Backdrop spans the whole window under all three.
const column = (width, sidebar) => {
  const panel = width - (sidebar ? SIDEBAR : 0)
  const left = (sidebar ? SIDEBAR : 0) + (panel - CHAT) / 2
  return { left, right: left + CHAT }
}
// Where the sprites of a framed Svg land in a window `width` wide, read from the placement the Svg itself carries: [from, to] CSS px
// of each zone's sprite and lit rects (not the wall bands that run on), and the top of the room.
const placed = (svg, width) => {
  const room = roomClasses(svg)
  const out = { left: [], right: [], top: Infinity }
  for (const side of ['left', 'right']) {
    const block = zonesOf(svg)[side]
    const [, tx, ty, scale] = block.match(/<g class="p[lr]" transform="translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)"/).map(Number)
    // The right zone's origin is the window's right edge, the left zone's the window's left edge.
    const origin = side === 'right' ? width : 0
    for (const [, cls, d] of block.matchAll(/<path (?:class="(c\d+)"|fill="#[0-9A-Fa-f]{6}") d="([^"]*)"\/>/g)) {
      if (cls && room.has(cls)) continue
      for (const [, x, y, w] of d.matchAll(/M(-?\d+) (-?\d+)h(\d+)v\d+h-\d+z/g)) {
        out[side].push([origin + tx + Number(x) * scale, origin + tx + (Number(x) + Number(w)) * scale])
        out.top = Math.min(out.top, ty + Number(y) * scale)
      }
    }
  }
  return out
}
// What reaches the sidebar (a left sprite that starts before it), the chat column (a left sprite that ends past its left edge, a right
// sprite that starts before its right edge) or the title bar (a sprite above it), in a window.
const reaching = (svg, width, sidebar) => {
  const { left, right } = column(width, sidebar)
  const at = placed(svg, width)
  const out = []
  for (const [a, b] of at.left) {
    if (sidebar && a < SIDEBAR) out.push(`left sprite ${a}-${b} under the sidebar`)
    if (b > left) out.push(`left sprite ${a}-${b} under the column from ${left}`)
  }
  for (const [a, b] of at.right) if (a < right) out.push(`right sprite ${a}-${b} under the column to ${right}`)
  if (at.top < TITLEBAR) out.push(`a sprite at ${at.top} under the title bar`)
  return out
}

test('at 1506 wide with the sidebar open no sprite of any room reaches under the chat column, the sidebar or the title bar', () => {
  assert.deepEqual(column(1506, true), { left: 510.5, right: 1278.5 })
  assert.equal(TITLEBAR, 40)
  for (const t of rooms()) assert.deepEqual(reaching(frameScene(t.art, CUTS[ROOMS[t.id]], D13), 1506, true), [], t.id)
  // Controls: the measure reads the placement the Svg carries, so the wrong values go red.
  const art = rooms().find(t => t.id === 'it-room').art
  const cuts = CUTS.it
  // 4 px a cell (the layout before this one): the zones are wider than the gutter.
  assert.ok(reaching(frameScene(art, cuts, { ...D13, cells: 4 }), 1506, true).length > 0)
  // A left zone that ignores the inset starts under the sidebar.
  assert.ok(reaching(frameScene(art, cuts, { ...D13, inset: 0 }), 1506, true).some(m => m.includes('under the sidebar')))
  // A room with no top offset reaches under the title bar.
  assert.ok(reaching(frameScene(art, cuts, { ...D13, top: 0 }), 1506, true).some(m => m.includes('title bar')))
})

test('the shaders place the motion by the same numbers as the layout: the 3 px cell and the inset', () => {
  const marketing = readFileSync(new URL('marketing.shader.ts', hooks), 'utf8')
  const it = readFileSync(new URL('it-room.shader.ts', hooks), 'utf8')

  assert.ok(marketing.includes(`const cell = ${D13.cells}\n`), 'marketing cell')
  assert.ok(it.includes(`const cell = ${D13.cells}\n`), 'it-room cell')
  assert.ok(it.includes(`const sceneX = ((p.uv.x * size.x - ${INSET}) * 4) / ${D13.cells}\n`), 'it-room scene x')
  // Control: a shader that kept an old number would not match.
  assert.equal(it.includes(`const cell = ${D13.cells + 1}\n`), false)
})
