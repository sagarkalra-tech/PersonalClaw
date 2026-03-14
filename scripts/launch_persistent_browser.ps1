$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$userDataDir = "c:\All Projects\PersonalClaw\browser_data"
$port = 9222

if (-not (Test-Path $userDataDir)) {
    New-Item -ItemType Directory -Path $userDataDir -Force
}

$arguments = @(
    "--remote-debugging-port=$port",
    "--user-data-dir=$userDataDir",
    "--no-first-run",
    "--no-default-browser-check"
)

Write-Host "Launching persistent Chrome on port $port..."
Start-Process -FilePath $chromePath -ArgumentList $arguments
Write-Host "Browser launched! You can now close this terminal."
