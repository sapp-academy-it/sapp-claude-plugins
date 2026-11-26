import { GUIDE_MARKDOWN } from './guide.js'

// The repository's issue tracker: the one place to report a problem. No personal contact.
export const ISSUES_URL = 'https://github.com/sapp-academy-it/sapp-claude-plugins/issues'
export const PANE_ID = 'sapp-help'
export const HELP_TOAST = 'Gõ /sapp-help để xem hướng dẫn dùng Claude tại SAPP'
// The one key that remembers the pointer toast was shown: at most one toast ever per install.
export const TOAST_KEY = 'help-toast-shown'

const INTRO = `# Trợ giúp SAPP

Đây là bộ plugin Claude Code chính thức của SAPP, do phòng công nghệ SAPP quản lý.

## Đang cài: sapp-mod

- Giao diện SAPP cho Claude Code (hiện ở tab Code của Claude Desktop).
- Giao diện SAPP mặc định tắt: bật bằng \`/sapp-theme on\`, đổi bằng \`/sapp-theme\`.
- Xem hướng dẫn dùng Claude: gõ \`/sapp-help\` (trang này).

## Báo vấn đề

Mở một issue tại ${ISSUES_URL}

---
`

// The whole card. Markdown that also reads as plain text, so the same string is the text fallback.
export const HELP_MARKDOWN = `${INTRO}\n${GUIDE_MARKDOWN}\n`
