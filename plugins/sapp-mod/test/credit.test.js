import assert from 'node:assert/strict'
import { test } from 'node:test'

import { CREDIT, SPINNER_TEXT, register } from '../hooks/register.js'
import { registered, render, startSession } from './harness.js'

// On the Desktop Code tab the status call at session.start has no effect (no status row is attached
// that early), so the first render that arrives with a surface sets the credit line again, once.
const statuses = engine => engine.calls.filter(c => c.path === 'ui.status')
const backdrop = { surface: 'desktop', props: { scene: 'sapp-acca-classroom', plugin: 'sapp-mod' } }
const spinner = { surface: 'desktop', props: { word: 'x', message: null, suffix: '…', mode: 'thinking' } }

test('the first render that arrives with a surface sets the credit line once more', async () => {
  const engine = registered()
  await startSession(engine)
  assert.equal(statuses(engine).length, 1)

  await render(engine, 'Backdrop', backdrop)
  assert.deepEqual(statuses(engine).map(c => c.args), [[CREDIT], [CREDIT]])
})

test('a render with no surface yet does not use the one extra call up (control)', async () => {
  const engine = registered()
  await startSession(engine)
  await render(engine, 'Backdrop', { surface: null, props: backdrop.props })
  await render(engine, 'Spinner', { props: spinner.props })
  assert.equal(statuses(engine).length, 1)

  // Control: the first render that has a surface still gets it.
  await render(engine, 'Spinner', spinner)
  assert.equal(statuses(engine).length, 2)
})

test('later renders add no more status calls, and the next session gets its one extra again', async () => {
  const engine = registered()
  await startSession(engine)
  await render(engine, 'Backdrop', backdrop)
  await render(engine, 'Spinner', spinner)
  await render(engine, 'Backdrop', backdrop)
  await render(engine, 'Spinner', spinner)
  assert.equal(statuses(engine).length, 2)

  // Control: a new session start is one more status call, and one more render sets it again.
  await startSession(engine)
  assert.equal(statuses(engine).length, 3)
  await render(engine, 'Spinner', spinner)
  await render(engine, 'Spinner', spinner)
  assert.equal(statuses(engine).length, 4)
})

test('a $.ui.status that throws leaves the render result as it is', async () => {
  const healthy = registered()
  await startSession(healthy)
  const wanted = await render(healthy, 'Backdrop', backdrop)
  const wantedSpinner = await render(healthy, 'Spinner', spinner)
  assert.equal(statuses(healthy).length, 2)

  const broken = registered(register, { throwOn: 'ui.status' })
  await startSession(broken)
  const got = await render(broken, 'Backdrop', backdrop)
  const gotSpinner = await render(broken, 'Spinner', spinner)

  assert.deepEqual(got, wanted)
  assert.deepEqual(gotSpinner, wantedSpinner)
  assert.equal(gotSpinner.passed.props.word, SPINNER_TEXT)
  // The throwing call was tried at start and once at the first render, and not again.
  assert.equal(statuses(broken).length, 2)
})
