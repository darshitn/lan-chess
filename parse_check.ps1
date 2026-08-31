$path = "D:\Projects\Multi-Agent-Interface\start-dev.ps1"
$content = Get-Content -Raw -Path $path
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$tokens, [ref]$errors)
Write-Host "Errors: $($errors.Count)"
foreach ($e in $errors) {
  Write-Host "---"
  Write-Host "Message: $($e.Message)"
  Write-Host "Extent: $($e.Extent.Text)"
  Write-Host "Line: $($e.Extent.StartLineNumber) Col: $($e.Extent.StartColumnNumber)"
  Write-Host "Start: $($e.Extent.StartOffset) End: $($e.Extent.EndOffset)"
}
if ($errors.Count -eq 0) { Write-Host "NO ERRORS - PASS" }
