$files = @("D:\Projects\Multi-Agent-Interface\start-dev.ps1", "D:\Projects\Multi-Agent-Interface\scripts\dev.ps1", "D:\Projects\Multi-Agent-Interface\start-dev.bat")
foreach ($f in $files) {
  if ($f -like "*.ps1") {
    $c = Get-Content -Raw -Path $f
    $tokens = $null; $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseInput($c, [ref]$tokens, [ref]$errors)
    if ($errors.Count -eq 0) { Write-Host "$f : PASS" } else { Write-Host "$f : FAIL"; $errors | ForEach-Object { Write-Host "  $($_.Message) at line $($_.Extent.StartLineNumber)" } }
  } else {
    Write-Host "$f : BAT file, checking existence"
    if (Test-Path $f) { Write-Host "  exists PASS" } else { Write-Host "  missing FAIL" }
    $batContent = Get-Content -Raw -Path $f
    if ($batContent -match "start-dev.ps1") { Write-Host "  references start-dev.ps1 PASS" }
  }
}
# Check package.json dev script
$pkg = Get-Content -Raw -Path "D:\Projects\Multi-Agent-Interface\package.json" | ConvertFrom-Json
Write-Host "package.json dev script: $($pkg.scripts.dev)"
if ($pkg.scripts.dev -match "start-dev.ps1") { Write-Host "package.json dev -> start-dev.ps1 PASS" } else { Write-Host "package.json dev FAIL" }
# Check braces balance for start-dev.ps1
$c = Get-Content -Raw -Path "D:\Projects\Multi-Agent-Interface\start-dev.ps1"
$openB = ($c.ToCharArray() | Where-Object { $_ -eq '{' }).Count
$closeB = ($c.ToCharArray() | Where-Object { $_ -eq '}' }).Count
Write-Host "Braces: open $openB close $closeB balanced: $($openB -eq $closeB)"
$openP = ($c.ToCharArray() | Where-Object { $_ -eq '(' }).Count
$closeP = ($c.ToCharArray() | Where-Object { $_ -eq ')' }).Count
Write-Host "Parens: open $openP close $closeP balanced: $($openP -eq $closeP)"
