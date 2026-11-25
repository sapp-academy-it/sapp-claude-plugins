import { tokens } from './tokens.js'

import { makeColors } from './make-colors.js'
import { SCENE_ALT, SCENE_SVG } from './scene.js'

export const CREDIT = 'Tạo bởi SAPP IT Department, © 2026'
export const SPINNER_TEXT = 'SAPP đang xử lý'
export const SCENE_NAME = 'sapp-acca-classroom'

const { theme, problems } = makeColors({
  label: 'SAPP',
  roles: tokens.roles,
  light: { gray: { anchors: tokens.light } },
  dark: { gray: { anchors: tokens.dark } },
})

export const themeProblems = problems

export const register = on => {
  on('session.start', async ($, e, next) => {
    // The credit line first: an older Claude Code without $.theme.set still shows it.
    $.ui.status(CREDIT)
    try {
      await $.theme.set({
        colors: theme,
        backdrop: { scene: SCENE_NAME, glass: { blur: 14, opacity: 0.72 } },
      })
    } catch {
      // No theme on this build; the rest of the mod still works.
    }

    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }
    if (e.props.plugin !== 'sapp-brand' || e.props.scene !== SCENE_NAME) {
      return next(e)
    }
    const { Shader, Svg } = $.ui.resolve(e)

    return Shader({
      module: './backdrop.shader.ts',
      children: [Svg({ source: SCENE_SVG, alt: SCENE_ALT })],
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
