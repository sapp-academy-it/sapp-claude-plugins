# sapp-claude-plugins

Kho plugin Claude Code của SAPP Academy: các plugin và mod cài cho toàn tổ chức.
Kho này là một marketplace tên `sapp`, hiện có một plugin là `sapp-brand`.

Tạo bởi SAPP IT Department, © 2026.

## sapp-brand

`sapp-brand` là một bộ giao diện (theme) cho Claude Code của SAPP, dưới dạng mod (plugin có `hooks/register.js`). Mỗi giao diện gồm màu SAPP sáng và tối, và tùy giao diện có thêm nền (Svg, có thể có shader). Người dùng đổi giao diện bằng lệnh `/sapp-theme`. Ngoài giao diện, mod còn làm hai việc không đổi theo giao diện:

| Việc | Nơi hiện |
| :-- | :-- |
| Giao diện đang chọn: màu SAPP sáng và tối, cộng nền nếu có | Tab Code của ứng dụng Desktop và mobile |
| Dòng credit cố định "Tạo bởi SAPP IT Department, © 2026" (dòng trạng thái dưới ô nhập) | Mọi nơi Claude Code vẽ giao diện |
| Chữ khi Claude đang xử lý: "SAPP đang xử lý…" thay cho từ quay vòng mặc định | Mọi nơi Claude Code vẽ giao diện |

### Các giao diện

| Số | Mã | Tên | Nội dung |
| :-- | :-- | :-- | :-- |
| 1 | `acca-classroom` | Lớp học ACCA (mặc định) | Lớp học pixel art nhìn từ cuối lớp: bảng ghi ACCA, thầy giáo, bàn học có máy tính, học viên. Màn hình phát sáng nhẹ, bụi phấn trôi, vệt sáng quanh con trỏ (shader). Màu SAPP |
| 2 | `acca-night` | Lớp học ACCA ban đêm | Cùng lớp học, phủ thêm một lớp xanh đêm, màn hình vẫn sáng (shader). Bảng màu xanh đêm, vẫn nhấn vàng SAPP |
| 3 | `sapp-dots` | Chấm vàng SAPP | Lưới chấm vàng SAPP to dần về góc dưới bên phải, vẽ bằng mã, tĩnh. Màu SAPP |
| 4 | `sapp-plain` | SAPP cơ bản | Chỉ màu SAPP, không có nền |

![Ảnh xem trước: mỗi giao diện một hàng, chế độ sáng bên trái, tối bên phải, có ghi tên](plugins/sapp-brand/preview.png)

Ảnh trên là khung hình tĩnh của từng giao diện (chưa có chuyển động của shader). Khung hình tĩnh này cũng là cái người dùng thấy khi bật giảm chuyển động.

### Đổi giao diện

```text
/sapp-theme                    # liệt kê các giao diện, đánh dấu cái đang dùng
/sapp-theme acca-night         # theo mã
/sapp-theme 3                  # theo số trong danh sách
/sapp-theme Chấm vàng SAPP     # theo tên (không phân biệt hoa thường, có hoặc không dấu)
```

Lựa chọn được lưu trong kho riêng của mod (`$.store`, tệp JSON dưới `~/.claude/plugins/store/`) với một khóa `theme`, và áp dụng lại ở mọi phiên sau. Chưa chọn, hoặc mã đã lưu không còn trong danh sách, thì dùng `acca-classroom`. Tên không có trong danh sách thì lệnh không đổi gì và hiện lại danh sách. Đổi giao diện không ảnh hưởng dòng credit và chữ "SAPP đang xử lý…".

Chỉ tab Code của ứng dụng Desktop (và mobile) vẽ nền và màu giao diện. Ở terminal và editor, `/sapp-theme` vẫn chạy và lưu lựa chọn nhưng không có gì để vẽ; dòng credit và chữ "SAPP đang xử lý…" vẫn hiện.

Mod không làm gì khác: không đăng ký hook nào đọc hay đổi hành động của Claude (`tool.call`, `tool.check`, `prompt.submit`...), không gọi mạng, không chạy tiến trình, không đọc hay ghi tệp ngoài kho `$.store` của chính nó. Các sự kiện nó nghe: `session.start`, `command.run` của `/sapp-theme`, và `ui.render` của Backdrop và Spinner. Các lệnh `$` nó gọi: `$.theme.set`, `$.store.get`, `$.store.set`, `$.command.register`, `$.ui.status`, `$.ui.resolve`. Nền được giữ nhạt để chữ hội thoại vẫn dễ đọc ở cả hai chế độ; cảnh không nhấp nháy.

### Màu

