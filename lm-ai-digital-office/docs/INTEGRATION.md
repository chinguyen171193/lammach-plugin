# Tích hợp sự kiện

Plugin lắng nghe hook `lm_ai_office_event`. Plugin khác có thể gửi sự kiện:

```php
do_action(
    'lm_ai_office_event',
    array(
        'type'       => 'new_pcb_order',
        'title'      => 'Có đơn PCB mới',
        'department' => 'sales',
        'source'     => 'gerber_plugin',
        'object_id'  => 123,
        'priority'   => 'high',
        'message'    => 'Khách hàng vừa gửi file Gerber.',
    )
);
```

Các loại mặc định: `new_customer`, `new_pcb_order`, `new_pcba_order`, `new_gerber`, `gerber_checked`, `bom_created`, `bom_checked`, `quote_created`, `quote_approved`, `production_created`, `production_started`, `production_completed`, `qc_passed`, `qc_failed`, `packing_started`, `shipment_created`, `shipment_completed`, `warranty_created`, `warranty_completed`, `zalo_notification_sent`.

REST API công khai: `GET /wp-json/lm-ai-office/v1/status`, `/departments`, `/agents`, `/workflows`, `/events`.

REST API ghi: `POST /tasks`, `POST /events`; yêu cầu WordPress login, `manage_options` và REST nonce. Chế độ kết nối dữ liệu thật có thể dùng webhook/hook trước; REST polling/WebSocket được thiết kế để mở rộng ở lớp frontend.
