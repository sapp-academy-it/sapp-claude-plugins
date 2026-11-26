import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { CREDIT, SPINNER_TEXT, STORE_KEY, register } from '../hooks/register.js'
import { SCENE_SVG } from '../hooks/scene.js'
import { THEMES, dotsSvg, pickTheme, themeOrDefault } from '../hooks/themes.js'
import { tokens } from '../hooks/tokens.js'
import { makeColors } from '../hooks/make-colors.js'
import { buildSceneModule } from '../scripts/build-scene.mjs'
import { registered, render, runCommand, startSession, tip } from './harness.js'

// Events that read or change what Claude does, or what the person typed: whole
// families by prefix, plus these exact names.
const FORBIDDEN_PREFIXES = ['tool.', 'prompt.', 'classic.']
const FORBIDDEN = ['skill.prompt', 'session.append', 'attribution.text', 'settings.read', 'plugin.register', 'telemetry.log']
const isForbidden = event => FORBIDDEN.includes(event) || FORBIDDEN_PREFIXES.some(prefix => event.startsWith(prefix))

// What a register function sets up that is not allowed.
function violations(registerFn) {
  return registered(registerFn).hooks.map(h => h.event).filter(isForbidden)
}

const setCalls = engine => engine.calls.filter(c => c.path === 'theme.set')
const lastSet = engine => setCalls(engine).at(-1).args[0]
const inputs = (id, mode) => THEMES.find(t => t.id === id).colors.inputs[mode]

// ---- the registry -------------------------------------------------------------

test('the registry lists exactly these theme ids, in this order, the default first', () => {
  assert.deepEqual(
    THEMES.map(t => t.id),
    ['acca-classroom', 'marketing-room', 'it-room', 'sapp-dots'],
  )
  assert.deepEqual(
    THEMES.map(t => t.title),
    ['Lớp học ACCA', 'Phòng Marketing', 'Phòng IT', 'Chấm vàng SAPP'],
  )
})

test('exact SAPP colours of acca-classroom, marketing-room and sapp-dots, light and dark', () => {
  for (const id of ['acca-classroom', 'marketing-room', 'sapp-dots']) {
    const light = inputs(id, 'light')
    const dark = inputs(id, 'dark')

    assert.equal(light['gray-20'], '#faf8f3', id)
    assert.equal(light['gray-400'], '#79736a', id)
    assert.equal(light['gray-600'], '#57534a', id)
    assert.equal(light['gray-900'], '#1a1916', id)
    assert.equal(dark['gray-900'], '#1a1916', id)
    assert.equal(dark['gray-800'], '#2a2823', id)
    assert.equal(dark['gray-400'], '#a39c90', id)
    assert.equal(dark['gray-200'], '#c9c2b5', id)
    assert.equal(dark['gray-50'], '#faf8f3', id)
    assert.equal(light['role-danger-450'], '#d64545', id)
    assert.equal(dark['role-danger-450'], '#d64545', id)
  }
})

test('exact colours of the IT theme: the SAPP cream in a light window, the night blue in a dark one', () => {
  for (const id of ['it-room']) {
    const light = inputs(id, 'light')
    const dark = inputs(id, 'dark')

    assert.equal(light['gray-20'], '#faf8f3', id)
    assert.equal(light['gray-400'], '#79736a', id)
    assert.equal(light['gray-900'], '#1a1916', id)
    assert.equal(dark['gray-900'], '#0e1430', id)
    assert.equal(dark['gray-800'], '#18213f', id)
    assert.equal(dark['gray-400'], '#98a2c0', id)
    assert.equal(dark['gray-200'], '#b8c0d8', id)
    assert.equal(dark['gray-50'], '#eef1f8', id)
    assert.equal(light['role-danger-450'], '#d64545', id)
    // Not the SAPP ink in the dark half.
    assert.notEqual(dark['gray-900'], inputs('acca-classroom', 'dark')['gray-900'], id)
  }
})

