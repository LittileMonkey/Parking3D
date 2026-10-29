param(
    [string]$PgBin = $env:PARKING_PG_BIN,
    [int]$Port = 55484,
    [switch]$IncludeIdentityHttp
)
$ErrorActionPreference = 'Stop'
if (-not $PgBin -or -not (Test-Path -LiteralPath (Join-Path $PgBin 'initdb.exe'))) {
    throw 'Supply -PgBin or PARKING_PG_BIN pointing to the PostgreSQL Windows bin directory.'
}
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$evidence = Join-Path $repo ('artifacts/qa/sprint-3/tests-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $evidence -Force | Out-Null
$cluster = Join-Path $evidence 'cluster'
$names = @('PARKING_TEST_ADMIN_CONNECTION','PARKING_REPO_ROOT','DOTNET_ROLL_FORWARD','PARKING_TEST_API_DLL','PARKING_TEST_IDENTITY_DLL')
$previous = @{}
foreach ($name in $names) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
$started = $false
try {
    & "$PgBin/postgres.exe" --version
    & "$PgBin/initdb.exe" -D $cluster -A trust -U postgres --encoding=UTF8 --no-locale *> (Join-Path $evidence 'initdb.log')
    if ($LASTEXITCODE -ne 0) { throw 'Isolated initdb failed; inspect evidence initdb.log.' }
    & "$PgBin/pg_ctl.exe" start -D $cluster -l (Join-Path $evidence 'server.log') -o "-p $Port -h 127.0.0.1" -w
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL startup failed; another process may use the requested port.' }
    $started = $true
    $env:PARKING_TEST_ADMIN_CONNECTION = "Host=127.0.0.1;Port=$Port;Username=postgres;Database=postgres;SSL Mode=Disable;Timeout=5"
    $env:PARKING_REPO_ROOT = $repo
    $env:DOTNET_ROLL_FORWARD = 'Major'
    $env:PARKING_TEST_API_DLL = Join-Path $repo 'src/Services/Parking/Parking.Parking.Api/bin/Debug/net9.0/Parking.Parking.Api.dll'
    $env:PARKING_TEST_IDENTITY_DLL = if ($IncludeIdentityHttp) {
        Join-Path $repo 'src/Services/Identity/Parking.Identity.Api/bin/Debug/net9.0/Parking.Identity.Api.dll'
    } else { $null }
    & git -C $repo rev-parse HEAD
    & dotnet test (Join-Path $repo 'tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj') --no-build --no-restore --nologo --blame-hang-timeout 60s --logger 'trx;LogFileName=sprint3-isolated.trx' --results-directory "$evidence/results" -v minimal
    $testExit = $LASTEXITCODE
    Write-Output "TEST_EXIT=$testExit; Evidence=$evidence"
    Write-Output 'Database/repository and mock-boundary tests are not full UI/Gateway/checkout acceptance. A skipped host test is not PASS.'
    exit $testExit
}
finally {
    if ($started) { & "$PgBin/pg_ctl.exe" stop -D $cluster -m fast -w }
    foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
