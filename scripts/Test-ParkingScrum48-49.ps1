param(
    [string]$AdminConnection = $env:PARKING_TEST_ADMIN_CONNECTION,
    [switch]$Offline,
    [switch]$IncludeIdentityIntegration
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$mode = if ($IncludeIdentityIntegration) { 'with-identity' } else { 'parking-only' }
$outputRoot = Join-Path $repoRoot "artifacts/microservices/scrum48-49/$mode"
$variables = @('PARKING_TEST_ADMIN_CONNECTION', 'PARKING_REPO_ROOT', 'PARKING_TEST_API_DLL', 'PARKING_TEST_IDENTITY_DLL')
$previousValues = @{}
foreach ($name in $variables) { $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function Invoke-DotnetChecked([string[]]$Arguments) {
    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet failed with exit code $LASTEXITCODE. See diagnostics above." }
}

try {
    # Read only configuration, never print a connection string or copy it into a report.
    if ([string]::IsNullOrWhiteSpace($AdminConnection)) {
        $apiDirectory = Join-Path $repoRoot 'src/Services/Parking/Parking.Parking.Api'
        $secretPath = Join-Path $env:APPDATA 'Microsoft/UserSecrets/0ccc272e-148e-4e7e-a271-b40754fa6cdd/secrets.json'
        foreach ($file in @((Join-Path $apiDirectory 'appsettings.json'), (Join-Path $apiDirectory 'appsettings.Development.json'), $secretPath)) {
            if (Test-Path -LiteralPath $file) {
                $configuration = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
                if ($configuration.ConnectionStrings.Service) { $AdminConnection = $configuration.ConnectionStrings.Service }
                if ($configuration.'ConnectionStrings:Service') { $AdminConnection = $configuration.'ConnectionStrings:Service' }
            }
        }
        if ($env:ConnectionStrings__Service) { $AdminConnection = $env:ConnectionStrings__Service }
    }
    if ([string]::IsNullOrWhiteSpace($AdminConnection)) {
        throw 'Set PARKING_TEST_ADMIN_CONNECTION to a local PostgreSQL connection with CREATEDB permission.'
    }
    $env:PARKING_TEST_ADMIN_CONNECTION = $AdminConnection
    $env:PARKING_REPO_ROOT = $repoRoot
    $projects = @(
        @('src/Services/Identity/Parking.Identity.Api/Parking.Identity.Api.csproj', 'identity'),
        @('src/Services/Parking/Parking.Parking.Api/Parking.Parking.Api.csproj', 'parking'),
        @('tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj', 'tests')
    )
    if (-not $IncludeIdentityIntegration) {
        $projects = @($projects | Where-Object { $_[1] -ne 'identity' })
    }
    foreach ($project in $projects) {
        $path = Join-Path $repoRoot $project[0]
        $restoreArguments = @('restore', $path, '--disable-parallel', '-m:1', '-v:minimal')
        if ($Offline) { $restoreArguments += @('--ignore-failed-sources', '-p:NuGetAudit=false') }
        Invoke-DotnetChecked $restoreArguments
        Invoke-DotnetChecked @('build', $path, '--no-restore', '--disable-build-servers', '-m:1',
            '-o', (Join-Path $outputRoot $project[1]), '--nologo', '-v:minimal')
    }
    $env:PARKING_TEST_API_DLL = Join-Path $outputRoot 'parking/Parking.Parking.Api.dll'
    if ($IncludeIdentityIntegration) {
        $env:PARKING_TEST_IDENTITY_DLL = Join-Path $outputRoot 'identity/Parking.Identity.Api.dll'
    }
    $testArguments = @('test', (Join-Path $outputRoot 'tests/Parking.Microservices.Tests.dll'),
        '--logger', 'trx;LogFileName=scrum48-49.trx', '--results-directory', (Join-Path $outputRoot 'results'), '--nologo')
    if (-not $IncludeIdentityIntegration) {
        Write-Host 'Parking scope: excluding 2 IdentityIntegration tests. These require owner-provided LOOKUP/CHECK_IN support and a compatible Identity host.'
        $testArguments += @('--filter', 'Dependency!=IdentityIntegration')
    }
    Invoke-DotnetChecked $testArguments
}
finally {
    foreach ($name in $variables) { [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process') }
}
