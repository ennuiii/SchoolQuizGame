# Navigate to admin directory
cd admin

# Install dependencies
npm install

# Create .env file
$envContent = @"
REACT_APP_SUPABASE_URL=https://msocknepcnzlrelwplkf.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zb2NrbmVwY256bHJlbHdwbGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY1MTU3MTIsImV4cCI6MjA2MjA5MTcxMn0.vOoZEjyKKcbym8nkK5knRb_JTiOBlP1m6fUK7Z2wTN4
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8

Write-Host "Admin panel setup completed!" 