BEGIN;

-- Bãi C: Bị Đóng Cửa (CLOSED) - Chắc chắn phải bị API Search loại bỏ
INSERT INTO parking_lots(id,code,name,address,latitude,longitude,timezone,status,created_at,updated_at) VALUES
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','DEMO-C','Bãi demo C (Closed)','Địa chỉ C',10.800,106.720,'Asia/Ho_Chi_Minh','CLOSED',now(),now());

-- Bãi D: Đang Bảo Trì (MAINTENANCE) - Chắc chắn phải bị API Search loại bỏ
INSERT INTO parking_lots(id,code,name,address,latitude,longitude,timezone,status,created_at,updated_at) VALUES
 ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','DEMO-D','Bãi demo D (Maintenance)','Địa chỉ D',10.810,106.730,'Asia/Ho_Chi_Minh','MAINTENANCE',now(),now());

COMMIT;
