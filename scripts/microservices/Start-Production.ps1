param([string]$EnvFile='.env.production',[switch]$NoBuild)
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
if(-not(Test-Path -LiteralPath $EnvFile)){throw 'Production environment file missing. Run New-ProductionEnv.ps1 and configure SMTP/provider first.'}
$compose=@('compose','--env-file',$EnvFile,'-f','compose.production.yml')
& docker @compose config --quiet
if($LASTEXITCODE -ne 0){throw 'Production configuration invalid.'}
& docker @compose up -d --wait identity-db parking-db payment-db ai-db
if($LASTEXITCODE -ne 0){throw 'Databases are not ready.'}
$migrations=@{
 'identity-db'=@('identity','parking_identity',@('database/services/identity/002_mfa.sql','database/services/identity/003_guest_otp.sql'))
 'parking-db'=@('parking','parking_parking',@('database/services/parking/migrations/002_hold_default_5_minutes.sql','database/services/parking/migrations/003_scrum99_incidents_shift_handover.sql','database/services/parking/migrations/004_staff_shifts.sql','database/services/parking/migrations/005_booking_cancellations.sql','database/services/parking/migrations/006_reservation_realtime.sql','database/services/parking/migrations/007_notifications.sql','database/services/parking/migrations/008_daily_grace.sql'))
 'payment-db'=@('payment','parking_payment',@('database/services/payment/002_schema.sql','database/services/payment/003_refund_workflow.sql'))
}
foreach($service in $migrations.Keys){$entry=$migrations[$service];foreach($file in $entry[2]){Get-Content -Raw -Encoding UTF8 -LiteralPath $file | & docker @compose exec -T $service psql -X -v ON_ERROR_STOP=1 -U $entry[0] -d $entry[1];if($LASTEXITCODE -ne 0){throw "Migration failed: $file"}}}
$up=@('up','-d','--wait','--wait-timeout','600');if(-not $NoBuild){$up+='--build'}
& docker @compose @up
if($LASTEXITCODE -ne 0){throw 'Production services not ready. Inspect compose ps/logs without printing secrets.'}
Write-Host 'Services started. Verify domain/TLS and business flows before admitting production traffic.'
