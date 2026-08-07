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

`supervisor-ai` là prototype 3D đầu tiên. Agent này dùng model toàn thân `Suit.gltf` từ Quaternius Ultimate Modular Men và animation `UAL1_Standard.glb` từ Universal Animation Library. `sale-ai` và `pcb-engineer` vẫn dùng skeletal rig SVG hiện có để không thay đổi các phần chưa nằm trong prototype. Các sprite sheet cũ và `portrait.png` vẫn được giữ làm fallback nếu WebGL hoặc asset 3D không tải được.

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

Supervisor AI và Sale AI dùng `playback: "rig"`. Player dựng nhân vật 2.5D bằng SVG nhiều lớp; bàn và màn hình đứng yên, trong khi đầu, mắt, tay, chuột, bàn phím và thiết bị được chuyển động độc lập. Chế độ này không đổi ảnh, không làm mờ và không scale toàn bộ nhân vật nên không có hiện tượng co giãn giữa các frame:

```json
"playback": "rig"
```

### Prototype 3D Quaternius toàn thân

DAT Supervisor AI dùng `playback: "three"`. Model và animation được đóng gói trong plugin, không dùng CDN. Renderer dùng Three.js `AnimationMixer`; state machine nằm riêng trong `public/js/agent-3d-state-machine.js` và cross-fade giữa các clip để không gắn logic chuyển động vào giao diện:

```json
"playback": "three",
"three": {
  "model": "3d/Suit.gltf",
  "animations": "3d/UAL1_Standard.glb"
}
```

Mapping prototype hiện tại dùng đúng tên clip đã kiểm tra trong file: `idle → Idle_Loop`, `working → Walk_Loop`, `reviewing → Sitting_Enter` rồi `Sitting_Idle_Loop`, và `done → Sitting_Exit`. `typing` và `using_mouse` không tồn tại trong nguồn Universal Animation Library đang dùng, vì vậy phiên bản này không tự giả hai animation đó. Muốn bổ sung cần tạo animation tương thích trong Blender hoặc lấy từ nguồn có giấy phép rõ ràng.

Model `Suit.gltf` có 5 node gắn skin (Three.js tách thành 13 `SkinnedMesh` theo primitive), một skeleton 62 joints; file UAL có một node gắn skin (2 primitive `SkinnedMesh`), skeleton 65 joints. `public/js/agent-3d.js` retarget clip bằng mapping xương tường minh, ẩn phụ kiện súng của model Suit, render toàn thân và tự dừng khi card ra ngoài viewport hoặc tab bị ẩn. Thông tin nguồn và giấy phép nằm trong `assets/licenses/`.

State, progress, task và Demo Agent vẫn hoạt động. Animation tự pause khi card ra ngoài màn hình hoặc tab trình duyệt bị ẩn. Khi có sprite sheet được dựng từ cùng một model/camera và có hình học đồng nhất, có thể đổi `playback` thành `sprite` để dùng lại sprite sheet.

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
updateAgentState('ai_1', 'reviewing');
updateAgentTask('ai_1', 'Rà soát dashboard', 65);
```

`AgentSpritePlayer` cũng cung cấp `loadState()`, `setState()`, `play()`, `pause()`, `stop()` và `destroy()`. Khi state `done` kết thúc, player tự quay lại `idle`.

## Demo

Vào **DAT AI Office → Nhân viên và AI Agent**, bấm **Demo Agent**. Demo chạy: idle 2 giây → working 8 giây (10–80%) → reviewing 4 giây → done 2 giây → idle cho DAT Supervisor AI và cập nhật nhật ký ngay trên trang.

## Kết nối dữ liệu thật

Gửi hook `dat_ai_office_event` khi đơn hàng, Gerber, BOM, sản xuất hay QC thay đổi. Frontend gọi REST chỉ để đọc dữ liệu an toàn; không đưa API key, thông tin khách hàng hoặc dữ liệu nhạy cảm vào endpoint công khai.
