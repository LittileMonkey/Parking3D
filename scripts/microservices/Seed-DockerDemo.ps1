$ErrorActionPreference='Stop'
$OutputEncoding=[System.Text.UTF8Encoding]::new($false)
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
& "$PSScriptRoot/New-DevelopmentEnv.ps1" -Ensure
foreach($migration in @('002_hold_default_5_minutes.sql','003_scrum99_incidents_shift_handover.sql','004_staff_shifts.sql','005_booking_cancellations.sql','006_reservation_realtime.sql','007_notifications.sql','008_daily_grace.sql','009_handover_integrity.sql','010_incident_evidence.sql','011_sync_official_lot_names.sql')){
    Get-Content -Raw -Encoding UTF8 (Join-Path 'database/services/parking/migrations' $migration) |
        docker compose -f compose.microservices.yml exec -T parking-db psql -X -v ON_ERROR_STOP=1 -U parking -d parking_parking
    if($LASTEXITCODE -ne 0){throw "Parking migration failed: $migration"}
}
foreach($paymentMigration in @('002_schema.sql','003_refund_workflow.sql')){
    Get-Content -Raw -Encoding UTF8 (Join-Path 'database/services/payment' $paymentMigration) |
        docker compose -f compose.microservices.yml exec -T payment-db psql -X -v ON_ERROR_STOP=1 -U payment -d parking_payment
    if($LASTEXITCODE -ne 0){throw "Payment migration failed: $paymentMigration"}
}
foreach($identityMigration in @('002_mfa.sql','003_guest_otp.sql')){
    Get-Content -Raw -Encoding UTF8 (Join-Path 'database/services/identity' $identityMigration) |
        docker compose -f compose.microservices.yml exec -T identity-db psql -X -v ON_ERROR_STOP=1 -U identity -d parking_identity
    if($LASTEXITCODE -ne 0){throw "Identity migration failed: $identityMigration"}
}
foreach($aiMigration in @('002_lot_catalog_details.sql','002_seed_approved_faqs.sql')){
    Get-Content -Raw -Encoding UTF8 (Join-Path 'database/services/ai' $aiMigration) |
        docker compose -f compose.microservices.yml exec -T ai-db psql -X -v ON_ERROR_STOP=1 -U ai -d parking_ai
    if($LASTEXITCODE -ne 0){throw "AI migration failed: $aiMigration"}
}
docker compose -f compose.microservices.yml up -d payment | Out-Null
$settings=@{}
foreach($line in Get-Content -Encoding UTF8 '.env'){if($line -match '^([A-Z0-9_]+)=(.*)$'){$settings[$Matches[1]]=$Matches[2].Trim().Trim('"').Trim("'")}}
function Invoke-Api([string]$Path,[string]$Method='GET',$Body=$null,[string]$Token=''){
    $headers=@{};if($Token){$headers.Authorization="Bearer $Token"}
    $params=@{Uri="http://localhost:8080$Path";Method=$Method;Headers=$headers;TimeoutSec=20;ErrorAction='Stop'}
    if($null -ne $Body){$params.ContentType='application/json';$params.Body=$Body|ConvertTo-Json -Depth 8 -Compress}
    $response=Invoke-RestMethod @params
    if($response.isSuccess -eq $false){throw "API rejected $Path : $($response.message)"}
    return $response.result
}
$auth=Invoke-Api '/api/v1/auth/login' 'POST' @{email=$settings.BOOTSTRAP_EMAIL;password=$settings.BOOTSTRAP_PASSWORD}
$admin=Invoke-Api '/api/v1/account/information' 'GET' $null $auth.accessToken
if($admin.roles -notcontains 'ADMIN'){throw 'Tài khoản bootstrap không có quyền Admin; không seed dữ liệu.'}
$staffAuth=Invoke-Api '/api/v1/auth/login' 'POST' @{email=$settings.DEMO_STAFF_EMAIL;password=$settings.DEMO_STAFF_PASSWORD}
$staff=Invoke-Api '/api/v1/account/information' 'GET' $null $staffAuth.accessToken
try{
    $customerAuth=Invoke-Api '/api/v1/auth/login' 'POST' @{email=$settings.DEMO_CUSTOMER_EMAIL;password=$settings.DEMO_CUSTOMER_PASSWORD}
    $customer=Invoke-Api '/api/v1/account/information' 'GET' $null $customerAuth.accessToken
}catch{
    # Registration never changes an existing account's password. A duplicate email stops this script.
    $customer=Invoke-Api '/api/v1/auth/register' 'POST' @{emailNormalized=$settings.DEMO_CUSTOMER_EMAIL;password=$settings.DEMO_CUSTOMER_PASSWORD;phoneE164='+84000000003';fullName='Docker demo customer'}
}
$adminId=([Guid]$admin.id).ToString();$customerId=([Guid]$customer.id).ToString()
Get-Content -Raw -Encoding UTF8 database/services/parking/004_docker_demo.sql |
    docker compose -f compose.microservices.yml exec -T parking-db psql -X -v ON_ERROR_STOP=1 -U parking -d parking_parking -v "admin_id=$adminId" -v "customer_id=$customerId"
