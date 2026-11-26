import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { GUIDE_MARKDOWN } from '../hooks/guide.js'
import { HELP_MARKDOWN, HELP_TIP, HELP_TOAST, ISSUES_URL, TOAST_KEY } from '../hooks/help.js'
import { register } from '../hooks/register.js'
import { buildGuideModule, parseSkill } from '../scripts/build-guide.mjs'
import { find, registered, render, runCommand, startSession, tip } from './harness.js'

const SKILL = readFileSync(new URL('../skills/sapp-claude-guide/SKILL.md', import.meta.url), 'utf8')
// The body of the SKILL.md, found here without the build script: what follows the closing --- line.
const skillBody = text => text.split('\n---\n').slice(1).join('\n---\n').trim()

const toasts = engine => engine.calls.filter(c => c.path === 'ui.toast')

// The same engine, with a $.ui.open that answers `opened` (the harness answers nothing).
const withOpen = (engine, opened) =>
  new Proxy(engine.$, {
    get: (target, key) => {
      if (key !== 'ui') return target[key]
      const ui = target.ui
      return new Proxy(
        {},
        {
          get: (_, name) =>
            name === 'open'
              ? async (...args) => {
                  engine.calls.push({ path: 'ui.open', args })
                  if (opened instanceof Error) throw opened
                  return opened
                }
              : ui[name],
        },
      )
    },
  })

const runHelp = (engine, $) => find(engine, 'command.run', { command: 'sapp-help' }).fn($, { command: 'sapp-help', args: '' }, async e => e)

// ---- the command --------------------------------------------------------------------------

test('a session start registers /sapp-help beside /sapp-theme', async () => {
  const engine = registered()
  await startSession(engine)

  const names = engine.calls.filter(c => c.path === 'command.register').map(c => c.args[0].name)
  assert.deepEqual(names, ['sapp-theme', 'sapp-help'])
})

test('/sapp-help where no pane is drawn answers the whole card as text and starts no model turn', async () => {
  const engine = registered()
  const out = await runCommand(engine, 'sapp-help', '')

  assert.equal(out.isTextDisplayOnly, true)
  assert.equal(out.text, HELP_MARKDOWN)
  // The intro, what is installed, how to switch themes, where to report, and the guide.
  assert.ok(out.text.includes('bộ plugin Claude Code chính thức của SAPP, do phòng công nghệ SAPP quản lý'))
  assert.ok(out.text.includes('## Đang cài: sapp-mod'))
  assert.ok(out.text.includes('`/sapp-theme`'))
  assert.ok(out.text.includes('https://github.com/sapp-academy-it/sapp-claude-plugins/issues'))
  assert.ok(out.text.includes('# Dùng Claude hiệu quả – 5 quy tắc: ASK – CONTEXT – VERIFY – OUTPUT – TEST'))
  // Nothing that reaches the model, the prompt, the files or the session.
  const reached = engine.calls.map(c => c.path.split('.')[0]).filter(ns => ['model', 'prompt', 'fs', 'process', 'session', 'agent'].includes(ns))
  assert.deepEqual(reached, [])
})

test('/sapp-help where a pane is drawn opens the pane and answers one short line instead of the card', async () => {
  const engine = registered()
  const out = await runHelp(engine, withOpen(engine, { isPlaced: true }))

  assert.deepEqual(engine.calls.find(c => c.path === 'ui.open').args, [
    { id: 'sapp-help', title: 'Trợ giúp SAPP', focus: true, closeOnEscape: true },
  ])
  assert.equal(out.text, 'Đã mở trang trợ giúp SAPP. Nhấn Esc để đóng.')
  assert.equal(out.isTextDisplayOnly, true)
  assert.equal(engine.calls.some(c => c.path === 'ui.close'), false)
})

test('a pane that is not placed is closed again and the card comes as text (negative case)', async () => {
  const engine = registered()
  const out = await runHelp(engine, withOpen(engine, { isPlaced: false, reason: 'no surface' }))

  assert.equal(out.text, HELP_MARKDOWN)
  assert.deepEqual(engine.calls.find(c => c.path === 'ui.close').args, [{ id: 'sapp-help' }])
})

test('a build whose $.ui.open throws still answers the card as text', async () => {
  const engine = registered()
  const out = await runHelp(engine, withOpen(engine, new Error('not available on this build')))

  assert.equal(out.text, HELP_MARKDOWN)
})

test('the Pane hook draws the card as Markdown with a dismiss button, and leaves any other pane alone', async () => {
  const engine = registered()
  const tree = await render(engine, 'Pane', { surface: 'desktop', requestId: 'sapp-help', props: {} })

  assert.equal(tree.type, 'Box')
  const [markdown, button] = tree.props.children
  assert.equal(markdown.type, 'Markdown')
  assert.equal(markdown.props.text, HELP_MARKDOWN)
  assert.equal(button.type, 'Button')
  assert.equal(button.props.role, 'dismiss')
  await button.props.onPress()
  assert.deepEqual(engine.calls.find(c => c.path === 'ui.close').args, [{ id: 'sapp-help' }])

  const other = await render(registered(), 'Pane', { surface: 'desktop', requestId: 'someone-elses-pane', props: {} })
  assert.deepEqual(other.passed.requestId, 'someone-elses-pane')
})

test('the card holds no e-mail address and no personal contact', () => {
  assert.equal(HELP_MARKDOWN.includes('@'), false)
  assert.equal(SKILL.includes('@'), false)
  assert.equal(/\d{9,}/.test(HELP_MARKDOWN), false)
  assert.equal(ISSUES_URL, 'https://github.com/sapp-academy-it/sapp-claude-plugins/issues')
})

// ---- the pointer: one toast ever, and a tip that rotates ---------------------------------------

