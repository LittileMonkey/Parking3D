# SCRUM-80 — Postman scripts and source files

Collection gồm 8 request kiểm tra API cấu trúc nhiều bãi, tọa độ 3D, dữ liệu giữa các bãi và lỗi 404. Script JavaScript chạy sau khi Postman nhận response và tạo các assertion trong Test Results.

## Import and run

Import hai file sau và chọn environment **Han - SCRUM-80 Local**.

- [Han-Scrum80.postman_collection.json](../../postman/Han-Scrum80.postman_collection.json)
- [Han-Scrum80-Local.postman_environment.json](../../postman/Han-Scrum80-Local.postman_environment.json)

Giữ baseUrl là `http://localhost:8080` khi dùng Docker Gateway. Để trống lotId/otherLotId nếu muốn request 01 tự chọn hai bãi. Chạy 01 đến 08 theo thứ tự, một iteration, delay 100 ms.

## Shared collection script

Mở collection → Scripts → Post-response để đọc phần dùng chung.

- Mọi response đều được kiểm tra Content-Type JSON và envelope `result`, `isSuccess`, `statusCode`, `message`.
- Response thành công phải có isSuccess=true. Response 404 phải có isSuccess=false và result=null.
- Mọi response layout HTTP 200 được kiểm tra lotId trùng ID trên URL, có code/name và có cây levels → zones → slots.
- ID tầng/khu/ô phải duy nhất trong cây. Elevation, tọa độ, góc xoay và kích thước có dữ liệu phải là số.
- Mỗi layout phải có ít nhất một ô. Khi requirePublishedCoordinates=true, phải có ít nhất một ô có đủ position, rotationY và size. Bản đồ PUBLISHED được chọn trong truy vấn repository.
- Danh sách ID của layout vừa nhận được lưu vào scrum80_currentIds để request 03/05 sử dụng. Cách này gom phần duyệt cây vào một chỗ.

Các kiểm tra chung chạy thêm vào script riêng của từng request. Việc rút gọn chuyển phần layout lặp bốn lần sang collection. Tổng số dòng script giảm từ 259 xuống 113.

## The eight request scripts

| Request | Script làm gì | Ý nghĩa khi trình bày với mentor |
| --- | --- | --- |
| 01 - Select Two Parking Lots | Lấy result là danh sách bãi. Ưu tiên ID đã nhập trong environment, nếu để trống thì chọn DEMO-Q1 hoặc bãi đầu tiên. Chọn bãi thứ hai khác bãi đầu. Lưu lotId/otherLotId và xóa snapshot lần chạy cũ. | Tự chuẩn bị hai bãi có thật để kiểm tra Multi-Parking. |
| 02 - Get Parking Lot Details | Kiểm tra HTTP 200, ID đúng, code/name/address/timezone/status là chuỗi và latitude/longitude là số. | API trả đúng thông tin bãi theo ID. |
| 03 - Get 3D Layout and Save Baseline | Script chung kiểm tra cây layout. Script riêng lưu toàn bộ result vào scrum80_primaryLayout và ID tầng/khu/ô vào scrum80_primaryIds. | Lưu dữ liệu chuẩn để so sánh các lần gọi tiếp theo. |
| 04 - Repeat Layout and Check Response Time | Gọi lại layout và dùng deep.equal so sánh với snapshot 03. Ghi responseTime ra Console. Nếu checkPerformance=true, kiểm tra responseTime nhỏ hơn maxWarmResponseMs. | Kiểm tra dữ liệu lặp ổn định và thời gian HTTP sau khi đã gọi layout trước đó. |
| 05 - Check Cross-Lot Data Isolation | Gọi bãi thứ hai. So sánh ID của bãi này với Set ID đã lưu của bãi đầu. Không ID nào được xuất hiện ở cả hai bãi. | Phát hiện dữ liệu hoặc cache bị trộn giữa hai bãi. |
| 06 - Return to the Primary Parking Lot | Gọi lại bãi đầu sau khi đã gọi bãi thứ hai. So sánh toàn bộ result với snapshot 03. | Kiểm tra việc đổi bãi giữ đúng dữ liệu theo lotId. |
| 07 - Get a Nonexistent Parking Lot | Dùng {{$guid}} tạo UUID ngẫu nhiên và yêu cầu HTTP 404. Script chung kiểm tra envelope lỗi. | UUID có định dạng hợp lệ nhưng không có bãi tương ứng được xử lý đúng. |
| 08 - Get a Nonexistent Layout | Dùng UUID ngẫu nhiên cho endpoint layout và yêu cầu HTTP 404. | Endpoint layout xử lý đúng bãi không tồn tại. |

