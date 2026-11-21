param(
    [Parameter(Mandatory = $true)][string]$PgBin,
    [Parameter(Mandatory = $true)][Security.SecureString]$DatabasePassword
)
$ErrorActionPreference = 'Stop'
$syncScript = Join-Path $PSScriptRoot 'Sync-LocalDatabases.ps1'
if (-not (Test-Path -LiteralPath $syncScript)) { throw 'FAIL: shared local database sync entrypoint is missing.' }
$prefix = 'parking_sync_it_' + [Guid]::NewGuid().ToString('N').Substring(0, 12) + '_'
$services = @('identity', 'parking', 'payment', 'ai')
$savedPassword = $env:PGPASSWORD
$savedTimeout = $env:PGCONNECT_TIMEOUT
$env:PGPASSWORD = [Net.NetworkCredential]::new('', $DatabasePassword).Password
$env:PGCONNECT_TIMEOUT = '5'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envPath = Join-Path $repo '.env'
$envHash = if (Test-Path -LiteralPath $envPath) { (Get-FileHash -LiteralPath $envPath).Hash } else { $null }

function Sql([string]$Database, [string]$Statement) {
    $output = & (Join-Path $PgBin 'psql.exe') -X -w -h localhost -p 5432 -U postgres -d $Database -At -v ON_ERROR_STOP=1 -c $Statement
    if ($LASTEXITCODE -ne 0) { throw "Test SQL failed for $Database" }
    return ($output -join "`n").Trim()
}
function Assert([bool]$Condition, [string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
}
try {
    # Fresh installation: all names belong exclusively to this random test run.
    & $syncScript -PgBin $PgBin -DatabasePassword $DatabasePassword -DatabasePrefix $prefix -SkipEnvironmentConfiguration
    foreach ($service in $services) {
        $name = $prefix + $service
        Assert ((Sql $name 'SELECT count(*) FROM service_schema_versions WHERE version=1;') -eq '1') "Fresh schema missing: $service"
    }
    Write-Output 'PASS: initializes all four empty databases'

    # Reproduce an older local installation and retain an existing account.
    $identity = $prefix + 'identity'
    Sql $identity "INSERT INTO app_users(id,full_name,email_normalized,status) VALUES('00000000-0000-4000-8000-000000000021','Keep existing account','KEEP@EXAMPLE.TEST','ACTIVE'); DROP TABLE user_mfa; DROP TABLE guest_login_challenges; ALTER TABLE password_reset_otps DROP COLUMN attempt_count;" | Out-Null
    Sql ($prefix + 'payment') 'ALTER TABLE billing_accounts DROP COLUMN customer_id, DROP COLUMN lot_name, DROP COLUMN plate_number; ALTER TABLE refunds DROP COLUMN provider_payload, DROP COLUMN last_error, DROP COLUMN updated_at; ALTER TABLE payment_attempts DROP COLUMN provider_created_date, DROP COLUMN payment_url;' | Out-Null
    Sql ($prefix + 'ai') 'ALTER TABLE ai_lot_catalog DROP COLUMN address, DROP COLUMN latitude, DROP COLUMN longitude, DROP COLUMN car_price_per_hour, DROP COLUMN motorbike_price_per_hour, DROP COLUMN has_ev_charging, DROP COLUMN has_roofed_shelter, DROP COLUMN total_slots;' | Out-Null
    Sql ($prefix + 'parking') 'DROP TABLE incident_evidence_images; DROP TABLE shift_handover_history; DROP TABLE shift_handovers; DROP TABLE staff_shifts; DROP TABLE booking_cancellations; DROP TABLE user_notifications; DROP TABLE daily_grace_claims;' | Out-Null
    Assert ((Sql $identity "SELECT count(*) FROM information_schema.columns WHERE table_name='password_reset_otps' AND column_name='attempt_count';") -eq '0') 'Legacy OTP fixture must reproduce missing column'

    & $syncScript -PgBin $PgBin -DatabasePassword $DatabasePassword -DatabasePrefix $prefix -SkipEnvironmentConfiguration
    Assert ((Sql $identity "SELECT count(*) FROM app_users WHERE id='00000000-0000-4000-8000-000000000021' AND full_name='Keep existing account';") -eq '1') 'Existing account must survive upgrade'
    Assert ((Sql $identity "SELECT count(*) FROM information_schema.columns WHERE table_name='password_reset_otps' AND column_name='attempt_count' AND is_nullable='NO';") -eq '1') 'OTP attempt count must be upgraded'
    Sql $identity 'SELECT attempt_count FROM password_reset_otps LIMIT 0;' | Out-Null
    Sql ($prefix + 'payment') 'SELECT customer_id,lot_name,plate_number FROM billing_accounts LIMIT 0; SELECT provider_payload,last_error,updated_at FROM refunds LIMIT 0; SELECT provider_created_date,payment_url FROM payment_attempts LIMIT 0;' | Out-Null
    Sql ($prefix + 'ai') 'SELECT address,latitude,longitude,car_price_per_hour,motorbike_price_per_hour,has_ev_charging,has_roofed_shelter,total_slots FROM ai_lot_catalog LIMIT 0;' | Out-Null
    Assert ((Sql ($prefix + 'parking') "SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='x';") -ge 3) 'Time-overlap exclusion constraints must survive'
    Write-Output 'PASS: upgrades legacy schemas and preserves existing accounts and overlap guards'

    & $syncScript -PgBin $PgBin -DatabasePassword $DatabasePassword -DatabasePrefix $prefix -SkipEnvironmentConfiguration
    Assert ((Sql $identity 'SELECT count(*) FROM app_users;') -eq '1') 'Repeated sync must not reset or duplicate accounts'
    $newEnvHash = if (Test-Path -LiteralPath $envPath) { (Get-FileHash -LiteralPath $envPath).Hash } else { $null }
    Assert ($newEnvHash -eq $envHash) 'Isolated database tests must not modify .env'
    Write-Output 'PASS: repeated runs are safe and test configuration stays isolated'

    # An unrelated/non-service database must stop the whole preflight before
    # another service is migrated, even if that other service needs an upgrade.
    Sql $identity 'ALTER TABLE password_reset_otps DROP COLUMN attempt_count;' | Out-Null
    Sql ($prefix + 'ai') 'DROP TABLE service_schema_versions;' | Out-Null
    $rejected = $false
    try { & $syncScript -PgBin $PgBin -DatabasePassword $DatabasePassword -DatabasePrefix $prefix -SkipEnvironmentConfiguration }
    catch { $rejected = $_.Exception.Message -match 'not a service database' }
    Assert $rejected 'Non-service database must be rejected'
    Assert ((Sql $identity "SELECT count(*) FROM information_schema.columns WHERE table_name='password_reset_otps' AND column_name='attempt_count';") -eq '0') 'Failed preflight must not migrate other databases'
    Write-Output 'PASS: incompatible databases are rejected before any migration'
} finally {
    try {
        foreach ($service in $services) {
            $name = $prefix + $service
            if ($name -notmatch '^parking_sync_it_[0-9a-f]{12}_(identity|parking|payment|ai)$') { throw 'Invalid test cleanup target' }
            Sql 'postgres' ('DROP DATABASE IF EXISTS "' + $name + '";') | Out-Null
        }
    } finally {
        $env:PGPASSWORD = $savedPassword
        $env:PGCONNECT_TIMEOUT = $savedTimeout
    }
}
