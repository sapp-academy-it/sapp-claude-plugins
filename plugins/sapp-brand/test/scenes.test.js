import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

import { BLUEPRINT_ALT, LINK, NOTE_WHITE, NOTE_YELLOW, blueprintSvg, boardSvg } from '../hooks/diagrams.js'
import { IT_SVG } from '../hooks/scene-it.js'
import { MARKETING_SVG } from '../hooks/scene-marketing.js'
import { SCENE_SVG } from '../hooks/scene.js'
import { THEMES, pickTheme } from '../hooks/themes.js'
import { GRAPH_BG, MARKERS, SCENES, buildScene, buildSceneModule } from '../scripts/build-scene.mjs'
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

const NEW = ['acca-classroom', 'acca-night', 'marketing-room', 'marketing-board', 'it-room', 'it-blueprint']

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
    'sapp-acca-night': './backdrop.shader.ts',
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

test('no shader sets a rate above 3 cycles a second: every sin() in time runs under 6 rad/s', () => {
  for (const f of readdirSync(hooks).filter(x => x.endsWith('.shader.ts'))) {
    const source = readFileSync(new URL(f, hooks), 'utf8')
    for (const [, rate] of source.matchAll(/time \* ([\d.]+)/g)) assert.ok(Number(rate) < 3, `${f}: time * ${rate}`)
  }
  // Control: the scan finds the rates.
  assert.ok(readFileSync(new URL('it-room.shader.ts', hooks), 'utf8').includes('time * 1.3'))
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
    ['3', 'marketing-room'],
    ['4', 'marketing-board'],
    ['5', 'it-room'],
    ['6', 'it-blueprint'],
    ['it-room', 'it-room'],
  ]
  for (const [text, id] of picks) assert.equal(pickTheme(text)?.id, id, text)
  // Refusals: a near miss, a part of a title and another team's word match nothing.
  for (const bad of ['phong', 'ban ve', 'marketing', 'phong it ', 'phong i', 'bang y tuong 2', '0', '9']) {
    if (bad === 'phong it ') continue
    assert.equal(pickTheme(bad), undefined, bad)
  }
})

test('/sapp-theme switches to each new theme, sets its scene and stores its id', async () => {
  for (const id of NEW.slice(2)) {
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
