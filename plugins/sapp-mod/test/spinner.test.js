import assert from 'node:assert/strict'
import { test } from 'node:test'

import { OFF_KEY, SPINNER_LOCAL_KEY, SPINNER_USER_KEY, register } from '../hooks/register.js'
import { registered, render, runCommand, startSession } from './harness.js'

const props = { word: 'engine-word', message: null, suffix: 'engine-suffix', mode: 'thinking' }
const spin = async engine => (await render(engine, 'Spinner', { surface: 'desktop', props })).passed.props
const say = (engine, args) => runCommand(engine, 'sapp-spinner', args).then(out => out.text)
const started = async options => {
  const engine = registered(register, options)
  await startSession(engine)
  return engine
}

test('a fresh store gives the SAPP word with the … suffix', async () => {
  const engine = await started()
  const got = await spin(engine)

  assert.equal(got.word, 'SAPP đang xử lý')
  assert.equal(got.suffix, '…')
})

test('each scope sets its word and wins over the ones below it: session over local over user over the default', async () => {
  const engine = await started()
  assert.equal((await spin(engine)).word, 'SAPP đang xử lý')

  assert.equal(await say(engine, '--scope user Từ người dùng'), 'Đã đặt chữ đang xử lý "Từ người dùng…" cho mọi dự án của bạn (user).\nChữ đang xử lý: "Từ người dùng…", theo phạm vi mọi dự án của bạn (user).')
  assert.equal((await spin(engine)).word, 'Từ người dùng')
  await say(engine, '--scope local Từ thư mục')
  assert.equal((await spin(engine)).word, 'Từ thư mục')
  await say(engine, 'Từ phiên')
  assert.equal((await spin(engine)).word, 'Từ phiên')
  assert.equal((await spin(engine)).suffix, '…')

  // Setting a lower scope while a higher one stands changes nothing visible, and the reply says who wins.
  const text = await say(engine, '--scope user Khác')
  assert.ok(text.endsWith('Chữ đang xử lý: "Từ phiên…", theo phạm vi phiên này.'), text)
  assert.equal(engine.store.get(SPINNER_USER_KEY).text, 'Khác')
})

test('reset removes that scope\'s value so the next scope down applies, down to the default', async () => {
  const engine = await started()
  await say(engine, '--scope user U')
  await say(engine, '--scope local L')
  await say(engine, 'S')

  await say(engine, 'reset')
  assert.equal((await spin(engine)).word, 'L')
  await say(engine, '--scope local reset')
  assert.equal((await spin(engine)).word, 'U')
  assert.deepEqual(engine.store.get(SPINNER_LOCAL_KEY), {})
  await say(engine, '--scope user reset')
  assert.equal((await spin(engine)).word, 'SAPP đang xử lý')
  assert.equal(engine.store.get(SPINNER_USER_KEY), null)
})

test('off passes the engine word through untouched, at its scope only, and a higher scope can set a word over it', async () => {
  const engine = await started()
  await say(engine, '--scope user Từ người dùng')
  await say(engine, '--scope local off')
  assert.deepEqual(await spin(engine), props)

  // A session word wins over a local off.
  await say(engine, 'Từ phiên')
  assert.equal((await spin(engine)).word, 'Từ phiên')
  // Reset the session and the local off wins again; reset local and the user word returns.
  await say(engine, 'reset')
  assert.deepEqual(await spin(engine), props)
  await say(engine, '--scope local reset')
  assert.equal((await spin(engine)).word, 'Từ người dùng')
  // tắt is off too.
  await say(engine, 'tắt')
  assert.deepEqual(await spin(engine), props)
})

test('a session word is not seen by another session, a local word follows the project, and stored words persist', async () => {
  const store = new Map()
  const a = await started({ store, session: { id: 'session-A', root: '/work/one' } })
  await say(a, 'Chỉ phiên A')
  await say(a, '--scope local Thư mục một')
  await say(a, '--scope user Cho mọi nơi')
  assert.equal((await spin(a)).word, 'Chỉ phiên A')

  // Session B shares the engine process (same module, same store): another id, the same folder.
  a.session.id = 'session-B'
  assert.equal((await spin(a)).word, 'Thư mục một')
  // Session B in another folder sees the user word only.
  a.session.root = '/work/two'
  assert.equal((await spin(a)).word, 'Cho mọi nơi')
  // Back to A in its folder: its own word again.
  a.session.id = 'session-A'
  a.session.root = '/work/one'
  assert.equal((await spin(a)).word, 'Chỉ phiên A')

  // A new process on the same store: stored scopes persist, the session word is gone.
  const fresh = await started({ store, session: { id: 'session-C', root: '/work/one' } })
  assert.equal((await spin(fresh)).word, 'Thư mục một')
  const elsewhere = await started({ store, session: { id: 'session-D', root: '/work/three' } })
  assert.equal((await spin(elsewhere)).word, 'Cho mọi nơi')
})

test('/sapp-spinner with no argument shows the word, its scope and a usage line', async () => {
  const engine = await started()
  assert.equal(
    await say(engine, ''),
    'Chữ đang xử lý: "SAPP đang xử lý…", theo phạm vi mặc định của SAPP.\nDùng: /sapp-spinner [--scope local|user] <chữ> | off | reset. Không có --scope thì chỉ áp dụng cho phiên này.',
  )
  await say(engine, '--scope user off')
  assert.ok((await say(engine, '')).startsWith('Chữ đang xử lý: mặc định của Claude Code (SAPP đã tắt chữ ở phạm vi mọi dự án của bạn (user)).'))
})

