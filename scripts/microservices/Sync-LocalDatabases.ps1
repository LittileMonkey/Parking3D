<#
.SYNOPSIS
Back up and upgrade the four Development databases on localhost PostgreSQL.
.EXAMPLE
.\scripts\microservices\Sync-LocalDatabases.ps1 -StartBackend
#>
param(
    [string]$PgBin,
    [ValidateRange(1, 65535)][int]$Port = 5432,
    [ValidatePattern('^[A-Za-z_][A-Za-z0-9_]*$')][string]$Username = 'postgres',
    [Security.SecureString]$DatabasePassword,
    [ValidatePattern('^[a-z][a-z0-9_]{0,39}$')][string]$DatabasePrefix = 'parking_',
    [switch]$StartBackend,
    [switch]$SkipEnvironmentConfiguration
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$envFile = Join-Path $repo '.env'
$settings = @{}
if (Test-Path -LiteralPath $envFile) {
    foreach ($line in Get-Content -Encoding UTF8 -LiteralPath $envFile) {
        if ($line -match '^([A-Z0-9_]+)=(.*)$') { $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'") }
    }
}
if (-not $PSBoundParameters.ContainsKey('Port') -and $settings.LOCAL_POSTGRES_PORT) {
    $Port = [int]$settings.LOCAL_POSTGRES_PORT
    if ($Port -lt 1 -or $Port -gt 65535) { throw 'Invalid LOCAL_POSTGRES_PORT.' }
}
if (-not $PSBoundParameters.ContainsKey('Username') -and $settings.LOCAL_POSTGRES_USER) {
    $Username = $settings.LOCAL_POSTGRES_USER
    if ($Username -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { throw 'Invalid LOCAL_POSTGRES_USER.' }
}
if ($StartBackend -and ($SkipEnvironmentConfiguration -or $DatabasePrefix -ne 'parking_')) {
    throw '-StartBackend requires the default database prefix and local environment configuration.'
}
if ($DatabasePrefix -ne 'parking_' -and -not $SkipEnvironmentConfiguration) {
    throw 'Use -SkipEnvironmentConfiguration with a custom database prefix.'
}
if (-not $PgBin) {
    $psql = Get-Command psql -ErrorAction SilentlyContinue
    if ($psql) { $PgBin = Split-Path -Parent $psql.Source }
    if (-not $PgBin -and (Test-Path 'HKLM:\SYSTEM\CurrentControlSet\Services')) {
        foreach ($service in Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Services' | Where-Object { $_.PSChildName -like 'postgresql*' } | Sort-Object PSChildName -Descending) {
            $image = (Get-ItemProperty -LiteralPath $service.PSPath).ImagePath
            if ($image -match '"([^"\r\n]+[\\/]pg_ctl\.exe)"') { $PgBin = Split-Path -Parent $Matches[1]; break }
        }
    }
    if (-not $PgBin -and $env:ProgramFiles) {
        $installation = Get-ChildItem (Join-Path $env:ProgramFiles 'PostgreSQL') -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if ($installation) { $PgBin = Join-Path $installation.FullName 'bin' }
    }
}
foreach ($tool in @('psql.exe', 'pg_dump.exe', 'pg_restore.exe')) {
    if (-not $PgBin -or -not (Test-Path -LiteralPath (Join-Path $PgBin $tool))) { throw 'PostgreSQL client tools not found. Supply -PgBin <PostgreSQL bin directory>.' }
}
if (-not $DatabasePassword -and $settings.LOCAL_POSTGRES_PASSWORD) {
    $DatabasePassword = ConvertTo-SecureString $settings.LOCAL_POSTGRES_PASSWORD -AsPlainText -Force
}
if (-not $DatabasePassword) { $DatabasePassword = Read-Host 'Local PostgreSQL password' -AsSecureString }
$savedPassword = $env:PGPASSWORD
$savedTimeout = $env:PGCONNECT_TIMEOUT
$savedOptions = $env:PGOPTIONS
$env:PGPASSWORD = [Net.NetworkCredential]::new('', $DatabasePassword).Password
$env:PGCONNECT_TIMEOUT = '5'
$env:PGOPTIONS = '-c lock_timeout=5000 -c statement_timeout=120000'

function Invoke-Pg([string]$Tool, [string[]]$Arguments) {
    $savedPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & (Join-Path $PgBin ($Tool + '.exe')) @Arguments 2>&1
        $code = $LASTEXITCODE
    } finally { $ErrorActionPreference = $savedPreference }
    if ($code -ne 0) {
        # Do not print native DETAIL, SQL payloads or connection credentials.
        $summary = @($output | ForEach-Object { [string]$_ } | Where-Object { $_ -match '(?:ERROR|FATAL):' } | Select-Object -First 1) -join ''
        if ($env:PGPASSWORD) { $summary = $summary.Replace($env:PGPASSWORD, '[REDACTED]') }
        throw "$Tool failed (exit $code). $summary"
    }
    return ($output | ForEach-Object { [string]$_ })
}
function Invoke-Sql([string]$Database, [string]$Statement) {
    return ((Invoke-Pg 'psql' @('-X', '-w', '-h', 'localhost', '-p', [string]$Port, '-U', $Username, '-d', $Database, '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', $Statement)) -join "`n").Trim()
}
function Quote-Identifier([string]$Value) { return '"' + $Value.Replace('"', '""') + '"' }
function Quote-Literal([string]$Value) { return "'" + $Value.Replace("'", "''") + "'" }
function Get-Tables([string]$Database) {
    $parsed = ConvertFrom-Json (Invoke-Sql $Database "SELECT coalesce(json_agg(table_name ORDER BY table_name),'[]') FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")
    return $parsed
}
function Get-Counts([string]$Database, [string[]]$Tables) {
    if ($Tables.Count -eq 0) { return @() }
    $parts = foreach ($table in $Tables) { 'SELECT ' + (Quote-Literal $table) + ' AS name,count(*) AS rows FROM public.' + (Quote-Identifier $table) }
    $parsed = ConvertFrom-Json (Invoke-Sql $Database ('SELECT json_agg(t) FROM (' + ($parts -join ' UNION ALL ') + ') t;'))
    return $parsed
}

$backupDirectory = $null
try {
    $version = [int](Invoke-Sql 'postgres' "SELECT current_setting('server_version_num');")
    if ($version -lt 170000) { throw 'PostgreSQL 17 or newer is required.' }
    $databases = ConvertFrom-Json (Invoke-Sql 'postgres' "SELECT json_agg(datname) FROM pg_database WHERE NOT datistemplate;")
    $services = @(
        @{ Name = 'identity'; Database = ($DatabasePrefix + 'identity'); Core = @('app_users', 'platform_user_roles', 'auth_tokens'); Migrations = @('002_mfa.sql', '003_guest_otp.sql', '004_password_reset_attempt_count.sql') },
        @{ Name = 'parking'; Database = ($DatabasePrefix + 'parking'); Core = @('parking_lots', 'parking_slots', 'bookings'); Migrations = @(Get-ChildItem -LiteralPath (Join-Path $repo 'database/services/parking/migrations') -Filter '*.sql' | Sort-Object Name | ForEach-Object { 'migrations/' + $_.Name }) },
        @{ Name = 'payment'; Database = ($DatabasePrefix + 'payment'); Core = @('payments', 'refunds', 'billing_accounts'); Migrations = @('002_schema.sql', '003_refund_workflow.sql') },
        @{ Name = 'ai'; Database = ($DatabasePrefix + 'ai'); Core = @('ai_lot_catalog', 'occupancy_snapshots', 'assistant_documents'); Migrations = @('002_lot_catalog_details.sql', '002_seed_approved_faqs.sql', '003_sync_lot_names.sql') }
    )
    if ($DatabasePrefix -eq 'parking_' -and -not $SkipEnvironmentConfiguration) {
        if ($settings.LOCAL_PARKING_DATABASE) { $services[1].Database = $settings.LOCAL_PARKING_DATABASE }
        elseif ($databases -notcontains 'parking_parking' -and $databases -contains 'Parking_3D') { $services[1].Database = 'Parking_3D' }
        if ($services[1].Database -notmatch '^[A-Za-z_][A-Za-z0-9_]{0,62}$') { throw 'Invalid LOCAL_PARKING_DATABASE.' }
    }
    # Preflight every database before changing any database or local setting.
    foreach ($service in $services) {
        $service.Exists = $databases -contains $service.Database
        $service.TablesBefore = if ($service.Exists) { @(Get-Tables $service.Database) } else { @() }
        if ($service.TablesBefore.Count -gt 0) {
            if ($service.TablesBefore -notcontains 'service_schema_versions') { throw "$($service.Database) is not a service database. No automatic conversion of monolithic databases is supported." }
            if ((Invoke-Sql $service.Database 'SELECT count(*) FROM public.service_schema_versions WHERE version=1;') -ne '1') { throw "Unrecognized schema in $($service.Database)." }
            foreach ($table in $service.Core) {
                if ($service.TablesBefore -notcontains $table) { throw "Missing core table $table in $($service.Database). Restore or review this database before upgrading." }
            }
        }
    }
    if ($StartBackend) { & (Join-Path $PSScriptRoot 'Run-GitHubDev.ps1') -Stop }
    $backupRoot = Join-Path $repo 'database-backups'
    $backupDirectory = Join-Path $backupRoot ('local-sync-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    # Finish and validate all backups before applying any migration.
    foreach ($service in $services) {
        $service.CountsBefore = if ($service.Exists) { @(Get-Counts $service.Database $service.TablesBefore) } else { @() }
        if ($service.Exists) {
            $file = Join-Path $backupDirectory ($service.Name + '.dump')
            Invoke-Pg 'pg_dump' @('-w', '-h', 'localhost', '-p', [string]$Port, '-U', $Username, '-d', $service.Database, '-Fc', '--file', $file) | Out-Null
            Invoke-Pg 'pg_restore' @('--list', $file) | Out-Null
            Write-Host "BACKUP verified: $($service.Database)"
        }
    }
    $services | Select-Object Name, Database, Exists, CountsBefore | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath (Join-Path $backupDirectory 'before.json')
    foreach ($service in $services) {
        if (-not $service.Exists) { Invoke-Sql 'postgres' ('CREATE DATABASE ' + (Quote-Identifier $service.Database) + ';') | Out-Null }
        $schemaRoot = Join-Path $repo ('database/services/' + $service.Name)
        $files = @()
        if ($service.TablesBefore.Count -eq 0) { $files += Join-Path $schemaRoot '001_schema.sql' }
        $files += @($service.Migrations | ForEach-Object { Join-Path $schemaRoot $_ })
        # Session lock serializes migrators; each source migration keeps its own
        # transaction. ON_ERROR_STOP aborts and session exit releases the lock.
        $commands = @("SELECT pg_try_advisory_lock(hashtext('parking-local-schema-sync')) AS acquired \gset", '\if :acquired', '\else', '\echo Another schema sync is running.', '\quit 3', '\endif')
        foreach ($file in $files) {
            if (-not (Test-Path -LiteralPath $file)) { throw "Migration file missing: $file" }
            $commands += "\ir '" + $file.Replace('\', '/').Replace("'", "''") + "'"
        }
        $commands += "SELECT pg_advisory_unlock(hashtext('parking-local-schema-sync'));"
        $batch = Join-Path $backupDirectory ($service.Name + '-apply.sql')
        [IO.File]::WriteAllLines($batch, $commands, [Text.UTF8Encoding]::new($false))
        Invoke-Pg 'psql' @('-X', '-w', '-h', 'localhost', '-p', [string]$Port, '-U', $Username, '-d', $service.Database, '-q', '-v', 'ON_ERROR_STOP=1', '-f', $batch) | Out-Null

        $tables = @(Get-Tables $service.Database)
        $schemaFiles = @((Join-Path $schemaRoot '001_schema.sql')) + @($service.Migrations | ForEach-Object { Join-Path $schemaRoot $_ })
        $requiredTables = @($schemaFiles | ForEach-Object {
            [regex]::Matches((Get-Content -Raw -Encoding UTF8 -LiteralPath $_), '(?i)CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z_0-9]*)') | ForEach-Object { $_.Groups[1].Value }
        } | Sort-Object -Unique)
        foreach ($table in $requiredTables) { if ($tables -notcontains $table) { throw "Schema verification failed: $($service.Name).$table" } }
        $columnChecks = @{
            identity = 'SELECT attempt_count FROM password_reset_otps LIMIT 0; SELECT secret_cipher,last_step,locked_until FROM user_mfa LIMIT 0; SELECT otp_hash,consumed_at FROM guest_login_challenges LIMIT 0;'
            parking = 'SELECT title,severity,description,detected_at,late_report_reason,related_plate,related_slot_code,related_gate,evidence,exit_decision,version,updated_at FROM parking_issues LIMIT 0; SELECT grace_free_minutes FROM lot_vehicle_policies LIMIT 0; SELECT customer_id,grace_minutes FROM parking_sessions LIMIT 0;'
            payment = 'SELECT customer_id,lot_name,plate_number FROM billing_accounts LIMIT 0; SELECT provider_payload,last_error,updated_at FROM refunds LIMIT 0; SELECT provider_created_date,payment_url FROM payment_attempts LIMIT 0;'
            ai = 'SELECT address,latitude,longitude,car_price_per_hour,motorbike_price_per_hour,has_ev_charging,has_roofed_shelter,total_slots FROM ai_lot_catalog LIMIT 0;'
        }
        Invoke-Sql $service.Database $columnChecks[$service.Name] | Out-Null
        if ($service.Name -eq 'parking') {
            $guardCount = [int](Invoke-Sql $service.Database "SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='x' AND conname IN ('ex_vehicle_booking_window','ex_slot_reservation_window','ex_slot_physical_window','ex_session_physical_window','ex_opening_intervals');")
            if ($guardCount -ne 5) { throw 'Parking time-overlap exclusion constraints are incomplete.' }
        }
        $after = @(Get-Counts $service.Database $service.TablesBefore)
        foreach ($before in $service.CountsBefore) {
            if ($before.name -eq 'service_schema_versions') { continue }
            $current = $after | Where-Object { $_.name -eq $before.name }
            if ($null -eq $current -or [long]$current.rows -lt [long]$before.rows) { throw "Existing row count decreased: $($service.Name).$($before.name). Review the backup before continuing." }
        }
        Write-Host "PASS: $($service.Name) -> $($service.Database), $($tables.Count) tables; existing row counts preserved."
    }
    if (-not $SkipEnvironmentConfiguration) {
        if (-not (Test-Path -LiteralPath $envFile)) { & (Join-Path $PSScriptRoot 'New-DevelopmentEnv.ps1') }
        Copy-Item -LiteralPath $envFile -Destination (Join-Path $backupDirectory 'env-before.bak')
        $local = @{ LOCAL_POSTGRES_PORT = [string]$Port; LOCAL_POSTGRES_USER = $Username; LOCAL_PARKING_DATABASE = $services[1].Database }
        # Reuse matching local seed accounts without changing their passwords or
        # the Docker BOOTSTRAP_* settings. Never grant privileges here.
        $seedAccounts = ConvertFrom-Json (Invoke-Sql $services[0].Database "SELECT json_build_object('admin',(SELECT email_normalized FROM app_users u WHERE phone_e164='+84383900873' AND EXISTS(SELECT 1 FROM platform_user_roles r WHERE r.user_id=u.id AND r.role_code='ADMIN')),'staff',(SELECT email_normalized FROM app_users u WHERE phone_e164='+84339603819' AND EXISTS(SELECT 1 FROM platform_user_roles r WHERE r.user_id=u.id AND r.role_code='PARKING_STAFF')));")
        if ($seedAccounts.admin) { $local.LOCAL_BOOTSTRAP_EMAIL = $seedAccounts.admin }
        if ($seedAccounts.staff) { $local.LOCAL_STAFF_EMAIL = $seedAccounts.staff }
        $content = Get-Content -Raw -Encoding UTF8 -LiteralPath $envFile
        foreach ($key in $local.Keys) {
            $value = [string]$local[$key]
            if ($value -match "['\r\n]") { throw "Unsupported local setting: $key" }
            $newLine = $key + "='" + $value + "'"
            $pattern = '(?m)^' + [regex]::Escape($key) + '=[^\r\n]*'
            if ([regex]::IsMatch($content, $pattern)) {
                $replacement = $newLine
                $content = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacement })
            } else { $content += "`n" + $newLine + "`n" }
        }
        [IO.File]::WriteAllText($envFile, $content, [Text.UTF8Encoding]::new($false))
    }
    Write-Host "LOCAL DATABASE SYNC COMPLETE. Backups: $backupDirectory"
} catch {
    if ($backupDirectory) { Write-Warning "Sync stopped. Completed migrations keep their own transactions; no automatic restore or database deletion was performed. Backups: $backupDirectory" }
    throw
} finally {
    $env:PGPASSWORD = $savedPassword
    $env:PGCONNECT_TIMEOUT = $savedTimeout
    $env:PGOPTIONS = $savedOptions
}
if ($StartBackend) { & (Join-Path $PSScriptRoot 'Run-GitHubDev.ps1') -DatabasePassword $DatabasePassword }
