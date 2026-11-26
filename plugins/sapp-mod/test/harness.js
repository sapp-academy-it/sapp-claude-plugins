// A fake engine for the tests: `on` records each hook, `$` records each call.
import { register } from '../hooks/register.js'

// `store` is a fake $.store: a Map the mod reads and writes through $.store.get/set.
export function makeEngine({ throwOn, store = new Map() } = {}) {
  const hooks = []
  const calls = []

  const on = (event, matcher, fn) => {
    hooks.push({ event, matcher: typeof matcher === 'function' ? null : matcher, fn: fn ?? matcher })
  }

  const record = path => {
    const target = (...args) => {
      calls.push({ path: path.join('.'), args })
      if (path.join('.') === throwOn) throw new Error('not available on this build')
      const name = path.join('.')
      if (name === 'theme.set') return { isDrawn: true }
      if (name === 'store.get') return store.get(args[0])
      if (name === 'store.set') return void store.set(args[0], args[1])
      return undefined
    }
    return new Proxy(target, { get: (_, key) => record([...path, String(key)]) })
  }

  const $ = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'ui') {
          const ui = record(['ui'])
          return new Proxy(
            {},
            {
              get: (__, name) =>
                name === 'resolve'
                  ? (...args) => {
                      calls.push({ path: 'ui.resolve', args })
                      // The element table: each element returns what it is given.
                      return {
                        Svg: props => ({ type: 'Svg', props }),
                        Shader: props => ({ type: 'Shader', props }),
                        Box: props => ({ type: 'Box', props }),
                        Markdown: props => ({ type: 'Markdown', props }),
                        Button: props => ({ type: 'Button', props }),
                      }
                    }
                  : ui[name],
            },
          )
        }
        return record([String(key)])
      },
    },
  )

  return { hooks, calls, on, $, store }
}

export function registered(registerFn = register, options) {
  const engine = makeEngine(options)
  registerFn(engine.on)
  return engine
}

export const find = (engine, event, matcher) =>
  engine.hooks.find(
    h => h.event === event && JSON.stringify(h.matcher) === JSON.stringify(matcher ?? null),
  )

const next = async e => ({ passed: e })

export async function startSession(engine) {
  const hook = find(engine, 'session.start')
  return hook.fn(engine.$, { cwd: '/', surface: 'desktop' }, next)
}

export async function render(engine, component, e) {
  const hook = find(engine, 'ui.render', { component })
  return hook.fn(engine.$, e, next)
}

export async function tip(engine, candidates = []) {
  const hook = find(engine, 'ui.tip')
  return hook.fn(engine.$, { candidates }, next)
}

export async function runCommand(engine, command, args) {
  const hook = find(engine, 'command.run', { command })
  return hook.fn(engine.$, { command, args }, next)
}
