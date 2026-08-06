# Lammach WordPress Plugins

Repository này quản lý nhiều plugin WordPress của Lammach. Mỗi plugin có một
thư mục cấp một riêng, với một file PHP chính chứa WordPress plugin header.

```text
repository-root/
├── dat-pcb-image-tracer/
│   └── dat-pcb-image-tracer.php
├── plugin-thu-hai/
│   └── plugin-thu-hai.php
└── plugin-thu-ba/
    └── plugin-thu-ba.php
```

Các plugin hiện có trong repository:

- `dat-pcb-image-tracer/`: PCB Image Tracer.
- `cty-1-nguoi/`: CTY 1 Người; cấu hình tại **Cài đặt → CTY 1 Người** và dùng
  shortcode `[cty_mot_nguoi]`.

Xem [DEPLOYMENT.md](DEPLOYMENT.md) trước khi triển khai lên hosting.
