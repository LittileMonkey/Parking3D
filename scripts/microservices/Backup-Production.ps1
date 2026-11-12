param([string]$EnvFile='.env.production')
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$compose=@('compose','--env-file',$EnvFile,'-f','compose.production.yml')
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$destination=Join-Path (Get-Location) "backups/$stamp"
New-Item -ItemType Directory -Path $destination -Force | Out-Null
foreach($name in @('identity','parking','payment','ai')){
 $service="$name-db";$database="parking_$name";$dump="/tmp/parking-backup-$stamp-$name.dump"
 & docker @compose exec -T $service pg_dump -U $name -d $database -Fc -f $dump
 if($LASTEXITCODE -ne 0){throw "Backup failed: $database"}
 & docker @compose cp "${service}:$dump" (Join-Path $destination "$database.dump")
 if($LASTEXITCODE -ne 0){throw "Backup copy failed: $database"}
 & docker @compose exec -T $service rm -- $dump
}
Write-Host "Backups saved to $destination. Store an encrypted off-host copy with the corresponding environment/encryption keys."
