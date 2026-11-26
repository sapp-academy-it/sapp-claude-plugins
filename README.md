# sapp-claude-plugins

Kho plugin Claude Code của SAPP Academy: các plugin và mod cài cho toàn tổ chức.
Kho này là một marketplace tên `sapp`, hiện có một plugin là `sapp-mod`.

Tạo bởi SAPP IT Department, © 2026.

## sapp-mod

`sapp-mod` là một bộ giao diện (theme) cho Claude Code của SAPP, dưới dạng mod (plugin có `hooks/register.js`). Có bốn giao diện, mỗi giao diện gồm màu sáng và tối, và tùy giao diện có thêm nền (Svg, có thể có shader). Người dùng đổi giao diện bằng lệnh `/sapp-theme`. Ngoài giao diện, mod còn làm hai việc không đổi theo giao diện:

| Việc | Nơi hiện |
| :-- | :-- |
| Giao diện đang chọn: màu SAPP sáng và tối, cộng nền nếu có | Tab Code của ứng dụng Desktop và mobile |
| Dòng credit cố định "Tạo bởi SAPP IT Department, © 2026" (dòng trạng thái dưới ô nhập) | Mọi nơi Claude Code vẽ giao diện |
| Chữ khi Claude đang xử lý: "SAPP đang xử lý…" thay cho từ quay vòng mặc định | Mọi nơi Claude Code vẽ giao diện |

### Các giao diện

| Số | Mã | Tên | Đội | Kiểu cửa sổ | Nội dung |
| :-- | :-- | :-- | :-- | :-- | :-- |
| 1 | `acca-classroom` | Lớp học ACCA (mặc định) | ACCA | Theo cửa sổ: sáng hoặc tối | Lớp học pixel art, không có máy tính: bàn có sách, vở và máy tính cầm tay; bảng ghi ACCA cùng công thức và bảng cân đối nhỏ; lịch thi khoanh đỏ một ngày; thầy chỉ bảng bằng thước, vài học viên giơ tay. Chuyển động (shader): quạt trần quay chậm, bụi phấn trôi, bảng sáng nhẹ dưới con trỏ. Màu SAPP |
| 2 | `marketing-room` | Phòng Marketing | Marketing | Theo cửa sổ: sáng hoặc tối | Pixel art: bàn chiến dịch ở giữa trải kế hoạch, bốn người đứng bàn bạc; tường dán poster và bảng ý tưởng; bảng KPI cột đang tăng; góc nội dung có đèn ring light, máy quay trên chân đế, điện thoại; góc làm việc chỉ có hai bàn máy tính. Chuyển động (shader): cột KPI cao lên rồi hạ nhẹ, ring light thở chậm, thỉnh thoảng một trái tim bay lên từ điện thoại. Màu SAPP |
| 3 | `it-room` | Phòng IT | IT | Theo cửa sổ: phòng ban ngày sáng, phòng ban đêm tối | Pixel art: ba tủ rack có đèn LED, một tủ mở cửa và một người cầm laptop kiểm tra, cáp gọn; hai bàn có hai màn hình mỗi bàn; màn hình giám sát lớn trên tường; cốc cà phê, chậu cây. Người có viền tối một ô để rõ ở cả hai chế độ. Chuyển động (shader): đèn LED nhấp nháy chậm, đồ thị giám sát cuộn, thỉnh thoảng một đèn trạng thái chuyển hổ phách rồi về xanh. Màu SAPP khi sáng, xanh đêm khi tối |
| 4 | `sapp-dots` | Chấm vàng SAPP | Chung | Theo cửa sổ | Lưới chấm vàng SAPP to dần về góc dưới bên phải, vẽ bằng mã, tĩnh. Màu SAPP |

Không giao diện nào ép kiểu cửa sổ (không dùng `overrideColorScheme`): mỗi nền và mỗi bảng màu có cả bản sáng lẫn tối, cửa sổ chọn bản nào thì hiện bản đó. Các giao diện có chuyển động đều chạy bằng shader trên GPU và không nhấp nháy (mọi thay đổi dưới 3 lần mỗi giây). Các mã đã bỏ (`acca-night`, trùng với `acca-classroom` ở chế độ tối; `marketing-board`, `it-blueprint` và `sapp-plain`) không còn trong danh sách; ai đã lưu một trong các mã đó sẽ quay về `acca-classroom`.

![Ảnh xem trước: mỗi giao diện một ô, cửa sổ sáng 1728x1117, hai nhóm hai bên và phòng trống ở giữa, có ghi tên](plugins/sapp-mod/preview.png)

Ảnh trên là khung hình tĩnh của từng giao diện (chưa có chuyển động của shader). Khung hình tĩnh này cũng là cái người dùng thấy khi bật giảm chuyển động.

