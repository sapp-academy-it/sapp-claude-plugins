import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CREDIT, SPINNER_TEXT, register } from '../hooks/register.js'
import { registered, render, startSession } from './harness.js'

// On the Desktop Code tab the status call at session.start has no effect (no status row is attached
// that early), so every Backdrop and Spinner render that arrives with a surface sets the credit line
// again. There is no once-flag: a render that is still too early must not use up the next one.
const statuses = engine => engine.calls.filter(c => c.path === 'ui.status')
const backdrop = { surface: 'desktop', props: { scene: 'sapp-acca-classroom', plugin: 'sapp-mod' } }
const spinner = { surface: 'desktop', props: { word: 'x', message: null, suffix: '…', mode: 'thinking' } }

test('a render that arrives with a surface sets the credit line, for the Backdrop and for the Spinner', async () => {
  for (const [component, event] of [['Backdrop', backdrop], ['Spinner', spinner]]) {
    const engine = registered()
    await startSession(engine)
    assert.equal(statuses(engine).length, 1)

    await render(engine, component, event)
    assert.deepEqual(statuses(engine).map(c => c.args), [[CREDIT], [CREDIT]], component)
  }
})

test('a render with no surface issues no status call (control: the same render with a surface does)', async () => {
  const engine = registered()
  await startSession(engine)
  await render(engine, 'Backdrop', { surface: null, props: backdrop.props })
  await render(engine, 'Spinner', { props: spinner.props })
  assert.equal(statuses(engine).length, 1)

  await render(engine, 'Spinner', spinner)
  assert.equal(statuses(engine).length, 2)
})

test('a second and a third render with a surface still issue the status (a once-flag would stop at the first)', async () => {
  const engine = registered()
  await startSession(engine)
  // The first render is "too early": no surface, so nothing is spent.
  await render(engine, 'Backdrop', { surface: null, props: backdrop.props })
  await render(engine, 'Backdrop', backdrop)
  await render(engine, 'Spinner', spinner)
  await render(engine, 'Backdrop', backdrop)

  assert.equal(statuses(engine).length, 4)
  assert.deepEqual(statuses(engine).map(c => c.args), [[CREDIT], [CREDIT], [CREDIT], [CREDIT]])
})

test('a $.ui.status that throws leaves every render result as it is', async () => {
  const healthy = registered()
  await startSession(healthy)
  const wanted = [await render(healthy, 'Backdrop', backdrop), await render(healthy, 'Spinner', spinner)]
  assert.equal(statuses(healthy).length, 3)

  const broken = registered(register, { throwOn: 'ui.status' })
  await startSession(broken)
  const got = [await render(broken, 'Backdrop', backdrop), await render(broken, 'Spinner', spinner)]

  assert.deepEqual(got, wanted)
  assert.equal(got[1].passed.props.word, SPINNER_TEXT)
  // It was tried at start and at each render, and every failure was swallowed.
  assert.equal(statuses(broken).length, 3)
})
