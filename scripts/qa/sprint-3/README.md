# Sprint 3 — QA runners

Chỉ chạy với dữ liệu synthetic/local; không đưa connection string hoặc token của nhóm vào runner. Không push thư mục kết quả. Các runner không sửa code sản phẩm. Bộ test C# là test sẵn có của nhóm được Quang chạy lại.

## Chuẩn bị

Tại root repo: restore/build `Parking.Microservices.slnx`, cài/build frontend theo lockfile. Runner Windows dùng PostgreSQL native và Node; cung cấp đúng đường dẫn PostgreSQL bin qua `PARKING_PG_BIN`. Phiên bản18.4 đã được thử trên máy QA; baseline17 cần kiểm chứng riêng.

```powershell
npm ci --prefix scripts/qa/sprint-3 --ignore-scripts
$env:PARKING_PG_BIN = 'D:/postGREDB/bin'
```

## Test suite với database riêng

```powershell
powershell -ExecutionPolicy Bypass -File scripts/qa/sprint-3/Run-IsolatedTests.ps1 -IncludeIdentityHttp
```

Runner tạo cluster mới ở `artifacts/qa/sprint-3`, bind loopback55484, tự dừng trong finally. Test tạo/drop database tạm riêng. `-IncludeIdentityHttp` bật ca Identity host thật; không bỏ cờ chỉ để che failure. Không có cờ thì ca thiếu host có thể SKIP, không phải PASS. Build trước vì runner dùng `--no-build --no-restore`. Không chạy đồng thời nhiều instance trên cùng port.

## Demo API thật đến check-in

```powershell
node scripts/qa/sprint-3/run-real-api-demo.cjs
```

Tạo bốn DB riêng, năm .NET host và hai bãi fixture; CASH thật trên DB test → outbox/inbox → Confirmed → QR → check-in. Không inject PaymentSucceeded. Nếu Gateway404, ghi rõ bypass sang Parking trực tiếp; nếu Gateway200, kiểm DB effect sau đường Gateway. Assert đúng một active session/assignment. Script kiểm port trống trước khi chạy, tự dừng host/cluster khi kết thúc hoặc lỗi; không dùng trong DB có dữ liệu thật.

Port mặc định:55486 (PG; đổi bằng QA_PG_PORT),5041/5042/7023 (Identity hiện hard-code),56500 (Gateway),56521/22,56531/32,56541/42. Identity cần developer certificate hiện có; nếu thiếu thì báo môi trường chưa sẵn sàng, không bypass cảnh báo bảo mật. Secret sinh ngẫu nhiên, không in token/QR/password. Node driver phụ thuộc `pg` có lockfile trong thư mục này.

Identity, Payment và AI có thể ghi log cấu hình/nghiệp vụ; log gốc chỉ lưu local và phải kiểm tra/redact trước khi chia sẻ. Không tự push raw logs.

## Browser smoke

Dùng Python environment riêng, cài `requirements-browser.txt`. Cài browser Playwright hoặc chỉ định browser hiện có qua `QA_BROWSER_EXECUTABLE`. Frontend chạy ở loopback5178; có thể đặt `QA_BASE_URL` khác nhưng vẫn phải loopback.

```powershell
python -m pip install -r scripts/qa/sprint-3/requirements-browser.txt
python -m playwright install chromium
# Terminal khác: npm run dev --prefix frontend_parking_system -- --host 127.0.0.1 --port 5178 --strictPort
python scripts/qa/sprint-3/browser-smoke.py
```

Video là tùy chọn `QA_RECORD_VIDEO=1`, cần FFmpeg của Playwright. Kết quả chỉ chứng minh rendering, route redirect và layout; không khẳng định API/3D realtime/checkout đã hoạt động. Không thêm API mocks để làm kết quả sản phẩm xanh.

## Postman

Import collection/environment ở `postman/sprint-3`. Environment chia sẻ để trống password/token/QR/ID; điền fixture tại máy, không export lại secrets. Collection13 requests mới chỉ chuẩn bị, chưa chạy nguyên collection. Chờ Confirmed trước cấp QR. Không tự tạo endpoint checkout chưa được owner chốt; concurrency và DB assertions phải chạy harness riêng.


