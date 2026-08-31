$path = "D:\Projects\Multi-Agent-Interface\test_min2.ps1"
$content = Get-Content -Raw -Path $path
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$tokens, [ref]$errors)
Write-Host "Errors: $($errors.Count)"
foreach ($e in $errors) {
  Write-Host "---"
  Write-Host $e.Message
  Write-Host "Line $($e.Extent.StartLineNumber) Col $($e.Extent.StartColumnNumber): $($e.Extent.Text)"
}