test('every theme is one Desktop will paint: no problem line starts "Desktop won\'t paint"', () => {
  for (const t of THEMES) {
    assert.deepEqual(t.problems.filter(line => line.startsWith("Desktop won't paint")), [], t.id)
  }
  // Control: makeColors reports problem lines for these themes, so the list is live.
  assert.ok(THEMES[0].problems.length > 0)
})

test('backdrop and shader per theme: each scene has its own id and shader, dots a still only', () => {
  const by = Object.fromEntries(THEMES.map(t => [t.id, t]))
  const want = {
    'acca-classroom': ['sapp-acca-classroom', 'classroom'],
    'marketing-room': ['sapp-marketing-room', 'marketing'],
    'it-room': ['sapp-it-room', 'it-room'],
  }
  for (const [id, [scene, shader]] of Object.entries(want)) {
    assert.equal(by[id].scene, scene, id)
    assert.equal(by[id].shader, shader, id)
  }
  assert.equal(by['sapp-dots'].scene, 'sapp-dots')
  assert.equal(by['sapp-dots'].shader, undefined)
  // Every Svg is also the still frame for reduced motion, so each has alt text.
  for (const t of THEMES.filter(x => x.svg)) assert.ok(t.alt.length > 10, t.id)
  // A scene id is one theme's alone: the Backdrop hook finds the theme by it.
  const scenes = THEMES.filter(t => t.scene).map(t => t.scene)
  assert.equal(new Set(scenes).size, scenes.length)
})

// ---- switching, fallback, persistence ---------------------------------------------

test('a first start with an empty store sets the default theme: acca-classroom with its backdrop', async () => {
  const engine = registered()
  await startSession(engine)
  const set = lastSet(engine)

  assert.equal(set.backdrop.scene, 'sapp-acca-classroom')
  assert.deepEqual(set.backdrop.glass, { blur: 14, opacity: 0.72 })
  assert.equal(set.colors.inputs.light['gray-20'], '#faf8f3')
})

test('a stored id sets that theme at the next start', async () => {
  const engine = registered(register, { store: new Map([[STORE_KEY, 'it-room']]) })
  await startSession(engine)

  assert.equal(lastSet(engine).backdrop.scene, 'sapp-it-room')
  assert.equal(lastSet(engine).colors.inputs.dark['gray-900'], '#0e1430')
})

test('the removed ids acca-night, marketing-board, it-blueprint and sapp-plain, stored by an earlier version, fall back to acca-classroom', async () => {
  for (const removed of ['acca-night', 'marketing-board', 'it-blueprint', 'sapp-plain']) {
    const engine = registered(register, { store: new Map([[STORE_KEY, removed]]) })
    await startSession(engine)

    assert.equal(lastSet(engine).backdrop.scene, 'sapp-acca-classroom', removed)
    assert.equal(themeOrDefault(removed).id, 'acca-classroom', removed)
    assert.equal(THEMES.some(t => t.id === removed), false, removed)
    // They are no longer names /sapp-theme knows, either.
    assert.equal(pickTheme(removed), undefined, removed)
  }
  assert.equal(pickTheme('Lớp học ACCA ban đêm'), undefined)
  assert.equal(pickTheme('Bảng ý tưởng'), undefined)
  assert.equal(pickTheme('Bản vẽ mạng'), undefined)
  assert.equal(pickTheme('SAPP cơ bản'), undefined)
})

test('an unknown, removed or malformed stored id falls back to the default theme', async () => {
  for (const bad of ['sapp-hologram', '', 42, null, { id: 'it-room' }, 'IT-ROOM']) {
    const engine = registered(register, { store: new Map([[STORE_KEY, bad]]) })
    await startSession(engine)

    assert.equal(lastSet(engine).backdrop.scene, 'sapp-acca-classroom', JSON.stringify(bad))
  }
  assert.equal(themeOrDefault('sapp-hologram').id, 'acca-classroom')
  assert.equal(themeOrDefault(undefined).id, 'acca-classroom')
})

