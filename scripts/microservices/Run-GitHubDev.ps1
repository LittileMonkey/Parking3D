param([switch]$Stop,[switch]$TrustLocal,[Security.SecureString]$DatabasePassword)
$ErrorActionPreference='Stop'
$repo=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $repo
$logDir=Join-Path $repo 'artifacts/local-stack'
$stateFile=Join-Path $logDir 'processes.json'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Stop-OwnedHosts {
    if(-not(Test-Path -LiteralPath $stateFile)){return}
    # PS 5.1 emits a JSON array as one pipeline item. Assign first so foreach
    # visits individual records instead of passing all PIDs to Get-Process.
    $entries=Get-Content -Raw -Encoding UTF8 $stateFile | ConvertFrom-Json
    foreach($entry in $entries){
        $process=Get-Process -Id $entry.Id -ErrorAction SilentlyContinue
        if($process -and $process.StartTime.ToUniversalTime().ToString('o') -eq $entry.StartTime){
            & taskkill.exe /PID $entry.Id /T /F | Out-Null
            if($LASTEXITCODE -ne 0){throw "Could not stop owned host '$($entry.Name)' (PID $($entry.Id)). State retained for retry."}
        }
    }
    Remove-Item -LiteralPath $stateFile
}
Stop-OwnedHosts
if($Stop){Write-Host 'Đã dừng BE do launcher quản lý; giữ nguyên database.';return}
if(-not(Test-Path -LiteralPath '.env')){throw 'Thiếu .env. Khôi phục cấu hình local trước khi chạy; không gửi secrets qua chat.'}
$settings=@{}
foreach($line in Get-Content -Encoding UTF8 '.env'){
    if($line -match '^([A-Z0-9_]+)=(.*)$'){$settings[$Matches[1]]=$Matches[2].Trim().Trim('"').Trim("'")}
}
foreach($key in @('JWT_KEY','GRPC_SERVICE_KEY','BOOTSTRAP_EMAIL','BOOTSTRAP_PASSWORD','DEMO_STAFF_EMAIL','DEMO_STAFF_PASSWORD')){
    if([string]::IsNullOrWhiteSpace($settings[$key])){throw "Thiếu $key trong .env. Không chạy seed bằng tài khoản mặc định hardcode."}
}
if(-not $settings.QR_SIGNING_KEY){
    $bytes=New-Object byte[] 32
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}
    $settings.QR_SIGNING_KEY=([BitConverter]::ToString($bytes)).Replace('-','').ToLowerInvariant()
    Add-Content -LiteralPath '.env' -Value ("`nQR_SIGNING_KEY="+$settings.QR_SIGNING_KEY)
}
if(-not $TrustLocal -and -not $DatabasePassword){$DatabasePassword=Read-Host 'Mật khẩu PostgreSQL local' -AsSecureString}
$dbPassword=if($DatabasePassword){[Net.NetworkCredential]::new('',$DatabasePassword).Password}else{''}

# GitHub dev Identity currently requires a development HTTPS certificate even when FE uses HTTP.
dotnet dev-certs https --check | Out-Null
if($LASTEXITCODE -ne 0){dotnet dev-certs https | Out-Null;if($LASTEXITCODE -ne 0){throw 'Không tạo được certificate .NET Development.'}}
dotnet build Parking.Microservices.slnx -c Release --nologo -v minimal
if($LASTEXITCODE -ne 0){throw 'Build thất bại; chưa khởi động BE.'}

