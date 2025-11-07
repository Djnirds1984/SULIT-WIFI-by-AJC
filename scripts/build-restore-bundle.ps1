Param(
  [string]$ReleaseDir = "release",
  [string]$BundleName = "sulit-wifi-php-backend-" + (Get-Date -Format "yyyyMMdd-HHmm") + ".zip"
)

Write-Host "[Bundle] Preparing $ReleaseDir and $BundleName"
New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null

$items = @(
  "README.md",
  ".env.example",
  "index.html",
  "public",
  "php-backend",
  "deploy",
  "scripts"
)

$tempDir = Join-Path $ReleaseDir ("bundle-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

foreach ($item in $items) {
  if (Test-Path $item) {
    Write-Host "[Bundle] Adding $item"
    Copy-Item $item -Destination $tempDir -Recurse -Force
  } else {
    Write-Warning "[Bundle] Skipping missing item: $item"
  }
}

$zipPath = Join-Path $ReleaseDir $BundleName
Write-Host "[Bundle] Creating archive $zipPath"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $tempDir '*') -DestinationPath $zipPath

Write-Host "[Bundle] Done: $zipPath"