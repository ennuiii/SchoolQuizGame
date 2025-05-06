# Script to set up and run the admin panel for SchoolQuizGame

Write-Host "Setting up Admin Panel..." -ForegroundColor Cyan

# Navigate to the admin-panel directory
Set-Location -Path "$PSScriptRoot\admin-panel"

# Check if node_modules exists
if (-Not (Test-Path -Path ".\node_modules")) {
    Write-Host "Installing dependencies for admin panel..." -ForegroundColor Yellow
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error installing dependencies. Exiting." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Dependencies already installed." -ForegroundColor Green
}

# Run the admin panel in development mode
Write-Host "Starting Admin Panel..." -ForegroundColor Green
npm start

# Return to the original directory
Set-Location -Path $PSScriptRoot 