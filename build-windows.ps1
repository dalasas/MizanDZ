$ErrorActionPreference = 'Stop'

Write-Host '=== Mizan DZ Windows Build ===' -ForegroundColor Cyan

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'Node.js/npm غير مثبت. ثبّت Node.js 22 LTS ثم أعد المحاولة.'
}

New-Item -ItemType Directory -Force -Path 'src-tauri/resources' | Out-Null

$nodePath = Join-Path (Get-Location) 'src-tauri/resources/node.exe'
if (-not (Test-Path $nodePath)) {
  Write-Host 'Downloading embedded Node.js runtime...' -ForegroundColor Yellow
  Invoke-WebRequest -Uri 'https://nodejs.org/dist/v22.16.0/win-x64/node.exe' -OutFile $nodePath
}

Write-Host 'Installing dependencies...' -ForegroundColor Yellow
npm install --no-audit --no-fund

Write-Host 'Building Mizan DZ...' -ForegroundColor Yellow
npm run tauri:build

Write-Host ''
Write-Host 'Build completed.' -ForegroundColor Green
Write-Host 'NSIS installer:'
Get-ChildItem 'src-tauri/target/release/bundle/nsis/*.exe' | Select-Object FullName, Length
