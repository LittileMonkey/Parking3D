param([string]$PgBin = 'D:/postGREDB/bin', [int]$Port = 55482)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$cluster = Join-Path $PSScriptRoot ('pg-test-' + [Guid]::NewGuid().ToString('N'))
$oldConnection = $env:PARKING_TEST_ADMIN_CONNECTION
$oldRoot = $env:PARKING_REPO_ROOT
$oldRoll = $env:DOTNET_ROLL_FORWARD
$started = $false
try {
    & "$PgBin/postgres.exe" --version
    & "$PgBin/initdb.exe" -D $cluster -A trust -U postgres --encoding=UTF8 --no-locale *> (Join-Path $PSScriptRoot 'initdb.log')
    if ($LASTEXITCODE -ne 0) { throw 'initdb failed; see initdb.log' }
    & "$PgBin/pg_ctl.exe" start -D $cluster -l (Join-Path $cluster 'server.log') -o "-p $Port -h 127.0.0.1" -w
    if ($LASTEXITCODE -ne 0) { throw 'Isolated PostgreSQL startup failed' }
    $started = $true
    $env:PARKING_TEST_ADMIN_CONNECTION = "Host=127.0.0.1;Port=$Port;Username=postgres;Database=postgres;SSL Mode=Disable;Timeout=5"
    $env:PARKING_REPO_ROOT = $repo
    $env:DOTNET_ROLL_FORWARD = 'Major'
    $dll = Join-Path $repo 'tests/Parking.Microservices.Tests/bin/Debug/net9.0/Parking.Microservices.Tests.dll'
    & dotnet vstest $dll '--TestCaseFilter:FullyQualifiedName!~ParkingHttpWorkflowTests' '--Logger:trx;LogFileName=tv2-isolated-pg18.trx' "--ResultsDirectory:$PSScriptRoot/results"
    $testExit = $LASTEXITCODE
    Write-Output "TEST_EXIT=$testExit"
    Write-Output 'Scope: repository/unit tests on PostgreSQL 18.4; HTTP Identity workflow is discovered but skipped without host DLL configuration. PostgreSQL 17 baseline remains unverified.'
    exit $testExit
}
finally {
    if ($started) { & "$PgBin/pg_ctl.exe" stop -D $cluster -m fast -w }
    $env:PARKING_TEST_ADMIN_CONNECTION = $oldConnection
    $env:PARKING_REPO_ROOT = $oldRoot
    $env:DOTNET_ROLL_FORWARD = $oldRoll
}
