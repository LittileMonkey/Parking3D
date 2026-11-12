param([string]$PgBin='D:/postGREDB/bin',[int]$Port=55484,[switch]$IncludeIdentityHttp)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../../..')).Path
$cluster=Join-Path $PSScriptRoot ('pg-test-'+[Guid]::NewGuid().ToString('N'))
$started=$false
try {
 & "$PgBin/postgres.exe" --version
 & "$PgBin/initdb.exe" -D $cluster -A trust -U postgres --encoding=UTF8 --no-locale *> (Join-Path $PSScriptRoot 'initdb.log')
 if($LASTEXITCODE -ne 0){throw 'Isolated initdb failed'}
 & "$PgBin/pg_ctl.exe" start -D $cluster -l (Join-Path $cluster 'server.log') -o "-p $Port -h 127.0.0.1" -w
 if($LASTEXITCODE -ne 0){throw 'Isolated cluster failed to start'}
 $started=$true
 $env:PARKING_TEST_ADMIN_CONNECTION="Host=127.0.0.1;Port=$Port;Username=postgres;Database=postgres;SSL Mode=Disable;Timeout=5"
 $env:PARKING_REPO_ROOT=$repo
 $env:DOTNET_ROLL_FORWARD='Major'
 $env:PARKING_TEST_API_DLL=Join-Path $repo 'src/Services/Parking/Parking.Parking.Api/bin/Debug/net9.0/Parking.Parking.Api.dll'
 if($IncludeIdentityHttp){$env:PARKING_TEST_IDENTITY_DLL=Join-Path $repo 'src/Services/Identity/Parking.Identity.Api/bin/Debug/net9.0/Parking.Identity.Api.dll'}
 & dotnet test (Join-Path $repo 'tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj') --no-build --no-restore --nologo --blame-hang-timeout 60s --logger 'trx;LogFileName=tv2-isolated.trx' --results-directory "$PSScriptRoot/results" -v minimal
 $testExit=$LASTEXITCODE
 Write-Output "TEST_EXIT=$testExit"
 Write-Output 'Uses isolated PostgreSQL18.4, not shared data; full suite includes tests with mocks, distinguish boundaries in report.'
 exit $testExit
} finally {if($started){& "$PgBin/pg_ctl.exe" stop -D $cluster -m fast -w}}
