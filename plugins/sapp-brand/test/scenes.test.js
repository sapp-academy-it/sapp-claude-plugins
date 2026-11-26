import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

import { BLUEPRINT_ALT, LINK, NOTE_WHITE, NOTE_YELLOW, blueprintSvg, boardSvg } from '../hooks/diagrams.js'
import { IT_SVG } from '../hooks/scene-it.js'
import { MARKETING_SVG } from '../hooks/scene-marketing.js'
import { SCENE_SVG } from '../hooks/scene.js'
import { THEMES, pickTheme } from '../hooks/themes.js'
import { GRAPH_BG, GRAPH_PANEL, IT_PEOPLE, MARKERS, RIM, SCENES, buildItWithoutPeople, buildItWithoutRim, buildScene, buildSceneModule, personCells } from '../scripts/build-scene.mjs'
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

test('the two diagram scenes are the same Svg every time', () => {
  assert.equal(boardSvg(), boardSvg())
  assert.equal(blueprintSvg(), blueprintSvg())
  assert.equal(byId('marketing-board').svg, boardSvg())
  assert.equal(byId('it-blueprint').svg, blueprintSvg())
})

test('a scene name that does not exist is refused, not built empty', () => {
  assert.throws(() => buildScene('library'))
  assert.deepEqual(Object.keys(SCENES), ['classroom', 'marketing', 'it'])
})

// ---- sizes and shape of every new Svg ------------------------------------------------

const NEW = ['acca-classroom', 'marketing-room', 'marketing-board', 'it-room', 'it-blueprint']

test('every scene Svg: under 131072 characters, crispEdges, a viewBox, no width or height, no id that is not hyphenated', () => {
  for (const id of NEW) {
    const { svg } = byId(id)

    assert.ok(svg.length < 131072, `${id} ${svg.length}`)
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 544" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">'), id)
    assert.equal(/<svg [^>]*\b(width|height)=/.test(svg), false, id)
    for (const [, name] of svg.matchAll(/\bid="([^"]*)"/g)) assert.match(name, /^[a-z]+(-[a-z]+)*$/, `${id} id ${name}`)
  }
  // Control: the id check is live on a bad one.
  assert.equal(/^[a-z]+(-[a-z]+)*$/.test('bad_id'), false)
})

