// A fake engine for the tests: `on` records each hook, `$` records each call.
import { register } from '../hooks/register.js'

export function makeEngine() {
  const hooks = []
  const calls = []

  const on = (event, matcher, fn) => {
    hooks.push({ event, matcher: typeof matcher === 'function' ? null : matcher, fn: fn ?? matcher })
  }

  const record = path => {
    const target = (...args) => {
      calls.push({ path: path.join('.'), args })
      return path.join('.') === 'theme.set' ? { isDrawn: true } : undefined
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

  return { hooks, calls, on, $ }
}

export function registered(registerFn = register) {
  const engine = makeEngine()
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