### Đổi giao diện

```text
/sapp-theme                    # liệt kê các giao diện, đánh dấu cái đang dùng
/sapp-theme it-room            # theo mã
/sapp-theme 2                  # theo số trong danh sách (Phòng Marketing)
/sapp-theme phong it           # theo tên (không phân biệt hoa thường, có hoặc không dấu)
```

Lựa chọn được lưu trong kho riêng của mod (`$.store`, tệp JSON dưới `~/.claude/plugins/store/`) với một khóa `theme`, và áp dụng lại ở mọi phiên sau. Chưa chọn, hoặc mã đã lưu không còn trong danh sách, thì dùng `acca-classroom`. Tên không có trong danh sách thì lệnh không đổi gì và hiện lại danh sách. Đổi giao diện không ảnh hưởng dòng credit và chữ "SAPP đang xử lý…".

Chỉ tab Code của ứng dụng Desktop (và mobile) vẽ nền và màu giao diện. Ở terminal và editor, `/sapp-theme` vẫn chạy và lưu lựa chọn nhưng không có gì để vẽ; dòng credit và chữ "SAPP đang xử lý…" vẫn hiện.

Mod không làm gì khác: không đăng ký hook nào đọc hay đổi hành động của Claude (`tool.call`, `tool.check`, `prompt.submit`...), không gọi mạng, không chạy tiến trình, không đọc hay ghi tệp ngoài kho `$.store` của chính nó. Các sự kiện nó nghe: `session.start`, `command.run` của `/sapp-theme` và `/sapp-help`, `ui.render` của Backdrop, Spinner và Pane (chỉ khung của chính nó). Các lệnh `$` nó gọi: `$.theme.set`, `$.store.get`, `$.store.set`, `$.command.register`, `$.ui.status`, `$.ui.resolve`, cùng ba lệnh thêm cho `/sapp-help`: `$.ui.open`, `$.ui.close`, `$.ui.toast`. Các dòng `hooks:` và `calls:` của `claude plugin validate plugins/sapp-mod` được ghim trong CI; thêm sự kiện hay lệnh `$` thì phải sửa dòng ghim ở `.github/workflows/ci.yml` và đoạn này. Nền được giữ nhạt để chữ hội thoại vẫn dễ đọc ở cả hai chế độ; cảnh không nhấp nháy.

## Trợ giúp và hướng dẫn dùng Claude

Gõ `/sapp-help` để xem trang trợ giúp của SAPP, không tốn lượt nào của Claude. Trang gồm: lời giới thiệu (bộ plugin Claude Code chính thức của SAPP, do phòng công nghệ SAPP quản lý), những gì `sapp-mod` đã cài, cách đổi giao diện bằng `/sapp-theme`, nơi báo vấn đề (issues của kho này, không có liên hệ cá nhân) và hướng dẫn "Dùng Claude hiệu quả – 5 quy tắc: ASK – CONTEXT – VERIFY – OUTPUT – TEST". Nơi nào vẽ được khung (pane) thì trang mở thành khung, nhấn Esc hoặc nút Đóng để đóng; nơi nào không thì cùng nội dung hiện thành chữ trong hội thoại. Lần đầu sau khi cài, ở phiên tương tác (không phải `claude -p` hay SDK, nên không bị dùng hết khi không ai nhìn), mod hiện đúng một thông báo ngắn trỏ tới `/sapp-help` (cờ nhớ trong `$.store`, khóa `help-toast-shown`, không bao giờ hiện lại).

| Phần | Nơi hiện |
| :-- | :-- |
| Khung trợ giúp mở bởi `/sapp-help` (`$.ui.open`, vẽ ở render site `Pane`, phần tử `Markdown`) | Terminal, tab Code của Desktop, VS Code (bảng "Render sites" của mods reference); chỗ nào không đặt được khung thì dùng chữ |
| Chữ trả lời của `/sapp-help` khi không có khung | Hội thoại, ở mọi nơi chạy mod (`CommandOutput`: terminal và Desktop) |
| Thông báo `$.ui.toast` một lần | Docs không ghi từng nơi vẽ; chưa kiểm trên Desktop. Chỉ hiện khi `session.start` báo `isInteractive` và có surface; tab Code của Desktop có báo `isInteractive` true hay không thì chưa kiểm (nếu không, thông báo không hiện ở đó) |

