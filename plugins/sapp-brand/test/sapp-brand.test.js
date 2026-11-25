import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { CREDIT, SPINNER_TEXT, register, themeProblems } from '../hooks/register.js'
import { SCENE_SVG } from '../hooks/scene.js'
import { tokens } from '../hooks/tokens.js'
import { registered, render, startSession } from './harness.js'

// Events that read or change what Claude does, or what the person typed.
const FORBIDDEN = [
  'tool.call',
  'tool.check',
  'tool.describe',
  'prompt.submit',
  'prompt.compose',
  'prompt.section',
  'prompt.context',
  'prompt.attachment',
  'skill.prompt',
  'session.append',
  'attribution.text',
  'settings.read',
  'plugin.register',
  'telemetry.log',
]

// What a register function sets up that is not allowed: any forbidden event, or
// a classic.<Event> hook, or any call on $ outside the three the mod needs.
function violations(registerFn) {
  const engine = registered(registerFn)
  const bad = engine.hooks
    .map(h => h.event)
    .filter(event => FORBIDDEN.includes(event) || event.startsWith('classic.'))
  return bad
}

test('register() sets the theme from the exact SAPP token values', async () => {
  const engine = registered()
  await startSession(engine)
  const set = engine.calls.find(c => c.path === 'theme.set')
  const { light, dark } = set.args[0].colors.inputs

  // light: surface-0, text-muted, text-secondary, text-primary
  assert.equal(light['gray-20'], '#faf8f3')
  assert.equal(light['gray-400'], '#79736a')
  assert.equal(light['gray-600'], '#57534a')
  assert.equal(light['gray-900'], '#1a1916')
  // dark: surface-0, surface-1, text-muted, text-secondary, text-primary
  assert.equal(dark['gray-900'], '#1a1916')
  assert.equal(dark['gray-800'], '#2a2823')
  assert.equal(dark['gray-400'], '#a39c90')
  assert.equal(dark['gray-200'], '#c9c2b5')
  assert.equal(dark['gray-50'], '#faf8f3')
  // a role seeded from the design system's danger colour
  assert.equal(light['role-danger-450'], '#d64545')
  assert.equal(dark['role-danger-450'], '#d64545')
})

test('the backdrop is named in the theme, so the Backdrop hook is asked for it', async () => {
  const engine = registered()
  await startSession(engine)
  const set = engine.calls.find(c => c.path === 'theme.set')

  assert.equal(set.args[0].backdrop.scene, 'sapp-acca-classroom')
})

test('tokens.json and the loaded copy in hooks/tokens.js hold the same values', () => {
  const file = JSON.parse(readFileSync(new URL('../tokens.json', import.meta.url), 'utf8'))

  assert.deepEqual(
    { roles: file.roles, light: file.light, dark: file.dark },
    tokens,
  )
  assert.equal(file.light['surface-0'], '#FAF8F3')
  assert.equal(file.dark['surface-0'], '#1A1916')
})

test('the credit line is exact and is pinned as the status line', async () => {
  const engine = registered()
  await startSession(engine)
  const status = engine.calls.find(c => c.path === 'ui.status')

  assert.equal(CREDIT, 'Tạo bởi SAPP IT Department, © 2026')
  assert.deepEqual(status.args, ['Tạo bởi SAPP IT Department, © 2026'])
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

  // While a state overrides the word with a message (Compacting), it still shows.
  const overridden = await render(engine, 'Spinner', {
    surface: 'desktop',
    props: { ...props, message: 'Compacting' },
  })
  assert.equal(overridden.passed.props.message, 'Compacting')
})

test('the backdrop Svg stays under the 131072-character limit, with room to spare', () => {
  assert.ok(SCENE_SVG.length < 131072, `Svg is ${SCENE_SVG.length} characters`)
  assert.ok(SCENE_SVG.length < 100000, `Svg is ${SCENE_SVG.length} characters`)
})

test('the backdrop is pure vector with nothing the engine refuses', () => {
  for (const banned of ['<image', 'data:', 'base64', 'foreignObject', '@font-face', '@import', 'href', '<!']) {
    assert.equal(SCENE_SVG.includes(banned), false, banned)
  }
  assert.ok(SCENE_SVG.startsWith('<svg '))
  assert.ok(SCENE_SVG.includes('viewBox="0 0 200 112"'))
  assert.ok(SCENE_SVG.includes('preserveAspectRatio="xMidYMid slice"'))
})

test('the Backdrop hook draws the scene under the shader on the desktop', async () => {
  const engine = registered()
  const out = await render(engine, 'Backdrop', {
    surface: 'desktop',
    props: { scene: 'sapp-acca-classroom', plugin: 'sapp-brand' },
  })

  assert.equal(out.type, 'Shader')
  assert.equal(out.props.module, './backdrop.shader.ts')
  assert.equal(out.props.children[0].type, 'Svg')
  assert.equal(out.props.children[0].props.source, SCENE_SVG)
})