Các assertion ở request 07/08 phải PASS khi HTTP trả 404. UUID ngẫu nhiên có xác suất trùng dữ liệu hiện có rất nhỏ.

## JavaScript used in the scripts

| Cú pháp/API | Cách hiểu |
| --- | --- |
| pm.test("Name", function () { ... }) | Đặt tên một nhóm kiểm tra. Assertion sai làm nhóm này FAIL. |
| pm.response.json() | Chuyển response JSON thành object JavaScript để đọc trường dữ liệu. |
| pm.expect(value).to.equal(expected) | Kiểm tra hai giá trị bằng nhau. |
| to.be.a("number") / to.be.an("array") | Kiểm tra kiểu dữ liệu. |
| to.deep.equal(object) | So sánh nội dung toàn bộ object và mảng, gồm các trường con. |
| pm.environment.get/set | Đọc/lưu biến environment. Các biến này được thay vào URL như {{lotId}}. |
| pm.collectionVariables.get/set | Đọc/lưu dữ liệu kiểm thử trong collection, ví dụ snapshot layout. |
| pm.variables.get | Đọc giá trị có hiệu lực theo phạm vi biến của Postman. |
| JSON.stringify / JSON.parse | Chuyển object thành chuỗi để lưu vào biến và chuyển chuỗi lại thành object để so sánh. |
| find | Tìm phần tử đầu tiên thỏa điều kiện, ví dụ bãi có ID được chọn. |
| map | Lấy một giá trị từ mỗi phần tử, ví dụ danh sách ID. |
| flatMap | Gom mảng con thành một mảng chung, ví dụ gom zones từ tất cả levels. |
| forEach | Duyệt từng phần tử để kiểm tra. |
| some | Kiểm tra có ít nhất một phần tử thỏa điều kiện. |
| Set | Giữ các giá trị duy nhất. Nếu số phần tử Set bằng số ID ban đầu thì các ID không trùng. |
| condition ? a : b | Chọn a khi điều kiện đúng, chọn b khi điều kiện sai. |
| primary?.id | Đọc id khi primary tồn tại. |
| pm.response.responseTime | Thời gian HTTP do Postman đo, tính bằng mili giây. |

Ví dụ request 03 lưu snapshot.

```javascript
pm.collectionVariables.set(
    "scrum80_primaryLayout",
    JSON.stringify(pm.response.json().result)
);
```

Request 04 đọc snapshot và đối chiếu dữ liệu mới.

```javascript
const saved = pm.collectionVariables.get("scrum80_primaryLayout");
pm.expect(pm.response.json().result).to.deep.equal(JSON.parse(saved));
```

Bạn có thể trình bày rằng request 03 lấy dữ liệu chuẩn, còn request 04 kiểm tra lần gọi tiếp theo có trả cùng cấu trúc hay không. Request 05/06 bổ sung việc chuyển qua lại giữa hai bãi để kiểm tra khóa cache theo lotId.

## Redis and response time

Request 04 so sánh response và có tùy chọn kiểm tra một mẫu thời gian HTTP. Để xác nhận Redis đang lưu key, kiểm tra TTL trên đúng Redis instance và prefix. Khi BE thiếu cấu hình Redis, ParkingCachingExtensions chọn MemoryDistributedCache.

Sau request 01, copy lotId vào PowerShell ở thư mục gốc repo.

```powershell
$lotId = 'PASTE_LOT_ID_HERE'
$cacheKey = "parking:lot_layout_$lotId"
docker compose -f compose.microservices.yml exec -T redis redis-cli TTL $cacheKey
```

Key vừa được tạo có TTL gần 43200 giây, tương đương 12 giờ. TTL giảm dần theo thời gian. -2 nghĩa là key không tồn tại, -1 nghĩa là key thiếu thời gian hết hạn.

Để quan sát cache miss/hit, có thể xóa riêng key demo rồi gọi request 03 và 04. CACHE SET ở mức log Information, CACHE HIT ở mức Debug. Cũng có thể đặt breakpoint tại lời gọi repository.GetLotLayout3DAsync trong handler để thấy lần cache hit bỏ qua truy vấn DB.

```powershell
docker compose -f compose.microservices.yml exec -T redis redis-cli DEL $cacheKey
```

checkPerformance=false là giá trị mặc định. Đặt true để request 04 assert HTTP responseTime < maxWarmResponseMs, mặc định 20 ms. Số đo này gồm BE, Gateway và kết nối mạng local. Postman collection này đo một lượt ở request 04. Bộ test tích hợp trong Sprint4TicketVerificationTests còn đo p95 trên fixture Redis riêng.

