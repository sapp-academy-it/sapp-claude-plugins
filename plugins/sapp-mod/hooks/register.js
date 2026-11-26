import { THEMES, pickTheme, themeOrDefault } from './themes.js'

export const CREDIT = 'Tạo bởi SAPP IT Department, © 2026'
export const SPINNER_TEXT = 'SAPP đang xử lý'
// The one key this mod keeps in its own store: the id of the chosen theme.
export const STORE_KEY = 'theme'

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

const listText = current =>
  [
    `Giao diện SAPP, đang dùng: ${current.title}.`,
    ...THEMES.map(
      (t, i) => `${i + 1}. ${t.title} (${t.id}): ${t.blurb}${t === current ? ' [đang dùng]' : ''}`,
    ),
    `Đổi bằng /sapp-theme <số, mã hoặc tên>. Nền và màu chỉ hiện ở tab Code của Desktop và trên mobile.`,
  ].join('\n')

const switchTo = async ($, theme, state) => {
  try {
    await apply($, theme)
    state.applied = theme
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
  } catch {
    return `Đã đổi sang "${theme.title}", nhưng không lưu được lựa chọn cho lần sau.`
  }
  return `Đã đổi sang "${theme.title}" và lưu lại cho các phiên sau.`
}

// The theme this session applied lives in `state`; before any, the stored one stands.
const answer = async ($, e, state) => {
  const asked = (e.args ?? '').trim()
  const now = state.applied ?? themeOrDefault(await stored($))
  if (asked === '') return { text: listText(now), isTextDisplayOnly: true }

  const theme = pickTheme(asked)
  if (!theme) {
    return {
      text: `Không có giao diện "${shown(asked)}".\n${listText(now)}`,
      isTextDisplayOnly: true,
    }
  }
  return { text: await switchTo($, theme, state), isTextDisplayOnly: true }
}

// A long unknown name is cut before it is echoed.
const shown = text => (text.length > 64 ? `${text.slice(0, 64)}…` : text)

export const register = on => {
  const state = { applied: undefined }

  on('session.start', async ($, e, next) => {
    // The credit line first: an older Claude Code without $.theme.set still shows it.
    try {
      $.ui.status(CREDIT)
    } catch {
      // No status line on this build.
    }
    try {
      const theme = themeOrDefault(await stored($))
      await apply($, theme)
      state.applied = theme
    } catch {
      // No theme on this build; the rest of the mod still works.
    }
    // Last: a refused command name must not cost the session its theme.
    try {
      await $.command.register({
        name: 'sapp-theme',
        description: 'Đổi giao diện SAPP. Không có tham số thì liệt kê các giao diện.',
        argumentHint: '[số | mã | tên]',
      })
    } catch {
      // No command on this build.
    }

    return next(e)
  })

  on('command.run', { command: 'sapp-theme' }, ($, e) =>
    answer($, e, state).catch(() => ({ text: 'Lệnh /sapp-theme gặp lỗi, giao diện không đổi.', isTextDisplayOnly: true })),
  )

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
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

  on('ui.render', { component: 'Spinner' }, ($, e, next) =>
    next({
      ...e,
      props: {
        ...e.props,
        word: SPINNER_TEXT,
        suffix: '…',
      },
    }),
  )
}
