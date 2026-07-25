# Tich hop tuong lai voi Gerber renderer cu

Plugin `PCB Image Tracer` doc lap voi `pcb-gerber-analyzer-v2`.

## Nguyen tac tuong thich

- Prefix PHP: `DAT_PCB_TRACER_`, `DAT_PCB_`, `dat_pcb_tracer_`.
- CPT rieng: `dat_pcb_project`.
- Meta rieng: `_dat_pcb_tracer_*`.
- REST namespace rieng: `dat-pcb-tracer/v1`.
- Khong dung option/action/shortcode/handle asset cua plugin Gerber cu.
- Asset chi enqueue trong trang admin DAT PCB Tracer.

## Mapping JSON sang render data cu

Renderer Gerber cu mong doi data gan voi:

- `outline`: diem `[x, y, drawFromPrev]`.
- `top.tracks`, `bottom.tracks`: segment `[x1, y1, x2, y2, width]`.
- `top.pads`, `bottom.pads`: pad `[shape, x, y, sx, sy, ...]`.
- `drills`: `[x, y, diameter, plated]`.
- `top.regions`, `bottom.regions`: polygon list.

Co the chuyen `objects` cua plugin moi nhu sau:

- `track` tren `top_copper` -> `top.tracks`.
- `track` tren `bottom_copper` -> `bottom.tracks`.
- `pad` shape `round` -> pad cu shape `C`.
- `pad` shape `rect` -> pad cu shape `R`.
- `pad` shape `oval` -> pad cu shape `O`.
- `via` -> them pad top/bottom va them drill.
- `drill` -> `drills`.
- `outline` -> `outline`.
- `region` -> `top.regions` hoac `bottom.regions`.
- `annotation` khong chuyen sang du lieu dong/Gerber.

## Luu y

- Du lieu tracing anh khong du de xuat Gerber san xuat trong giai doan 1.
- Can buoc net inference/DRC rieng truoc khi tao Gerber.
- Neu sau nay dung Three.js tu plugin cu, nen bundle vendor local rieng trong plugin moi va giu try/catch khi load module.
- Khong nen include truc tiep `pcb-gerber-analyzer-v2.php` vi file do dang gan voi upload, shortcode, pricing va global class cua plugin cu.
