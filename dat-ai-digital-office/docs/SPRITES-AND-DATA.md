# Thay sprite và kết nối dữ liệu thật

Phiên bản 1.0 tạo nhân vật bằng PixiJS `Graphics`, không dùng emoji và không phụ thuộc asset ngoài. Điểm thay thế sprite nằm trong `public/js/office-agents.js`: thay `humanGraphic()` hoặc `aiGraphic()` bằng `PIXI.Sprite`/`PIXI.AnimatedSprite` từ sprite sheet cục bộ trong `public/sprites/`.

Để kết nối dữ liệu thật, gửi hook `dat_ai_office_event` khi đơn hàng, Gerber, BOM, sản xuất hay QC thay đổi. Frontend gọi REST chỉ để đọc dữ liệu an toàn; không đưa API key, thông tin khách hàng hoặc dữ liệu nhạy cảm vào endpoint công khai.
