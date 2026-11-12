param([string]$AdminEmail='admin@example.test')
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$destination=Join-Path $repoRoot '.env'
if(Test-Path -LiteralPath $destination){throw '.env already exists; keep existing secrets or rename it explicitly.'}
if($AdminEmail -notmatch '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$'){throw 'Invalid administrator email'}
function New-TaskSecret {
  $buffer=New-Object byte[] 32
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($buffer)).Replace('-','').ToLowerInvariant()
}
$lines=@(
 ('JWT_KEY='+(New-TaskSecret))
 ('GRPC_SERVICE_KEY='+(New-TaskSecret))
 ('IDENTITY_DB_PASSWORD='+(New-TaskSecret))
 ('PARKING_DB_PASSWORD='+(New-TaskSecret))
 ('PAYMENT_DB_PASSWORD='+(New-TaskSecret))
 ('AI_DB_PASSWORD='+(New-TaskSecret))
 ('BOOTSTRAP_EMAIL='+$AdminEmail)
 ('BOOTSTRAP_PASSWORD='+(New-TaskSecret))
 'OCR_ENDPOINT='
 'OCR_API_KEY='
)
[IO.File]::WriteAllLines($destination,$lines,[Text.UTF8Encoding]::new($false))
Write-Host 'Created ignored .env with generated Development secrets. Read BOOTSTRAP_EMAIL/PASSWORD locally to sign in; do not commit or share this file.'
