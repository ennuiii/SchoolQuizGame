# Set Node.js to use legacy OpenSSL provider
$env:NODE_OPTIONS="--openssl-legacy-provider"

Write-Host "Setting NODE_OPTIONS to use legacy OpenSSL provider"
Write-Host "Starting server on port 5000..."

# Change to the server directory and run the server
Set-Location -Path (Join-Path $PSScriptRoot "server")
node index.js 