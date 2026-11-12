# Kiểm tra cấu trúc

- 42 bảng, 82 Ref, 5 TableGroup; mỗi bảng thuộc đúng một group.
- Đã kiểm tra tất cả đầu mút Ref: bảng/cột tồn tại, số cột hai vế khớp.
- Đã loại Ref tới 12 bảng hoãn và hai cột vé tháng liên quan.
- Đã thêm FK từ slot đến zone cùng tầng và từ map object đến slot cùng tầng.
- Đây là kiểm tra cấu trúc bằng script, chưa phải xác nhận parse bằng công cụ DBML hay chạy PostgreSQL.
- Chưa có SQL V2 để kiểm tra CHECK/EXCLUDE/trigger; các yêu cầu còn lại được liệt kê rõ trong V3_REVIEW.md.
