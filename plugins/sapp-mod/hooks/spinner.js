// The spinner word, per scope. Pure functions only: every `$` call stays in register.js.
//
// Scopes, the most specific first, named like Claude Code's own settings scopes:
//   session  this session only (kept in memory, keyed by the session id)
//   local    this project, this person (stored); a project is its repository root, else the session root
//   project  shared with the team: not available (it needs the mod to read and write files in the repo)
//   user     every project for this person (stored)
//   default  "SAPP đang xử lý"
// A value is `{ text }` (the word) or `{ off: true }` (Claude Code's own spinner words come back).

export const MAX_WORD = 40
// One measure everywhere: code points, so an emoji counts once however many UTF-16 units it takes.
const size = text => [...text].length
export const SETTABLE_SCOPES = ['session', 'local', 'user']
// What a person may type after --scope.
const KNOWN_SCOPES = [...SETTABLE_SCOPES, 'project']

export const USAGE = 'Dùng: /sapp-spinner [--scope local|user] <chữ> | off | reset. Không có --scope thì chỉ áp dụng cho phiên này.'

const OFF_WORDS = ['off', 'tat', 'tắt']
const RESET_WORDS = ['reset']

// A stored value that is not one of the two shapes is treated as no value.
export const isValue = value =>
  value != null &&
  typeof value === 'object' &&
  ((value.off === true && value.text === undefined) ||
    (typeof value.text === 'string' && value.text.trim() !== '' && size(value.text) <= MAX_WORD && value.off === undefined))

export const okValue = value => (isValue(value) ? value : undefined)

// The word a person typed: not empty, not longer than MAX_WORD, no line break or other control character.
export const checkWord = word => {
  const text = word.trim()
  if (text === '') return { error: 'Chữ không được để trống.' }
  if (/[\p{Cc}\p{Cf}]/u.test(text)) return { error: 'Chữ không được chứa ký tự điều khiển hoặc xuống dòng.' }
  if (size(text) > MAX_WORD) return { error: `Chữ quá dài: tối đa ${MAX_WORD} ký tự.` }
  return { text }
}

// `args` as typed after /sapp-spinner. Returns { scope, action, word } or { error }.
// action: show | set | off | reset. `--scope x` may stand anywhere; the rest is the word or a keyword.
export const parseArgs = args => {
  let rest = (args ?? '').trim()
  let scope = 'session'
  const flag = /(^|\s)--scope(?:=|\s+)(\S+)/.exec(rest)
  if (flag) {
    scope = flag[2].toLowerCase()
    // The flag may stand inside the word: join the two sides with one space, never two.
    rest = `${rest.slice(0, flag.index)} ${rest.slice(flag.index + flag[0].length)}`.replace(/\s+/g, ' ').trim()
  } else if (/(^|\s)--scope(\s|$)/.test(rest)) {
    return { error: 'Thiếu tên phạm vi sau --scope. ' + USAGE }
  }
  if (!KNOWN_SCOPES.includes(scope)) {
    return { error: `Không có phạm vi "${scope.length > 20 ? `${scope.slice(0, 20)}…` : scope}". Có: session, local, user. ${USAGE}` }
  }
  if (scope === 'project') {
    return {
      error:
        'Phạm vi project (dùng chung cả nhóm) chưa có: mod phải đọc và ghi tệp trong kho của dự án, mà sapp-mod không truy cập tệp. Dùng local (riêng bạn, trong dự án này) hoặc user (mọi dự án của bạn).',
    }
  }
  if (rest === '') return { scope, action: 'show', hadScope: Boolean(flag) }
  const key = rest.toLowerCase()
  if (OFF_WORDS.includes(key)) return { scope, action: 'off' }
  if (RESET_WORDS.includes(key)) return { scope, action: 'reset' }
  const checked = checkWord(rest)
  if (checked.error) return { error: `${checked.error} ${USAGE}` }
  return { scope, action: 'set', word: checked.text }
}

// The value in force: session, then local, then user (project is not available), else the default.
export const resolve = ({ session, local, user }) => {
  if (session) return { scope: 'session', value: session }
  if (local) return { scope: 'local', value: local }
  if (user) return { scope: 'user', value: user }
  return { scope: 'default', value: undefined }
}

const SCOPE_NAMES = {
  session: 'phiên này',
  local: 'dự án này (local)',
  user: 'mọi dự án của bạn (user)',
  default: 'mặc định của SAPP',
}
export const scopeName = scope => SCOPE_NAMES[scope]
