param([Parameter(Mandatory=$true)][string]$Domain,[Parameter(Mandatory=$true)][string]$AdminEmail)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$destination=Join-Path $repo '.env.production'
if(Test-Path -LiteralPath $destination){throw '.env.production already exists; keep existing encryption keys.'}
if($Domain -notmatch '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' -or $AdminEmail -notmatch '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+$'){throw 'Valid public hostname and administrator email required.'}
function New-ProductionSecret {
 $buffer=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 try{$rng.GetBytes($buffer)}finally{$rng.Dispose()}
 return ([BitConverter]::ToString($buffer)).Replace('-','').ToLowerInvariant()
}
$lines=@("SITE_DOMAIN=$Domain","ACME_EMAIL=$AdminEmail","BOOTSTRAP_EMAIL=$AdminEmail","VNPAY_RETURN_URL=https://$Domain/api/v1/payments/vnpay/return",'SMTP_HOST=','SMTP_PORT=587','SMTP_SENDER=','SMTP_PASSWORD=','VNPAY_BASE_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html','VNPAY_TMN_CODE=','VNPAY_HASH_SECRET=','VNPAY_REFUNDS_ENABLED=false','VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction','VNPAY_REFUND_IP=')
foreach($key in @('JWT_KEY','GRPC_SERVICE_KEY','QR_SIGNING_KEY','OTP_HMAC_KEY','MFA_ENCRYPTION_KEY','IDENTITY_DB_PASSWORD','PARKING_DB_PASSWORD','PAYMENT_DB_PASSWORD','AI_DB_PASSWORD','BOOTSTRAP_PASSWORD')){$lines+=($key+'='+(New-ProductionSecret))}
[IO.File]::WriteAllLines($destination,$lines,[Text.UTF8Encoding]::new($false))
Write-Host 'Created .env.production. Fill SMTP and merchant settings locally. Keep this file and encryption keys private and backed up.'