test('the pointer toast shows once, the flag is stored, and later sessions stay quiet', async () => {
  const store = new Map()
  const first = registered(register, { store })
  await startSession(first)

  assert.deepEqual(toasts(first).map(c => c.args), [['Gõ /sapp-help để xem hướng dẫn dùng Claude tại SAPP']])
  assert.equal(store.get('help-toast-shown'), true)

  // The same session starting again, and a new session on the same install.
  await startSession(first)
  const later = registered(register, { store })
  await startSession(later)
  await startSession(later)
  assert.equal(toasts(first).length, 1)
  assert.equal(toasts(later).length, 0)
  assert.equal(TOAST_KEY, 'help-toast-shown')
  assert.equal(HELP_TOAST, 'Gõ /sapp-help để xem hướng dẫn dùng Claude tại SAPP')
})

test('a store that cannot be written makes no toast at all, so it can never come back (negative case)', async () => {
  const engine = registered(register, { throwOn: 'store.set' })
  const out = await startSession(engine)

  assert.ok(out.passed)
  assert.equal(toasts(engine).length, 0)
})

test('a toast that throws does not stop the session start', async () => {
  const engine = registered(register, { throwOn: 'ui.toast' })
  const out = await startSession(engine)

  assert.ok(out.passed)
  assert.equal(engine.calls.some(c => c.path === 'command.register'), true)
})

test('the spinner tip is ours on every 4th ask and the engine\'s own choice on the others', async () => {
  const engine = registered()
  const candidates = [{ id: 'engine-tip', source: 'shipped', priority: 0, sessionsSinceShown: null }]
  const answers = []
  for (let i = 0; i < 8; i += 1) answers.push(await tip(engine, candidates))

  const ours = answers.map(a => a.id === 'sapp-help')
  assert.deepEqual(ours, [false, false, false, true, false, false, false, true])
  assert.deepEqual(answers[3], {
    id: 'sapp-help',
    text: 'Gõ /sapp-help để xem hướng dẫn dùng Claude tại SAPP (5 quy tắc ASK – CONTEXT – VERIFY – OUTPUT – TEST)',
    label: 'SAPP',
  })
  // The others pass the engine's candidates on untouched.
  assert.deepEqual(answers[0].passed.candidates, candidates)
  // The limits of an own tip: id of letters, digits and . _ -, up to 64; text up to 500; label up to 40.
  assert.match(answers[3].id, /^[A-Za-z0-9._-]{1,64}$/)
  assert.ok(HELP_TIP.length <= 500 && answers[3].label.length <= 40)
})

// ---- the guide: one source, two forms ---------------------------------------------------------

test('the card carries the SKILL.md body word for word, and hooks/guide.js is built from it', () => {
  const body = skillBody(SKILL)

  assert.ok(body.length > 1500)
  assert.equal(GUIDE_MARKDOWN, body)
  assert.ok(HELP_MARKDOWN.includes(body))
  assert.equal(buildGuideModule(), readFileSync(new URL('../hooks/guide.js', import.meta.url), 'utf8'))
})

test('the drift check is live: a SKILL.md edited without a rebuild no longer matches the committed guide', () => {
  const edited = SKILL.replace('Hỏi như đang nhắn tin cho một đồng nghiệp', 'Hỏi như đang nhắn tin cho một người lạ')

  assert.notEqual(edited, SKILL)
  assert.notEqual(buildGuideModule(edited), readFileSync(new URL('../hooks/guide.js', import.meta.url), 'utf8'))
  assert.notEqual(GUIDE_MARKDOWN, skillBody(edited))
})

test('the guide has the five rules in order, each with a principle and a do and a don\'t', () => {
  const heads = [...GUIDE_MARKDOWN.matchAll(/^## (\d)\. (\w+) – /gm)].map(m => `${m[1]} ${m[2]}`)
  assert.deepEqual(heads, ['1 ASK', '2 CONTEXT', '3 VERIFY', '4 OUTPUT', '5 TEST'])

  const sections = GUIDE_MARKDOWN.split(/^## \d\. /m).slice(1)
  assert.equal(sections.length, 5)
  for (const section of sections) {
    assert.ok(section.includes('Nguyên tắc: '), section.slice(0, 20))
    assert.ok(section.includes('- Nên: '), section.slice(0, 20))
    assert.ok(section.includes('- Đừng: '), section.slice(0, 20))
  }
})

test('the SKILL.md frontmatter is valid for Claude Code and for an upload to claude.ai', () => {
  const { fields } = parseSkill(SKILL)

  assert.deepEqual(Object.keys(fields), ['name', 'description'])
  assert.equal(fields.name, 'sapp-claude-guide')
  assert.match(fields.name, /^[a-z0-9-]{1,64}$/)
  assert.ok(fields.description.length > 100 && fields.description.length <= 1024)
  // The description is what makes Claude load it: how to use Claude well, and SAPP's rules for it.
  assert.ok(fields.description.includes('dùng Claude'))
  assert.ok(fields.description.includes('quy tắc'))
  assert.ok(fields.description.includes('SAPP'))
  // Stands alone: no plugin-only path or variable.
  assert.equal(/CLAUDE_PLUGIN_ROOT|\.\.\//.test(SKILL), false)
  // The folder is named as the skill, which a claude.ai zip needs.
  assert.equal(readFileSync(new URL('../skills/sapp-claude-guide/SKILL.md', import.meta.url), 'utf8'), SKILL)
})

test('a SKILL.md with no frontmatter is refused by the build (negative case)', () => {
  assert.throws(() => parseSkill('# Only a body'), /no frontmatter/)
  assert.throws(() => buildGuideModule('# Only a body'), /no frontmatter/)
})
