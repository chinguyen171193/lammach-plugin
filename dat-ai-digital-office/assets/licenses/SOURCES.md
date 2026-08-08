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
- File tham khảo, không được tải trong runtime hiện tại: `Unreal-Godot/UAL1_Standard.glb`
- File trong plugin: `assets/agents/supervisor-ai/3d/UAL1_Standard.glb`
- Nguồn: <https://quaternius.com/packs/universalanimationlibrary.html>
- Giấy phép: CC0 1.0 Universal

Các clip đã được kiểm tra trực tiếp trong GLB: `Idle_Loop`, `Walk_Loop`, `Sitting_Enter`, `Sitting_Idle_Loop`, `Sitting_Exit`. Danh sách đủ 43 clip nằm trong `UAL1-STANDARD-ANIMATIONS.txt`. File được giữ để nghiên cứu nhưng không còn được frontend tải hoặc retarget vào Suit.

## NPC employee_001 (FBX test scene)

- Pack: **Ultimate Modular Men Pack**
- Tác giả: **Quaternius**
- Runtime files: `public/assets/characters/employee_001/employee_001.fbx` và `animations.fbx`
- Nguồn: asset gốc `employee_001_quaternius_min.zip`
- Giấy phép: CC0 1.0 Universal; bản gốc được lưu tại `docs/assets/employee_001/License.txt`
- Cấu hình animation đã kiểm tra trực tiếp: `CharacterArmature|Idle` và `CharacterArmature|Walk`

## Three.js

- Thư viện runtime: Three.js r128 và addon `GLTFLoader`
- Nguồn: <https://github.com/mrdoob/three.js>
- Ví dụ tham khảo: <https://threejs.org/examples/#webgl_animation_skinning_blending>
- Giấy phép: MIT, xem `public/js/vendor/three.LICENSE.txt`

Tất cả file được đóng gói cục bộ trong plugin; frontend không tải asset từ CDN.

## fflate

- Thư viện giải nén runtime cho FBX binary nén: `public/js/vendor/fflate.min.js` (0.6.10)
- Nguồn: <https://github.com/101arrowz/fflate>
- Giấy phép: MIT, xem `assets/licenses/fflate-MIT-LICENSE.txt`

## Ready Player Me Face Preview

- Model kỹ thuật: `assets/agents/supervisor-ai/3d/ready-player-me-face-prototype.glb`
- Nguồn: Ready Player Me Visage official example `public/male.glb`
- Mục đích: chỉ dùng cho Face Preview trong trang quản trị; không thay Suit hoặc animation cơ thể
- Giấy phép và giới hạn sử dụng: xem `READY-PLAYER-ME-FACE-PROTOTYPE-LICENSE.md`

Model nam đã được kiểm tra trực tiếp: 18.391 triangles, texture tối đa 2048 px, 67 joints, 72 morph targets và không có clip animation cơ thể nhúng sẵn. Vì vậy plugin không retarget animation Suit/UAL vào model này. Facewear và headwear của sample được ẩn trong Face Preview để không che khuôn mặt.

- Texture khuôn mặt DAT Supervisor: `assets/agents/supervisor-ai/3d/textures/supervisor-face-v1.png`
- Nguồn: texture gốc của model Ready Player Me Visage, được vẽ lại bằng AI cho prototype DAT Supervisor.
- Mục đích: chỉ thay material `Wolf3D_Head` trong Face Preview; GLB gốc không bị sửa.
