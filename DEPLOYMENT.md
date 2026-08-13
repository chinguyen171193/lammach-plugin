# Triển khai plugin WordPress

## Thư mục đích

Hostinger triển khai toàn bộ repository này vào:

```text
public_html/wp-content/plugins
```

Mỗi thư mục cấp một của repository là một plugin WordPress riêng. Ví dụ:

```text
public_html/wp-content/plugins/
├── lm-pcb-image-tracer/
│   └── lm-pcb-image-tracer.php
└── cty-1-nguoi/
    └── cty-1-nguoi.php
```

Không đặt file PHP chính của plugin trực tiếp ở thư mục gốc repository, vì nó
sẽ bị triển khai trực tiếp vào `wp-content/plugins` thay vì thư mục plugin
riêng.

Không đưa WooCommerce, Elementor hoặc bất kỳ plugin bên thứ ba nào vào
repository này. Các plugin đó cần được cài đặt và cập nhật độc lập bằng
WordPress hoặc nguồn chính thức của chúng.

## Trước lần triển khai đầu tiên

Sao lưu toàn bộ `wp-content/plugins` trước khi triển khai lần đầu. Việc deploy
vào thư mục này có thể thay đổi các file plugin hiện hữu trên hosting.

Sau khi deploy, vào **WordPress → Plugins** để xác nhận từng plugin được nhận
đúng trước khi kích hoạt hoặc cập nhật plugin.
