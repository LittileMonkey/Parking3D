# Parse only: never starts services or modifies databases. Run with Windows PowerShell 5.1 and pwsh.
$failed = $false
foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.ps1') {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) {
        $failed = $true
        Write-Output ("FAIL {0}: {1} parse errors" -f $file.Name, $errors.Count)
    } else {
        Write-Output ("PASS {0}" -f $file.Name)
    }
}
if ($failed) { exit 1 }