Hướng dẫn nằm ở một nguồn duy nhất: `plugins/sapp-mod/skills/sapp-ai-guide/SKILL.md`. Nó vừa là skill của plugin (Claude tự nạp khi người dùng hỏi cách dùng Claude hay quy tắc dùng Claude của SAPP), vừa là nội dung của khung `/sapp-help`. Mod không đọc được tệp, nên `npm run build:guide` chép phần thân của SKILL.md vào `plugins/sapp-mod/hooks/guide.js`; sửa SKILL.md xong phải chạy lệnh này rồi commit cả hai, và một bài test fail khi hai bản lệch nhau. Hướng dẫn chỉ có lời khuyên chung, không có dữ liệu, tên hay địa chỉ nội bộ.

### Đưa hướng dẫn lên claude.ai (chat web và Desktop chat)

Mod chỉ chạy ở Claude Code (terminal, tab Code của Desktop, VS Code), không chạy trong chat của claude.ai; chat chỉ nạp skill, không nạp hook hay mod. Vì vậy `/sapp-help`, thông báo không có ở chat; chỉ SKILL.md đi được.

Kho này là public, mà đồng bộ marketplace từ GitHub trong Organization settings chỉ nhận kho private hoặc internal ("On github.com, your repository must be private or internal"), nên không dùng cách đồng bộ. Cách làm cho kho public, bằng tay, do Owner của tổ chức (Team hoặc Enterprise):

1. Nén thư mục skill thành zip, tên thư mục trùng tên skill: `cd plugins/sapp-mod/skills && zip -r sapp-ai-guide.zip sapp-ai-guide` (trong zip có `sapp-ai-guide/SKILL.md`).
2. Vào Organization settings > Plugins & skills > Policy: bảo đảm công tắc Skills đang bật. Muốn thành viên tự tải skill lên thì bật thêm User-created skills (cách của Owner ở bước 3 không cần công tắc này).
3. Vào tab Inventory, chọn Add > Upload a skill, chọn tệp zip. Theo tài liệu, skill do tổ chức tải lên hiện ở tab Organization skills cho tới khi được chuyển sang Inventory; ở Inventory đặt Default access (Available to install, Installed by default hoặc Required) cho thành viên.
4. Mỗi lần sửa SKILL.md: tạo zip mới, mở trang của skill trong Inventory, chọn Upload new version.

Không phải Owner thì tự dùng: Customize > Skills > Create skill > Upload a skill, chọn cùng tệp zip (chỉ cho tài khoản của mình, và khi tổ chức không tắt "User-created skills"). Đừng tải cả plugin `sapp-mod` lên bằng Upload a plugin: phần hook và mod bị bỏ qua trong chat, và việc kiểm tra mod trong zip plugin chưa xác nhận.

