// The two simple, code-drawn scenes: a content-plan board of sticky notes for the
// marketing team, and a thin-line network diagram for IT. Pure functions with fixed
// numbers: the same Svg every time. Both are drawn with straight, axis-aligned
// shapes and crisp edges, and carry the exact colours their shaders look for.

const W = 768
const H = 544

// The shader marks (marketing-board.shader.ts, it-blueprint.shader.ts) read these.
export const NOTE_YELLOW = '#FFE07A'
export const NOTE_WHITE = '#FFFFFF'
export const LINK = '#3E7BD9'

const open = css =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges"><style>${css}</style>`

// ---- the idea board ------------------------------------------------------------

const COLS = 6
const ROWS = 4
const NOTE_W = 104
const NOTE_H = 88
const GAP_X = 18
const GAP_Y = 22
const LEFT = (W - (COLS * NOTE_W + (COLS - 1) * GAP_X)) / 2
const TOP = 72

export const boardSvg = () => {
  const parts = []
  // Column heads: the weeks of the plan.
  for (let col = 0; col < COLS; col++) {
    parts.push(`<rect class="head" x="${LEFT + col * (NOTE_W + GAP_X)}" y="34" width="${NOTE_W}" height="10"/>`)
  }
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = LEFT + col * (NOTE_W + GAP_X)
      const y = TOP + row * (NOTE_H + GAP_Y)
      // A fixed, uneven mix of yellow and white, like a plan filled in by hand.
      const yellow = (row * 7 + col * 3) % 5 < 3
      const line = (dy, w) => `<rect class="ink" x="${x + 12}" y="${y + dy}" width="${w}" height="4"/>`
      parts.push(
        `<rect class="shade" x="${x + 4}" y="${y + 5}" width="${NOTE_W}" height="${NOTE_H}"/>` +
          `<rect class="${yellow ? 'yellow' : 'white'}" x="${x}" y="${y}" width="${NOTE_W}" height="${NOTE_H}"/>` +
          `<rect class="pin" x="${x + NOTE_W / 2 - 4}" y="${y + 6}" width="8" height="8"/>` +
          line(26, 40 + ((row + col * 2) % 4) * 12) +
          line(42, 60 + ((row * 3 + col) % 3) * 10) +
          (row % 2 === 0 || col % 3 === 0 ? line(58, 28 + ((row + col) % 3) * 14) : ''),
      )
    }
  }
  return (
    open(`.bg{fill:#E9DFC8}.head{fill:#D4C7A8}.shade{fill:#CFC2A2}.yellow{fill:${NOTE_YELLOW}}.white{fill:${NOTE_WHITE}}.ink{fill:#BDB08F}.pin{fill:#D64545}`) +
    `<rect class="bg" width="${W}" height="${H}"/>${parts.join('')}</svg>`
  )
}
export const BOARD_ALT = 'Bảng ý tưởng nội dung: lưới giấy ghi nhớ màu vàng và trắng như một kế hoạch nội dung, mỗi tờ ghim một đinh đỏ'

// ---- the network blueprint -------------------------------------------------------

// Boxes: [x, y, w, h]; centre-based helpers keep the links honest.
const NODES = {
  cloud: [324, 28, 120, 56],
  firewall: [334, 128, 100, 48],
  core: [304, 228, 160, 52],
  swA: [108, 338, 120, 44],
  swB: [324, 338, 120, 44],
  swC: [540, 338, 120, 44],
  s1: [44, 448, 88, 44],
  s2: [160, 448, 88, 44],
  s3: [340, 448, 88, 44],
  s4: [520, 448, 88, 44],
  s5: [636, 448, 88, 44],
}
const bottom = n => [NODES[n][0] + NODES[n][2] / 2, NODES[n][1] + NODES[n][3]]
const top = n => [NODES[n][0] + NODES[n][2] / 2, NODES[n][1]]
// Straight down, across, and down again: an elbow link through the given middle height.
const elbow = (from, to, mid) => {
  const [x1, y1] = bottom(from)
  const [x2, y2] = top(to)
  return x1 === x2 ? `M${x1} ${y1}V${y2}` : `M${x1} ${y1}V${mid}H${x2}V${y2}`
}

export const blueprintSvg = () => {
  const links = [
    elbow('cloud', 'firewall', 106),
    elbow('firewall', 'core', 202),
    elbow('core', 'swA', 310),
    elbow('core', 'swB', 310),
    elbow('core', 'swC', 310),
    elbow('swA', 's1', 416),
    elbow('swA', 's2', 416),
    elbow('swB', 's3', 416),
    elbow('swC', 's4', 416),
    elbow('swC', 's5', 416),
  ]
  const boxes = Object.entries(NODES).map(([name, [x, y, w, h]]) => {
    let inner = ''
    if (name === 'cloud') {
      inner = `<rect class="mark" x="${x + 30}" y="${y + 30}" width="60" height="4"/><rect class="mark" x="${x + 40}" y="${y + 18}" width="14" height="12"/><rect class="mark" x="${x + 58}" y="${y + 12}" width="18" height="18"/>`
    } else if (name === 'firewall') {
      inner = [0, 1, 2, 3, 4].map(i => `<rect class="mark" x="${x + 14 + i * 16}" y="${y + 14}" width="10" height="20"/>`).join('')
    } else if (name === 'core') {
      inner = [0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect class="mark" x="${x + 14 + i * 17}" y="${y + 18}" width="10" height="16"/>`).join('')
    } else if (name.startsWith('sw')) {
      inner = [0, 1, 2, 3, 4, 5].map(i => `<rect class="mark" x="${x + 12 + i * 17}" y="${y + 14}" width="9" height="16"/>`).join('')
    } else {
      inner = `<rect class="mark" x="${x + 14}" y="${y + 12}" width="60" height="6"/><rect class="mark" x="${x + 14}" y="${y + 26}" width="60" height="6"/>`
    }
    return `<rect class="node" x="${x}" y="${y}" width="${w}" height="${h}"/>${inner}`
  })
  const grid = []
  for (let x = 0; x <= W; x += 48) grid.push(`<rect class="grid" x="${x}" y="0" width="1" height="${H}"/>`)
  for (let y = 0; y <= H; y += 48) grid.push(`<rect class="grid" x="0" y="${y}" width="${W}" height="1"/>`)
  return (
    open(`.bg{fill:#0B1636}.grid{fill:#12224D}.link{fill:none;stroke:${LINK};stroke-width:3}.node{fill:#0F1D45;stroke:#8FB0F0;stroke-width:3}.mark{fill:#9DB8F5}`) +
    `<rect class="bg" width="${W}" height="${H}"/>${grid.join('')}` +
    `<path class="link" d="${links.join('')}"/>` +
    boxes.join('') +
    '</svg>'
  )
}
export const BLUEPRINT_ALT = 'Bản vẽ mạng: sơ đồ nét mảnh trên nền xanh đậm, từ internet qua tường lửa, switch lõi, các switch nhánh tới máy chủ'
