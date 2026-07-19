param(
	[switch]$UseLegacyStaticSite
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$frontendDir = Join-Path $repoRoot "frontend"
$apiProject = Join-Path $backendDir "src/NeonDraw.Api"
$staticPort = 8080

function Start-InNewShell {
	param(
		[Parameter(Mandatory = $true)][string]$Command,
		[Parameter(Mandatory = $true)][string]$WorkingDirectory
	)

	Start-Process powershell -WorkingDirectory $WorkingDirectory -ArgumentList "-NoExit", "-Command", $Command | Out-Null
}

Write-Host "Starting NeonDraw local stack..." -ForegroundColor Cyan

# 1) Backend API (http://localhost:5080)
Write-Host "Starting backend API..." -ForegroundColor Yellow
Start-InNewShell -WorkingDirectory $backendDir -Command "dotnet run --project `"$apiProject`""

# 2) Frontend (http://localhost:3000)
Write-Host "Starting frontend..." -ForegroundColor Yellow
Start-InNewShell -WorkingDirectory $frontendDir -Command "npm run dev"

# 3) Optional legacy static site (http://127.0.0.1:8080)
if ($UseLegacyStaticSite) {
	Write-Host "Starting legacy static site..." -ForegroundColor Yellow
	Start-InNewShell -WorkingDirectory $repoRoot -Command "node scripts/dev-server.mjs $staticPort"
}

Start-Sleep -Seconds 4

Start-Process "http://localhost:3000"
Write-Host "Done." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000"
Write-Host "API:      http://localhost:5080/swagger"
if ($UseLegacyStaticSite) {
	Write-Host "Legacy:   http://127.0.0.1:$staticPort"
}
