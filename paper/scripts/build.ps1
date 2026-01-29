#!/usr/bin/env pwsh
# Build script for IEEE paper

param(
    [switch]$Clean = $false,
    [switch]$WordCount = $false,
    [switch]$CheckPages = $false,
    [switch]$GenerateDOCX = $false
)

$paperDir = Split-Path $PSScriptRoot -Parent
$mainTex = Join-Path $paperDir "main.tex"
$outputDir = Join-Path (Split-Path $paperDir -Parent) "dist"

# Ensure output directory exists
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Write-Host "=== IEEE Paper Build Script ===" -ForegroundColor Cyan

# Clean build artifacts
if ($Clean) {
    Write-Host "`n[1/4] Cleaning build artifacts..." -ForegroundColor Yellow
    Set-Location $paperDir
    Get-ChildItem -Include "*.aux","*.log","*.bbl","*.blg","*.out","*.toc","*.synctex.gz" -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue
    Set-Location $PSScriptRoot
    Write-Host "   ✓ Cleaned" -ForegroundColor Green
}

# Check for pdflatex and bibtex
Write-Host "`n[2/4] Checking LaTeX installation..." -ForegroundColor Yellow
$pdflatexPath = Get-Command pdflatex -ErrorAction SilentlyContinue
$bibtexPath = Get-Command bibtex -ErrorAction SilentlyContinue

if (!$pdflatexPath) {
    Write-Host "   ✗ pdflatex not found. Install TeX Live or MiKTeX" -ForegroundColor Red
    exit 1
}

if (!$bibtexPath) {
    Write-Host "   ✗ bibtex not found" -ForegroundColor Red
    exit 1
}

Write-Host "   ✓ pdflatex found" -ForegroundColor Green
Write-Host "   ✓ bibtex found" -ForegroundColor Green

# Build PDF
Write-Host "`n[3/4] Building PDF..." -ForegroundColor Yellow
Set-Location $paperDir

Write-Host "   → Pass 1: pdflatex..." -ForegroundColor Gray
& pdflatex -interaction=nonstopmode main.tex 2>&1 | Out-Null

Write-Host "   → Pass 2: bibtex..." -ForegroundColor Gray
& bibtex main 2>&1 | Out-Null

Write-Host "   → Pass 3: pdflatex..." -ForegroundColor Gray
& pdflatex -interaction=nonstopmode main.tex 2>&1 | Out-Null

Write-Host "   → Pass 4: pdflatex..." -ForegroundColor Gray
& pdflatex -interaction=nonstopmode main.tex 2>&1 | Out-Null

if (Test-Path "main.pdf") {
    Copy-Item "main.pdf" -Destination (Join-Path $outputDir "paper_IEEE_9pages.pdf") -Force
    Write-Host "   ✓ PDF built!" -ForegroundColor Green
    Write-Host "     Output: dist/paper_IEEE_9pages.pdf" -ForegroundColor Cyan
} else {
    Write-Host "   ✗ PDF generation failed" -ForegroundColor Red
    Set-Location $PSScriptRoot
    exit 1
}

Set-Location $PSScriptRoot

# Check page count
if ($CheckPages) {
    Write-Host "`n[4/4] Checking page count..." -ForegroundColor Yellow
    $pdfPath = Join-Path $outputDir "paper_IEEE_9pages.pdf"
    
    # Try pdfinfo
    $pageCount = 0
    $pdfinfoPath = Get-Command pdfinfo -ErrorAction SilentlyContinue
    if ($pdfinfoPath) {
        $info = & pdfinfo $pdfPath 2>$null
        $pageLine = $info | Select-String -Pattern "Pages:\s+(\d+)"
        if ($pageLine) {
            $pageCount = [int]$pageLine.Matches.Groups[1].Value
        }
    }
    
    if ($pageCount -gt 0) {
        Write-Host "   📄 Page count: $pageCount" -ForegroundColor $(if ($pageCount -eq 9) { "Green" } else { "Yellow" })
        
        if ($pageCount -eq 9) {
            Write-Host "   ✓ Exactly 9 pages!" -ForegroundColor Green
        } elseif ($pageCount -lt 9) {
            Write-Host "   ⚠ $($9 - $pageCount) pages under target" -ForegroundColor Yellow
        } else {
            Write-Host "   ⚠ $($pageCount - 9) pages over target" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ! Could not determine page count automatically" -ForegroundColor Yellow
    }
}

# Generate DOCX
if ($GenerateDOCX) {
    Write-Host "`n[Extra] Generating DOCX..." -ForegroundColor Yellow
    $pandocPath = Get-Command pandoc -ErrorAction SilentlyContinue
    
    if (!$pandocPath) {
        Write-Host "   ✗ pandoc not found" -ForegroundColor Red
    } else {
        Set-Location $paperDir
        $docxPath = Join-Path $outputDir "paper_IEEE_9pages.docx"
        
        & pandoc main.tex `
            --from=latex `
            --to=docx `
            --bibliography=refs.bib `
            --citeproc `
            --output=$docxPath `
            2>$null
        
        if (Test-Path $docxPath) {
            Write-Host "   ✓ DOCX generated" -ForegroundColor Green
        } else {
            Write-Host "   ✗ DOCX generation failed" -ForegroundColor Red
        }
        
        Set-Location $PSScriptRoot
    }
}

Write-Host "`n✨ Build complete!" -ForegroundColor Green
