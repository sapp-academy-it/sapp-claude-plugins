import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CAPPED, COLUMN, FIXED, frameScene, scaleFor } from '../hooks/layout.js'
import { CUTS, THEMES, dotsSvg } from '../hooks/themes.js'
import { GRID_H, GRID_W, ZONES } from '../scripts/build-scene.mjs'

// A scene by hand: a wall that touches both side edges (a room colour: the dark window recolours it),
// a board whose frame straddles the cut at x = 200 (a sprite colour), and one floor rect (room colour, below row 42).
// Cells are 4 units.
const TOY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 704" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">' +
  '<style>.bg{fill:#111111}.veil{fill:#FFFFFF;opacity:.3}.fa{fill:#AAAAAA}.fb{fill:#999999}.c0{fill:#222222}.c1{fill:#333333}.c2{fill:#444444}' +
  '@media (prefers-color-scheme: dark){.bg{fill:#000000}.c0{fill:#050505}.c2{fill:#070707}}</style>' +
  '<rect class="bg" width="768" height="704"/>' +
  '<path class="c0" d="M0 0h768v40h-768z"/>' +
  '<path class="c2" d="M0 200h768v64h-768z"/>' +
  '<path class="c1" d="M100 100h200v40h-200z"/>' +
  '<rect class="veil" width="768" height="704"/>' +
  '<path fill="#00FF00" d="M120 120h4v4h-4zM500 120h4v4h-4z"/>' +
  '</svg>'
const TOY_ZONES = { left: 50, right: 100 } // units 200 and 400

const pathsOf = (svg, attr) => [...svg.matchAll(new RegExp(`<path ${attr} d="([^"]*)"/>`, 'g'))].map(m => m[1])

test('a sprite that straddles the cut is clipped at it, never stretched into the middle; a wall band runs on', () => {
  const svg = frameScene(TOY, TOY_ZONES, FIXED)

  // The board (x 100 to 300) lies in the left zone up to the cut at 200 and in no right zone (right starts at 400).
  assert.deepEqual(pathsOf(svg, 'class="c1"'), ['M100 100h100v40h-100z'])
  // The wall touches the cut: it runs 4000 on toward the middle, from each side.
  assert.deepEqual(pathsOf(svg, 'class="c0"'), ['M0 0h4200v40h-4200z', 'M-3600 0h4368v40h-4368z'])
})

test('the floor is tiled, not stretched: the floor rect of the scene is dropped, and each side gets tiles that alternate', () => {
  const svg = frameScene(TOY, TOY_ZONES, FIXED)

  // The room colour below row 42 (the c2 rect at y 200) is not drawn from the scene.
  assert.deepEqual(pathsOf(svg, 'class="c2"'), [])
  // Left: one base tile colour, then the odd tiles (column + row odd) of 64 units from the left edge.
  const [leftOdd, rightOdd] = pathsOf(svg, 'class="fa"')
  assert.ok(leftOdd.startsWith('M64 168h64v64h-64zM192 168h64v64h-64z'), leftOdd.slice(0, 60))
  assert.ok(leftOdd.includes('M0 232h64v64h-64z'))
  // Right: counted back from the right edge, the grid's own parity: column 11 (touching the edge) is odd on row 0, column 10 is not.
  assert.ok(rightOdd.includes('M704 168h64v64h-64z'))
  assert.equal(rightOdd.includes('M640 168h64v64h-64z'), false)
  assert.equal(pathsOf(svg, 'class="fb"').length, 2)
})

test('the lit cells go to the zone they are in, once, and are never stretched', () => {
  const svg = frameScene(TOY, TOY_ZONES, FIXED)

  assert.deepEqual(pathsOf(svg, 'fill="#00FF00"'), ['M120 120h4v4h-4z', 'M500 120h4v4h-4z'])
})

test('both zones sit on the window edges at 4 points a cell, from the top; the veil lies over both, under the lit cells', () => {
  const svg = frameScene(TOY, TOY_ZONES, FIXED)

  assert.ok(svg.includes('<g class="pl" transform="translate(0 0) scale(1)">'))
  assert.ok(svg.includes('<g class="pr" transform="translate(-768 0) scale(1)">'))
  const veil = svg.indexOf('<rect class="veil" width="100%" height="100%"/>')
  assert.ok(veil > svg.indexOf('class="c1"'))
  assert.ok(veil < svg.indexOf('fill="#00FF00"'))
  assert.equal(svg.includes('@media (min-width'), false)
})

