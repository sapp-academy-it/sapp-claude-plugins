import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

import { IT_SVG } from '../hooks/scene-it.js'
import { MARKETING_SVG } from '../hooks/scene-marketing.js'
import { SCENE_SVG } from '../hooks/scene.js'
import { D13, INSET } from '../hooks/layout.js'
import { THEMES, pickTheme } from '../hooks/themes.js'
import { GRAPH_BG, GRAPH_PANEL, IT_PEOPLE, MARKERS, RIM, RIM_LIGHT, SCENES, buildItWithoutPeople, buildItWithoutRim, buildScene, buildSceneModule, buildTrace, COFFEE_AT, IT_DESKS, personCells, readPng } from '../scripts/build-scene.mjs'
import { registered, render, runCommand } from './harness.js'

const hooks = new URL('../hooks/', import.meta.url)
const byId = id => THEMES.find(t => t.id === id)

// ---- reproducibility, one test per pixel scene ------------------------------------

for (const [name, file] of [
  ['classroom', 'scene.js'],
  ['marketing', 'scene-marketing.js'],
  ['it', 'scene-it.js'],
]) {
  test(`scripts/build-scene.mjs rebuilds hooks/${file} byte for byte from the committed sprites`, () => {
    const committed = readFileSync(new URL(file, hooks), 'utf8')

    assert.equal(buildSceneModule(name), committed)
    // Control: the comparison is live, a changed scene does not match.
    assert.notEqual(buildSceneModule(name), committed.replace('crispEdges', 'auto'))
  })
}

test('a scene name that does not exist is refused, not built empty', () => {
  assert.throws(() => buildScene('library'))
  assert.deepEqual(Object.keys(SCENES), ['classroom', 'marketing', 'it'])
})

// ---- sizes and shape of every new Svg ------------------------------------------------

const NEW = ['acca-classroom', 'marketing-room', 'it-room']

test('every scene Svg: under 131072 characters, crispEdges, sized by its own box (100%), no viewBox to slice it up, no id that is not hyphenated', () => {
  for (const id of NEW) {
    const { svg, art } = byId(id)

    assert.ok(svg.length < 131072, `${id} ${svg.length}`)
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" shape-rendering="crispEdges">'), id)
    assert.equal(svg.includes('preserveAspectRatio="xMidYMid slice"'), false, id)
    // The flat picture kept for preview.png is still the 768 by 800 scene.
    assert.ok(art.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 800" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">'), id)
    for (const [, name] of svg.matchAll(/\bid="([^"]*)"/g)) assert.match(name, /^[a-z]+(-[a-z]+)*$/, `${id} id ${name}`)
  }
  // Control: the id check is live on a bad one.
  assert.equal(/^[a-z]+(-[a-z]+)*$/.test('bad_id'), false)
})

test('the pixel scenes are whole cells of 4 on a 192 by 200 grid', () => {
  for (const svg of [SCENE_SVG, MARKETING_SVG, IT_SVG]) {
    const subpaths = [...svg.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z/g)]
    assert.ok(subpaths.length > 1500)
    for (const [, x, y, w, h] of subpaths) {
      for (const v of [x, y, w, h]) assert.equal(Number(v) % 4, 0)
      assert.ok(Number(x) + Number(w) <= 768 && Number(y) + Number(h) <= 800)
    }
  }
})