if($LASTEXITCODE -ne 0){throw 'Không seed được bãi/slot/giá demo; giữ nguyên dữ liệu đã có.'}
# Seed a current price snapshot for the existing walk-in implementation; this is demo initialization.
$snapshotSql=@'
INSERT INTO pricing_snapshots(id,lot_id,plan_id,vehicle_type,engine_version,resolved_rules,policy_snapshot,currency)
SELECT gen_random_uuid(),p.lot_id,p.id,p.vehicle_type,'block-v1',r.parameters,
  jsonb_build_object('holdMinutes',v.hold_minutes,'lateArrivalMinutes',v.late_arrival_minutes,'isEv',r.rule_type='FLAT_BLOCK_EV'),'VND'
FROM pricing_plans p JOIN pricing_rules r ON r.plan_id=p.id AND r.rule_type IN ('FLAT_BLOCK','FLAT_BLOCK_EV')
JOIN lot_vehicle_policies v ON v.lot_id=p.lot_id AND v.vehicle_type=p.vehicle_type
JOIN parking_lots l ON l.id=p.lot_id
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') AND p.status='PUBLISHED'
AND p.effective_from<=now() AND (p.effective_until IS NULL OR p.effective_until>now())
AND NOT EXISTS(
  SELECT 1 FROM pricing_snapshots s
  WHERE s.plan_id=p.id AND COALESCE((s.policy_snapshot->>'isEv')::boolean,false)=(r.rule_type='FLAT_BLOCK_EV')
);
'@
$snapshotSql | docker compose -f compose.microservices.yml exec -T parking-db psql -X -v ON_ERROR_STOP=1 -U parking -d parking_parking
if($LASTEXITCODE -ne 0){throw 'Không khởi tạo được pricing snapshot demo.'}
$identitySql=@'
BEGIN;
INSERT INTO user_memberships(user_id,tier_code) SELECT id,'STANDARD' FROM app_users ON CONFLICT DO NOTHING;
INSERT INTO user_vehicles(id,user_id,license_plate,vehicle_type,is_default,created_at,updated_at)
VALUES
 ('99999999-9999-4999-8999-999999999999',:'customer_id'::uuid,'51A12345','Car',true,now(),now()),
 ('88888888-8888-4888-8888-888888888888',:'customer_id'::uuid,'51K88888','EV',false,now(),now()),
 ('77777777-7777-4777-8777-777777777777',:'customer_id'::uuid,'59P112345','Bike',false,now(),now())