Màu lấy từ SAPP Academy Design System (skill `sapp-design-system`, tệp `references/tokens.css`): vàng SAPP `#FFB700`, ink ấm `#1A1916`, nền kem `#FAF8F3`, cùng thang ink và bốn màu ngữ nghĩa. Giá trị nằm trong [`plugins/sapp-brand/tokens.json`](plugins/sapp-brand/tokens.json). Mod chỉ nạp được tệp mã, nên bản nạp thật là `hooks/tokens.js`; một bài test fail khi hai bản lệch nhau. Từ các màu này, `makeColors` của Claude Code dựng cả bảng màu giao diện, nên các màu nhấn (vàng, đỏ, xanh) được chỉnh độ sáng cho đủ tương phản.

## Dùng thử

Trong Claude Code:

```text
/plugin marketplace add sapp-academy-it/sapp-claude-plugins
/plugin install sapp-brand@sapp
```

Cần Claude Code có mod (từ 2.1.286); đã kiểm với 2.1.332.

## Triển khai cho cả tổ chức

Quản trị viên dán đoạn sau vào managed settings (claude.ai admin console hoặc `managed-settings.json`):

```json
{
  "extraKnownMarketplaces": {
    "sapp": {
      "source": {
        "source": "github",
        "repo": "sapp-academy-it/sapp-claude-plugins",
        "ref": "<SHA 40 ký tự của commit đã duyệt trên main>"
      }
    }
  },
  "enabledPlugins": { "sapp-brand@sapp": true },
  "appendPlugins": ["sapp-brand@sapp"]
}
```

- `extraKnownMarketplaces` khai báo marketplace `sapp` từ kho GitHub này. `ref` ghim marketplace vào đúng một commit: thay `<SHA ...>` bằng SHA đầy đủ (40 ký tự thường) của commit đã duyệt. Mỗi bản phát hành mới đổi SHA này trong cài đặt quản trị; không đổi thì máy người dùng vẫn ở bản đã ghim. Ghim bằng SHA cần Claude Code 2.1.324 trở lên; bản cũ hơn không nạp được marketplace ghim kiểu này.
- `enabledPlugins` bật `sapp-brand` cho mọi người nhận cài đặt.
- `appendPlugins` làm mod chạy sau mod của người dùng. Theo tài liệu, khai báo ở `prependPlugins` hoặc `appendPlugins` đều đủ để một mod từ marketplace GitHub tính là mod của tổ chức (cùng với hai khóa trên, trên Claude Code 2.1.324 trở lên). `sapp-brand` chỉ vẽ giao diện nên không cần chạy trước mod khác; dùng `appendPlugins` cũng không buộc phải liệt kê `sec-default@builtin`.

Cấu trúc theo [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin) và [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference).

## Phát triển

```text
npm test                                  # node --test, không cần mạng
claude plugin validate .                  # marketplace
claude plugin validate plugins/sapp-brand # plugin
npm run build:scene                       # sinh lại hooks/scene.js từ sprite
npm run preview                           # dựng lại preview.png (cần rsvg-convert và ImageMagick 7)
```

Cảnh lớp học được sinh từ các sprite pixel trong `plugins/sapp-brand/assets/` bằng `plugins/sapp-brand/scripts/build-scene.mjs` (Node, không cần mạng); kết quả là `hooks/scene.js`, đã commit, và một bài test fail khi hai bên lệch nhau. Sau khi đổi sprite hay bố cục: `npm run build:scene`, rồi `npm run preview`. Chuyển động là shader `hooks/backdrop.shader.ts`. Danh sách giao diện nằm ở `hooks/themes.js`; thêm một giao diện là thêm một dòng ở đó (mã, tên, màu, nền) và một bài test cho màu của nó.

## Ghi công sprite

Nhân vật và đồ nội thất của cảnh nền là sprite pixel từ dự án pixel-agents, giấy phép MIT, Copyright (c) 2026 Pablo De Lucca. Toàn văn giấy phép nằm ở [`plugins/sapp-brand/assets/LICENSE-pixel-agents.txt`](plugins/sapp-brand/assets/LICENSE-pixel-agents.txt).

## Ghi công

- Cách tổ chức bộ giao diện (một bảng giao diện, mỗi hàng một mã; lệnh đổi giao diện theo mã hoặc tên; lưu lựa chọn trong `$.store`; mã không còn thì quay về mặc định; shader viết tên tệp dạng chuỗi) học từ ví dụ `theme-examples` của Anthropic trong [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/73c8cf3ea7e296057b467990f2f5d61b4c922260/plugins/theme-examples), giấy phép Apache License 2.0. Mã của `sapp-brand` được viết lại cho bốn giao diện này; không sao chép nguyên văn tệp nào của ví dụ.
