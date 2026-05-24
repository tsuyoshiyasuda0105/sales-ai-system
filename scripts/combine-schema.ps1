$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $root "prisma/migrations/0001_initial"
$outputFile = Join-Path $outputDir "migration.sql"

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$schemaFiles = Get-ChildItem -Path $root -Filter "db_schema_*.sql" | Sort-Object Name

Set-Content -Path $outputFile -Value "-- Combined initial migration generated from db_schema_*.sql`n" -Encoding utf8

foreach ($file in $schemaFiles) {
  Add-Content -Path $outputFile -Value "`n-- ============================================================`n-- Source: $($file.Name)`n-- ============================================================`n" -Encoding utf8
  Get-Content -Path $file.FullName | Add-Content -Path $outputFile -Encoding utf8
}

Write-Host "Wrote $outputFile"
