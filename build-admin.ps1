# Script to build the admin panel for SchoolQuizGame

Write-Host "Building Admin Panel..." -ForegroundColor Cyan

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

# Build the admin panel
Write-Host "Building admin panel..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building admin panel. Exiting." -ForegroundColor Red
    exit 1
}

Write-Host "Admin panel successfully built!" -ForegroundColor Green
Write-Host "The built files are in the admin-panel/build directory." -ForegroundColor Cyan
Write-Host "You can deploy these files to a static hosting service like Netlify, Vercel, or GitHub Pages." -ForegroundColor Cyan

# Return to the original directory
Set-Location -Path $PSScriptRoot 