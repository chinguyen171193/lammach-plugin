# Shortcode

```text
[lm_ai_office]
[lm_ai_office height="850" mode="demo" theme="dark" fullscreen="yes"]
```

Các thuộc tính `height`, `mode`, `theme`, `fullscreen`, `show_dashboard`, `show_log`, `show_controls`, `sound`, `auto_camera` được hỗ trợ. Mỗi shortcode tạo ID container ngẫu nhiên, do đó có thể đặt nhiều văn phòng trên cùng một trang.

Asset chỉ được enqueue khi shortcode được render, tương thích Gutenberg, Elementor và theme thông thường.

## NPC 3D test (FBX)

Shortcode `[lm_ai_office_npc_test]` tạo scene kiểm thử độc lập cho
`employee_001.fbx` và `animations.fbx`, nên không thay đổi renderer office 2.5D
đang hoạt động. Có thể đặt chiều cao bằng `[lm_ai_office_npc_test height="620"]`.

Scene in danh sách clip của `animations.fbx` ra Console và panel debug, dùng map
đã kiểm tra trực tiếp `CharacterArmature|Idle_Neutral` / `CharacterArmature|Walk`
và có workstation prototype `desk_01` / `chair_01` / `computer_01`. Debug panel
quét riêng animation Sit/Stand/Typing, hiển thị interaction point của ghế và cho
phép chạy luồng Go To Desk → Sit → Work → Stand Up. Asset runtime đặt tại
`public/assets/characters/employee_001/`; license và hướng dẫn gốc được lưu trong
`docs/assets/employee_001/`.
