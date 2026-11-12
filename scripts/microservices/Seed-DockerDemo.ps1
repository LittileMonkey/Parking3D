$ErrorActionPreference='Stop'
$OutputEncoding=[System.Text.UTF8Encoding]::new($false)
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
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
  jsonb_build_object('holdMinutes',v.hold_minutes,'lateArrivalMinutes',v.late_arrival_minutes),'VND'
FROM pricing_plans p JOIN pricing_rules r ON r.plan_id=p.id AND r.rule_type='FLAT_BLOCK'
JOIN lot_vehicle_policies v ON v.lot_id=p.lot_id AND v.vehicle_type=p.vehicle_type
JOIN parking_lots l ON l.id=p.lot_id
WHERE l.code IN ('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B') AND p.status='PUBLISHED'
AND p.effective_from<=now() AND (p.effective_until IS NULL OR p.effective_until>now())
AND NOT EXISTS(SELECT 1 FROM pricing_snapshots s WHERE s.plan_id=p.id);
'@
$snapshotSql | docker compose -f compose.microservices.yml exec -T parking-db psql -X -v ON_ERROR_STOP=1 -U parking -d parking_parking
if($LASTEXITCODE -ne 0){throw 'Không khởi tạo được pricing snapshot demo.'}
$identitySql=@'
BEGIN;
INSERT INTO user_memberships(user_id,tier_code) SELECT id,'STANDARD' FROM app_users ON CONFLICT DO NOTHING;
INSERT INTO user_vehicles(id,user_id,license_plate,vehicle_type,is_default,created_at,updated_at)
VALUES('99999999-9999-4999-8999-999999999999',:'customer_id'::uuid,'51A12345','Car',true,now(),now()) ON CONFLICT DO NOTHING;
COMMIT;
'@
$identitySql | docker compose -f compose.microservices.yml exec -T identity-db psql -X -v ON_ERROR_STOP=1 -U identity -d parking_identity -v "customer_id=$customerId"
if($LASTEXITCODE -ne 0){throw 'Không khởi tạo được xe demo của customer.'}
$assignments=@(Invoke-Api '/api/v1/staff-assignments/me' 'GET' $null $staffAuth.accessToken)
$lots=@(Invoke-Api '/api/v1/parking-lots' 'GET' $null $auth.accessToken)
foreach($lot in $lots | Where-Object code -in @('DEMO-Q1','DEMO-BT','DEMO-Q7','DEMO-A','DEMO-B')){
    if(-not($assignments | Where-Object lotId -eq $lot.id)){
        $null=Invoke-Api '/api/v1/staff-assignments' 'POST' @{userId=$staff.id;lotId=$lot.id;roleCode='PARKING_STAFF';validFrom=[DateTime]::UtcNow.ToString('o')} $auth.accessToken
    }
}
Write-Host 'DEMO READY: đã bổ sung bãi, slot, cổng, biểu giá, xe customer và assignment Staff (DB mới: 3 bãi/120 slot/6 cổng).'
Write-Host 'Tài khoản: BOOTSTRAP_EMAIL/PASSWORD; DEMO_STAFF_EMAIL/PASSWORD; DEMO_CUSTOMER_EMAIL/PASSWORD trong .env. Không chia sẻ secrets.'
Write-Host 'Đây là fixture Development; không phải xác minh quyền sở hữu xe thực tế.'
