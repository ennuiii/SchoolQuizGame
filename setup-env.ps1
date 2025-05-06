# PowerShell script to create .env file with Supabase credentials

# Create or overwrite the .env file
$envContent = @"
REACT_APP_SUPABASE_URL=https://msocknepcnzlrelwplkf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2NrbmVwY256bHJlbHdwbGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTU3MTIsImV4cCI6MjA2MjA5MTcxMn0.vOoZEjyKKcbym8nkK5knRb_JTiOBlP1m6fUK7Z2wTN4
"@

# Write to .env file
$envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline

Write-Host "Environment variables have been set up successfully!" -ForegroundColor Green
Write-Host "Your .env file has been created with the Supabase credentials."
Write-Host "Please restart your development server for the changes to take effect." 