test('a store that throws still gives the default theme and the credit line', async () => {
  const engine = registered(register, { throwOn: 'store.get' })
  const result = await startSession(engine)

  assert.ok(result.passed)
  assert.equal(lastSet(engine).backdrop.scene, 'sapp-acca-classroom')
  assert.deepEqual(engine.calls.find(c => c.path === 'ui.status').args, [CREDIT])
})

test('/sapp-theme <id> sets that theme with its colours and backdrop, and answers in Vietnamese', async () => {
  const engine = registered()
  await startSession(engine)
  const out = await runCommand(engine, 'sapp-theme', 'it-room')
  const set = lastSet(engine)

  assert.equal(set.backdrop.scene, 'sapp-it-room')
  assert.equal(set.colors.inputs.light['gray-20'], '#faf8f3')
  assert.equal(set.colors.inputs.dark['gray-900'], '#0e1430')
  assert.equal(out.text, 'Đã đổi sang "Phòng IT" và lưu lại cho các phiên sau.')
  assert.equal(out.isTextDisplayOnly, true)
})

test('a theme can be picked by list number, by title in any case, and by title without accents', async () => {
  const picks = [
    ['4', 'sapp-dots'],
    ['  Chấm vàng SAPP ', 'sapp-dots'],
    ['PHONG IT', 'it-room'],
    ['chAm vang sapp', 'sapp-dots'],
  ]
  for (const [text, id] of picks) {
    const engine = registered()
    await runCommand(engine, 'sapp-theme', text)

    assert.equal(engine.store.get(STORE_KEY), id, text)
  }
  assert.equal(pickTheme('6'), undefined)
  assert.equal(pickTheme('0'), undefined)
  assert.equal(pickTheme('acca'), undefined)
})

test('an unknown theme name changes nothing: no theme.set, nothing stored, the list is shown', async () => {
  const engine = registered(register, { store: new Map([[STORE_KEY, 'sapp-dots']]) })
  const out = await runCommand(engine, 'sapp-theme', 'sapp-hologram')

  assert.equal(setCalls(engine).length, 0)
  assert.equal(engine.store.get(STORE_KEY), 'sapp-dots')
  assert.ok(out.text.startsWith('Không có giao diện "sapp-hologram".\nGiao diện SAPP, đang dùng: Chấm vàng SAPP.'))
})

test('/sapp-theme with no argument lists the four themes and marks the one in use', async () => {
  const engine = registered(register, { store: new Map([[STORE_KEY, 'it-room']]) })
  const out = await runCommand(engine, 'sapp-theme', '')

  assert.equal(
    out.text,
    [
      'Giao diện SAPP, đang dùng: Phòng IT.',
      '1. Lớp học ACCA (acca-classroom): Lớp học pixel art: bảng ACCA, thầy chỉ bảng, quạt trần quay chậm (mặc định)',
      '2. Phòng Marketing (marketing-room): Phòng Marketing pixel art: bàn chiến dịch, bảng KPI, góc quay nội dung',
      '3. Phòng IT (it-room): Phòng IT pixel art: tủ rack, màn hình giám sát, đèn LED nhấp nháy chậm; sáng ban ngày, tối về đêm [đang dùng]',
      '4. Chấm vàng SAPP (sapp-dots): Lưới chấm vàng SAPP tĩnh, nhẹ',
      'Đổi bằng /sapp-theme <số, mã hoặc tên>. Nền và màu chỉ hiện ở tab Code của Desktop và trên mobile.',
    ].join('\n'),
  )
  assert.equal(setCalls(engine).length, 0)
})

test('the choice round-trips through the store: switch, restart, same theme', async () => {
  const first = registered()
  await runCommand(first, 'sapp-theme', 'sapp-dots')
  assert.equal(first.store.get(STORE_KEY), 'sapp-dots')

  // A new session over the same fake store.
  const second = registered(register, { store: first.store })
  await startSession(second)

  assert.equal(lastSet(second).backdrop.scene, 'sapp-dots')
})

