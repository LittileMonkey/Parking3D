param([string]$AdminEmail='admin@example.test',[switch]$Ensure)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$destination=Join-Path $repoRoot '.env'
if($AdminEmail -notmatch '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$'){throw 'Invalid administrator email'}
function New-TaskSecret {
  $buffer=New-Object byte[] 32
  $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($buffer)).Replace('-','').ToLowerInvariant()
}
if(Test-Path -LiteralPath $destination){
  if(-not $Ensure){throw '.env already exists. Use -Ensure to append missing local settings without replacing existing secrets.'}
  $existing=Get-Content -Raw -LiteralPath $destination
  $defaults=@{OTP_HMAC_KEY=(New-TaskSecret);MFA_ENCRYPTION_KEY=(New-TaskSecret);QR_SIGNING_KEY=(New-TaskSecret);DEMO_STAFF_EMAIL='docker.demo.staff@example.test';DEMO_STAFF_PASSWORD=(New-TaskSecret);DEMO_CUSTOMER_EMAIL='docker.demo.customer@example.test';DEMO_CUSTOMER_PASSWORD=(New-TaskSecret)}
  foreach($key in $defaults.Keys){if($existing -notmatch "(?m)^$key=.+$"){Add-Content -LiteralPath $destination -Value ("`n"+$key+'='+$defaults[$key])}}
  Write-Host 'Kept existing .env; appended only missing demo/QR settings.'
  return
}
$lines=@(
 ('OTP_HMAC_KEY='+(New-TaskSecret))
 ('MFA_ENCRYPTION_KEY='+(New-TaskSecret))
 ('JWT_KEY='+(New-TaskSecret))
 ('GRPC_SERVICE_KEY='+(New-TaskSecret))
 ('QR_SIGNING_KEY='+(New-TaskSecret))
 ('IDENTITY_DB_PASSWORD='+(New-TaskSecret))
 ('PARKING_DB_PASSWORD='+(New-TaskSecret))
 ('PAYMENT_DB_PASSWORD='+(New-TaskSecret))
 ('AI_DB_PASSWORD='+(New-TaskSecret))
 ('BOOTSTRAP_EMAIL='+$AdminEmail)
 ('BOOTSTRAP_PASSWORD='+(New-TaskSecret))
 'DEMO_STAFF_EMAIL=docker.demo.staff@example.test'
 ('DEMO_STAFF_PASSWORD='+(New-TaskSecret))
 'DEMO_CUSTOMER_EMAIL=docker.demo.customer@example.test'
 ('DEMO_CUSTOMER_PASSWORD='+(New-TaskSecret))
 'OCR_ENDPOINT='
 'OCR_API_KEY='
 'GEMINI_API_KEY='
 'GEMINI_MODEL=gemini-2.5-flash'
)
[IO.File]::WriteAllLines($destination,$lines,[Text.UTF8Encoding]::new($false))
Write-Host 'Created ignored .env with generated Development secrets. Read BOOTSTRAP_EMAIL/PASSWORD locally to sign in; do not commit or share this file.'
