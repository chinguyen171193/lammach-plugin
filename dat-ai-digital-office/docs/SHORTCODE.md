# Shortcode

```text
[dat_ai_office]
[dat_ai_office height="850" mode="demo" theme="dark" fullscreen="yes"]
```

Các thuộc tính `height`, `mode`, `theme`, `fullscreen`, `show_dashboard`, `show_log`, `show_controls`, `sound`, `auto_camera` được hỗ trợ. Mỗi shortcode tạo ID container ngẫu nhiên, do đó có thể đặt nhiều văn phòng trên cùng một trang.

Asset chỉ được enqueue khi shortcode được render, tương thích Gutenberg, Elementor và theme thông thường.

## NPC 3D test (FBX)

Shortcode `[dat_ai_office_npc_test]` tạo scene kiểm thử độc lập cho
`employee_001.fbx` và `animations.fbx`, nên không thay đổi renderer office 2.5D
đang hoạt động. Có thể đặt chiều cao bằng `[dat_ai_office_npc_test height="620"]`.

Scene in danh sách clip của `animations.fbx` ra Console và panel debug, dùng map
đã kiểm tra trực tiếp `CharacterArmature|Idle` / `CharacterArmature|Walk`,
cross-fade 0.32 giây, đồng thời cho phép đi tới Marker A/B/C. Asset runtime đặt tại `public/assets/characters/employee_001/`;
license và hướng dẫn gốc được lưu trong `docs/assets/employee_001/`.