test('every room is cut at the zones its builder composed, and keeps the middle empty: no sprite colour between the zones', () => {
  assert.deepEqual(ZONES, { left: 88, right: 104 })
  assert.equal(GRID_W, 192)
  assert.equal(GRID_H, 200)
  for (const t of THEMES.filter(x => x.art && x.id !== 'sapp-dots')) {
    const key = { 'acca-classroom': 'classroom', 'marketing-room': 'marketing', 'it-room': 'it' }[t.id]
    assert.deepEqual(CUTS[key], ZONES, t.id)
    const svg = frameScene(t.art, CUTS[key], FIXED)
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

test('the dots keep their detail to the 8 columns at each side: none in the middle 8 columns', () => {
  const svg = dotsSvg(FIXED)
  const xs = [...svg.matchAll(/<circle cx="(\d+)"/g)].map(m => Number(m[1]))

  assert.ok(xs.length > 60)
  assert.equal(xs.filter(x => x > 256 && x < 512).length, 0)
  // Control: both sides do hold dots, so the empty middle is the layout and not an empty reader.
  assert.ok(xs.some(x => x < 256))
  assert.ok(xs.some(x => x >= 512))
})

// ---- the scale rule --------------------------------------------------------------------------

test('option A is 4 whatever the window; option B follows the gutter and the height, never above 6 or below 2', () => {
  for (const win of [[1440, 900], [1728, 1117], [1920, 1080], [600, 300]]) assert.equal(scaleFor(FIXED, win, 88), 4)

  // 1440: gutter 340, 340/88 = 3.86; 1728: 484/88 = 5.5; 1920: 580/88 = 6.6 but 1080/200 = 5.4.
  assert.equal(scaleFor(CAPPED, [1440, 900], 88), 3)
  assert.equal(scaleFor(CAPPED, [1728, 1117], 88), 5)
  assert.equal(scaleFor(CAPPED, [1920, 1080], 88), 5)
  // The height binds: 800 / 200 = 4.
  assert.equal(scaleFor(CAPPED, [1920, 800], 88), 4)
  // A window narrower than the column, and a tiny one: the floor.
  assert.equal(scaleFor(CAPPED, [700, 900], 88), 2)
  assert.equal(scaleFor(CAPPED, [300, 100], 88), 2)
  assert.equal(COLUMN, 760)
})

// The scale the generated CSS bands pick in a window: the highest band whose queries hold.
const bandScale = (svg, [w, h], start) => {
  let k = start
  for (const [, minW, minH, scale] of svg.matchAll(/@media \(min-width:(\d+)px\) and \(min-height:(\d+)px\)\{\.pl\{transform:translate\(0px,[\d.-]+px\) scale\(([\d.]+)\)\}/g)) {
    if (w >= Number(minW) && h >= Number(minH)) k = Number(scale) * 4
  }
  return k
}

test('the CSS bands of option B give the same scale as the rule, in every window shape', () => {
  const t = THEMES.find(x => x.id === 'acca-classroom')
  const svg = frameScene(t.art, CUTS.classroom, CAPPED)

  for (const win of [[1440, 900], [1728, 1117], [1920, 1080], [1920, 800], [700, 900], [1296, 800], [1162, 600], [2560, 1440]]) {
    assert.equal(bandScale(svg, win, CAPPED.min), scaleFor(CAPPED, win, 88), win.join('x'))
  }
  // Control: the reader sees bands at all, and the fixed option has none.
  assert.equal([...svg.matchAll(/@media \(min-width/g)].length, 4)
  assert.equal(frameScene(t.art, CUTS.classroom, FIXED).includes('@media (min-width'), false)
})

// ---- nothing crosses the chat column at 1440 ---------------------------------------------------------------------

// A 1440 wide window leaves (1440 - 760) / 2 = 340 px each side of the column: 85 cells at 4 px a cell. The sprites of
// the left zone must end by cell 85, and those of the right zone start from cell 192 - 85 = 107.
const GUTTER_CELLS = (1440 - COLUMN) / 2 / 4
// The sprite and lit rects (not the room's own wall bands, which run on by design, and not the floor tiles) that reach the column.
const crossings = svg => {
  const style = svg.match(/<style>(.*?)<\/style>/s)[1]
  const room = new Set([...style.slice(style.indexOf('@media')).matchAll(/\.(c\d+)\{/g)].map(m => m[1]))
  const out = []
  // Each zone is one nested svg: `width="50%"` for the left, `x="50%"` for the right.
  for (const [block] of svg.matchAll(/<svg (?:width|x)="50%".*?<\/g>/gs)) {
    const left = block.startsWith('<svg width="50%"')
    for (const [, cls, d] of block.matchAll(/<path (?:class="(c\d+)"|fill="#[0-9A-Fa-f]{6}") d="([^"]*)"\/>/g)) {
      if (cls && room.has(cls)) continue
      for (const [, x, w] of d.matchAll(/M(-?\d+) -?\d+h(\d+)v\d+h-\d+z/g)) {
        const [from, to] = [Number(x) / 4, (Number(x) + Number(w)) / 4]
        if (left ? to > GUTTER_CELLS : from < GRID_W - GUTTER_CELLS) out.push(`${left ? 'left' : 'right'} ${from}-${to}`)
      }
    }
  }
  return out
}

test('at 1440 wide no sprite of any room reaches under the 760 px chat column', () => {
  assert.equal(GUTTER_CELLS, 85)
  for (const t of THEMES.filter(x => x.art && x.id !== 'sapp-dots')) {
    const key = { 'acca-classroom': 'classroom', 'marketing-room': 'marketing', 'it-room': 'it' }[t.id]
    assert.deepEqual(crossings(frameScene(t.art, CUTS[key], FIXED)), [], t.id)
  }
  // Control: the measure is live. A sprite of the left zone to cell 88 (the marketing phone table of the last commit) and one of
  // the right zone from cell 104 both cross, and one that ends at cell 85 does not.
  const toy = (l, r) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 800"><style>.bg{fill:#111111}.veil{fill:#FFFFFF;opacity:.3}.c1{fill:#333333}@media (prefers-color-scheme: dark){.c0{fill:#000000}}</style>' +
    '<rect class="bg" width="768" height="800"/>' +
    `<path class="c1" d="M${l[0] * 4} 200h${(l[1] - l[0]) * 4}v40h-${(l[1] - l[0]) * 4}zM${r[0] * 4} 300h${(r[1] - r[0]) * 4}v40h-${(r[1] - r[0]) * 4}z"/>` +
    '<rect class="veil" width="768" height="800"/></svg>'
  assert.equal(crossings(frameScene(toy([50, 85], [107, 150]), { left: 88, right: 104 }, FIXED)).length, 0)
  assert.equal(crossings(frameScene(toy([56, 88], [104, 150]), { left: 88, right: 104 }, FIXED)).length, 2)
})
