# Nguồn asset và thư viện của prototype 3D

## Nhân vật

- Pack: **Ultimate Modular Men Pack**
- Tác giả: **Quaternius**
- Model dùng trong prototype: `Individual Characters/glTF/Suit.gltf`
- File trong plugin: `assets/agents/supervisor-ai/3d/Suit.gltf`
- Nguồn: <https://quaternius.com/packs/ultimatemodularcharacters.html>
- Giấy phép: CC0 1.0 Universal

Model có 5 node gắn skin (Three.js tách thành 13 `SkinnedMesh` theo primitive), một skeleton `CharacterArmature` với 62 joints. Mesh phụ kiện `Pistol` bị ẩn khi render prototype.

## Animation

- Pack: **Universal Animation Library**
- Tác giả: **Quaternius**
- File dùng trong prototype: `Unreal-Godot/UAL1_Standard.glb`
- File trong plugin: `assets/agents/supervisor-ai/3d/UAL1_Standard.glb`
- Nguồn: <https://quaternius.com/packs/universalanimationlibrary.html>
- Giấy phép: CC0 1.0 Universal

Các clip prototype đã được kiểm tra trực tiếp trong GLB: `Idle_Loop`, `Walk_Loop`, `Sitting_Enter`, `Sitting_Idle_Loop`, `Sitting_Exit`. Danh sách đủ 43 clip nằm trong `UAL1-STANDARD-ANIMATIONS.txt`. Pack này không có clip tên `typing` hoặc `using_mouse`.

## Three.js

- Thư viện: Three.js r128 và các addon `GLTFLoader`, `SkeletonUtils`
- Nguồn: <https://github.com/mrdoob/three.js>
- Ví dụ tham khảo: <https://threejs.org/examples/#webgl_animation_skinning_blending>
- Giấy phép: MIT, xem `public/js/vendor/three.LICENSE.txt`

Tất cả file được đóng gói cục bộ trong plugin; frontend không tải asset từ CDN.
