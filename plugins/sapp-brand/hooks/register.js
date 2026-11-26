import { THEMES, pickTheme, themeOrDefault } from './themes.js'

export const CREDIT = 'Tạo bởi SAPP IT Department, © 2026'
export const SPINNER_TEXT = 'SAPP đang xử lý'
export const COMMAND = 'sapp-theme'
// The one key this mod keeps in its own store: the id of the chosen theme.
export const STORE_KEY = 'theme'

const apply = async ($, theme) => {
  // The whole theme in one set: what a set leaves out is gone, so a theme with no
  // scene sets no backdrop and the previous theme's scene is dropped.
  const attributes = { colors: theme.colors }
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
    `Đổi bằng /${COMMAND} <số, mã hoặc tên>. Nền và màu chỉ hiện ở tab Code của Desktop và trên mobile.`,
  ].join('\n')

const switchTo = async ($, theme) => {
  try {
    await apply($, theme)
  } catch {
    return `Không áp dụng được "${theme.title}" trên bản Claude Code này.`
  }
  // The credit line is ours too: set it again so a switch can never leave it out.
  $.ui.status(CREDIT)
  try {
    await $.store.set(STORE_KEY, theme.id)
  } catch {
    return `Đã đổi sang "${theme.title}", nhưng không lưu được lựa chọn cho lần sau.`
  }
  return `Đã đổi sang "${theme.title}" và lưu lại cho các phiên sau.`
}

export const register = on => {
  on('session.start', async ($, e, next) => {
    // The credit line first: an older Claude Code without $.theme.set still shows it.
    $.ui.status(CREDIT)
    try {
      await apply($, themeOrDefault(await stored($)))
    } catch {
      // No theme on this build; the rest of the mod still works.
    }
    // Last: a refused command name must not cost the session its theme.
    try {
      await $.command.register({
        name: COMMAND,
        description: 'Đổi giao diện SAPP. Không có tham số thì liệt kê các giao diện.',
        argumentHint: '[số | mã | tên]',
      })
    } catch {
      // No command on this build.
    }

    return next(e)
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    const asked = (e.args ?? '').trim()
    const current = themeOrDefault(await stored($))
    if (asked === '') return { text: listText(current), isTextDisplayOnly: true }

    const theme = pickTheme(asked)
    if (!theme) {
      return {
        text: `Không có giao diện "${asked}".\n${listText(current)}`,
        isTextDisplayOnly: true,
      }
    }
    return { text: await switchTo($, theme), isTextDisplayOnly: true }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    if (e.props.plugin !== 'sapp-brand') {
      return next(e)
    }
    const theme = THEMES.find(t => t.scene !== undefined && t.scene === e.props.scene)
    if (!theme) {
      return next(e)
    }
    const { Shader, Svg } = $.ui.resolve(e)
    const picture = Svg({ source: theme.svg, alt: theme.alt })
    if (!theme.shader) {
      return picture
    }

    return Shader({
      module: './backdrop.shader.ts',
      children: [picture],
    })
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
