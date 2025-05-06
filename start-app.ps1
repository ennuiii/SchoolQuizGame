# Set Node.js to use legacy OpenSSL provider
$env:NODE_OPTIONS="--openssl-legacy-provider"

Write-Host "Setting NODE_OPTIONS to use legacy OpenSSL provider"
Write-Host "Stopping any existing Node.js processes..."
taskkill /f /im node.exe 2>$null

# Set variables to avoid port conflicts
$serverPort = 5000

Write-Host "Starting server on port $serverPort..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-Command `"Set-Location '$PSScriptRoot'; `$env:NODE_OPTIONS='--openssl-legacy-provider'; node server/index.js`""

Write-Host "Waiting 5 seconds for server to initialize..."
Start-Sleep -Seconds 5

Write-Host "Starting client using legacy OpenSSL provider..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-Command `"Set-Location '$PSScriptRoot'; `$env:NODE_OPTIONS='--openssl-legacy-provider'; npm start`""

Write-Host "Server and client started. Check the new command windows that opened."
Write-Host "To test:"
Write-Host "1. Open your browser to http://localhost:3000"
Write-Host "2. Create a game room as Game Master"
Write-Host "3. Open another tab and go to http://localhost:3000/join"
Write-Host "4. Enter the room code and join as a player"
Write-Host ""
Write-Host "Press Enter to exit this script..."
$null = Read-Host 