Nguồn: [Manage plugins for your organization](https://claude.com/docs/plugins/admin.md), [Sync your organization's plugins from a repository](https://claude.com/docs/plugins/org-sync.md), [Plugin feature support across platforms](https://claude.com/docs/plugins/platform-support.md), [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview.md).

### Màu

Màu lấy từ SAPP Academy Design System (skill `sapp-design-system`, tệp `references/tokens.css`): vàng SAPP `#FFB700`, ink ấm `#1A1916`, nền kem `#FAF8F3`, cùng thang ink và bốn màu ngữ nghĩa. Giá trị nằm trong [`plugins/sapp-mod/tokens.json`](plugins/sapp-mod/tokens.json). Mod chỉ nạp được tệp mã, nên bản nạp thật là `hooks/tokens.js`; một bài test fail khi hai bản lệch nhau. Từ các màu này, `makeColors` của Claude Code dựng cả bảng màu giao diện, nên các màu nhấn (vàng, đỏ, xanh) được chỉnh độ sáng cho đủ tương phản.

## Dùng thử

Trong Claude Code:

```text
/plugin marketplace add sapp-academy-it/sapp-claude-plugins
/plugin install sapp-mod@sapp
```

Cần Claude Code có mod (từ 2.1.286). Bản tối thiểu mà mod này hỗ trợ và được kiểm là **2.1.330**, bản cũ nhất chạy được trên máy phát triển; đã kiểm tải thật trên 2.1.330, 2.1.331 và 2.1.332. Lý do: một sự kiện mà engine cũ không biết (`ui.tip`, chỉ có từ 2.1.332) làm engine từ chối cả module, mất cả giao diện, dòng credit và `/sapp-theme` (sự cố 0.4.0). Vì vậy mod chỉ được đăng ký những sự kiện và gọi những lệnh `$` nằm trong danh sách cho phép của bài test `test/engine-floor.test.js`; thêm một cái mới thì phải kiểm trên 2.1.330 rồi mới thêm vào danh sách.

Máy đã cài `sapp-brand@sapp` cần gỡ nó (`/plugin uninstall sapp-brand@sapp`) rồi cài `sapp-mod@sapp`.

Quản trị viên: managed settings nào liệt kê `sapp-brand@sapp` trong `enabledPlugins` hoặc `appendPlugins` phải đổi sang `sapp-mod@sapp` và đổi `ref` sang SHA merge mới.

Lựa chọn giao diện đã lưu không được mang sang: gỡ plugin xóa dữ liệu trong `~/.claude/plugins/data/{id}/` (trừ khi dùng `--keep-data`) và mã plugin cũng đổi. Sau khi cài, chạy lại `/sapp-theme`.

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
  "enabledPlugins": { "sapp-mod@sapp": true },
  "appendPlugins": ["sapp-mod@sapp"]
}
```

- `extraKnownMarketplaces` khai báo marketplace `sapp` từ kho GitHub này. `ref` ghim marketplace vào đúng một commit: thay `<SHA ...>` bằng SHA đầy đủ (40 ký tự thường) của commit đã duyệt. Mỗi bản phát hành mới đổi SHA này trong cài đặt quản trị; không đổi thì máy người dùng vẫn ở bản đã ghim. Ghim bằng SHA cần Claude Code 2.1.324 trở lên; bản cũ hơn không nạp được marketplace ghim kiểu này.
- `enabledPlugins` bật `sapp-mod` cho mọi người nhận cài đặt.
- `appendPlugins` làm mod chạy sau mod của người dùng. Theo tài liệu, khai báo ở `prependPlugins` hoặc `appendPlugins` đều đủ để một mod từ marketplace GitHub tính là mod của tổ chức (cùng với hai khóa trên, trên Claude Code 2.1.324 trở lên). `sapp-mod` chỉ vẽ giao diện nên không cần chạy trước mod khác; dùng `appendPlugins` cũng không buộc phải liệt kê `sec-default@builtin`.

Cấu trúc theo [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin) và [Marketplace reference](https://code.claude.com/docs/en/plugins/marketplace-reference).

## Phát triển

```text
npm test                                  # node --test, không cần mạng
claude plugin validate .                  # marketplace
claude plugin validate plugins/sapp-mod   # plugin
npm run build:guide                       # chép SKILL.md vào hooks/guide.js
npm run build:scene                       # sinh lại ba cảnh pixel (hooks/scene*.js) từ sprite
npm run preview                           # dựng lại preview.png (cần Chromium, đặt biến CHROME nếu không có trên PATH; cùng rsvg-convert và ImageMagick 7)
```

Ba cảnh pixel (lớp học, phòng Marketing, phòng IT) được sinh từ các sprite trong `plugins/sapp-mod/assets/` bằng `plugins/sapp-mod/scripts/build-scene.mjs` (Node, không cần mạng); kết quả là `hooks/scene.js`, `hooks/scene-marketing.js` và `hooks/scene-it.js`, đã commit, và mỗi cảnh có một bài test fail khi hai bên lệch nhau. Đồ vật không có trong bộ sprite (máy tính cầm tay, sách, lịch, thước, quạt, bàn chiến dịch, poster, bảng KPI, ring light, máy quay, điện thoại, tủ rack, laptop, màn hình) được vẽ bằng mã trong cùng thang màu. Sau khi đổi sprite hay bố cục: `npm run build:scene`, rồi `npm run preview`. Chuyển động là các shader `hooks/*.shader.ts`, mỗi shader tìm vật cần động trong chính ảnh Svg bằng một màu đánh dấu riêng (một bài test kiểm không màu nào khác của cảnh gần màu đánh dấu). Danh sách giao diện nằm ở `hooks/themes.js`; thêm một giao diện là thêm một dòng ở đó (mã, tên, màu, nền) và một bài test cho màu của nó.

## Ghi công sprite

Nhân vật và đồ nội thất của cảnh nền là sprite pixel từ dự án pixel-agents, giấy phép MIT, Copyright (c) 2026 Pablo De Lucca. Toàn văn giấy phép nằm ở [`plugins/sapp-mod/assets/LICENSE-pixel-agents.txt`](plugins/sapp-mod/assets/LICENSE-pixel-agents.txt).

## Ghi công

- Cách tổ chức bộ giao diện (một bảng giao diện, mỗi hàng một mã; lệnh đổi giao diện theo mã hoặc tên; lưu lựa chọn trong `$.store`; mã không còn thì quay về mặc định; shader viết tên tệp dạng chuỗi) học từ ví dụ `theme-examples` của Anthropic trong [claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/73c8cf3ea7e296057b467990f2f5d61b4c922260/plugins/theme-examples), giấy phép Apache License 2.0. Mã của `sapp-mod` được viết lại cho các giao diện này; không sao chép nguyên văn tệp nào của ví dụ.
