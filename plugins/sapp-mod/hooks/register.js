import { HELP_MARKDOWN, HELP_TOAST, PANE_ID, TOAST_KEY } from './help.js'
import { THEMES, pickTheme, plain, themeOrDefault } from './themes.js'

export const CREDIT = 'Tạo bởi SAPP IT Department, © 2026'
export const SPINNER_TEXT = 'SAPP đang xử lý'
// The one key this mod keeps in its own store: the id of the chosen theme.
export const STORE_KEY = 'theme'
// Whether the person turned the SAPP theme off (`/sapp-theme off`). The chosen id stays in STORE_KEY,
// so `/sapp-theme on` brings the last choice back.
export const OFF_KEY = 'theme-off'
const OFF_WORDS = ['off', 'tat']
const ON_WORDS = ['on', 'bat']

const apply = async ($, theme) => {
  // The whole theme in one set: what a set leaves out is gone, so a theme with no
  // scene sets no backdrop and the previous theme's scene is dropped.
  const attributes = { colors: theme.colors }
  // No override of the colour scheme: every theme has a light and a dark look and follows the window.
  if (theme.scene) attributes.backdrop = { scene: theme.scene, glass: theme.glass }
  await $.theme.set(attributes)
}

const stored = async $ => {
  try {
    return await $.store.get(STORE_KEY)
  } catch {
    return undefined
  }
}

// The SAPP theme is OFF by default. What the store says decides:
//  - `theme-off` true: off. `theme-off` false: on, with the stored theme (or the default theme).
//  - no `theme-off` key and a stored `theme`: a person who picked a theme before the default became
//    off. Their theme stays on, so nobody who chose a theme loses it.
//  - no `theme-off` key and no stored `theme` (a fresh install), or a store that cannot be read: off.
const isOff = async $ => {
  try {
    const off = await $.store.get(OFF_KEY)
    if (off === true) return true
    if (off === false) return false
    return (await $.store.get(STORE_KEY)) == null
  } catch {
    return true
  }
}

// While the theme is off no row is marked [đang dùng]; `current` is then the last chosen theme,
// named only when there is one (`hasChoice`).
const listText = (current, off = false, hasChoice = true) =>
  [
    off
      ? `Giao diện SAPP đang TẮT (Claude Code dùng giao diện mặc định).${hasChoice ? ` Giao diện đã chọn gần nhất: ${current.title}.` : ''}`
      : `Giao diện SAPP, đang dùng: ${current.title}.`,
    ...THEMES.map(
      (t, i) => `${i + 1}. ${t.title} (${t.id}): ${t.blurb}${!off && t === current ? ' [đang dùng]' : ''}`,
    ),
    `Đổi bằng /sapp-theme <số, mã hoặc tên>. Tắt giao diện: /sapp-theme off. Bật giao diện: /sapp-theme on. Nền và màu chỉ hiện ở tab Code của Desktop và trên mobile.`,
  ].join('\n')

const switchTo = async ($, theme, state) => {
  try {
    await apply($, theme)
    state.applied = theme
    state.off = false
  } catch {
    return `Không áp dụng được "${theme.title}" trên bản Claude Code này.`
  }
  // The credit line is ours too: set it again so a switch can never leave it out.
  // A status that throws must not stop the choice being stored or the command answered.
  try {
    $.ui.status(CREDIT)
  } catch {
    // The line stays as it was.
  }
  try {
    await $.store.set(STORE_KEY, theme.id)
    await $.store.set(OFF_KEY, false)
  } catch {
    return `Đã đổi sang "${theme.title}", nhưng không lưu được lựa chọn cho lần sau.`
  }
  return `Đã đổi sang "${theme.title}" và lưu lại cho các phiên sau.`
}

// Turns the theme off: the engine's own look comes back. The credit line and the spinner word are not
// part of the theme, so they stay. The choice is stored, so a later session does not apply a theme.
const turnOff = async ($, state) => {
  try {
    await $.theme.clear()
  } catch {
    return 'Không tắt được giao diện trên bản Claude Code này.'
  }
  state.off = true
  state.applied = undefined
  const kept = 'Dòng credit và chữ "SAPP đang xử lý…" vẫn giữ vì không thuộc giao diện. Bật lại bằng /sapp-theme on hoặc /sapp-theme <số, mã hoặc tên>.'
  try {
    await $.store.set(OFF_KEY, true)
  } catch {
    return `Đã tắt giao diện SAPP, nhưng không lưu được lựa chọn cho lần sau. ${kept}`
  }
  return `Đã tắt giao diện SAPP: Claude Code về giao diện mặc định, và giữ vậy ở các phiên sau. ${kept}`
}

// The theme this session applied lives in `state`; before any, the stored one stands.
const answer = async ($, e, state) => {
  const asked = (e.args ?? '').trim()
  const off = state.off ?? (await isOff($))
  const choice = state.applied ?? (await stored($))
  const last = state.applied ?? themeOrDefault(choice)
  const hasChoice = choice != null
  if (asked === '') return { text: listText(last, off, hasChoice), isTextDisplayOnly: true }

  const word = plain(asked)
  if (OFF_WORDS.includes(word)) return { text: await turnOff($, state), isTextDisplayOnly: true }
  // `on` brings back the last chosen theme, or the default when none was chosen.
  if (ON_WORDS.includes(word)) return { text: await switchTo($, last, state), isTextDisplayOnly: true }

  const theme = pickTheme(asked)
  if (!theme) {
    return {
      text: `Không có giao diện "${shown(asked)}".\n${listText(last, off, hasChoice)}`,
      isTextDisplayOnly: true,
    }
  }
  return { text: await switchTo($, theme, state), isTextDisplayOnly: true }
}