ON CONFLICT DO NOTHING;
COMMIT;
'@
$identitySql | docker compose -f compose.microservices.yml exec -T identity-db psql -X -v ON_ERROR_STOP=1 -U identity -d parking_identity -v "customer_id=$customerId"
if($LASTEXITCODE -ne 0){throw 'Không khởi tạo được xe demo của customer.'}
$assignments=@(Invoke-Api '/api/v1/staff-assignments/me' 'GET' $null $staffAuth.accessToken)
$managerAssignments=@(Invoke-Api '/api/v1/staff-assignments/me' 'GET' $null $auth.accessToken)
$lots=@(Invoke-Api '/api/v1/parking-lots' 'GET' $null $auth.accessToken)
foreach($lot in $lots | Where-Object code -in @('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')){
    if(-not($assignments | Where-Object lotId -eq $lot.id)){
        $null=Invoke-Api '/api/v1/staff-assignments' 'POST' @{userId=$staff.id;lotId=$lot.id;roleCode='PARKING_STAFF';validFrom=[DateTime]::UtcNow.ToString('o')} $auth.accessToken
    }
    if(-not($managerAssignments | Where-Object { $_.lotId -eq $lot.id -and $_.roleCode -eq 'PARKING_MANAGER' })){
        $null=Invoke-Api '/api/v1/staff-assignments' 'POST' @{userId=$admin.id;lotId=$lot.id;roleCode='PARKING_MANAGER';validFrom=[DateTime]::UtcNow.ToString('o')} $auth.accessToken
    }
    $null=Invoke-Api "/api/v1/parking-lots/$($lot.id)/staff-shifts" 'POST' $null $staffAuth.accessToken
    $null=Invoke-Api "/api/v1/parking-lots/$($lot.id)/staff-shifts" 'POST' $null $auth.accessToken
    docker compose -f compose.microservices.yml exec -T redis redis-cli DEL "parking:lot_layout_$($lot.id)" "parking:pricing_rule:$($lot.id):CAR" "parking:pricing_rule:$($lot.id):EV" "parking:pricing_rule:$($lot.id):MOTORBIKE" | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Could not refresh Redis layout cache after demo seed.'}
}

# Tự động đồng bộ các bãi xe thực tế vào danh mục AI (ai_lot_catalog & occupancy_snapshots)
$aiSyncSql = @"
INSERT INTO ai_lot_catalog (lot_id, name, address, latitude, longitude, car_price_per_hour, motorbike_price_per_hour, has_ev_charging, has_roofed_shelter, total_slots, updated_at)
VALUES 
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Tòa nhà đỗ xe Vincom Center Đồng Khởi', '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM', 10.778100, 106.701800, 30000, 4000, false, true, 220, now()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'Bãi đỗ xe Landmark 81 - Central Park', '720A Điện Biên Phủ, Phường 22, Bình Thạnh, TP.HCM', 10.795200, 106.721900, 30000, 4000, false, false, 40, now()),
  ('33333333-3333-4333-8333-111111111111'::uuid, 'Bãi xe Crescent Mall & SECC Phú Mỹ Hưng', '101 Tôn Dật Tiên, Tân Phú, Quận 7, TP.HCM', 10.729200, 106.719600, 30000, 4000, true, true, 200, now())
ON CONFLICT (lot_id) DO UPDATE SET 
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  car_price_per_hour = EXCLUDED.car_price_per_hour,
  motorbike_price_per_hour = EXCLUDED.motorbike_price_per_hour,
  has_ev_charging = EXCLUDED.has_ev_charging,
  has_roofed_shelter = EXCLUDED.has_roofed_shelter,
  total_slots = EXCLUDED.total_slots,
  updated_at = now();

INSERT INTO occupancy_snapshots (id, lot_id, vehicle_type, observed_at, usable_capacity, occupied_count, reserved_count, data_source, created_at, updated_at, version)
VALUES
  (gen_random_uuid(), '11111111-1111-4111-8111-111111111111'::uuid, 'Car', now(), 40, 15, 2, 'ACTUAL', now(), now(), 1),
  (gen_random_uuid(), '22222222-2222-4222-8222-222222222222'::uuid, 'Car', now(), 40, 20, 0, 'ACTUAL', now(), now(), 1),
  (gen_random_uuid(), '33333333-3333-4333-8333-111111111111'::uuid, 'Car', now(), 40, 8, 1, 'ACTUAL', now(), now(), 1)
ON CONFLICT DO NOTHING;
"@
$aiSyncSql | docker compose -f compose.microservices.yml exec -T ai-db psql -X -v ON_ERROR_STOP=1 -U ai -d parking_ai
if ($LASTEXITCODE -ne 0) { throw 'Không đồng bộ được danh mục bãi xe sang AI service.' }

Write-Host 'DEMO READY: đã bổ sung bãi, slot, cổng, biểu giá, bản đồ PUBLISHED, xe customer và hai ca Staff/Manager để bàn giao.'
Write-Host 'Tài khoản: BOOTSTRAP_EMAIL/PASSWORD; DEMO_STAFF_EMAIL/PASSWORD; DEMO_CUSTOMER_EMAIL/PASSWORD trong .env. Không chia sẻ secrets.'
Write-Host 'Đây là fixture Development; không phải xác minh quyền sở hữu xe thực tế.'
