# AgentSprite, sprite sheet và dữ liệu thật

## Cấu trúc asset

Mỗi Agent dùng một thư mục trong `assets/agents/`:

```text
assets/agents/
├── pcb-engineer/
│   ├── idle.png
│   ├── working.png
│   ├── reviewing.png
│   ├── done.png
│   └── config.json
├── sale-ai/
├── supervisor-ai/
└── _placeholder/
```

Mỗi PNG là một hàng ngang. Ví dụ `working.png` có 8 frame, mỗi frame `320 × 400px`, thì ảnh có kích thước `2560 × 400px`. `config.json` là nơi duy nhất mô tả số frame, FPS và loop. `AgentSpritePlayer` đọc config, dùng `background-position` để đổi frame và dùng một requestAnimationFrame dùng chung cho mọi Agent.

Ba config có sẵn đang bật `"placeholder": true`, vì chưa có PNG thật. Điều này hiển thị nhân vật CSS dự phòng, không yêu cầu ảnh tĩnh hoặc request file 404. Khi đã thêm đủ PNG, xóa `"placeholder": true` (hoặc đổi thành `false`).

## Thêm Agent mới

1. Tạo `assets/agents/ten-agent/config.json`, theo mẫu `pcb-engineer/config.json`.
2. Thêm bốn PNG sprite sheet vào cùng thư mục.
3. Đặt `sprite: "ten-agent"` trong dữ liệu Agent. Nếu không đặt, plugin dùng ID Agent làm tên thư mục; vì vậy Agent ID `quality-ai` tự tìm `assets/agents/quality-ai/config.json`.

Không cần thêm code animation riêng. Các state được chuẩn hóa như sau:

| Business status | Sprite state |
| --- | --- |
| `online`, `waiting` | `idle` |
| `working`, `processing`, `typing` | `working` |
| `reviewing`, `checking` | `reviewing` |
| `done`, `completed` | `done` |

## API JavaScript

Khi Agent card đã được render, gọi từ JavaScript:

```js
updateAgentState('ai_3', 'reviewing');
updateAgentTask('ai_3', 'Phân tích Gerber', 65);
```

`AgentSpritePlayer` cũng cung cấp `loadState()`, `setState()`, `play()`, `pause()`, `stop()` và `destroy()`. Khi state `done` kết thúc, player tự quay lại `idle`.

## Demo

Vào **DAT AI Office → Nhân viên và AI Agent**, bấm **Demo Agent**. Demo chạy chuỗi: idle → working (10–80%) → reviewing → done → idle cho Gerber AI và cập nhật nhật ký ngay trên trang.

## Kết nối dữ liệu thật

Gửi hook `dat_ai_office_event` khi đơn hàng, Gerber, BOM, sản xuất hay QC thay đổi. Frontend gọi REST chỉ để đọc dữ liệu an toàn; không đưa API key, thông tin khách hàng hoặc dữ liệu nhạy cảm vào endpoint công khai.
