import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CREDIT, OFF_KEY, STORE_KEY, register } from '../hooks/register.js'
import { registered, render, runCommand, startSession } from './harness.js'

const calls = (engine, path) => engine.calls.filter(c => c.path === path)
const backdrop = { surface: 'desktop', props: { scene: 'sapp-dots', plugin: 'sapp-mod' } }

test('/sapp-theme off (and tắt) clears the theme, stores the choice, and says the credit line and spinner word stay', async () => {
  for (const word of ['off', 'OFF', 'tắt', 'TẮT', 'tat']) {
    const store = new Map()
    const engine = registered(register, { store })
    await startSession(engine)
    const out = await runCommand(engine, 'sapp-theme', word)

    assert.equal(calls(engine, 'theme.clear').length, 1, word)
    assert.equal(store.get(OFF_KEY), true, word)
    assert.equal(out.isTextDisplayOnly, true)
    assert.ok(out.text.startsWith('Đã tắt giao diện SAPP'), out.text)
    assert.ok(out.text.includes('Dòng credit và chữ "SAPP đang xử lý…" vẫn giữ'), out.text)
  }
})

test('an off that the engine refuses is not stored (negative case)', async () => {
  const store = new Map()
  const engine = registered(register, { store, throwOn: 'theme.clear' })
  await startSession(engine)
  const out = await runCommand(engine, 'sapp-theme', 'off')

  assert.equal(out.text, 'Không tắt được giao diện trên bản Claude Code này.')
  assert.equal(store.has(OFF_KEY), false)
})

test('off survives a new session: no theme is set at start and the Backdrop passes through', async () => {
  const store = new Map([[STORE_KEY, 'sapp-dots']])
  const first = registered(register, { store })
  await startSession(first)
  await runCommand(first, 'sapp-theme', 'off')
  // Same session: the Backdrop hook passes through while off.
  assert.ok((await render(first, 'Backdrop', backdrop)).passed)

  const later = registered(register, { store })
  await startSession(later)
  assert.equal(calls(later, 'theme.set').length, 0)
  assert.equal(calls(later, 'theme.clear').length, 0)
  assert.ok((await render(later, 'Backdrop', backdrop)).passed)
  // The credit line stays.
  assert.deepEqual(calls(later, 'ui.status').at(0).args, [CREDIT])

  // Control: the same store with the flag removed sets the theme and draws the Backdrop again.
  store.delete(OFF_KEY)
  const on = registered(register, { store })
  await startSession(on)
  assert.equal(calls(on, 'theme.set').length, 1)
  assert.equal((await render(on, 'Backdrop', backdrop)).type, 'Svg')
})

test('/sapp-theme on (and bật) brings back the last chosen theme, or the default when none was chosen', async () => {
  for (const word of ['on', 'ON', 'bật', 'bat']) {
    const store = new Map([[STORE_KEY, 'it-room'], [OFF_KEY, true]])
    const engine = registered(register, { store })
    await startSession(engine)
    assert.equal(calls(engine, 'theme.set').length, 0, word)
    const out = await runCommand(engine, 'sapp-theme', word)

    assert.equal(calls(engine, 'theme.set').length, 1, word)
    assert.equal(store.get(OFF_KEY), false, word)
    assert.equal(store.get(STORE_KEY), 'it-room', word)
    assert.equal(out.text, 'Đã đổi sang "Phòng IT" và lưu lại cho các phiên sau.')
  }
  // Nothing chosen before: the default, the first theme.
  const fresh = new Map([[OFF_KEY, true]])
  const engine = registered(register, { store: fresh })
  await startSession(engine)
  const out = await runCommand(engine, 'sapp-theme', 'on')
  assert.equal(out.text, 'Đã đổi sang "Lớp học ACCA" và lưu lại cho các phiên sau.')
})

test('a theme number, id or name turns the theme back on with that choice, and the Backdrop draws again', async () => {
  for (const [word, id] of [['4', 'sapp-dots'], ['sapp-dots', 'sapp-dots'], ['chấm vàng sapp', 'sapp-dots'], ['3', 'it-room']]) {
    const store = new Map([[STORE_KEY, 'acca-classroom'], [OFF_KEY, true]])
    const engine = registered(register, { store })
    await startSession(engine)
    await runCommand(engine, 'sapp-theme', word)

    assert.equal(calls(engine, 'theme.set').length, 1, word)
    assert.equal(store.get(STORE_KEY), id, word)
    assert.equal(store.get(OFF_KEY), false, word)
  }
  // Control: the Backdrop passes through before the switch and draws after, in one session.
  const store = new Map([[OFF_KEY, true]])
  const engine = registered(register, { store })
  await startSession(engine)
  assert.ok((await render(engine, 'Backdrop', backdrop)).passed)
  await runCommand(engine, 'sapp-theme', 'sapp-dots')
  assert.equal((await render(engine, 'Backdrop', backdrop)).type, 'Svg')
})

test('an unknown argument still lists the themes, changes nothing, and says when the theme is off', async () => {
  const on = registered(register, { store: new Map([[STORE_KEY, 'it-room']]) })
  await startSession(on)
  const outOn = await runCommand(on, 'sapp-theme', 'xyz')
  assert.ok(outOn.text.startsWith('Không có giao diện "xyz".\nGiao diện SAPP, đang dùng: Phòng IT.'))
  assert.ok(outOn.text.includes('[đang dùng]'))

  const store = new Map([[STORE_KEY, 'it-room'], [OFF_KEY, true]])
  const off = registered(register, { store })
  await startSession(off)
  const outOff = await runCommand(off, 'sapp-theme', 'xyz')
  const listed = await runCommand(off, 'sapp-theme', '')
  for (const out of [outOff, listed]) {
    assert.ok(out.text.includes('Giao diện SAPP đang TẮT'), out.text)
    assert.equal(out.text.includes('[đang dùng]'), false)
    assert.ok(out.text.includes('1. Lớp học ACCA') && out.text.includes('4. Chấm vàng SAPP'))
    assert.ok(out.text.includes('/sapp-theme off') && out.text.includes('/sapp-theme on'))
  }
  assert.equal(calls(off, 'theme.set').length + calls(off, 'theme.clear').length, 0)
  assert.equal(store.get(OFF_KEY), true)
})

test('the /sapp-theme registration offers off and on in its argument hint and description (autocomplete)', async () => {
  const engine = registered()
  await startSession(engine)
  const spec = calls(engine, 'command.register').map(c => c.args[0]).find(c => c.name === 'sapp-theme')

  assert.equal(spec.argumentHint, '[số | mã | tên | off | on]')
  assert.ok(spec.description.includes('off') && spec.description.includes('on'))
})