## Backend source files

| File | Nội dung nên đọc |
| --- | --- |
| [ParkingLotsController.cs](../../src/Services/Parking/Parking.Parking.Api/Controllers/ParkingLotsController.cs) | Hai endpoint chi tiết bãi và layout, gửi query qua MediatR và trả envelope. |
| [ParkingLotSpatialDtos.cs](../../src/Services/Parking/Parking.Parking.Application/DTOs/ParkingLotSpatialDtos.cs) | DTO bãi, tầng, khu, ô, Vector3, position/rotationY/size. |
| [GetParkingLotDetailQuery.cs](../../src/Services/Parking/Parking.Parking.Application/Features/ParkingLots/Queries/GetParkingLotDetailQuery.cs) | Query lấy thông tin một bãi. |
| [GetParkingLotDetailQueryValidator.cs](../../src/Services/Parking/Parking.Parking.Application/Features/ParkingLots/Queries/GetParkingLotDetailQueryValidator.cs) | Kiểm tra lotId khác Guid.Empty. |
| [GetParkingLotDetailQueryHandler.cs](../../src/Services/Parking/Parking.Parking.Application/Features/ParkingLots/Queries/GetParkingLotDetailQueryHandler.cs) | Lấy chi tiết bãi và trả NotFound khi thiếu dữ liệu. |
| [GetLotLayout3DQuery.cs](../../src/Services/Parking/Parking.Parking.Application/Features/ParkingLots/Queries/GetLotLayout3DQuery.cs) | Query lấy cây layout. |
| [GetLotLayout3DQueryValidator.cs](../../src/Services/Parking/Parking.Parking.Application/Features/ParkingLots/Queries/GetLotLayout3DQueryValidator.cs) | Kiểm tra lotId cho layout. |
| [GetLotLayout3DQueryHandler.cs](../../src/Services/Parking/Parking.Parking.Application/Features/ParkingLots/Queries/GetLotLayout3DQueryHandler.cs) | Cache key lot_layout_{lotId}, TTL 12 giờ và callback truy vấn DB. |
| [IParkingRepository.cs](../../src/Services/Parking/Parking.Parking.Application/Interfaces/IParkingRepository.cs) | Contract GetParkingLotDetailAsync/GetLotLayout3DAsync. |
| [IParkingCacheService.cs](../../src/Services/Parking/Parking.Parking.Application/Interfaces/IParkingCacheService.cs) | Contract GetOrSetAsync/RemoveAsync. |
| [ParkingRepository.Spatial.cs](../../src/Services/Parking/Parking.Parking.Persistence/Repositories/ParkingRepository.Spatial.cs) | SQL theo lot_id, transaction RepeatableRead, bản đồ PUBLISHED mới nhất và ghép cây DTO. |
| [ParkingRepository.cs](../../src/Services/Parking/Parking.Parking.Persistence/Repositories/ParkingRepository.cs) | Constructor repository và ListLotsAsync phục vụ request 01. |
| [ParkingCacheService.cs](../../src/Services/Parking/Parking.Parking.Infrastructure/Cache/ParkingCacheService.cs) | Đọc/ghi JSON cache, cache hit/miss, khóa theo key, TTL và xử lý cache lỗi. |
| [ParkingCachingExtensions.cs](../../src/Services/Parking/Parking.Parking.Infrastructure/Cache/ParkingCachingExtensions.cs) | Chọn Redis hoặc memory cache theo cấu hình và prefix parking:. |
| [Parking.Parking.Infrastructure.csproj](../../src/Services/Parking/Parking.Parking.Infrastructure/Parking.Parking.Infrastructure.csproj) | Package Microsoft.Extensions.Caching.StackExchangeRedis. |
| [Program.cs](../../src/Services/Parking/Parking.Parking.Api/Program.cs) | Đăng ký cache, controllers và endpoint danh sách bãi. |
| [Application/DependencyInjection.cs](../../src/Services/Parking/Parking.Parking.Application/DependencyInjection.cs) | Đăng ký MediatR, validator và validation pipeline. |
| [Persistence/DependencyInjection.cs](../../src/Services/Parking/Parking.Parking.Persistence/DependencyInjection.cs) | Đăng ký repository qua DI. |
| [OperationsRepository.cs](../../src/Services/Parking/Parking.Parking.Persistence/OperationsRepository.cs) | Xóa cache layout sau thay đổi trạng thái vận hành ô. |

Luồng đọc layout đi từ Controller đến Validator/Handler rồi ParkingCacheService. Cache hit trả dữ liệu đã lưu. Cache miss gọi ParkingRepository.Spatial đọc PostgreSQL, sau đó lưu kết quả vào cache.