test('bad input is refused with a Vietnamese message and changes nothing', async () => {
  const engine = await started()
  const long = 'x'.repeat(41)
  const cases = [
    [`--scope user ${long}`, 'Chữ quá dài: tối đa 40 ký tự.'],
    ['Có\u0007chuông', 'Chữ không được chứa ký tự điều khiển hoặc xuống dòng.'],
    ['--scope nowhere Chữ', 'Không có phạm vi "nowhere". Có: session, local, user.'],
    ['--scope', 'Thiếu tên phạm vi sau --scope.'],
    ['--scope project Chữ', 'Phạm vi project (dùng chung cả nhóm) chưa có'],
  ]
  for (const [args, start] of cases) {
    const text = await say(engine, args)
    assert.ok(text.startsWith(start), `${args} -> ${text}`)
  }
  assert.equal(engine.store.has(SPINNER_USER_KEY), false)
  assert.equal((await spin(engine)).word, 'SAPP đang xử lý')

  // Controls: exactly 40 characters is accepted, and the same word with a scope is stored.
  const forty = 'y'.repeat(40)
  assert.ok((await say(engine, `--scope user ${forty}`)).startsWith(`Đã đặt chữ đang xử lý "${forty}…"`))
  assert.equal(engine.store.get(SPINNER_USER_KEY).text, forty)
})

test('the spinner word still shows with the theme off, and a malformed stored value is ignored', async () => {
  const off = await started({ store: new Map([[OFF_KEY, true], [SPINNER_USER_KEY, { text: 'Khi tắt giao diện' }]]) })
  assert.equal((await spin(off)).word, 'Khi tắt giao diện')

  for (const bad of ['text', 42, { text: 'x'.repeat(99) }, { text: '' }, { off: 'yes' }, { text: 'a', off: true }]) {
    const engine = await started({ store: new Map([[SPINNER_USER_KEY, bad]]) })
    assert.equal((await spin(engine)).word, 'SAPP đang xử lý', JSON.stringify(bad))
  }
})

test('a store that cannot be written changes no word and says so (negative case)', async () => {
  const engine = await started({ throwOn: 'store.set' })
  assert.equal(await say(engine, '--scope user Chữ'), 'Không lưu được chữ đang xử lý, nên chưa đổi gì.')
  assert.equal((await spin(engine)).word, 'SAPP đang xử lý')
  // A session word needs no store.
  assert.ok((await say(engine, 'Chữ phiên')).startsWith('Đã đặt chữ đang xử lý "Chữ phiên…" cho phiên này.'))
  assert.equal((await spin(engine)).word, 'Chữ phiên')
})

test('a word of 40 code points with emoji (more than 40 UTF-16 units) is accepted, stored and shown from a fresh store', async () => {
  const word = `Đang chạy ${'🚀'.repeat(16)}`
  assert.equal([...word].length, 26)
  assert.ok(word.length > 40)
  const store = new Map()
  const first = await started({ store })
  assert.ok((await say(first, `--scope user ${word}`)).startsWith(`Đã đặt chữ đang xử lý "${word}…"`))

  // The next session, on the same store, shows it instead of silently dropping it.
  const next = await started({ store })
  assert.equal((await spin(next)).word, word)
  // Control: 41 code points are still refused, emoji or not.
  const tooLong = '🚀'.repeat(41)
  assert.ok((await say(first, `--scope user ${tooLong}`)).startsWith('Chữ quá dài: tối đa 40 ký tự.'))
  assert.equal(store.get(SPINNER_USER_KEY).text, word)
})

test('a local word follows the project: a session in a subfolder of the repository sees the repository\'s word', async () => {
  const store = new Map()
  const top = await started({ store, session: { id: 's1', root: '/work/projA', vcsRoot: '/work/projA' } })
  await say(top, '--scope local Dự án A')

  const sub = await started({ store, session: { id: 's2', root: '/work/projA/sub', vcsRoot: '/work/projA' } })
  assert.equal((await spin(sub)).word, 'Dự án A')
  // And it can be set from the subfolder: the same value, which the next session at the top sees.
  await say(sub, '--scope local Từ thư mục con')
  const next = await started({ store, session: { id: 's6', root: '/work/projA', vcsRoot: '/work/projA' } })
  assert.equal((await spin(next)).word, 'Từ thư mục con')
  assert.deepEqual(Object.keys(store.get(SPINNER_LOCAL_KEY)), ['/work/projA'])

  // Controls: another repository does not see it; with no repository the session root is the key,
  // and so is the root when the repository lookup fails.
  const other = await started({ store, session: { id: 's3', root: '/work/projB', vcsRoot: '/work/projB' } })
  assert.equal((await spin(other)).word, 'SAPP đang xử lý')
  const noGit = await started({ store, session: { id: 's4', root: '/work/projA/sub' } })
  assert.equal((await spin(noGit)).word, 'SAPP đang xử lý')
  await say(noGit, '--scope local Không có git')
  assert.deepEqual(Object.keys(store.get(SPINNER_LOCAL_KEY)).sort(), ['/work/projA', '/work/projA/sub'])
  const broken = await started({ store, throwOn: 'vcs.detect', session: { id: 's5', root: '/work/projA/sub', vcsRoot: '/work/projA' } })
  assert.equal((await spin(broken)).word, 'Không có git')
})

test('a --scope flag in the middle of the word leaves single spaces', async () => {
  const engine = await started()
  for (const args of ['Đang --scope user làm việc', 'Đang   --scope=user   làm việc', '--scope user Đang   làm  việc']) {
    const text = await say(engine, args)
    assert.ok(text.startsWith('Đã đặt chữ đang xử lý "Đang làm việc…" cho mọi dự án của bạn (user).'), `${args} -> ${text}`)
    assert.equal(engine.store.get(SPINNER_USER_KEY).text, 'Đang làm việc')
  }
})
