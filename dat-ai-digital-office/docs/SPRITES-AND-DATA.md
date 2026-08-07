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

Mỗi PNG là một hàng ngang gồm **4 frame thật**, mỗi frame `320 × 400px`; vì vậy mỗi file có kích thước `1280 × 400px`, nền trong suốt. `config.json` là nơi duy nhất mô tả số frame, FPS và loop. `AgentSpritePlayer` đọc config, dùng `background-position` để đổi frame và dùng một requestAnimationFrame dùng chung cho mọi Agent.

Ba Agent thử nghiệm đã dùng sprite PNG thật: `supervisor-ai`, `sale-ai` và `pcb-engineer`. Các config của chúng đặt `"placeholder": false` để ưu tiên sprite. Nếu file không tải được, `AgentSpritePlayer` tự trả về nhân vật CSS dự phòng; card không bị trắng hoặc hỏng.

| State | File | Frame | FPS | Loop |
| --- | --- | ---: | ---: | --- |
| `idle` | `idle.png` | 4 | 4 | Có |
| `working` | `working.png` | 4 | 8 | Có |
| `reviewing` | `reviewing.png` | 4 | 5 | Có |
| `done` | `done.png` | 4 | 6 | Không — giữ frame cuối 1,2 giây rồi về `idle` |

## Thêm Agent mới

1. Tạo `assets/agents/ten-agent/config.json`, theo mẫu `pcb-engineer/config.json`.
2. Thêm bốn PNG sprite sheet vào cùng thư mục, đúng tên `idle.png`, `working.png`, `reviewing.png`, `done.png`. Mỗi file nên là `1280 × 400px`: 4 frame ngang, mỗi frame `320 × 400px`, nền PNG trong suốt.
3. Đặt `sprite: "ten-agent"` trong dữ liệu Agent. Nếu không đặt, plugin dùng ID Agent làm tên thư mục; vì vậy Agent ID `quality-ai` tự tìm `assets/agents/quality-ai/config.json`.

Đặt `"placeholder": false` khi bốn PNG đã sẵn sàng. Không cần thêm code animation riêng. Các state được chuẩn hóa như sau:

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
