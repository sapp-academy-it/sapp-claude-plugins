import assert from 'node:assert/strict'
import { test } from 'node:test'

import { register } from '../hooks/register.js'
import { find, registered, render, runCommand, startSession } from './harness.js'

// The oldest engine this mod supports: 2.1.330, the oldest we can run here. An engine refuses the
// WHOLE hooks module when it registers an event the engine does not know (0.4.0 hooked `ui.tip`,
// which 2.1.330 and 2.1.331 do not have, and lost the theme, the credit line and /sapp-theme).
// Add a name here only after a real load on 2.1.330 (`claude -p ... --plugin-dir ... --debug-file`).
export const OLDEST_ENGINE = '2.1.330'
// Events: loaded on 2.1.330 with exactly these (the debug line "events: session.start,command.run,ui.render").
export const EVENTS_ON_OLDEST = ['session.start', 'command.run', 'ui.render']
// `$` calls the module makes. Each is behind try/catch, so a call an engine lacks costs that feature
// only, never the module. Not proven at run time on 2.1.330 beyond a load: ui.open, ui.close, ui.toast.
export const CALLS_ON_OLDEST = [
  'command.register',
  'store.get',
  'store.set',
  'theme.set',
  'ui.close',
  'ui.open',
  'ui.resolve',
  'ui.status',
  'ui.toast',
]

const notAllowed = (names, allowed) => [...new Set(names)].filter(name => !allowed.includes(name)).sort()

// Registers the module, then drives every hook so every `$` call it makes is recorded.
async function eventsAndCalls(registerFn) {
  const engine = registered(registerFn)
  const events = engine.hooks.map(h => h.event)
  await startSession(engine)
  await runCommand(engine, 'sapp-theme', 'it-room')
  await runCommand(engine, 'sapp-help', '')
  if (find(engine, 'command.run', { command: 'extra' })) await runCommand(engine, 'extra', '')
  const pane = await render(engine, 'Pane', { surface: 'desktop', requestId: 'sapp-help', props: {} })
  await pane.props.children[1].props.onPress()
  await render(engine, 'Backdrop', { surface: 'desktop', props: { scene: 'sapp-acca-classroom', plugin: 'sapp-mod' } })
  await render(engine, 'Spinner', { surface: 'desktop', props: { word: 'x', message: null, suffix: '…', mode: 'thinking' } })
  return { events, calls: engine.calls.map(c => c.path) }
}

test(`every event the module registers is one the oldest supported engine (${OLDEST_ENGINE}) knows`, async () => {
  const { events } = await eventsAndCalls(register)

  assert.deepEqual(notAllowed(events, EVENTS_ON_OLDEST), [])
  assert.deepEqual([...new Set(events)].sort(), ['command.run', 'session.start', 'ui.render'])
})

test(`every $ call the module makes is on the list for ${OLDEST_ENGINE}`, async () => {
  const { calls } = await eventsAndCalls(register)

  assert.deepEqual(notAllowed(calls, CALLS_ON_OLDEST), [])
  // The run reached the calls: a driver that stopped early would pass for nothing.
  assert.ok(calls.includes('ui.toast') && calls.includes('ui.open') && calls.includes('theme.set'))
})

test('the guard goes red on a module that hooks ui.tip or calls a $ method not on the list (control)', async () => {
  const bad = on => {
    register(on)
    on('ui.tip', async ($, e, next) => next(e))
    on('command.run', { command: 'extra' }, $ => {
      $.ui.newThing('x')
      return { text: 'x' }
    })
  }
  const { events, calls } = await eventsAndCalls(bad)

  assert.deepEqual(notAllowed(events, EVENTS_ON_OLDEST), ['ui.tip'])
  assert.deepEqual(notAllowed(calls, CALLS_ON_OLDEST), ['ui.newThing'])
})
