function Write-Status($msg, $color="Cyan") { Write-Host $msg -ForegroundColor $color }
Write-Status "hello" White
Write-Status "hello" "White"
Write-Status -msg "hello" -color White
Write-Status "== test ==" White