// A long unknown name is cut before it is echoed.
const shown = text => (text.length > 64 ? `${text.slice(0, 64)}…` : text)

// The pointer to /sapp-help shows once per install: the flag is stored before the toast,
// so a store that cannot write (or read) never makes the toast come back.
// A run with no one to see it (`claude -p`, the SDK: not interactive, or no surface drawing yet)
// leaves the flag alone, so the toast is not spent unseen.
const pointToHelp = async ($, e) => {
  if (!e.isInteractive || e.surface == null) return
  try {
    if (await $.store.get(TOAST_KEY)) return
    await $.store.set(TOAST_KEY, true)
    $.ui.toast(HELP_TOAST)
  } catch {
    // No store or no toast on this build: say nothing.
  }
}

// /sapp-help: the card in a pane where the surface draws one, the same text in the
// transcript where it does not. Nothing here starts a model turn.
const showHelp = async $ => {
  try {
    const opened = await $.ui.open({ id: PANE_ID, title: 'Trợ giúp SAPP', focus: true, closeOnEscape: true })
    if (opened?.isPlaced === true) {
      return { text: 'Đã mở trang trợ giúp SAPP. Nhấn Esc để đóng.', isTextDisplayOnly: true }
    }
    await $.ui.close({ id: PANE_ID })
  } catch {
    // No pane on this build: the text below.
  }
  return { text: HELP_MARKDOWN, isTextDisplayOnly: true }
}

// The credit line is set at session.start, but on the Desktop Code tab no status row is attached
// that early and the call has no effect. So every Backdrop and Spinner render that arrives with a
// surface sets it again (a repeat call replaces the status with itself, so there is no once-flag
// to spend on a render that is still too early). A status that throws never touches the render.
const creditAgain = ($, e) => {
  if (e.surface == null) return
  try {
    $.ui.status(CREDIT)
  } catch {
    // The line stays as it was.
  }
}

export const register = on => {
  const state = { applied: undefined, off: undefined }

  on('session.start', async ($, e, next) => {
    // The credit line first: an older Claude Code without $.theme.set still shows it.
    try {
      $.ui.status(CREDIT)
    } catch {
      // No status line on this build.
    }
    try {
      state.off = await isOff($)
      // While the theme is off, no theme is set (and none cleared: a clear at start would wipe another mod's).
      if (!state.off) {
        const theme = themeOrDefault(await stored($))
        await apply($, theme)
        state.applied = theme
      }
    } catch {
      // No theme on this build; the rest of the mod still works.
    }
    // Last: a refused command name must not cost the session its theme.
    try {
      await $.command.register({
        name: 'sapp-theme',
        description: 'Đổi giao diện SAPP, hoặc tắt bằng off và bật lại bằng on. Không có tham số thì liệt kê các giao diện.',
        argumentHint: '[số | mã | tên | off | on]',
      })
    } catch {
      // No command on this build.
    }
    try {
      await $.command.register({
        name: 'sapp-help',
        description: 'Trợ giúp SAPP: các tính năng đã cài, cách đổi giao diện và hướng dẫn dùng Claude hiệu quả.',
      })
    } catch {
      // No command on this build.
    }
    await pointToHelp($, e)

    return next(e)
  })

  on('command.run', { command: 'sapp-theme' }, ($, e) =>
    answer($, e, state).catch(() => ({ text: 'Lệnh /sapp-theme gặp lỗi, giao diện không đổi.', isTextDisplayOnly: true })),
  )

  on('command.run', { command: 'sapp-help' }, $ =>
    showHelp($).catch(() => ({ text: HELP_MARKDOWN, isTextDisplayOnly: true })),
  )

  on('ui.render', { component: 'Pane' }, ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)
    const { Box, Markdown, Button } = $.ui.resolve(e)
    return Box({
      flexDirection: 'column',
      children: [
        Markdown({ text: HELP_MARKDOWN }),
        Button({ key: 'close', label: 'Đóng', role: 'dismiss', onPress: () => $.ui.close({ id: PANE_ID }) }),
      ],
    })
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    creditAgain($, e)
    // Off: our scene is gone with the theme; anything that still asks is left to the next hook.
    if (state.off === true) return next(e)
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    if (e.props.plugin !== 'sapp-mod') {
      return next(e)
    }
    const theme = THEMES.find(t => t.scene !== undefined && t.scene === e.props.scene)
    if (!theme) {
      return next(e)
    }
    const { Shader, Svg } = $.ui.resolve(e)
    const picture = Svg({ source: theme.svg, alt: theme.alt })
    // Each shader file is a literal path in its own call: the engine reads the path
    // off the source, so a variable would leave the Svg alone.
    const children = [picture]
    switch (theme.shader) {
      case 'classroom':
        return Shader({ module: './backdrop.shader.ts', children })
      case 'marketing':
        return Shader({ module: './marketing.shader.ts', children })
      case 'it-room':
        return Shader({ module: './it-room.shader.ts', children })
      default:
        return picture
    }
  })

  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    creditAgain($, e)
    return next({
      ...e,
      props: {
        ...e.props,
        word: SPINNER_TEXT,
        suffix: '…',
      },
    })
  })
}