test('a build where theme.set throws: the switch is refused and nothing is stored', async () => {
  const engine = registered(register, { throwOn: 'theme.set' })
  const out = await runCommand(engine, 'sapp-theme', 'it-room')

  assert.equal(out.text, 'Không áp dụng được "Phòng IT" trên bản Claude Code này.')
  assert.equal(engine.store.has(STORE_KEY), false)
})

test('a store that cannot be written: the theme is applied and the person is told it is not saved', async () => {
  const engine = registered(register, { throwOn: 'store.set' })
  const out = await runCommand(engine, 'sapp-theme', 'sapp-dots')

  assert.equal(lastSet(engine).backdrop.scene, 'sapp-dots')
  assert.equal(out.text, 'Đã đổi sang "Chấm vàng SAPP", nhưng không lưu được lựa chọn cho lần sau.')
})

// ---- the credit line and the spinner -----------------------------------------------

test('the credit line is exact and is pinned as the status line', async () => {
  const engine = registered()
  await startSession(engine)
  const status = engine.calls.find(c => c.path === 'ui.status')

  assert.equal(CREDIT, 'Tạo bởi SAPP IT Department, © 2026')
  assert.deepEqual(status.args, ['Tạo bởi SAPP IT Department, © 2026'])
})

test('a switch leaves the credit line exact and the spinner text unchanged, for every theme', async () => {
  for (const t of THEMES) {
    const engine = registered()
    await startSession(engine)
    await runCommand(engine, 'sapp-theme', t.id)
    const statuses = engine.calls.filter(c => c.path === 'ui.status')
    const out = await render(engine, 'Spinner', {
      surface: 'desktop',
      props: { word: 'Sauteing', message: null, suffix: '.', mode: 'thinking' },
    })

    assert.deepEqual(statuses.at(-1).args, ['Tạo bởi SAPP IT Department, © 2026'], t.id)
    assert.deepEqual(out.passed.props, {
      word: 'SAPP đang xử lý',
      message: null,
      suffix: '…',
      mode: 'thinking',
    }, t.id)
  }
})

test('the spinner says "SAPP đang xử lý…" in place of the word and leaves messages alone', async () => {
  const engine = registered()
  const props = { word: 'Sauteing', message: null, suffix: '…', mode: 'thinking' }
  const out = await render(engine, 'Spinner', { surface: 'terminal', props })

  assert.equal(SPINNER_TEXT, 'SAPP đang xử lý')
  assert.deepEqual(out.passed.props, {
    word: 'SAPP đang xử lý',
    message: null,
    suffix: '…',
    mode: 'thinking',
  })

  const overridden = await render(engine, 'Spinner', {
    surface: 'desktop',
    props: { ...props, message: 'Compacting' },
  })
  assert.equal(overridden.passed.props.message, 'Compacting')
})

test('the credit line survives a build where $.theme.set throws, and it is set first', async () => {
  const engine = registered(register, { throwOn: 'theme.set' })
  const result = await startSession(engine)

  assert.ok(result.passed)
  assert.deepEqual(
    engine.calls.map(c => c.path),
    ['ui.status', 'store.get', 'theme.set', 'command.register', 'command.register', 'store.get', 'store.set', 'ui.toast'],
  )
  assert.deepEqual(engine.calls[0].args, ['Tạo bởi SAPP IT Department, © 2026'])
})

// ---- tokens, scenes, sizes -----------------------------------------------------------

test('tokens.json and the loaded copy in hooks/tokens.js hold the same values', () => {
  const file = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'))

  assert.deepEqual({ roles: file.roles, light: file.light, dark: file.dark }, tokens)
  assert.equal(file.light['surface-0'], '#FAF8F3')
  assert.equal(file.dark['surface-0'], '#1A1916')
})

