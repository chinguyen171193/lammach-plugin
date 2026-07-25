# Phan tich nguon pcb-gerber-analyzer-v2

## File va cau truc chinh

- File plugin chinh: `pcb-gerber-analyzer-v2/pcb-gerber-analyzer-v2.php`.
- Class chinh: `PCB_Gerber_Analyzer_V2`.
- Plugin cu gom nhieu chuc nang trong mot file PHP lon: shortcode frontend, upload Gerber, tinh gia, admin setting, parser Gerber/Excellon va tao render data.
- Asset 2D/3D rieng nam trong `assets/js`: `renderer_v2.js`, `viewer.js`, `pcb3d_geometry.js`, `pcb3d_viewer.js`.

## Parser Gerber va Excellon

- Parser Gerber nam trong cac method PHP:
  - `analyze_outline()`
  - `parse_copper_tracks_and_pads()`
  - `parse_silkscreen()`
  - `gerber_coord_to_mm()`
- Parser Excellon/drill nam trong:
  - `find_drill_files()`
  - `parse_drill_file()`
  - `excellon_coord_to_mm()`
- He toa do duoc chuan hoa ve mm bang `unit_factor_mm`, ho tro `MOIN`, `MOMM`, format va zero suppression.

## Cau truc du lieu hinh hoc

Plugin cu dung cac cau truc render sau:

- `outline`: danh sach diem `[x, y, drawFromPrev]`.
- `tracks`/`segments`: `[x1, y1, x2, y2, width]`.
- `pads`: `[shape, x, y, sx, sy, ...]`.
- `drills`: `[x, y, diameter, plated/type...]`.
- `regions`: polygon danh sach diem.
- `layers`: danh sach layer co `key`, `side`, `color`, `segments`, `pads`, `regions`, clear geometry.

## Canvas 2D

- `renderer_v2.js` co renderer layer theo Canvas.
- Y tuong quan trong:
  - tinh bounds toan cuc;
  - projector world mm sang canvas pixel;
  - mirror mat bottom;
  - ve segments, pads, regions, drills, outline theo layer;
  - tach layer logic va opacity.
- `viewer.js` tao canvas stack, layer toggles va ket noi data render tu shortcode.

## 3D

- `pcb3d_geometry.js` chua ham geometry polygon/outline, split contour, point-in-polygon.
- `pcb3d_viewer.js` dung Three.js local trong `assets/vendor/three`.
- Three.js co the tach ra neu can, nhung giai doan 1 cua plugin moi dung preview fallback Canvas 2.5D de tranh phu thuoc runtime va tranh loi editor.

## Phan duoc tai su dung

- Tai su dung y tuong, khong copy truc tiep:
  - he toa do PCB theo mm;
  - projector mm sang pixel;
  - layer color/opacity/visibility;
  - geometry track, pad, drill, outline, region;
  - ve Canvas theo requestAnimationFrame;
  - bounds/fit board.

## Phan viet lai

- Toan bo plugin WordPress moi: bootstrap, CPT, REST, upload, admin UI.
- Editor Canvas thao tac truc tiep tren anh nen.
- Data model JSON cho tracing thu cong.
- Undo/redo, autosave, import/export JSON.
- Calibration anh bang hai diem.
- Preview 3D fallback.

## Phan khong phu thuoc truc tiep vao plugin cu

- Khong include file PHP cua `pcb-gerber-analyzer-v2`.
- Khong dung class `PCB_Gerber_Analyzer_V2`.
- Khong dung option, ajax action, shortcode, DB/meta cua plugin cu.
- Khong enqueue JS/CSS cua plugin cu tren trang DAT PCB Tracer.
- Khong sua file, bang DB hay setting cua plugin cu.

## Rui ro neu copy code cu

- Plugin cu co class/function/handle rieng, copy truc tiep de gay trung ten khi hai plugin cung kich hoat.
- Parser Gerber cu lon va gan voi upload/shortcode/tinh gia, khong phu hop editor tracing anh.
- Asset 3D can module import va Three.js; neu copy thieu vendor se lam hong editor.
- Data render cu toi uu cho Gerber da parse, khong phai data nguoi dung ve thu cong.
- Mot so comment/encoding trong file cu bi mojibake, nen khong nen copy UI string.
