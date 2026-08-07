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
│   ├── portrait.png
│   └── config.json
├── sale-ai/
├── supervisor-ai/
└── _placeholder/
```

Mỗi PNG là một hàng ngang, nền trong suốt. Mỗi frame luôn là `320 × 400px`; chiều rộng file là số frame nhân `320px`. `config.json` là nơi duy nhất mô tả số frame, FPS, loop và nhịp riêng của từng frame. `AgentSpritePlayer` đọc config, dùng `background-position` để đổi frame và dùng một requestAnimationFrame dùng chung cho mọi Agent.

Mỗi Agent cũng khai báo một anchor cố định:

```json
"anchorX": 160,
"anchorY": 345
```

`anchorX` là tâm ngang và `anchorY` là baseline ở đáy vùng nhìn thấy. Mọi frame được căn vào anchor này ngay trong PNG, vì vậy khi state đổi thì card, desk và sprite area không di chuyển.

Ba Agent thử nghiệm `supervisor-ai`, `sale-ai` và `pcb-engineer` dùng skeletal rig SVG để chuyển động ổn định. Mỗi rig tải thêm `portrait.png` 512×512 nền trong suốt để tạo khuôn mặt 3D life-simulation riêng, còn cơ thể và thiết bị tiếp tục chuyển động theo state. Các sprite PNG vẫn được giữ làm nguồn thay thế và để bật lại chế độ sprite sau này. Nếu rig hoặc asset không tải được, `AgentSpritePlayer` giữ nhân vật CSS dự phòng; card không bị trắng hoặc hỏng.

| State | File | Frame | FPS | Loop |
| --- | --- | ---: | ---: | --- |
| `idle` | `idle.png` | 8 | 5 | Có |
| `working` | `working.png` | 12 | 8 | Có |
| `reviewing` | `reviewing.png` | 8 | 6 | Có |
| `done` | `done.png` | 6 | 6 | Không — giữ frame cuối 1,6 giây rồi về `idle` |

`frameDurations` là mảng thời lượng theo mili giây, tương ứng từng frame. Nếu một state không khai báo mảng này, player tự dùng `1000 / fps`. Ví dụ frame thứ bảy của `working` hiện giữ `650–800ms` để tạo nhịp quan sát tự nhiên trước khi Agent tiếp tục thao tác:

```json
{
  "image": "working.png",
  "frames": 12,
  "fps": 8,
  "loop": true,
  "frameDurations": [120, 120, 130, 140, 160, 180, 650, 120, 130, 140, 180, 380]
}
```

`frameOffsets` là tùy chọn chỉ dành cho asset bên thứ ba chưa được bake anchor. Đây là mảng `{ "x": 0, "y": 0 }` theo pixel gốc của một frame; giá trị dương di chuyển hình hiển thị sang phải/xuống dưới. Không cần khai báo cho ba Agent mẫu vì các PNG đã được căn sẵn.

### Chế độ skeletal rig không giật hình

Ba Agent mẫu dùng `playback: "rig"`. Player dựng nhân vật 2.5D bằng SVG nhiều lớp; bàn và màn hình đứng yên, trong khi đầu, mắt, tay, chuột, bàn phím và thiết bị được chuyển động độc lập. Chế độ này không đổi ảnh, không làm mờ và không scale toàn bộ nhân vật nên không có hiện tượng co giãn giữa các frame:

```json
"playback": "rig"
```

State, progress, task và Demo Agent vẫn hoạt động. `idle`, `working`, `reviewing` và `done` điều khiển các animation CSS khác nhau. Animation tự pause khi card ra ngoài màn hình hoặc tab trình duyệt bị ẩn. Khi có sprite sheet được dựng từ cùng một model/camera và có hình học đồng nhất, có thể đổi `playback` thành `sprite` để dùng lại sprite sheet.

## Kiểm tra alignment

Hai utility phát triển nằm trong `tools/`, không được tải bởi WordPress:

```bash
python -m pip install pillow
python tools/check-agent-sprites.py --strict
python tools/align-agent-sprites.py --scale 0.88 --normalize-height --normalize-width --write
```

`check-agent-sprites.py` kiểm tra kích thước sheet, alpha canvas, bounding box, tâm nhân vật, baseline và kích thước object giữa các frame. Utility báo lỗi nếu file thiếu/sai kích thước, và cảnh báo nếu tâm lệch quá 8px, tâm dọc quá 12px, baseline lệch quá 6px hoặc object thay đổi quá 10px chiều rộng/12px chiều cao.

## Thêm Agent mới

1. Tạo `assets/agents/ten-agent/config.json`, theo mẫu `pcb-engineer/config.json`.
2. Thêm bốn PNG sprite sheet vào cùng thư mục, đúng tên `idle.png`, `working.png`, `reviewing.png`, `done.png`. Chuẩn hiện tại là `idle: 8`, `working: 12`, `reviewing: 8`, `done: 6` frame; mỗi frame `320 × 400px`, nền PNG trong suốt.
3. Đặt `sprite: "ten-agent"` trong dữ liệu Agent. Nếu không đặt, plugin dùng ID Agent làm tên thư mục; vì vậy Agent ID `quality-ai` tự tìm `assets/agents/quality-ai/config.json`.

Khi tạo lại asset, khóa hoàn toàn camera angle, desk, chair và monitor position; chỉ thay đổi tay, mắt, đầu hoặc PCB. Để trống ít nhất 20px nền trong suốt quanh subject, không crop bàn/chân/monitor. Sau khi export, chạy utility kiểm tra trước khi thay PNG.

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

Vào **DAT AI Office → Nhân viên và AI Agent**, bấm **Demo Agent**. Demo chạy: idle 2 giây → working 8 giây (10–80%) → reviewing 4 giây → done 2 giây → idle cho Gerber AI và cập nhật nhật ký ngay trên trang.

## Kết nối dữ liệu thật

Gửi hook `dat_ai_office_event` khi đơn hàng, Gerber, BOM, sản xuất hay QC thay đổi. Frontend gọi REST chỉ để đọc dữ liệu an toàn; không đưa API key, thông tin khách hàng hoặc dữ liệu nhạy cảm vào endpoint công khai.
