param(
  [string]$RepoUrl = "",
  [string]$Branch = "main",
  [string]$Message = "Update project"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "Git is not installed or not in PATH. Install Git and retry."
}

if ($RepoUrl -ne "") {
  git remote remove origin 2>$null
  git remote add origin $RepoUrl
}

Write-Host "Checking status..."
git status -sb

Write-Host "Staging changes..."
git add -A

Write-Host "Committing..."
try {
  git commit -m $Message
} catch {
  Write-Host "No changes to commit."
}

Write-Host "Pushing to origin/$Branch..."
git push --set-upstream origin $Branch