// ---- the markers the shaders look for -------------------------------------------------

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const dist = (a, b) => Math.hypot(...a.map((v, i) => (v - b[i]) / 255))
// What each colour of a scene looks like on screen: class fills seen through the veil
// (in light, and in dark with the dark block), and the lit colours as they are.
function seen(svg) {
  const [css] = svg.match(/<style>(.*?)<\/style>/s).slice(1)
  const [light, dark] = css.split('@media (prefers-color-scheme: dark){')
  const out = []
  for (const block of dark ? [light, light + dark] : [light]) {
    const fills = new Map([...block.matchAll(/\.(c\d+)\{fill:(#[0-9A-Fa-f]{6})\}/g)].map(m => [m[1], m[2]]))
    const veils = [...block.matchAll(/\.veil\{fill:(#[0-9A-Fa-f]{6});opacity:([.\d]+)\}/g)].at(-1)
    for (const fill of fills.values()) {
      const [vr, vg, vb] = rgb(veils[1])
      const a = Number(veils[2])
      out.push(rgb(fill).map((v, i) => v * (1 - a) + [vr, vg, vb][i] * a))
    }
  }
  return out
}
const litColors = svg => [...svg.slice(svg.indexOf('<rect class="veil"')).matchAll(/<path fill="(#[0-9A-Fa-f]{6})"/g)].map(m => m[1])

test('each shader marker is painted above the veil and no other colour of its scene comes near it', () => {
  const scenes = { classroom: SCENE_SVG, marketing: MARKETING_SVG, it: IT_SVG }
  for (const [name, markers] of Object.entries(MARKERS)) {
    const lit = litColors(scenes[name])
    const under = seen(scenes[name])
    for (const [what, hex] of Object.entries(markers)) {
      assert.ok(lit.includes(hex), `${name}.${what} is in the lit layer`)
      for (const c of under) assert.ok(dist(rgb(hex), c) > 0.2, `${name}.${what} ${hex} is near a veiled fill`)
      for (const other of lit.filter(l => l !== hex && !Object.values(markers).includes(l))) {
        assert.ok(dist(rgb(hex), rgb(other)) > 0.2, `${name}.${what} ${hex} is near lit ${other}`)
      }
    }
  }
  // Control: the distance sees two close colours as close.
  assert.ok(dist(rgb('#3DFF7A'), rgb('#40FF7A')) < 0.05)
})

// ---- shaders: where the registry points, and no flashing ------------------------------------

test('every shader file the registry names exists, and register.js names each by a literal path', () => {
  const files = readdirSync(hooks).filter(f => f.endsWith('.shader.ts'))
  const source = readFileSync(new URL('register.js', hooks), 'utf8')

  assert.deepEqual(files.sort(), ['backdrop.shader.ts', 'it-room.shader.ts', 'marketing.shader.ts'])
  for (const f of files) assert.ok(source.includes(`module: './${f}'`), f)
})

test('the Backdrop hook plays the shader of each theme over its own Svg, and none over the dots', async () => {
  const engine = registered()
  const draw = scene => render(engine, 'Backdrop', { surface: 'desktop', props: { scene, plugin: 'sapp-mod' } })
  const want = {
    'sapp-acca-classroom': './backdrop.shader.ts',
    'sapp-marketing-room': './marketing.shader.ts',
    'sapp-it-room': './it-room.shader.ts',
  }
  for (const [scene, module] of Object.entries(want)) {
    const out = await draw(scene)
    const theme = THEMES.find(t => t.scene === scene)

    assert.equal(out.type, 'Shader', scene)
    assert.equal(out.props.module, module, scene)
    assert.equal(out.props.children[0].props.source, theme.svg, scene)
  }
  assert.equal((await draw('sapp-dots')).type, 'Svg')
})

// Every shader's motion rates in rad/s, read numerically: `time * N` is N rad/s; `time / N` is a
// period of N seconds (2 pi / N rad/s); `sin(t * N)` runs t from 0 to 1 over the rising part of
// a `fract(time / period)` round, so it is N / (rising share * period) rad/s.
function rates(source) {
  const out = []
  for (const [, n] of source.matchAll(/time \* ([\d.]+)/g)) out.push(Number(n))
  for (const [, n] of source.matchAll(/time \/ ([\d.]+)/g)) out.push((2 * Math.PI) / Number(n))
  for (const [, n] of source.matchAll(/sin\(t \* ([\d.]+)\)/g)) {
    const period = Number(source.match(/fract\(time \/ ([\d.]+)\)/)[1])
    const share = Number(source.match(/phase \/ ([\d.]+)/)[1])
    out.push(Number(n) / (share * period))
  }
  return out
}

test('no shader runs a motion faster than 6 rad/s (about 1 cycle a second, far under the 3 a second flash limit)', () => {
  for (const f of readdirSync(hooks).filter(x => x.endsWith('.shader.ts'))) {
    for (const rate of rates(readFileSync(new URL(f, hooks), 'utf8'))) assert.ok(rate < 6, `${f}: ${rate} rad/s`)
  }
  // Controls: the scan sees all three forms, and it fails on a fast one.
  assert.deepEqual(rates('sin(time * 1.3)'), [1.3])
  assert.ok(Math.abs(rates('fract(time / 9) phase / 0.55 sin(t * 6)').at(-1) - 6 / 4.95) < 1e-9)
  assert.ok(rates('x = time / 0.5')[0] > 6)
  assert.ok(rates('sin(time * 40)')[0] >= 6)
})

// ---- the new Vietnamese titles ---------------------------------------------------------------

test('the new titles match in any case, with and without accents, and by number and id', () => {
  const picks = [
    ['Phòng Marketing', 'marketing-room'],
    ['phong marketing', 'marketing-room'],
    ['PHÒNG MARKETING', 'marketing-room'],
    ['Phòng IT', 'it-room'],
    ['phong it', 'it-room'],
    ['2', 'marketing-room'],
    ['3', 'it-room'],
    ['it-room', 'it-room'],
    ['  phong it ', 'it-room'],
  ]
  for (const [text, id] of picks) assert.equal(pickTheme(text)?.id, id, text)
  // Refusals: a near miss, a part of a title and another team's word match nothing.
  for (const bad of ['phong', 'ban ve', 'marketing', 'phong i', '0', '9']) {
    assert.equal(pickTheme(bad), undefined, bad)
  }
})

test('/sapp-theme switches to each new theme, sets its scene and stores its id', async () => {
  for (const id of NEW.slice(1)) {
    const engine = registered()
    const out = await runCommand(engine, 'sapp-theme', byId(id).title.toLowerCase())
    const set = engine.calls.filter(c => c.path === 'theme.set').at(-1).args[0]

    assert.equal(set.backdrop.scene, byId(id).scene, id)
    assert.equal(engine.store.get('theme'), id, id)
    assert.equal(out.text, `Đã đổi sang "${byId(id).title}" và lưu lại cho các phiên sau.`)
  }
})

// ---- what the scenes show, by construction -----------------------------------------------------

test('the classroom has no PC sprite: its still has no lit-screen marker and no PC colours', () => {
  // The PC screen glyph green of the old scene, and the screen face grey of the PC sprites.
  for (const c of ['#00FF8C', '#60C677', '#E1E3E9']) assert.equal(SCENE_SVG.toUpperCase().includes(c), false, c)
  // Control: the IT room does have PCs, so the check could fail.
  assert.ok(IT_SVG.toUpperCase().includes('#E1E3E9'))
})

test('the IT room paints the graph panel in the colour the shader hides the resting line with', () => {
  assert.equal(GRAPH_BG, '#0A1F3A')
  assert.ok(IT_SVG.includes(`<path fill="${GRAPH_BG}"`))
  // The wave repeats every 16 cells (64 units): the line paints the same row of cells one period apart.
  const line = IT_SVG.match(new RegExp(`<path fill="${MARKERS.it.graph}" d="([^"]*)"`))[1]
  const rows = [...line.matchAll(/M(\d+) (\d+)h4v(\d+)h-4z/g)].map(m => `${Number(m[1]) % 64}/${m[2]}`)
  assert.ok(rows.length > 24)
  assert.ok(rows.filter(r => r.startsWith('0/')).length >= 1)
})

// ---- the lit layer as cells ---------------------------------------------------------------------

// The lit paths of a scene as a map of 'x,y' (cell) to colour.
function litCells(svg) {
  const cells = new Map()
  for (const [, fill, d] of svg.slice(svg.indexOf('<rect class="veil"')).matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]*)"/g)) {
    for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
      for (let j = 0; j < h / 4; j++) for (let i = 0; i < w / 4; i++) cells.set(`${x / 4 + i},${y / 4 + j}`, fill.toUpperCase())
    }
  }
  return cells
}

// The final picture of a scene as cells, in a light or a dark window: the veiled class fills, then the lit layer.
function pictureOf(svg, mode = 'light') {
  const [css] = svg.match(/<style>(.*?)<\/style>/s).slice(1)
  const [lightCss, darkCss] = css.split('@media (prefers-color-scheme: dark){')
  const block = mode === 'dark' && darkCss ? lightCss + darkCss : lightCss
  const fills = new Map([...block.matchAll(/\.(c\d+)\{fill:(#[0-9A-Fa-f]{6})\}/g)].map(m => [m[1], m[2]]))
  const [, veilFill, veilAlpha] = [...block.matchAll(/\.veil\{fill:(#[0-9A-Fa-f]{6});opacity:([.\d]+)\}/g)].at(-1)
  const picture = new Map()
  for (const [, cls, d] of svg.matchAll(/<path class="(c\d+)" d="([^"]*)"/g)) {
    const seenColor = rgb(fills.get(cls)).map((v, i) => v * (1 - Number(veilAlpha)) + rgb(veilFill)[i] * Number(veilAlpha))
    for (const [, x, y, w, h] of d.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-\d+z/g)) {
      for (let j = 0; j < h / 4; j++) for (let i = 0; i < w / 4; i++) picture.set(`${x / 4 + i},${y / 4 + j}`, seenColor)
    }
  }
  for (const [k, c] of litCells(svg)) picture.set(k, rgb(c))
  return picture
}

// The shader's own measure: 1 at the colour, 0 beyond 0.14 away, a smoothstep between.
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const match = (c, target) => 1 - smooth(0.05, 0.14, dist(c, rgb(target)))

// The shader's own scene-x line, evaluated: from a uv x and the window size, where on the 768-unit scene the pixel is.
const sceneXOf = source => {
  const expr = source.match(/const sceneX = (.*)$/m)[1].replace(/p\.uv\.x/g, 'uvx').replace(/size\.x/g, 'size[0]').replace(/size\.y/g, 'size[1]')
  return new Function('uvx', 'size', 'max', 'min', `return ${expr}`)
}
// The uv x at which a window of this width shows scene x: layout.js draws the left zone from INSET points in at D13.cells points a cell (4 units a cell).
const uvXOf = (sceneX, [w]) => ((sceneX * D13.cells) / 4 + INSET) / w
const WINDOWS = [[768, 544], [1512, 945], [1000, 1400], [2400, 600]]

test('the shader\'s scene-x line maps a uv back to the scene x at every window shape; the old centred slice fit turns it red', () => {
  const source = readFileSync(new URL('it-room.shader.ts', hooks), 'utf8')
  const check = fn => WINDOWS.every(win => [42, 100, 246, 600].every(x => Math.abs(fn(uvXOf(x, win), win, Math.max, Math.min) - x) < 1e-6))

  assert.equal(check(sceneXOf(source)), true)
  // Controls: the old centred slice fit and a shifted anchor do not pass.
  const slice = '(p.uv.x * size.x - size.x / 2) / max(size.x / 768, size.y / 544) + 384'
  assert.equal(check(sceneXOf(source.replace('p.uv.x * size.x', slice))), false)
  assert.equal(check(sceneXOf(source.replace('p.uv.x * size.x', 'p.uv.x * size.x + 4'))), false)
  // ...and so does forgetting the inset (the zone starts past the sidebar) or the 3 points a cell.
  assert.equal(check(sceneXOf(source.replace(`- ${INSET}`, '- 0'))), false)
  assert.equal(check(sceneXOf(source.replace('* 4) / 3', '* 4) / 4'))), false)
})

for (const mode of ['light', 'dark']) {
  test(`one scroll cycle of the monitoring graph, with the shader's own tolerances and scene-x line, paints only inside the panel (${mode} window)`, () => {
    const source = readFileSync(new URL('it-room.shader.ts', hooks), 'utf8')
    const edges = source.match(/smoothstep\((\d+), (\d+), sceneX\) \* \(1 - smoothstep\((\d+), (\d+), sceneX\)/)
    const line = MARKERS.it.graph
    const picture = pictureOf(IT_SVG, mode)
    const sceneX = sceneXOf(source)
    // The ramps lie inside the panel: it spans cells x to x + w, which is 4 times that in scene units.
    assert.equal(Number(edges[1]), GRAPH_PANEL.x * 4)
    assert.equal(Number(edges[4]), (GRAPH_PANEL.x + GRAPH_PANEL.w) * 4)
    assert.ok(Number(edges[2]) > Number(edges[1]) && Number(edges[3]) < Number(edges[4]))
    const panel = (x, y) => x >= GRAPH_PANEL.x && x < GRAPH_PANEL.x + GRAPH_PANEL.w && y >= GRAPH_PANEL.y && y < GRAPH_PANEL.y + GRAPH_PANEL.h

    // The shader per cell: the line one step over or one period over, kept where the pixel is the panel's
    // back colour or the line, and between the panel's edges (the scene x taken from the shader's own line,
    // in a window of the shader's own shape).
    const painted = (pic, { byPosition, win = WINDOWS[1] }) => {
      const out = []
      for (let shift = 0; shift < 16; shift++) {
        for (let y = 0; y < 136; y++) {
          for (let x = 0; x < 192; x++) {
            const at = (xx, yy) => pic.get(`${xx},${yy}`) ?? [0, 0, 0]
            const live = Math.max(match(at(x + shift, y), line), match(at(x + shift - 16, y), line))
            const inside = Math.max(match(at(x, y), line), match(at(x, y), GRAPH_BG))
            const sx = sceneX(uvXOf(x * 4 + 2, win), win, Math.max, Math.min)
            const across = smooth(Number(edges[1]), Number(edges[2]), sx) * (1 - smooth(Number(edges[3]), Number(edges[4]), sx))
            if (live * inside * (byPosition ? across : 1) > 0.01 && !panel(x, y)) out.push(`${x},${y}`)
          }
        }
      }
      return out
    }

    for (const win of WINDOWS) assert.deepEqual(painted(picture, { byPosition: true, win }), [], win.join('x'))
    // Near-colour control: a cell 0.04 from the back colour, outside the panel on a row the line visits,
    // stays unpainted by position, and is painted when only colour decides.
    const near = [...rgb(GRAPH_BG)].map((v, i) => v + [7, 5, 6][i])
    assert.ok(dist(near, rgb(GRAPH_BG)) > 0.03 && dist(near, rgb(GRAPH_BG)) < 0.05)
    const withNear = new Map(picture)
    withNear.set('46,16', near)
    assert.deepEqual(painted(withNear, { byPosition: true }), [])
    assert.ok(painted(withNear, { byPosition: false }).includes('46,16'))
  })
}

// ---- the board reads in every theme -----------------------------------------------------------------

const luminance = hex => {
  const [r, g, b] = rgb(hex).map(v => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('the board ink reads on the board face at 4.5 to 1 or more in a light and a dark window, both above every veil', () => {
  const ink = MARKERS.classroom.ink.toUpperCase()
  const lit = litCells(SCENE_SVG)
  const inkCells = [...lit].filter(([, c]) => c === ink).map(([k]) => k)
  assert.ok(inkCells.length > 50)
  // Both colours are in the lit layer, painted after the veil of the scene, so no window kind can touch them.
  assert.ok(SCENE_SVG.indexOf(`<path fill="${ink}"`) > SCENE_SVG.lastIndexOf('class="veil"'))
  const faces = new Set()
  for (const k of inkCells) {
    const [x, y] = k.split(',').map(Number)
    for (const n of [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]) if (lit.has(n) && lit.get(n) !== ink) faces.add(lit.get(n))
  }
  assert.ok(faces.size >= 1)
  for (const face of faces) assert.ok(contrast(ink, face) >= 4.5, `${face} vs ${ink} is ${contrast(ink, face).toFixed(2)}`)
  // Controls: the measure is live. The old arrangement, ink above and face under the dark veil, fails it.
  assert.ok(contrast('#5B2BB0', '#E6E2DE') > 4.5)
  assert.ok(contrast('#5B2BB0', '#2D2B27') < 4.5)
})

// ---- the people of the IT room read against what is around them ---------------------------------------------

// Mean luminance of a person's cells against the mean luminance of the one-cell ring around them,
// in the final picture of a light or a dark window.
// The chair back's cells over a seated person (none for the inspector, who stands).
const chairCellsOf = person => {
  const seat = IT_DESKS.some(d => person.x === d.x + 16 && person.y === d.y + 8)
  if (!seat) return new Set()
  const img = png('furniture/WOODEN_CHAIR_BACK.png')
  const out = new Set()
  for (let j = 0; j < 32; j++) for (let i = 0; i < 16; i++) if (img.rgba[(j * 16 + i) * 4 + 3] >= 128) out.add(`${person.x + i},${person.y + j}`)
  return out
}
function personContrast(svg, mode, person, chair = new Set()) {
  const picture = pictureOf(svg, mode)
  // A seated person is seen without the chair back drawn over the legs: those cells belong to the chair,
  // for the person and for the surround alike.
  const own = new Set([...personCells(person)].filter(k => !chair.has(k)))
  const ring = new Set()
  for (const k of own) {
    const [x, y] = k.split(',').map(Number)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const near = `${x + dx},${y + dy}`
      if (!own.has(near) && !chair.has(near)) ring.add(near)
    }
  }
  const mean = keys => [...keys].reduce((sum, k) => sum + luminance('#' + picture.get(k).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')), 0) / keys.size
  const [hi, lo] = [mean(own), mean(ring)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

test('each of the two people who stand in the IT room reads at 3 to 1 or more against their surround, in a light and a dark window', () => {
  const standing = IT_PEOPLE.filter(person => chairCellsOf(person).size === 0)

  assert.equal(standing.length, 2)
  for (const mode of ['light', 'dark']) {
    for (const person of standing) {
      const value = personContrast(IT_SVG, mode, person, chairCellsOf(person))
      assert.ok(value >= 3, `${mode} char ${person.n}: ${value.toFixed(2)}`)
    }
  }
  // Controls: the measure is live. The same room with no rim fails it for someone in some window, and a
  // person measured in a room with nobody in it reads as nothing special.
  const bare = buildItWithoutRim()
  const failing = ['light', 'dark'].flatMap(mode => standing.filter(person => personContrast(bare, mode, person, chairCellsOf(person)) < 3))
  assert.ok(failing.length > 0)
  assert.equal(buildItWithoutPeople().includes(`<path fill="${RIM}"`), false)
  assert.equal(buildItWithoutPeople().includes(`<path fill="${RIM_LIGHT}"`), false)
  // The rim is dark ink, never a recolouring: a person's own cells keep the sprite's colours.
  const lit = litCells(IT_SVG)
  assert.equal(IT_PEOPLE.every(person => [...personCells(person)].every(k => lit.has(k))), true)
})

// The whole seated silhouette, the person with the chair back drawn over the legs, against the one-cell ring around it.
function silhouetteContrast(svg, mode, person) {
  const picture = pictureOf(svg, mode)
  const own = new Set([...personCells(person), ...chairCellsOf(person)])
  const ring = new Set()
  for (const k of own) {
    const [x, y] = k.split(',').map(Number)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!own.has(`${x + dx},${y + dy}`)) ring.add(`${x + dx},${y + dy}`)
  }
  const mean = keys => [...keys].reduce((sum, k) => sum + luminance('#' + picture.get(k).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')), 0) / keys.size
  const [hi, lo] = [mean(own), mean(ring)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// RULE CHANGE. The seated engineers (person and chair together) used to be outlined so that the silhouette read at 3 to 1 against
// its surround. The outline made the chair look lifted off the floor over the desk behind it, and the owner chose the room without
// it. Seated people are decoration, not a marker or text, so the silhouette no longer has to reach 3 to 1: where a floor can fail it
// only has to stay at or above what the room measures today (the measure rounded down); the two people who stand keep the outline and
// the 3 to 1 of the test above, and the board ink keeps 4.5 to 1.
// A floor must be able to fail. The control below builds the same room with nobody seated (the chair alone) and requires that every
// seat in every window kind with a floor scores under its floor there. In a dark window three of the four seats score no better
// than their empty chair (1.15, 1.38 and 1.08 against 1.40, 1.46 and 1.45), so no floor can tell them from nothing: their dark
// figures are NOT contrast-tested at all, and the test says so by asserting that they do not beat the empty chair.
const SEATED_FLOOR = {
  light: { 1: 2.3, 4: 3.9, 0: 3.1, 5: 4.1 },
  dark: { 1: 1.9 },
}

test('each seated engineer, person and chair together, stays at or above its floor where a floor can fail; the dark figures with none are not contrast-tested', () => {
  const seated = IT_PEOPLE.filter(person => chairCellsOf(person).size > 0)
  const empty = buildItWithoutPeople()

  assert.equal(seated.length, 4)
  for (const mode of ['light', 'dark']) {
    for (const person of seated) {
      const value = silhouetteContrast(IT_SVG, mode, person)
      const bare = silhouetteContrast(empty, mode, person)
      const floor = SEATED_FLOOR[mode][person.n]
      if (floor === undefined) {
        // No floor: the seat does not beat its empty chair, so any floor would pass for nobody sitting there.
        assert.ok(value <= bare, `${mode} char ${person.n} beats its empty chair (${value.toFixed(2)} against ${bare.toFixed(2)}): give it a floor`)
      } else {
        assert.ok(value >= floor, `${mode} char ${person.n} at ${person.x},${person.y}: ${value.toFixed(2)} under ${floor}`)
        // Control, every seat with a floor in its window kind: the empty chair does not reach the floor.
        assert.ok(bare < floor, `${mode} char ${person.n}: the empty chair scores ${bare.toFixed(2)}, the floor ${floor} cannot fail`)
      }
    }
  }
  // No outline is painted round a seat: the rim colours appear only round the two who stand.
  const standing = IT_PEOPLE.filter(person => chairCellsOf(person).size === 0)
  const lit = litCells(IT_SVG)
  const outlined = person =>
    [...personCells(person)]
      .flatMap(k => {
        const [x, y] = k.split(',').map(Number)
        return [`${x - 1},${y}`, `${x + 1},${y}`, `${x},${y - 1}`, `${x},${y + 1}`]
      })
      .some(k => [RIM, RIM_LIGHT].includes(lit.get(k)))
  for (const person of seated) assert.equal(outlined(person), false, `outline round char ${person.n}`)
  for (const person of standing) assert.equal(outlined(person), true, `no outline round standing char ${person.n}`)
})

// ---- seating, as the viz office seats a character ----------------------------------------------------------------
// gotechcom/vibemaestro-viz (screens/office): a desk sprite at (d.x - 24, d.y - 16); a person at work uses the
// back-view typing frame, centred on the desk, its top at d.y - 8, i.e. 16 right and 8 down of the desk sprite's
// corner; then the chair back is drawn at the same corner, over the person's legs. Order: desk, person, chair.

const assets = new URL('../assets/', import.meta.url)
const png = path => readPng(readFileSync(new URL(path, assets)))
const opaque = (img, sx, sy, w, h) => {
  const rows = []
  const cols = []
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      if (img.rgba[((sy + j) * img.width + sx + i) * 4 + 3] >= 128) {
        rows.push(j)
        cols.push(i)
      }
    }
  }
  return { top: Math.min(...rows), bottom: Math.max(...rows), left: Math.min(...cols), right: Math.max(...cols) }
}
const chairRows = opaque(png('furniture/WOODEN_CHAIR_BACK.png'), 0, 0, 16, 32)

// Is this placement a seated one? The person's origin is 16 right and 8 down of the desk's, the chair is at the
// person's origin, drawn after desk and person, and the person's bottom row lies in the chair's rows.
function seated({ desk, person, chair, order, bottomRow }) {
  const personBottom = person.y + bottomRow
  return (
    person.x === desk.x + 16 &&
    person.y === desk.y + 8 &&
    chair.x === person.x &&
    chair.y === person.y &&
    order.desk < order.person &&
    order.person < order.chair &&
    personBottom >= chair.y + chairRows.top &&
    personBottom <= chair.y + chairRows.bottom
  )
}

// Every seat of a scene, with the draw order read from the trace.
function seatsOf(name) {
  const trace = buildTrace(name)
  return trace.flatMap((entry, at) => {
    if (!entry.seat || entry.who === null) return []
    const before = trace.slice(0, at)
    const last = pred => before.map((e, i) => [e, i]).filter(([e]) => pred(e)).at(-1)
    const [desk, deskAt] = last(e => e.path === 'furniture/DESK_FRONT.png' && e.x === entry.desk.x && e.y === entry.desk.y)
    const [person, personAt] = last(e => e.path === `characters/char_${entry.who}.png` && e.x === entry.x && e.y === entry.y)
    const [chair, chairAt] = last(e => e.path === 'furniture/WOODEN_CHAIR_BACK.png' && e.x === entry.x && e.y === entry.y)
    const frame = [3, 4].map(col => opaque(png(`characters/char_${entry.who}.png`), col * 16, 32, 16, 32).bottom)
    return [{ who: entry.who, desk, person, chair, order: { desk: deskAt, person: personAt, chair: chairAt }, bottomRow: Math.max(...frame) }]
  })
}

for (const [name, count] of [['classroom', 5], ['marketing', 3], ['it', 4]]) {
  test(`${name}: every seated person sits as in the viz office: centred on the desk, the chair back over the legs, drawn after the person`, () => {
    const seats = seatsOf(name)

    assert.equal(seats.length, count)
    for (const seat of seats) assert.equal(seated(seat), true, `char ${seat.who} at desk ${seat.desk.x},${seat.desk.y}`)
    // Control: the old placement (person 24 right and 13 down, the chair 9 below the person, drawn after) is refused.
    const [first] = seats
    const old = {
      ...first,
      person: { x: first.desk.x + 24, y: first.desk.y + 13 },
      chair: { x: first.desk.x + 24, y: first.desk.y + 22 },
    }
    assert.equal(seated(old), false)
    // Control: the chair drawn before the person is refused too.
    assert.equal(seated({ ...first, order: { desk: 0, person: 2, chair: 1 } }), false)
  })
}

test('the coffee cup in the IT room stands on a desk top: its bottom row on a top-surface row, inside the desk\'s width', () => {
  const desk = png('furniture/DESK_FRONT.png')
  const cup = opaque(png('furniture/COFFEE.png'), 0, 0, 16, 16)
  // The desk sprite's top surface: the rows where its middle column is the wood top colour.
  const surface = []
  for (let j = 0; j < 32; j++) {
    const o = (j * 48 + 24) * 4
    const hex = [0, 1, 2].map(i => desk.rgba[o + i].toString(16).padStart(2, '0')).join('')
    if (['b38857', 'cfa86d'].includes(hex)) surface.push(j)
  }
  const { left, right } = opaque(desk, 0, 0, 48, 32)
  const onADesk = at => IT_DESKS.some(d => at.y + cup.bottom >= d.y + Math.min(...surface) && at.y + cup.bottom <= d.y + Math.max(...surface) && at.x + cup.left >= d.x + left && at.x + cup.right <= d.x + right)

  assert.deepEqual([Math.min(...surface), Math.max(...surface)], [12, 24])
  assert.equal(onADesk(COFFEE_AT), true)
  assert.ok(buildTrace('it').some(e => e.path === 'furniture/COFFEE.png' && e.x === COFFEE_AT.x && e.y === COFFEE_AT.y))
  // Controls: the old placement (the cup beyond the desk's right end, and one on the floor) is refused.
  assert.equal(onADesk({ x: 66 + 34, y: 88 + 7 }), false)
  assert.equal(onADesk({ x: COFFEE_AT.x, y: IT_DESKS[1].y + 60 }), false)
})

// ---- who stands where: the zones of every room ---------------------------------------------------------------

const LEFT_END = 88 // cells: the left zone ends here, the right one starts at 104
const zoneOf = x => (x + 8 < LEFT_END ? 'left' : x >= 104 ? 'right' : 'middle')

test('IT: exactly one person tends the dashboard on the left, exactly one tends the racks on the right, two engineers sit in each zone', () => {
  const standing = IT_PEOPLE.filter(person => chairCellsOf(person).size === 0)
  const seated = IT_PEOPLE.filter(person => chairCellsOf(person).size > 0)

  assert.deepEqual(standing.map(person => zoneOf(person.x)), ['left', 'right'])
  assert.deepEqual(seated.map(person => zoneOf(person.x)), ['left', 'left', 'right', 'right'])
  assert.equal(IT_PEOPLE.length, 6)
  // The desks are four, two in each zone, and nothing stands in the middle.
  assert.deepEqual(IT_DESKS.map(desk => zoneOf(desk.x + 24)), ['left', 'left', 'right', 'right'])
  // Control: a person placed under the chat column would be read as the middle.
  assert.equal(zoneOf(96), 'middle')
})

test('marketing: the photo kit (tripod, phone table) is in the left zone below the discussion table; the work desks are in the right zone', () => {
  const trace = buildTrace('marketing')
  const table = trace.find(e => e.path === 'furniture/SMALL_TABLE_FRONT.png')
  const desks = trace.filter(e => e.path === 'furniture/DESK_FRONT.png')
  const lit = litCells(MARKETING_SVG)
  const ring = [...lit].filter(([, c]) => c === MARKERS.marketing.ring.toUpperCase()).map(([k]) => Number(k.split(',')[0]))
  const heart = [...lit].filter(([, c]) => c === MARKERS.marketing.heart.toUpperCase()).map(([k]) => Number(k.split(',')[0]))

  assert.equal(zoneOf(table.x), 'left')
  assert.ok(ring.length > 20 && ring.every(x => x < LEFT_END))
  assert.ok(heart.length > 4 && heart.every(x => x < LEFT_END))
  assert.equal(desks.length, 3)
  assert.deepEqual(desks.map(d => zoneOf(d.x)), ['right', 'right', 'right'])
})

// A station is its desk, its monitors or PC, and the person with the chair back; its opaque rows run from the top of the
// tallest sprite (the monitor, or the desk) to the foot of the chair. The floor between two stations of a column is the rows
// strictly between the lower one's top and the upper one's foot.
const opaqueRows = path => {
  const { top, bottom } = opaque(png(path), 0, 0, png(path).width, png(path).height)
  return [top, bottom]
}
function stationsOf(name) {
  const trace = buildTrace(name)
  const [deskTop, deskBottom] = opaqueRows('furniture/DESK_FRONT.png')
  const [, chairBottom] = opaqueRows('furniture/WOODEN_CHAIR_BACK.png')
  return trace
    .filter(e => e.path === 'furniture/DESK_FRONT.png')
    .map(desk => {
      let top = desk.y + deskTop
      for (const e of trace) {
        const pc = e.path?.match(/furniture\/(PC_FRONT_ON_\d)\.png/)
        if (pc && e.x >= desk.x && e.x < desk.x + 48 && e.y >= desk.y - 8 && e.y <= desk.y) top = Math.min(top, e.y + opaqueRows(`furniture/${pc[1]}.png`)[0])
      }
      const chair = trace.find(e => e.path === 'furniture/WOODEN_CHAIR_BACK.png' && e.x === desk.x + 16 && e.y === desk.y + 8)
      return { x: desk.x, top, bottom: Math.max(desk.y + deskBottom, chair ? chair.y + chairBottom : 0) }
    })
}
// The smallest visible floor gap, in rows, between stations of one column (undefined when no column has two).
function floorGap(stations) {
  const columns = new Map()
  for (const s of stations) columns.set(s.x, [...(columns.get(s.x) ?? []), s].sort((p, q) => p.top - q.top))
  const gaps = [...columns.values()].flatMap(list => list.slice(1).map((s, i) => s.top - list[i].bottom - 1))
  return gaps.length ? Math.min(...gaps) : undefined
}

test('between two stations of a column there is as much floor as between the ACCA desks, measured from the lower monitor or PC to the upper chair', () => {
  const classroom = floorGap(stationsOf('classroom'))

  // The classroom: desks 40 rows apart, no monitors: 40 + 11 - 39 - 1 rows of floor.
  assert.equal(classroom, 11)
  for (const name of ['marketing', 'it']) {
    const gap = floorGap(stationsOf(name))
    assert.ok(gap >= classroom, `${name}: ${gap} rows of floor, the classroom has ${classroom}`)
  }
  assert.equal(floorGap(stationsOf('marketing')), 11)
  assert.equal(floorGap(stationsOf('it')), 11)
  // Controls: the measure is live. The last commit's stations (desks 46 apart, a monitor 6 rows above each desk) left no floor,
  // a station that overlaps the one above gives a negative gap, and one station alone has no gap to measure.
  assert.equal(floorGap([{ x: 0, top: 38, bottom: 83 }, { x: 0, top: 84, bottom: 129 }]), 0)
  assert.equal(floorGap([{ x: 0, top: 38, bottom: 90 }, { x: 0, top: 84, bottom: 130 }]), -7)
  assert.equal(floorGap([{ x: 0, top: 0, bottom: 10 }]), undefined)
})

test('the teacher faces the students: the front frame (row 0 of the sheet), not the back one', () => {
  const teacher = buildTrace('classroom').find(e => e.path === 'characters/char_5.png')
  const sheet = png('characters/char_5.png')
  // A face: skin-coloured pixels in the head rows of the frame; the back of a head has none.
  const skin = (col, row) => {
    let count = 0
    for (let j = 8; j < 15; j++) {
      for (let i = 3; i < 13; i++) {
        const o = ((row * 32 + j) * sheet.width + col * 16 + i) * 4
        const [r, g, b, a] = [0, 1, 2, 3].map(k => sheet.rgba[o + k])
        if (a > 250 && r > 190 && g > 130 && b > 90 && r > g && g > b) count++
      }
    }
    return count
  }

  assert.equal(teacher.sy, 0)
  assert.equal(teacher.sx, 0)
  assert.ok(skin(0, 0) >= 10, `front ${skin(0, 0)}`)
  assert.ok(skin(1, 1) < 3, `back ${skin(1, 1)}`)
})
