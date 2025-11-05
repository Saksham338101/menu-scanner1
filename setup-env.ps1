# meal.it Environment Setup Script (PowerShell)
# This script helps you create your .env.local file with the correct variables

Write-Host "🍎 meal.it Environment Setup" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Yellow
Write-Host ""

# Check if .env.local already exists
if (Test-Path ".env.local") {
    Write-Host "⚠️  .env.local already exists!" -ForegroundColor Red
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Please provide the following API keys and configuration:" -ForegroundColor Cyan
Write-Host ""

# Get OpenAI API Key
Write-Host "1️⃣  OpenAI API Key" -ForegroundColor Green
Write-Host "   Get from: https://platform.openai.com/api-keys" -ForegroundColor Gray
Write-Host "   Should start with: sk-proj-..." -ForegroundColor Gray
$OPENAI_KEY = Read-Host "   Enter your OpenAI API key"

# Get Supabase URL
Write-Host ""
Write-Host "2️⃣  Supabase URL" -ForegroundColor Green
Write-Host "   Default: https://sjrfqcphgtvwgcbumyot.supabase.co" -ForegroundColor Gray
$SUPABASE_URL = Read-Host "   Enter Supabase URL (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($SUPABASE_URL)) {
    $SUPABASE_URL = "https://sjrfqcphgtvwgcbumyot.supabase.co"
}

# Get Supabase Anon Key
Write-Host ""
Write-Host "3️⃣  Supabase Anonymous Key" -ForegroundColor Green
Write-Host "   Get from: Supabase Dashboard → Settings → API" -ForegroundColor Gray
Write-Host "   Should start with: eyJ..." -ForegroundColor Gray
$SUPABASE_ANON_KEY = Read-Host "   Enter your Supabase anon key"

# Generate random secret for NextAuth
$NEXTAUTH_SECRET = [System.Web.Security.Membership]::GeneratePassword(32, 8)
if ([string]::IsNullOrWhiteSpace($NEXTAUTH_SECRET)) {
    $NEXTAUTH_SECRET = [System.Guid]::NewGuid().ToString("N")
}

# Create .env.local file
$currentDate = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$envContent = @"
# meal.it Environment Variables
# Generated on $currentDate

# OpenAI API Configuration
OPENAI_API_KEY="$OPENAI_KEY"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
"@

$envContent | Out-File -FilePath ".env.local" -Encoding UTF8

Write-Host ""
Write-Host "✅ Environment file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Created: .env.local" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Run: npm install" -ForegroundColor White
Write-Host "   2. Set up Supabase database using: supabase_setup_steps.sql" -ForegroundColor White
Write-Host "   3. Run: npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "🚀 For deployment, use the DEPLOYMENT_GUIDE.md" -ForegroundColor Magenta
Write-Host ""
Write-Host "⚠️  Remember: Never commit .env.local to git!" -ForegroundColor Red