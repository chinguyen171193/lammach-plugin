# Thư viện tài sản và Build Mode V1

V1 chỉ nhận model `.glb`. File binary luôn ở WordPress Media Library; plugin chỉ lưu metadata và tham chiếu attachment.

## Lưu trữ

Không có migration database mới. Hai WordPress option theo site được dùng:

- `lm_ai_office_asset_library`: registry tài sản, gồm `asset_id`, attachment ID, URL, category, thumbnail, nguồn, tác giả, giấy phép, metadata và transform mặc định.
- `lm_ai_office_build_scene`: scene `office_default` với các object đặt trong văn phòng.

Khi bật tùy chọn xóa dữ liệu lúc uninstall, hai option này cũng được xóa. Xóa một asset chỉ xóa registry; tệp Media không bị xóa. Asset đang được scene sử dụng sẽ không thể xóa cho tới khi các instance liên quan bị xóa.

## REST API

Base namespace hiện có của plugin là `/wp-json/lm-ai-office/v1`.

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/assets` | Public, dùng để resolve asset khi load scene |
| GET | `/assets/{asset_id}` | Public |
| POST | `/assets` | `manage_options` + `X-WP-Nonce: wp_rest` |
| PUT/PATCH | `/assets/{asset_id}` | `manage_options` + nonce |
| DELETE | `/assets/{asset_id}` | `manage_options` + nonce |
| GET | `/scene` hoặc `/scene/current` | Public |
| PUT/PATCH | `/scene` hoặc `/scene/current` | `manage_options` + nonce |

Các mutation luôn kiểm tra capability, REST nonce, attachment từ Media Library, extension `.glb`, MIME model và toàn bộ input đã được sanitize. Client không được truyền filesystem path.

## Asset Definition

```json
{
  "id": "asset_1234abcd",
  "name": "Bàn văn phòng 01",
  "category": "TABLE",
  "model": {
    "url": "https://example.com/wp-content/uploads/desk.glb",
    "format": "glb",
    "available": true
  },
  "transformDefaults": {
    "scale": 1,
    "rotationY": 0,
    "floorOffset": 0
  },
  "license": {
    "type": "CC0",
    "author": "Quaternius",
    "sourceUrl": "https://example.com/source"
  }
}
```

`asset_id` được tạo độc lập với filename nên thay model GLB vẫn giữ identity của asset.

## Scene JSON

```json
{
  "scene_id": "office_default",
  "name": "Văn phòng",
  "objects": [
    {
      "instance_id": "obj_1234abcd",
      "asset_id": "asset_1234abcd",
      "position": { "x": 2, "y": 0, "z": 3 },
      "rotation": { "x": 0, "y": 1.5708, "z": 0 },
      "scale": { "x": 1, "y": 1, "z": 1 }
    }
  ]
}
```

Không có GLB binary hay Three.js `Object3D` được serialize vào scene.

## Luồng sử dụng

1. Mở **AI Office → Thư viện tài sản → Thêm tài sản**.
2. Chọn/tải tệp GLB trong Media Library, nhập metadata và bấm **Lưu**.
3. Dùng **Xem thử** để xoay/zoom model, xem bounding box, mesh/material/texture count. Nút **Đặt xuống sàn** cập nhật `floorOffset`; cần bấm Lưu để giữ giá trị đó.
4. Mở shortcode AI Office bằng tài khoản quản trị và bấm **Xây dựng**.
5. Chọn asset trong **Thư viện**, sau đó click floor để đặt. Chọn object để dùng các nút di chuyển, xoay 15°, nhân bản hoặc xóa.
6. Bấm **Lưu văn phòng**. Khi tải lại, Build Mode tải asset definitions + scene, resolve từng `asset_id` và áp dụng transform đã lưu.

Runtime cache GLTF theo `asset_id`; 10 instance của cùng một asset dùng một lần tải/parsing model và clone scene graph cho từng instance. Việc này không thay đổi NPC, skeleton, controller hay animation hiện có.