test('the Backdrop hook leaves the terminal, and another mod\'s scene, alone', async () => {
  const engine = registered()
  const terminal = await render(engine, 'Backdrop', {
    surface: 'terminal',
    props: { scene: 'sapp-acca-classroom' },
  })
  const otherScene = await render(engine, 'Backdrop', {
    surface: 'desktop',
    props: { scene: 'someone-elses-scene', plugin: 'sapp-brand' },
  })
  // Another mod that happens to name the same scene is not ours to draw.
  const otherPlugin = await render(engine, 'Backdrop', {
    surface: 'desktop',
    props: { scene: 'sapp-acca-classroom', plugin: 'another-mod' },
  })

  assert.ok(terminal.passed)
  assert.ok(otherScene.passed)
  assert.ok(otherPlugin.passed)
})

test('register() hooks only session.start and ui.render', () => {
  const events = registered().hooks.map(h => h.event).sort()

  assert.deepEqual(events, ['session.start', 'ui.render', 'ui.render'])
})

test('the ui.render hooks are exactly Backdrop and Spinner', () => {
  const matchers = registered()
    .hooks.filter(h => h.event === 'ui.render')
    .map(h => h.matcher.component)
    .sort()

  assert.deepEqual(matchers, ['Backdrop', 'Spinner'])
})

test('the credit line survives a build where $.theme.set throws, and it is set first', async () => {
  const engine = registered(register, { throwOn: 'theme.set' })
  const result = await startSession(engine)

  assert.ok(result.passed)
  assert.deepEqual(
    engine.calls.map(c => c.path),
    ['ui.status', 'theme.set'],
  )
  assert.deepEqual(engine.calls[0].args, ['Tạo bởi SAPP IT Department, © 2026'])
})

test('the theme is one Desktop will paint: no problem line starts "Desktop won\'t paint"', () => {
  const blocking = themeProblems.filter(line => line.startsWith("Desktop won't paint"))

  assert.deepEqual(blocking, [])
  // Control: makeColors does report problem lines for this theme, so the list is live.
  assert.ok(themeProblems.length > 0)
})

// The shader finds lamp bulbs by green minus blue. Colours as drawn: each fill
// seen through the veil. Only the bulb may reach the metric's range.
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
const over = (top, bottom, alpha) => hexToRgb(top).map((v, i) => v * alpha + hexToRgb(bottom)[i] * (1 - alpha))
const metric = ([, g, b]) => (g - b) / 255

test('only the lamp bulb scores above 0.6 on the shader\'s lamp metric, in light and dark', () => {
  const [styleText] = SCENE_SVG.match(/<style>(.*)<\/style>/s).slice(1)
  const [lightCss, darkCss] = styleText.split('@media (prefers-color-scheme: dark){')
  const fills = css => [...css.matchAll(/\.c\d+\{fill:(#[0-9A-Fa-f]{6})\}/g)].map(m => m[1])
  const veil = css => css.match(/\.veil\{fill:(#[0-9A-Fa-f]{6});opacity:([.\d]+)\}/).slice(1)
  const bulb = SCENE_SVG.match(/<g fill="(#[0-9A-Fa-f]{6})">(?:<rect [^>]*\/>)+<\/g><\/svg>/)[1]

  assert.equal(bulb, '#FFEE22')
  // The bulb is drawn after the veil: its own fill is what the shader sees.
  assert.ok(metric(hexToRgb(bulb)) > 0.76)

  for (const css of [lightCss, darkCss]) {
    const [veilFill, veilAlpha] = veil(css)
    const seen = fills(css)
    assert.ok(seen.length > 20)
    for (const fill of seen) {
      const scored = metric(over(veilFill, fill, Number(veilAlpha)))
      assert.ok(scored < 0.6, `${fill} scores ${scored}`)
    }
    // Halos use the bulb colour at 12 percent over the veiled scene.
    for (const fill of seen) {
      const veiled = over(veilFill, fill, Number(veilAlpha))
      const haloed = veiled.map((v, i) => hexToRgb(bulb)[i] * 0.12 + v * 0.88)
      assert.ok(metric(haloed) < 0.6, `${fill} under a halo scores ${metric(haloed)}`)
    }
  }
})

test('register() registers no event that reads or changes Claude\'s actions', () => {
  assert.deepEqual(violations(register), [])
})

test('the forbidden-event check fails on a register() that hooks tool.call (control)', () => {
  const bad = on => {
    on('session.start', (_, e, next) => next(e))
    on('tool.call', (_, e, next) => next(e))
    on('classic.PreToolUse', (_, e, next) => next(e))
  }

  assert.deepEqual(violations(bad), ['tool.call', 'classic.PreToolUse'])
})

test('running the hooks makes no call on $ beyond theme.set, ui.status and ui.resolve', async () => {
  const engine = registered()
  await startSession(engine)
  await render(engine, 'Backdrop', {
    surface: 'desktop',
    props: { scene: 'sapp-acca-classroom', plugin: 'sapp-brand' },
  })
  await render(engine, 'Spinner', {
    surface: 'desktop',
    props: { word: 'x', message: null, suffix: '…', mode: 'thinking' },
  })
  const used = [...new Set(engine.calls.map(c => c.path))].sort()

  // No $.fs, $.process, $.http, $.env, $.tool, $.model, $.mcp, $.prompt, $.session.
  assert.deepEqual(used, ['theme.set', 'ui.resolve', 'ui.status'])
})
