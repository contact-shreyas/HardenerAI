#!/usr/bin/env pwsh
# Count references and detect orphans in IEEE paper

$paperDir = Split-Path $PSScriptRoot -Parent
$mainTex = Join-Path $paperDir "main.tex"
$refsBib = Join-Path $paperDir "refs.bib"

Write-Host "=== Reference Audit Script ===" -ForegroundColor Cyan

# Count references in refs.bib
Write-Host "`n[1/3] Counting references in refs.bib..." -ForegroundColor Yellow
$bibContent = Get-Content $refsBib -Raw
$bibEntries = [regex]::Matches($bibContent, '@\w+\{([^,]+),')
$refCount = $bibEntries.Count

Write-Host "   📚 Total references in refs.bib: $refCount" -ForegroundColor $(if ($refCount -ge 50) { "Green" } else { "Yellow" })

if ($refCount -ge 50) {
    Write-Host "   ✓ Target of >= 50 references met!" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Need $($50 - $refCount) more references to reach 50" -ForegroundColor Yellow
}

# Extract all bib keys
$bibKeys = $bibEntries | ForEach-Object { $_.Groups[1].Value }
Write-Host "`n[2/3] Bibliography keys found:" -ForegroundColor Yellow
$bibKeys | ForEach-Object { Write-Host "   - $_" -ForegroundColor Gray }

# Check for citations in main.tex
Write-Host "`n[3/3] Checking for citations in main.tex..." -ForegroundColor Yellow
$texContent = Get-Content $mainTex -Raw
$citations = [regex]::Matches($texContent, '\\cite\{([^}]+)\}')

# Extract cited keys
$citedKeys = @{}
foreach ($match in $citations) {
    $keys = $match.Groups[1].Value -split ','
    foreach ($key in $keys) {
        $cleanKey = $key.Trim()
        $citedKeys[$cleanKey] = $true
    }
}

Write-Host "   📝 Unique citations in text: $($citedKeys.Count)" -ForegroundColor Cyan

# Find orphan references (in bib but not cited)
Write-Host "`n[Orphan Check] References NOT cited in text:" -ForegroundColor Yellow
$orphans = $bibKeys | Where-Object { !$citedKeys.ContainsKey($_) }

if ($orphans.Count -eq 0) {
    Write-Host "   ✓ No orphan references - all are cited!" -ForegroundColor Green
} else {
    Write-Host "   ⚠ Found $($orphans.Count) orphan references:" -ForegroundColor Yellow
    $orphans | ForEach-Object { Write-Host "     - $_" -ForegroundColor Red }
}

# Find missing references (cited but not in bib)
Write-Host "`n[Missing Check] Citations NOT in refs.bib:" -ForegroundColor Yellow
$missing = $citedKeys.Keys | Where-Object { $_ -notin $bibKeys }

if ($missing.Count -eq 0) {
    Write-Host "   ✓ No missing references - all citations have bib entries!" -ForegroundColor Green
} else {
    Write-Host "   ✗ Found $($missing.Count) missing references:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "     - $_" -ForegroundColor Red }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "   Total bib entries: $refCount" -ForegroundColor White
Write-Host "   Cited in text: $($citedKeys.Count)" -ForegroundColor White
Write-Host "   Orphans (not cited): $($orphans.Count)" -ForegroundColor $(if ($orphans.Count -eq 0) { "Green" } else { "Yellow" })
Write-Host "   Missing (cited but no bib): $($missing.Count)" -ForegroundColor $(if ($missing.Count -eq 0) { "Green" } else { "Red" })

if ($refCount -ge 50 -and $orphans.Count -eq 0 -and $missing.Count -eq 0) {
    Write-Host "`n✅ All reference checks passed!" -ForegroundColor Green
} else {
    Write-Host "`n⚠ Some issues need attention (see above)" -ForegroundColor Yellow
}
