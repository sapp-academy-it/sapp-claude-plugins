import { GUIDE_MARKDOWN } from './guide.js'

// The repository's issue tracker: the one place to report a problem. No personal contact.
export const ISSUES_URL = 'https://github.com/sapp-academy-it/sapp-claude-plugins/issues'
export const PANE_ID = 'sapp-help'
export const HELP_TOAST = 'Gõ /sapp-help để xem hướng dẫn dùng Claude tại SAPP'
export const HELP_TIP = 'Gõ /sapp-help để xem hướng dẫn dùng Claude tại SAPP (5 quy tắc ASK – CONTEXT – VERIFY – OUTPUT – TEST)'
export const HELP_TIP_ID = 'sapp-help'
// The own tip shows on every 4th tip the engine asks for; the other 3 are the engine's own.
export const TIP_EVERY = 4
// The one key that remembers the pointer toast was shown: at most one toast ever per install.
export const TOAST_KEY = 'help-toast-shown'

const INTRO = `# Trợ giúp SAPP

Đây là bộ plugin Claude Code chính thức của SAPP, do phòng công nghệ SAPP quản lý.

## Đang cài: sapp-mod

- Giao diện SAPP: bốn giao diện, màu sáng và tối (nền và màu chỉ hiện ở tab Code của ứng dụng Desktop và trên mobile).
- Dòng credit "Tạo bởi SAPP IT Department, © 2026" dưới ô nhập.
- Chữ "SAPP đang xử lý…" khi Claude đang làm việc.
- Lệnh \`/sapp-help\` (trang này) và hướng dẫn dùng Claude ở dưới. Hướng dẫn cũng có dạng skill: hỏi Claude "dùng Claude sao cho hiệu quả?" thì Claude đọc đúng nội dung này.

## Đổi giao diện

Gõ \`/sapp-theme\` để xem danh sách, \`/sapp-theme 2\` hoặc \`/sapp-theme it-room\` để đổi. Lựa chọn được lưu cho các phiên sau.

## Báo vấn đề

Mở một issue tại ${ISSUES_URL}

---
`

// The whole card. Markdown that also reads as plain text, so the same string is the text fallback.
export const HELP_MARKDOWN = `${INTRO}\n${GUIDE_MARKDOWN}\n`
