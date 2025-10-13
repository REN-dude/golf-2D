Param(
  [string]$Branch = "feature/trees-water-and-speed-x3",
  [string]$Remote = "origin",
  [string]$RemoteUrl
)

function Exec([string]$cmd) {
  Write-Host ">> $cmd" -ForegroundColor Cyan
  iex $cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $cmd" }
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Error "git not found. Please install Git and re-run."
  exit 1
}

# Ensure inside a git repo
git rev-parse --is-inside-work-tree | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Initializing git repository..." -ForegroundColor Yellow
  Exec "git init"
}

# Ensure remote exists
git remote get-url $Remote | Out-Null
if ($LASTEXITCODE -ne 0) {
  if ($RemoteUrl) {
    Write-Host "Adding remote '$Remote' -> $RemoteUrl" -ForegroundColor Yellow
    Exec "git remote add $Remote `"$RemoteUrl`""
  } else {
    Write-Error "Remote '$Remote' not set. Provide -RemoteUrl or add it manually: git remote add $Remote <URL>"
    exit 1
  }
}

# Create/switch branch
git rev-parse --verify $Branch | Out-Null
if ($LASTEXITCODE -eq 0) {
  Exec "git checkout $Branch"
} else {
  Exec "git checkout -b $Branch"
}

# Stage and commit changes (if any)
Exec "git add -A"
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $msg = "feat(game): add random trees and collision; water penalty only on rest; 3x shot speed"
  Exec "git commit -m `"$msg`""
} else {
  Write-Host "No staged changes to commit." -ForegroundColor DarkYellow
}

# Push
Exec "git push -u $Remote $Branch"

Write-Host "Done. Branch '$Branch' pushed to '$Remote'." -ForegroundColor Green

