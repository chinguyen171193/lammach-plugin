# Lammach WordPress Plugins

Repository này quản lý nhiều plugin WordPress của Lammach. Mỗi plugin có một
thư mục cấp một riêng, với một file PHP chính chứa WordPress plugin header.

```text
repository-root/
├── lm-pcb-image-tracer/
│   └── lm-pcb-image-tracer.php
├── plugin-thu-hai/
│   └── plugin-thu-hai.php
└── plugin-thu-ba/
    └── plugin-thu-ba.php
```

Các plugin hiện có trong repository:

- `lm-pcb-image-tracer/`: PCB Image Tracer.
- `cty-1-nguoi/`: CTY 1 Người; cấu hình tại **Cài đặt → CTY 1 Người** và dùng
  shortcode `[cty_mot_nguoi]`.

Xem [DEPLOYMENT.md](DEPLOYMENT.md) trước khi triển khai lên hosting.