## Configuration, database and demo data

| File | Vai trò |
| --- | --- |
| [appsettings.json](../../src/Services/Parking/Parking.Parking.Api/appsettings.json) | Các khóa ConnectionStrings:Redis và Redis:InstanceName. |
| [compose.microservices.yml](../../compose.microservices.yml) | Service Redis, PostgreSQL và kết nối Parking tới Redis. |
| [Gateway/appsettings.json](../../src/Gateway/Parking.Gateway/appsettings.json) | Chuyển request từ Gateway đến Parking. |
| [001_schema.sql](../../database/services/parking/001_schema.sql) | Các bảng parking_lots, parking_levels, zones, parking_slots, map_versions, map_objects. |
| [004_docker_demo.sql](../../database/services/parking/004_docker_demo.sql) | Dữ liệu bãi, tầng, khu, ô, bản đồ PUBLISHED và tọa độ demo. |
| [Seed-DockerDemo.ps1](../../scripts/microservices/Seed-DockerDemo.ps1) | Seed dữ liệu demo và xóa cache liên quan sau seed. |
| [Start-DockerTest.ps1](../../scripts/microservices/Start-DockerTest.ps1) | Khởi động stack Docker và áp dụng migration. |

## Tests and Postman files

| File | Vai trò |
| --- | --- |
| [ParkingLotSpatialTests.cs](../../tests/Parking.Microservices.Tests/ParkingLotSpatialTests.cs) | Unit tests validator, handler, cache và serialization layout. |
| [Sprint4TicketVerificationTests.cs](../../tests/Parking.Microservices.Tests/Sprint4TicketVerificationTests.cs) | Ca Ticket=SCRUM-80 kiểm tra tọa độ, đa bãi, HTTP, Redis TTL và p95. |
| [run-isolated-tests.cjs](../../artifacts/six-tickets/run-isolated-tests.cjs) | Runner tạo PostgreSQL/Redis riêng cho integration tests. |
| [Han-Scrum80.postman_collection.json](../../postman/Han-Scrum80.postman_collection.json) | Bản 8 request tên tiếng Anh và script đã rút gọn. |
| [Han-Scrum80-Local.postman_environment.json](../../postman/Han-Scrum80-Local.postman_environment.json) | Environment của bản 8 request. |
| [Han-Scrum80-DEMO.postman_collection.json](../../postman/Han-Scrum80-DEMO.postman_collection.json) | Bản demo 7 request có Visualize, đo nhiều lượt HTTP. |
| [Han-Scrum80-DEMO.postman_environment.json](../../postman/Han-Scrum80-DEMO.postman_environment.json) | Environment của bản demo 7 request. |

Đọc luồng 8 request trong hai file Han-Scrum80 và Han-Scrum80-Local ở trên khi chuẩn bị giải thích script đã rút gọn.

## Frontend consumers and related documents

| File | Vai trò |
| --- | --- |
| [api.ts](../../frontend_parking_system/src/services/api.ts) | Hàm getLotLayout3D và type LotLayout3DDto. |
| [SearchPage.tsx](../../frontend_parking_system/src/pages/SearchPage.tsx) | Customer tải layout và ghép với availability. |
| [LiveParkingView.tsx](../../frontend_parking_system/src/pages/staff/LiveParkingView.tsx) | Staff tải layout, chọn bãi/tầng và xem các ô. |
| [ParkingViewer.tsx](../../frontend_parking_system/src/components/parking/ParkingViewer.tsx) | Điều phối scene Three.js và tương tác chọn ô. |
| [parking.js](../../frontend_parking_system/src/components/parking/parking.js) | Dựng geometry theo transform của map object. |
| [SPRINT4-FE-INTEGRATION.md](SPRINT4-FE-INTEGRATION.md) | Contract và lưu ý ghép layout với availability/SignalR. |
| [API-CONTRACTS.md](API-CONTRACTS.md) | Quy ước API, envelope và contract runtime. |

## Verification of the simplified collection

Bản trước khi rút gọn đã chạy 8 request với 31 assertion PASS. Bản rút gọn chạy 8 request với checkPerformance=true có 38 assertion PASS, 0 failed. Các nhóm kiểm tra layout được đặt tên riêng trong script chung nên số assertion thay đổi. HTTP request 04 trong lượt xác minh đạt 5 ms.

Các URL, HTTP method, thứ tự request và biến cấu hình được giữ theo bộ 8 request. Lượt kiểm chứng dùng API local đang chạy trên Docker. Phép đo HTTP và so sánh response được trình bày cùng kiểm tra Redis TTL/log khi demo cache.