test('every backdrop Svg stays under the 131072-character limit, with room to spare', () => {
  const svgs = THEMES.filter(t => t.svg)

  assert.equal(svgs.length, 4)
  for (const t of svgs) {
    assert.ok(t.svg.length < 131072, `${t.id} is ${t.svg.length} characters`)
    assert.ok(t.svg.length < 125000, `${t.id} is ${t.svg.length} characters`)
  }
  // Control: the measure sees a real size.
  assert.ok(SCENE_SVG.length > 30000)
})

test('scripts/build-scene.mjs rebuilds hooks/scene.js byte for byte from the committed sprites', () => {
  const committed = readFileSync(new URL('../hooks/scene.js', import.meta.url), 'utf8')

  assert.equal(buildSceneModule(), committed)
  // Control: the comparison is live, a changed module does not match.
  assert.notEqual(buildSceneModule(), committed.replace('ACCA', 'ACCB'))
})

test('the classroom is pixel cells at an integer scale: 4 times a 192 by 200 grid, crisp, no width or height', () => {
  assert.ok(SCENE_SVG.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 800" preserveAspectRatio="xMidYMid slice"'))
  assert.equal(/<svg [^>]*\b(width|height)=/.test(SCENE_SVG), false)
  assert.ok(SCENE_SVG.includes('shape-rendering="crispEdges"'))
  // Every subpath is a rectangle of whole cells: M x y h w v h h -w z, all multiples of 4.
  const subpaths = [...SCENE_SVG.matchAll(/M(\d+) (\d+)h(\d+)v(\d+)h-(\d+)z/g)]
  assert.ok(subpaths.length > 1500)
  for (const [, x, y, w, h, back] of subpaths) {
    for (const v of [x, y, w, h]) assert.equal(Number(v) % 4, 0, `${v} is not a whole number of 4-pixel cells`)
    assert.equal(w, back)
  }
  for (const banned of ['<circle', '<polygon', '<line', '<ellipse']) {
    assert.equal(SCENE_SVG.includes(banned), false, banned)
  }
})

test('every backdrop is pure vector with nothing the engine refuses', () => {
  for (const t of THEMES.filter(x => x.svg)) {
    for (const banned of ['<image', 'data:', 'base64', 'foreignObject', '@font-face', '@import', 'href', '<!']) {
      assert.equal(t.svg.includes(banned), false, `${t.id} ${banned}`)
    }
    assert.ok(t.svg.startsWith('<svg '), t.id)
    assert.ok(t.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" shape-rendering="crispEdges">'), t.id)
    assert.equal(t.svg.includes('viewBox'), false, t.id)
  }
})

test('the dots scene is deterministic, uses circles only and grows toward the bottom-right', () => {
  assert.equal(dotsSvg(), dotsSvg())
  const dots = THEMES.find(t => t.id === 'sapp-dots').svg
  assert.equal(dotsSvg(), dots)
  const radii = [...dots.matchAll(/<circle cx="(\d+)" cy="(\d+)" r="([\d.]+)"\/>/g)].map(m => [+m[1], +m[2], +m[3]])
  const at = (x, y) => radii.find(([cx, cy]) => cx === x && cy === y)?.[2]

  assert.ok(radii.length > 100)
  assert.ok(at(752, 528) > at(560, 272))
  assert.equal(at(16, 16), undefined)
  assert.equal(dots.includes('<rect x='), false)
})

// ---- the Backdrop hook ---------------------------------------------------------------

test('the Backdrop hook draws each scene: a Shader over the Svg for the classroom, an Svg alone for the dots', async () => {
  const engine = registered()
  const draw = scene => render(engine, 'Backdrop', { surface: 'desktop', props: { scene, plugin: 'sapp-mod' } })

  const day = await draw('sapp-acca-classroom')
  assert.equal(day.type, 'Shader')
  assert.equal(day.props.module, './backdrop.shader.ts')
  assert.ok(day.props.children[0].props.source.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" shape-rendering="crispEdges"><style>.bg{fill:#EADFC4}'))

  const dots = await draw('sapp-dots')
  assert.equal(dots.type, 'Svg')
  assert.equal(dots.props.source, THEMES.find(t => t.id === 'sapp-dots').svg)
})

test('the Backdrop hook leaves the terminal, another mod\'s scene and a scene we do not own, or the old plugin name alone', async () => {
  const engine = registered()
  const terminal = await render(engine, 'Backdrop', { surface: 'terminal', props: { scene: 'sapp-dots', plugin: 'sapp-mod' } })
  const otherScene = await render(engine, 'Backdrop', { surface: 'desktop', props: { scene: 'someone-elses-scene', plugin: 'sapp-mod' } })
  const otherPlugin = await render(engine, 'Backdrop', { surface: 'desktop', props: { scene: 'sapp-dots', plugin: 'another-mod' } })
  // The plugin was renamed from sapp-brand: the guard must name sapp-mod only.
  const oldName = await render(engine, 'Backdrop', { surface: 'desktop', props: { scene: 'sapp-dots', plugin: 'sapp-brand' } })
  // A scene removed from the registry, as an older stored theme may name.
  const removed = await render(engine, 'Backdrop', { surface: 'desktop', props: { scene: 'sapp-undefined', plugin: 'sapp-mod' } })

  for (const out of [terminal, otherScene, otherPlugin, oldName, removed]) assert.ok(out.passed)
})

test('the manifest name, the marketplace entry and the Backdrop guard all say sapp-mod', async () => {
  const manifest = JSON.parse(readFileSync(new URL('../.claude-plugin/plugin.json', import.meta.url), 'utf8'))
  const market = JSON.parse(readFileSync(new URL('../../../.claude-plugin/marketplace.json', import.meta.url), 'utf8'))
  assert.equal(manifest.name, 'sapp-mod')
  assert.deepEqual(market.plugins.map(p => p.name), ['sapp-mod'])
  // The engine passes the manifest name as props.plugin, so the guard must accept exactly it.
  const out = await render(registered(), 'Backdrop', { surface: 'desktop', props: { scene: 'sapp-dots', plugin: manifest.name } })
  assert.equal(out.type, 'Svg')
})

// ---- what the mod hooks and calls -------------------------------------------------------

test('register() hooks exactly session.start, the two commands, ui.tip, and the Backdrop, Spinner and Pane renders', () => {
  const engine = registered()

  assert.deepEqual(
    engine.hooks.map(h => h.event + JSON.stringify(h.matcher)).sort(),
    [
      'command.run{"command":"sapp-help"}',
      'command.run{"command":"sapp-theme"}',
      'session.start' + 'null',
      'ui.render{"component":"Backdrop"}',
      'ui.render{"component":"Pane"}',
      'ui.render{"component":"Spinner"}',
      'ui.tip' + 'null',
    ],
  )
})

test('register() registers no event that reads or changes Claude\'s actions', () => {
  assert.deepEqual(violations(register), [])
})

test('the forbidden-event check fails on a register() that hooks tool.call and prompt.submit (control)', () => {
  const bad = on => {
    on('session.start', (_, e, next) => next(e))
    on('tool.call', (_, e, next) => next(e))
    on('prompt.submit', (_, e, next) => next(e))
    on('tool.future-event', (_, e, next) => next(e))
    on('classic.PreToolUse', (_, e, next) => next(e))
  }

  assert.deepEqual(violations(bad), ['tool.call', 'prompt.submit', 'tool.future-event', 'classic.PreToolUse'])
})

test('running every hook makes no call on $ beyond the pinned set', async () => {
  const engine = registered()
  await startSession(engine)
  await runCommand(engine, 'sapp-theme', '')
  await runCommand(engine, 'sapp-theme', 'it-room')
  await runCommand(engine, 'sapp-help', '')
  await render(engine, 'Pane', { surface: 'desktop', requestId: 'sapp-help', props: {} })
  await tip(engine)
  await render(engine, 'Backdrop', { surface: 'desktop', props: { scene: 'sapp-acca-classroom', plugin: 'sapp-mod' } })
  await render(engine, 'Spinner', { surface: 'desktop', props: { word: 'x', message: null, suffix: '…', mode: 'thinking' } })
  const used = [...new Set(engine.calls.map(c => c.path))].sort()

  // No $.fs, $.process, $.http, $.env, $.tool, $.model, $.mcp, $.prompt, $.session.
  assert.deepEqual(used, ['command.register', 'store.get', 'store.set', 'theme.set', 'ui.close', 'ui.open', 'ui.resolve', 'ui.status', 'ui.toast'])
})

// ---- review round 1 ------------------------------------------------------------------------

test('the "Desktop won\'t paint" filter goes red on a palette with unreadable text (negative case)', () => {
  const { problems } = makeColors({
    label: 'Bad',
    light: { gray: { anchors: { 'surface-0': '#FAF8F3', 'text-primary': '#C9C5BA', 'text-muted': '#DAD6CC' } } },
  })

  assert.ok(problems.some(line => line.startsWith("Desktop won't paint")), problems.join('\n'))
})

test('a title typed in capitals with the letter Đ still matches', async () => {
  assert.equal(pickTheme('PHÒNG IT').id, 'it-room')
  assert.equal(pickTheme('Đ'), undefined)
})

test('an unknown name is echoed at most 64 characters long', async () => {
  const engine = registered()
  const out = await runCommand(engine, 'sapp-theme', 'x'.repeat(200))

  assert.ok(out.text.startsWith(`Không có giao diện "${'x'.repeat(64)}…".\n`))
  assert.equal(out.text.includes('x'.repeat(65)), false)
})

test('a status line that throws during a switch does not stop the store or the answer', async () => {
  const engine = registered(register, { throwOn: 'ui.status' })
  const out = await runCommand(engine, 'sapp-theme', 'sapp-dots')

  assert.equal(engine.store.get(STORE_KEY), 'sapp-dots')
  assert.equal(out.text, 'Đã đổi sang "Chấm vàng SAPP" và lưu lại cho các phiên sau.')
  // And at the start of a session the theme is still set.
  const started = registered(register, { throwOn: 'ui.status' })
  await startSession(started)
  assert.equal(lastSet(started).backdrop.scene, 'sapp-acca-classroom')
})

test('a command that fails inside answers with a display-only error and changes nothing', async () => {
  const engine = registered()
  // Arguments that are not text make the handler throw.
  const out = await runCommand(engine, 'sapp-theme', 5)

  assert.deepEqual(out, { text: 'Lệnh /sapp-theme gặp lỗi, giao diện không đổi.', isTextDisplayOnly: true })
  assert.equal(setCalls(engine).length, 0)
})

test('the list marks the theme applied in this session, even when it could not be stored', async () => {
  const engine = registered(register, { throwOn: 'store.set', store: new Map([[STORE_KEY, 'it-room']]) })
  await runCommand(engine, 'sapp-theme', 'sapp-dots')
  const out = await runCommand(engine, 'sapp-theme', '')

  assert.ok(out.text.startsWith('Giao diện SAPP, đang dùng: Chấm vàng SAPP.'))
  assert.ok(out.text.includes('(sapp-dots): Lưới chấm vàng SAPP tĩnh, nhẹ [đang dùng]'))
  assert.equal(out.text.split('\n').find(l => l.includes('(it-room)')).endsWith('[đang dùng]'), false)
})

test('no theme forces a colour scheme: every switch leaves overrideColorScheme out, so the window decides', async () => {
  for (const t of THEMES) {
    const engine = registered()
    await runCommand(engine, 'sapp-theme', t.id)

    assert.equal('overrideColorScheme' in lastSet(engine), false, t.id)
    assert.equal(t.colorScheme, undefined, t.id)
  }
})
