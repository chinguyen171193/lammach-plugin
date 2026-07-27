# API footprint EasyEDA/LCSC

Ket qua spike ngay 2026-07-27. Moi so lieu duoi day deu da goi that va doi chieu
voi datasheet, khong phai suy doan.

## Bat buoc: header trinh duyet

Goi tran khong header -> CloudFront tra **403 Request blocked**. Them ba header
nay thi 200:

```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...
Referer:    https://easyeda.com/editor
Origin:     https://easyeda.com
```

## 1. Tra footprint theo ma LCSC

```
GET https://easyeda.com/api/products/{LCSC}/components?version=6.5.21
```

Footprint nam o `result.packageDetail.dataStr`:

- `head.x`, `head.y` - goc toa do cua package (tru di de dua ve tam).
- `shape[]` - mang chuoi, moi phan tu la mot doi tuong, cac truong cach nhau bang `~`.
- `layers[]` - bang ten lop.

Da thu 10 ma phu du ho package, **10/10 tra duoc**.

## 2. Tra ma LCSC theo ten linh kien

```
GET https://easyeda.com/api/eda/product/search?version=6.5.21&keyword={tu khoa}
```

Tham so phai la `keyword`. Dung `wd` thi tra ve `resultCode 0004`.

Moi phan tu `result.productList[]` co: `number` (ma LCSC), `mpn`, `package`,
`manufacturer`, `stock`, `price`.

**Gioi han quan trong:** day la tim kiem khop chuoi, khong hieu y nguoi dung.

| Tu khoa | Ket qua dau |
|---|---|
| `STM32F103C8T6` | C8734 STM32F103C8T6 LQFP-48 - dung |
| `ESP32-WROOM-32` | C529582 ESP32-WROOM-32-N8 - dung |
| `10k 0603 resistor` | dien tro cong suat 10W xuyen lo - **sai** |
| `tu 100nF 0805` | MOSFET STP100NF04 TO-220 - **sai** |

=> AI phai phan giai mo ta tieng Viet thanh MPN chinh xac TRUOC khi goi API nay.
API khong thay the duoc buoc do.

## 3. Don vi

**1 don vi = 10 mil = 0.254 mm.** Da kiem chung bang buoc chan:

| Ma | Package | Buoc chan tinh duoc | Datasheet |
|---|---|---|---|
| C8734 | LQFP-48 | 0.4999 mm | 0.5 |
| C2040 | LQFN-56 (RP2040) | 0.3998 mm | 0.4 |
| C7420 | SOT-23-5 | 0.9500 mm | 0.95 |
| C6186 | SOT-223 | 2.3000 mm | 2.3 |
| C111887 | TO-220-3 | 2.5400 mm | 2.54 |
| C165948 | USB-C 16P | 0.4996 mm | 0.5 |

## 4. Dinh dang PAD

```
PAD~shape~x~y~width~height~layerId~net~number~holeRadius~points~rotation~gId~holeLength~holePoint~plated
  0    1   2 3    4      5      6     7     8       9        10      11    12       13         14      15
```

- `shape`: `RECT`, `OVAL`, `ELLIPSE`, `POLYGON`.
- `number` **co the khong phai so** - USB-C dung `A1`, `B8`.
- `holeRadius` > 0 = chan xuyen lo; `layerId` khi do la `11` (Multi-Layer).
- `points` chi dung cho `POLYGON`.
- Pad tan nhiet (thermal/exposed pad) chi la **mot PAD RECT to binh thuong** -
  RP2040 co 57 pad, pad 57 la 3.1 x 3.1 mm. Khong can xu ly rieng.

Cac shape khac gap trong footprint: `TRACK` (silk), `SOLIDREGION` (vung dac,
dung cho paste va hinh than), `CIRCLE`, `ARC`, `HOLE` (lo khong phu dong),
`SVGNODE` (model 3D - bo qua).

## 5. Bang lop

| id | Ten |
|---|---|
| 1 / 2 | TopLayer / BottomLayer (dong) |
| 3 / 4 | TopSilkLayer / BottomSilkLayer |
| 5 / 6 | TopPasteMaskLayer / BottomPasteMaskLayer |
| 7 / 8 | TopSolderMaskLayer / BottomSolderMaskLayer |
| 10 | BoardOutLine |
| 11 | Multi-Layer (chan xuyen lo) |
| 12 / 13 | Document / TopAssembly |
| 19 | 3DModel |
| 99 / 100 / 101 | ComponentShape / LeadShape / ComponentPolarity |

## 6. Khoang trong cua editor hien tai

Doi chieu voi data model trong `data-format.md`:

| EasyEDA co | Editor co | Can lam |
|---|---|---|
| Pad RECT / OVAL / ELLIPSE | round / rect / oval | map thang |
| **Pad POLYGON** (USB-C) | khong | them shape polygon vao pad + renderer + Gerber |
| Mask rieng tung pad | co dinh 0.1mm toan cuc | them `mask` vao geometry pad |
| **Paste layer** | khong co | them GTP/GBP vao `LayerMapper.js` |
| HOLE khong phu dong | layer `drill` | map sang drill |
| Pad tan nhiet | dung duoc ngay | khong can gi |

## 7. Rui ro

API khong co tai lieu chinh thuc va khong cam ket on dinh. Bat buoc giu bac 3
(tim datasheet PDF) va bac 4 (AI tu dien) lam phao. Can doc dieu khoan su dung
cua LCSC/EasyEDA truoc khi chay o quy mo lon, va cache lai moi ket qua de khong
goi lap.