test('the pixel scenes are whole cells of 4 on a 192 by 136 grid', () => {
  for (const svg of [SCENE_SVG, MARKETING_SVG, IT_SVG]) {
    const subpaths = [...svg.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z/g)]
    assert.ok(subpaths.length > 1500)
    for (const [, x, y, w, h] of subpaths) {
      for (const v of [x, y, w, h]) assert.equal(Number(v) % 4, 0)
      assert.ok(Number(x) + Number(w) <= 768 && Number(y) + Number(h) <= 544)
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

test('the diagram marks are not near any other colour of their scene', () => {
  const near = (svg, hex, skip) => [...new Set([...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map(m => m[0].toUpperCase()))].filter(c => c !== hex.toUpperCase() && !skip.includes(c) && dist(rgb(hex), rgb(c)) <= 0.2)

  assert.deepEqual(near(blueprintSvg(), LINK, []), [])
  assert.deepEqual(near(boardSvg(), NOTE_YELLOW, []), [])
  assert.deepEqual(near(boardSvg(), NOTE_WHITE, []), [])
})

// ---- shaders: where the registry points, and no flashing ------------------------------------

test('every shader file the registry names exists, and register.js names each by a literal path', () => {
  const files = readdirSync(hooks).filter(f => f.endsWith('.shader.ts'))
  const source = readFileSync(new URL('register.js', hooks), 'utf8')

  assert.deepEqual(files.sort(), ['backdrop.shader.ts', 'it-blueprint.shader.ts', 'it-room.shader.ts', 'marketing-board.shader.ts', 'marketing.shader.ts'])
  for (const f of files) assert.ok(source.includes(`module: './${f}'`), f)
})

test('the Backdrop hook plays the shader of each theme over its own Svg, and none over the dots', async () => {
  const engine = registered()
  const draw = scene => render(engine, 'Backdrop', { surface: 'desktop', props: { scene, plugin: 'sapp-brand' } })
  const want = {
    'sapp-acca-classroom': './backdrop.shader.ts',
    'sapp-marketing-room': './marketing.shader.ts',
    'sapp-marketing-board': './marketing-board.shader.ts',
    'sapp-it-room': './it-room.shader.ts',
    'sapp-it-blueprint': './it-blueprint.shader.ts',
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
    ['Bảng ý tưởng', 'marketing-board'],
    ['bang y tuong', 'marketing-board'],
    ['BẢNG Ý TƯỞNG', 'marketing-board'],
    ['Phòng IT', 'it-room'],
    ['phong it', 'it-room'],
    ['Bản vẽ mạng', 'it-blueprint'],
    ['ban ve mang', 'it-blueprint'],
    ['BẢN VẼ MẠNG', 'it-blueprint'],
    ['2', 'marketing-room'],
    ['3', 'marketing-board'],
    ['4', 'it-room'],
    ['5', 'it-blueprint'],
    ['it-room', 'it-room'],
    ['  phong it ', 'it-room'],
  ]
  for (const [text, id] of picks) assert.equal(pickTheme(text)?.id, id, text)
  // Refusals: a near miss, a part of a title and another team's word match nothing.
  for (const bad of ['phong', 'ban ve', 'marketing', 'phong i', 'bang y tuong 2', '0', '9']) {
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
  assert.ok(rows.length > 40)
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
// The uv x at which a window of this size, fitting the 768 by 544 scene with `slice`, shows scene x.
const uvXOf = (sceneX, [w, h]) => ((sceneX - 384) * Math.max(w / 768, h / 544) + w / 2) / w
const WINDOWS = [[768, 544], [1512, 945], [1000, 1400], [2400, 600]]

test('the shader\'s scene-x line maps a uv back to the scene x at every window shape; a wrong fit turns it red', () => {
  const source = readFileSync(new URL('it-room.shader.ts', hooks), 'utf8')
  const check = fn => WINDOWS.every(win => [42, 100, 246, 600].every(x => Math.abs(fn(uvXOf(x, win), win, Math.max, Math.min) - x) < 1e-6))

  assert.equal(check(sceneXOf(source)), true)
  // Controls: the fit written the other way round (min, "contain") and a shifted centre do not pass.
  assert.equal(check(sceneXOf(source.replace('max(size.x / 768', 'min(size.x / 768').replace(/\bmax\(/g, 'min('))), false)
  assert.equal(check(sceneXOf(source.replace('+ 384', '+ 380'))), false)
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
    withNear.set('66,16', near)
    assert.deepEqual(painted(withNear, { byPosition: true }), [])
    assert.ok(painted(withNear, { byPosition: false }).includes('66,16'))
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
function personContrast(svg, mode, person) {
  const picture = pictureOf(svg, mode)
  const own = personCells(person)
  const ring = new Set()
  for (const k of own) {
    const [x, y] = k.split(',').map(Number)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!own.has(`${x + dx},${y + dy}`)) ring.add(`${x + dx},${y + dy}`)
  }
  const mean = keys => [...keys].reduce((sum, k) => sum + luminance('#' + picture.get(k).map(v => Math.round(v).toString(16).padStart(2, '0')).join('')), 0) / keys.size
  const [hi, lo] = [mean(own), mean(ring)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

test('each person in the IT room reads at 3 to 1 or more against their surround, in a light and a dark window', () => {
  for (const mode of ['light', 'dark']) {
    for (const person of IT_PEOPLE) assert.ok(personContrast(IT_SVG, mode, person) >= 3, `${mode} char ${person.n}: ${personContrast(IT_SVG, mode, person).toFixed(2)}`)
  }
  // Controls: the measure is live. The same room with no rim fails it for someone in some window, and a
  // person measured in a room with nobody in it reads as nothing special.
  const bare = buildItWithoutRim()
  const failing = ['light', 'dark'].flatMap(mode => IT_PEOPLE.filter(person => personContrast(bare, mode, person) < 3))
  assert.ok(failing.length > 0)
  assert.equal(buildItWithoutPeople().includes(`<path fill="${RIM}"`), false)
  // The rim is dark ink, never a recolouring: a person's own cells keep the sprite's colours.
  const lit = litCells(IT_SVG)
  assert.equal(IT_PEOPLE.every(person => [...personCells(person)].every(k => lit.has(k))), true)
})
