$path = "D:\Projects\Multi-Agent-Interface\start-dev.ps1"
$lines = Get-Content -Path $path
for ($i=1; $i -le $lines.Count; $i++) {
  $chunk = ($lines[0..($i-1)] -join "`n")
  $tokens = $null; $errors = $null
  [void][System.Management.Automation.Language.Parser]::ParseInput($chunk, [ref]$tokens, [ref]$errors)
  if ($errors.Count -gt 0) {
    Write-Host "First error at line $i"
    foreach ($e in $errors) {
      Write-Host "  Line $($e.Extent.StartLineNumber): $($e.Message) -> $($e.Extent.Text)"
    }
    break
  }
}
if ($errors.Count -eq 0) { Write-Host "No errors up to line $i" }