$services=@(
    @{Name='identity';Project='src/Services/Identity/Parking.Identity.Api';Db='parking_identity';Http=5041;Grpc=5042},
    @{Name='parking';Project='src/Services/Parking/Parking.Parking.Api';Db='parking_parking';Http=8082;Grpc=8083},
    @{Name='payment';Project='src/Services/Payment/Parking.Payment.Api';Db='parking_payment';Http=8084;Grpc=8085},
    @{Name='ai';Project='src/Services/AI/Parking.AI.Api';Db='parking_ai';Http=5004;Grpc=5005},
    @{Name='gateway';Project='src/Gateway/Parking.Gateway';Db='';Http=8080;Grpc=0}
)
$processes=@()
try{
    foreach($service in $services){
        $variables=@{
            ASPNETCORE_ENVIRONMENT='Development'; Jwt__Key=$settings.JWT_KEY; Grpc__ServiceKey=$settings.GRPC_SERVICE_KEY
            Qr__SigningKey=$settings.QR_SIGNING_KEY; Ports__Http=[string]$service.Http; Ports__Grpc=[string]$service.Grpc
            Services__IdentityGrpc='http://127.0.0.1:5042';Services__ParkingGrpc='http://127.0.0.1:8083'
            Services__PaymentGrpc='http://127.0.0.1:8085';Services__AIGrpc='http://127.0.0.1:5005'
            SeedAdmin__Email=$settings.BOOTSTRAP_EMAIL;SeedAdmin__Password=$settings.BOOTSTRAP_PASSWORD;SeedAdmin__FullName='Local demo administrator'
            SeedStaff__Email=$settings.DEMO_STAFF_EMAIL;SeedStaff__Password=$settings.DEMO_STAFF_PASSWORD;SeedStaff__FullName='Local demo staff'
            ASPNETCORE_URLS='http://127.0.0.1:8080';RateLimit__PermitLimit='600'
            AiVision__ServiceUrl='http://127.0.0.1:8000';AI__OcrEndpoint=$settings.OCR_ENDPOINT;AI__OcrApiKey=$settings.OCR_API_KEY
            Gemini__ApiKey=$settings.GEMINI_API_KEY;Gemini__Model=$settings.GEMINI_MODEL
            Ollama__Endpoint='http://127.0.0.1:11434';AI__OllamaEndpoint='http://127.0.0.1:11434'
        }
        if($service.Db){
            $builder=[System.Data.Common.DbConnectionStringBuilder]::new()
            $builder['Host']='localhost';$builder['Port']=5432;$builder['Username']='postgres';$builder['Database']=$service.Db;$builder['Password']=$dbPassword
            $variables['ConnectionStrings__Service']=$builder.ConnectionString
        }
        foreach($provider in $services | Where-Object Db){
            $variables["ReverseProxy__Clusters__$($provider.Name)__Destinations__main__Address"]="http://127.0.0.1:$($provider.Http)/"
            $variables["Services__$($provider.Name)Http"]="http://127.0.0.1:$($provider.Http)"
        }
        $saved=@{}
        try{
            foreach($key in $variables.Keys){$saved[$key]=[Environment]::GetEnvironmentVariable($key,'Process');[Environment]::SetEnvironmentVariable($key,[string]$variables[$key],'Process')}
            $process=Start-Process -FilePath 'dotnet' -ArgumentList @('run','--project',$service.Project,'--no-build','--no-restore','--no-launch-profile','-c','Release') -WorkingDirectory $repo -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logDir "$($service.Name).log") -RedirectStandardError (Join-Path $logDir "$($service.Name).error.log")
            $processes+=@{Name=$service.Name;Id=$process.Id;StartTime=$process.StartTime.ToUniversalTime().ToString('o')}
        }finally{foreach($key in $saved.Keys){[Environment]::SetEnvironmentVariable($key,$saved[$key],'Process')}}
    }
}finally{
    $dbPassword=$null
    $processes | ConvertTo-Json | Set-Content -Encoding utf8 $stateFile
}
$ready=$false
for($attempt=0;$attempt -lt 30;$attempt++){
    try{$result=Invoke-RestMethod 'http://127.0.0.1:8080/health/ready' -TimeoutSec 5;if($result.isSuccess){$ready=$true;break}}catch{}
    Start-Sleep -Seconds 1
}
if(-not $ready){throw 'BE chưa ready. Xem artifacts/local-stack/*.error.log và *.log; không coi khởi động process là chạy thành công.'}
Write-Host 'BE READY: Identity, Parking, Payment, AI và Gateway http://localhost:8080'
Write-Host 'Terminal FE: cd frontend_parking_system; npm run dev'
Write-Host 'Đăng nhập bằng BOOTSTRAP_EMAIL/PASSWORD hoặc DEMO_STAFF_EMAIL/PASSWORD, DEMO_CUSTOMER_EMAIL/PASSWORD trong .env.'
Write-Host 'Dừng BE: .\scripts\microservices\Run-GitHubDev.ps1 -Stop'
