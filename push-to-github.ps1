Param(
    [string]$Remote = "https://github.com/adissyauqi203/KKNT-SOCAH-PGSD-26.git",
    [string]$Branch = "main",
    [string]$Message = "Initial commit"
)

$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $RepoDir

Write-Host "Repository path: $RepoDir"

if (-not (Test-Path -Path ".git")) {
    Write-Host "Initializing git repository..."
    git init
    git branch -M $Branch
} else {
    Write-Host ".git already exists. Skipping init."
}

Write-Host "Adding files..."
git add .

$headExists = & git rev-parse --verify HEAD 2>$null
if (-not $?) {
    Write-Host "Creating initial commit..."
    git commit -m $Message
} else {
    try {
        git commit -m $Message -q
        Write-Host "Committed changes."
    } catch {
        Write-Host "No changes to commit."
    }
}

try {
    $currentRemote = git remote get-url origin 2>$null
    if (-not $currentRemote) {
        Write-Host "Adding remote origin: $Remote"
        git remote add origin $Remote
    } else {
        Write-Host "Remote origin exists. Setting URL to $Remote"
        git remote set-url origin $Remote
    }
} catch {
    Write-Host "Setting remote origin..."
    git remote add origin $Remote
}

Write-Host "Pushing to origin/$Branch..."
git push -u origin $Branch

Write-Host "Done. If prompted for credentials, authenticate and re-run the script if needed."
