# scripts/dev.ps1 - legacy wrapper, now calls root start-dev.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
& powershell -ExecutionPolicy Bypass -File "$root\start-dev.ps1"
