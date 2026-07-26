# Data format PCB Image Tracer 1.0

Du lieu du an luu trong post meta `_dat_pcb_tracer_project_json` cua CPT `dat_pcb_project`.

## Root

```json
{
  "version": "1.0",
  "project": {},
  "board": {},
  "images": {},
  "layers": {},
  "components": [],
  "objects": []
}
```

## project

- `name`: ten du an, text da sanitize.
- `code`: ma du an, sanitize key de tim kiem.
- `created_at`: thoi gian tao.
- `updated_at`: thoi gian cap nhat.

## board

- `width_mm`: chieu rong bo theo mm.
- `height_mm`: chieu cao bo theo mm.
- `origin_x`, `origin_y`: goc toa do de mo rong ve sau.
- `grid_mm`: kich thuoc grid, mac dinh `0.5`.

Tat ca kich thuoc hinh hoc luu theo mm, khong luu pixel man hinh.

## images

Co hai key `top` va `bottom`.

- `attachment_id`: ID anh trong WordPress Media Library.
- `url`: URL anh de preview.
- `visible`: hien/ẩn.
- `locked`: khoa keo nham.
- `opacity`: 0 den 1.
- `x`, `y`: vi tri theo toa do mm cua board/editor.
- `scale_x`, `scale_y`: ty le hien thi anh.
- `rotation`: do.
- `flip_x`, `flip_y`: lat anh.
- `calibration`: metadata hai diem A/B va khoang cach that.
- `transform`: cho ma tran/transform nang cao trong tuong lai.

Khong luu base64 anh trong JSON.

## layers

Layer mac dinh:

- `background_top`
- `background_bottom`
- `outline`
- `top_copper`
- `bottom_copper`
- `drill`
- `annotation`

Moi layer co:

- `name`
- `visible`
- `locked`
- `opacity`
- `color`

So luong doi tuong duoc tinh runtime tu `objects`.

## components

Danh sach linh kien logic. Moi linh kien gom ref/value/package/side/rotation va danh sach pin tro ve object pad/via con.
Object con van nam trong `objects` de renderer/exporter hien co dung duoc, va mang `geometry.component_id`.

## objects

Moi object:

```json
{
  "id": "obj_xxx",
  "type": "track|pad|via|drill|outline|region|annotation",
  "layer": "top_copper",
  "geometry": {},
  "style": {},
  "locked": false,
  "visible": true,
  "note": ""
}
```

### track

```json
{
  "geometry": { "x1": 0, "y1": 0, "x2": 10, "y2": 0, "width": 0.4, "bow": 0 }
}
```

- `bow`: do cong tuong doi so voi nua day cung (chord). `0` la duong thang. Khac 0 se ve/tao mot cung tron di qua hai dau mut, khong doi khi track duoc di chuyen/xoay (mirror se tu dong dao chieu cong dung). Xuat Gerber xap xi cung tron bang cac doan thang ngan.

### pad

Pad tron:

```json
{
  "geometry": { "shape": "round", "x": 10, "y": 10, "diameter": 1.6, "drill": 0, "side": "top" }
}
```

Pad chu nhat/oval:

```json
{
  "geometry": { "shape": "rect|oval", "x": 10, "y": 10, "width": 2, "height": 1, "rotation": 0, "drill": 0 }
}
```

Pad bo goc (rounded rectangle):

```json
{
  "geometry": { "shape": "roundrect", "x": 10, "y": 10, "width": 2, "height": 1.4, "radius": 0.3, "rotation": 0, "drill": 0 }
}
```

Xuat Gerber xap xi pad bo goc bang aperture chu nhat thuong (khong ma hoa ban kinh goc), co canh bao trong bao cao xuat.

### via

```json
{
  "geometry": { "x": 10, "y": 10, "diameter": 1.2, "drill": 0.6 }
}
```

### drill

```json
{
  "geometry": { "x": 10, "y": 10, "diameter": 0.8, "plated": false }
}
```

### outline va region

```json
{
  "geometry": { "points": [{ "x": 0, "y": 0 }, { "x": 10, "y": 0 }], "closed": true }
}
```

### annotation

```json
{
  "geometry": { "x": 5, "y": 5, "text": "Ghi chu", "size": 2.5 }
}
```

## Import security

- Chi chap nhan `version` 1.0.
- Gioi han kich thuoc JSON 2 MB trong REST import.
- Loai key khong nam trong schema khi sanitize.
- Text chay qua sanitize text/textarea.
- Khong thuc thi HTML/script.
