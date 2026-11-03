param(
    [string]$AdminConnection = $env:PARKING_TEST_ADMIN_CONNECTION,
    [switch]$Offline,
    [switch]$AllTests
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$resultPath = Join-Path $repoRoot 'artifacts/microservices/scrum100'
$variables = @('PARKING_TEST_ADMIN_CONNECTION', 'PARKING_REPO_ROOT', 'PARKING_TEST_API_DLL')
$previousValues = @{}
foreach ($name in $variables) { $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }

function Invoke-CheckedDotnet([string[]]$Arguments) {
    & dotnet @Arguments
    if ($LASTEXITCODE -ne 0) { throw "dotnet exited with code $LASTEXITCODE; inspect the diagnostics above." }
}

try {
    if ([string]::IsNullOrWhiteSpace($AdminConnection)) {
        $apiPath = Join-Path $repoRoot 'src/Services/Parking/Parking.Parking.Api'
        $secretPath = Join-Path $env:APPDATA 'Microsoft/UserSecrets/0ccc272e-148e-4e7e-a271-b40754fa6cdd/secrets.json'
        foreach ($file in @((Join-Path $apiPath 'appsettings.json'), (Join-Path $apiPath 'appsettings.Development.json'), $secretPath)) {
            if (Test-Path -LiteralPath $file) {
                $settings = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
                if ($settings.ConnectionStrings.Service) { $AdminConnection = $settings.ConnectionStrings.Service }
                if ($settings.'ConnectionStrings:Service') { $AdminConnection = $settings.'ConnectionStrings:Service' }
            }
        }
        if ($env:ConnectionStrings__Service) { $AdminConnection = $env:ConnectionStrings__Service }
    }
    if ([string]::IsNullOrWhiteSpace($AdminConnection)) { throw 'A local PostgreSQL login with CREATEDB is required.' }
    # The test fixture validates localhost and creates separate temporary databases. Never print credentials.
    $env:PARKING_TEST_ADMIN_CONNECTION = $AdminConnection
    $env:PARKING_REPO_ROOT = $repoRoot
    foreach ($project in @('src/Services/Parking/Parking.Parking.Api/Parking.Parking.Api.csproj', 'tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj')) {
        $projectPath = Join-Path $repoRoot $project
        $restore = @('restore', $projectPath, '--disable-parallel', '-p:NuGetAudit=false', '--nologo')
        if ($Offline) { $restore += '--ignore-failed-sources' }
        Invoke-CheckedDotnet -Arguments $restore
        Invoke-CheckedDotnet -Arguments @('build', $projectPath, '--no-restore', '-m:1', '--nologo')
    }
    $env:PARKING_TEST_API_DLL = Join-Path $repoRoot 'src/Services/Parking/Parking.Parking.Api/bin/Debug/net9.0/Parking.Parking.Api.dll'
    $testArguments = @('test', (Join-Path $repoRoot 'tests/Parking.Microservices.Tests/bin/Debug/net9.0/Parking.Microservices.Tests.dll'),
        '--logger', 'trx;LogFileName=scrum100.trx', '--results-directory', $resultPath, '--nologo')
    if (-not $AllTests) { $testArguments += @('--filter', 'FullyQualifiedName~Hold') }
    Invoke-CheckedDotnet -Arguments $testArguments
}
finally {
    foreach ($name in $variables) { [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process') }
}
