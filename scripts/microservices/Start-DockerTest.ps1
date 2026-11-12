param([switch]$NoBuild)
$ErrorActionPreference='Stop'
$OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $repo
if(-not(Get-Command docker -ErrorAction SilentlyContinue)){
    $locations=@(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin",
        "$env:ProgramFiles\Docker\Docker\resources\bin",
        'D:\Docker\Desktop\resources\bin',
        'D:\Docker\Docker\resources\bin'
    )
    $dockerBin=$locations | Where-Object { Test-Path -LiteralPath (Join-Path $_ 'docker.exe') } | Select-Object -First 1
    if(-not $dockerBin){throw 'Chưa tìm thấy Docker CLI. Cài/mở Docker Desktop rồi mở PowerShell mới; chạy docker version để kiểm tra.'}
    $env:PATH="$dockerBin;$env:PATH"
}
docker info --format '{{.OSType}}' | Out-Null
if($LASTEXITCODE -ne 0){throw 'Docker engine chưa sẵn sàng. Mở Docker Desktop, chọn Linux containers và đợi Engine running.'}
& "$PSScriptRoot/New-DevelopmentEnv.ps1" -Ensure
docker compose -f compose.microservices.yml config --quiet
if($LASTEXITCODE -ne 0){throw 'Compose/.env chưa hợp lệ. Không in config đã expand vì chứa secrets.'}
# Stop only native hosts recorded by our previous launcher, before binding Gateway port 8080.
if((Test-Path -LiteralPath 'artifacts/local-stack/processes.json') -and (Test-Path -LiteralPath "$PSScriptRoot/Run-GitHubDev.ps1")){
    & "$PSScriptRoot/Run-GitHubDev.ps1" -Stop
}
docker compose -f compose.microservices.yml up -d --wait identity-db parking-db payment-db ai-db
if($LASTEXITCODE -ne 0){throw 'PostgreSQL containers chưa healthy. Kiểm tra Docker logs; không xóa volumes.'}
foreach($file in @('database/services/parking/migrations/002_hold_default_5_minutes.sql','database/services/parking/migrations/003_scrum99_incidents_shift_handover.sql','database/services/parking/migrations/004_staff_shifts.sql','database/services/parking/migrations/005_booking_cancellations.sql','database/services/parking/migrations/006_reservation_realtime.sql','database/services/parking/migrations/007_notifications.sql','database/services/parking/migrations/008_daily_grace.sql')){
    Get-Content -Raw -Encoding UTF8 $file | docker compose -f compose.microservices.yml exec -T parking-db psql -X -v ON_ERROR_STOP=1 -U parking -d parking_parking
    if($LASTEXITCODE -ne 0){throw "Migration thất bại: $file"}
}
Get-Content -Raw -Encoding UTF8 database/services/payment/002_schema.sql | docker compose -f compose.microservices.yml exec -T payment-db psql -X -v ON_ERROR_STOP=1 -U payment -d parking_payment
if($LASTEXITCODE -ne 0){throw 'Payment migration thất bại.'}
foreach($file in @('database/services/identity/002_mfa.sql','database/services/identity/003_guest_otp.sql')) {
    Get-Content -Raw -Encoding UTF8 $file | docker compose -f compose.microservices.yml exec -T identity-db psql -X -v ON_ERROR_STOP=1 -U identity -d parking_identity
    if($LASTEXITCODE -ne 0){throw "Identity migration failed: $file"}
}
Get-Content -Raw -Encoding UTF8 database/services/payment/003_refund_workflow.sql | docker compose -f compose.microservices.yml exec -T payment-db psql -X -v ON_ERROR_STOP=1 -U payment -d parking_payment
if($LASTEXITCODE -ne 0){throw 'Refund migration failed.'}
$arguments=@('compose','-f','compose.microservices.yml','up','-d','--wait','--wait-timeout','600')
if(-not $NoBuild){$arguments+='--build'}
& docker @arguments
if($LASTEXITCODE -ne 0){throw 'Stack chưa healthy. Xem docker compose -f compose.microservices.yml ps và logs --tail 80.'}
$ready=Invoke-RestMethod 'http://localhost:8080/health/ready' -TimeoutSec 15
if(-not $ready.isSuccess){throw 'Gateway dependencies chưa ready.'}
Write-Host 'DATABASE + BE READY: http://localhost:8080/health/ready'
Write-Host 'Dữ liệu demo: .\scripts\microservices\Seed-DockerDemo.ps1'
Write-Host 'FE Docker: http://localhost:3000 (API va realtime di qua cung origin)'
Write-Host 'FE hot reload tuy chon: cd frontend_parking_system; npm ci; npm run dev'
