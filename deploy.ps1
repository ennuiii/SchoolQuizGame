# SchoolQuizGame Deployment Script
# This script prepares your game for deployment

# Set NODE_OPTIONS to use legacy OpenSSL provider for build
$env:NODE_OPTIONS="--openssl-legacy-provider"

Write-Host "SchoolQuizGame Deployment Preparation" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green

# Step 1: Check if the server directory has a package.json
if (-not (Test-Path -Path ".\server\package.json")) {
    Write-Host "Creating package.json for server..." -ForegroundColor Yellow
    
    $packageJson = @"
{
  "name": "school-quiz-game-server",
  "version": "1.0.0",
  "description": "Server for School Quiz Game",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "socket.io": "^4.6.1",
    "uuid": "^9.0.0"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
"@
    
    Set-Content -Path ".\server\package.json" -Value $packageJson
    Write-Host "Server package.json created." -ForegroundColor Green
}

# Step 2: Ask for server URL for production
Write-Host ""
Write-Host "Where will you deploy the server?" -ForegroundColor Cyan
Write-Host "1. Render.com (recommended)" 
Write-Host "2. Heroku"
Write-Host "3. Custom server/localhost"
$serverChoice = Read-Host "Enter your choice (1-3)"

$serverUrl = ""
switch ($serverChoice) {
    "1" {
        $serverUrl = Read-Host "Enter your Render.com server URL (e.g., https://school-quiz-game-server.onrender.com)"
    }
    "2" {
        $serverUrl = Read-Host "Enter your Heroku server URL (e.g., https://school-quiz-game-server.herokuapp.com)"
    }
    "3" {
        $serverUrl = Read-Host "Enter your custom server URL (e.g., http://your-server-ip:5000)"
    }
    default {
        $serverUrl = Read-Host "Enter your server URL"
    }
}

# Step 3: Create .env.production file
if ($serverUrl) {
    Write-Host "Creating .env.production file..." -ForegroundColor Yellow
    Set-Content -Path ".\.env.production" -Value "REACT_APP_SOCKET_URL=$serverUrl"
    Write-Host ".env.production created with server URL: $serverUrl" -ForegroundColor Green
}

# Step 4: Build the React app
Write-Host ""
Write-Host "Building React application..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "React app built successfully!" -ForegroundColor Green
} else {
    Write-Host "Error building React app. Please check for errors and try again." -ForegroundColor Red
    exit 1
}

# Step 5: Create a deployment package
Write-Host ""
Write-Host "Creating deployment package..." -ForegroundColor Yellow

# Create deploy directory if it doesn't exist
if (-not (Test-Path -Path ".\deploy")) {
    New-Item -Path ".\deploy" -ItemType Directory
} else {
    Remove-Item -Path ".\deploy\*" -Recurse -Force
}

# Create server directory in deploy
New-Item -Path ".\deploy\server" -ItemType Directory

# Copy server files
Copy-Item -Path ".\server\*" -Destination ".\deploy\server\" -Recurse
# Copy build folder
Copy-Item -Path ".\build" -Destination ".\deploy\" -Recurse
# Copy README and deployment guide
Copy-Item -Path ".\README.md" -Destination ".\deploy\"
Copy-Item -Path ".\deployment-guide.md" -Destination ".\deploy\"

# Remove node_modules from server directory if it exists
if (Test-Path -Path ".\deploy\server\node_modules") {
    Remove-Item -Path ".\deploy\server\node_modules" -Recurse -Force
}

Write-Host "Deployment package created in the 'deploy' directory!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Upload the 'deploy/server' folder to your backend hosting service"
Write-Host "2. Upload the 'deploy/build' folder to your frontend hosting service"
Write-Host "3. Follow the instructions in deployment-guide.md for more details"
Write-Host ""
Write-Host "Happy gaming!" -ForegroundColor Green 