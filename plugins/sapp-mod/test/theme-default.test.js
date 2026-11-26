import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CREDIT, OFF_KEY, STORE_KEY, register } from '../hooks/register.js'
import { registered, render, runCommand, startSession } from './harness.js'

// The SAPP theme is off by default. A stored choice wins; a stored `theme` with no `theme-off` key is
// a person who chose a theme before the default became off, and keeps it.
const calls = (engine, path) => engine.calls.filter(c => c.path === path)
const backdrop = { surface: 'desktop', props: { scene: 'sapp-acca-classroom', plugin: 'sapp-mod' } }

test('a fresh store gives no theme, a pass-through Backdrop, and still the credit line and spinner word', async () => {
  const engine = registered()
  await startSession(engine)

  assert.equal(calls(engine, 'theme.set').length, 0)
  assert.equal(calls(engine, 'theme.clear').length, 0)
  assert.ok((await render(engine, 'Backdrop', backdrop)).passed)
  assert.deepEqual(calls(engine, 'ui.status').at(0).args, [CREDIT])
  const spinner = await render(engine, 'Spinner', { surface: 'desktop', props: { word: 'x', message: null, suffix: '…', mode: 'thinking' } })
  assert.equal(spinner.passed.props.word, 'SAPP đang xử lý')

  // Control: the same engine, once the theme is turned on, sets it and draws the Backdrop.
  await runCommand(engine, 'sapp-theme', 'on')
  assert.equal(calls(engine, 'theme.set').length, 1)
  assert.equal((await render(engine, 'Backdrop', backdrop)).type, 'Shader')
})

test('a stored theme with no off key stays on, and an explicit off wins over a stored theme', async () => {
  const existing = registered(register, { store: new Map([[STORE_KEY, 'it-room']]) })
  await startSession(existing)
  assert.equal(calls(existing, 'theme.set').length, 1)

  const off = registered(register, { store: new Map([[STORE_KEY, 'it-room'], [OFF_KEY, true]]) })
  await startSession(off)
  assert.equal(calls(off, 'theme.set').length, 0)

  const on = registered(register, { store: new Map([[STORE_KEY, 'it-room'], [OFF_KEY, false]]) })
  await startSession(on)
  assert.equal(calls(on, 'theme.set').length, 1)
  // A stored null counts as no choice: off.
  const none = registered(register, { store: new Map([[STORE_KEY, null]]) })
  await startSession(none)
  assert.equal(calls(none, 'theme.set').length, 0)
})

test('/sapp-theme on with nothing stored turns on the default theme, Lớp học ACCA, and stores it', async () => {
  for (const word of ['on', 'bật']) {
    const store = new Map()
    const engine = registered(register, { store })
    await startSession(engine)
    const out = await runCommand(engine, 'sapp-theme', word)

    assert.equal(out.text, 'Đã đổi sang "Lớp học ACCA" và lưu lại cho các phiên sau.')
    assert.equal(calls(engine, 'theme.set').length, 1, word)
    assert.equal(store.get(STORE_KEY), 'acca-classroom')
    assert.equal(store.get(OFF_KEY), false)
  }
})

test('/sapp-theme in the default state says it is off, names no chosen theme, and shows how to turn it on', async () => {
  const fresh = registered()
  await startSession(fresh)
  const out = await runCommand(fresh, 'sapp-theme', '')

  assert.ok(out.text.startsWith('Giao diện SAPP đang TẮT (Claude Code dùng giao diện mặc định).\n1. Lớp học ACCA'), out.text)
  assert.equal(out.text.includes('đã chọn gần nhất'), false)
  assert.equal(out.text.includes('[đang dùng]'), false)
  assert.ok(out.text.includes('Bật giao diện: /sapp-theme on.'))
  // Control: once a theme was chosen and turned off, the list names it.
  await runCommand(fresh, 'sapp-theme', 'it-room')
  await runCommand(fresh, 'sapp-theme', 'off')
  const named = await runCommand(fresh, 'sapp-theme', '')
  assert.ok(named.text.includes('Giao diện đã chọn gần nhất: Phòng IT.'), named.text)
})
