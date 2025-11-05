@echo off
echo 🍎 meal.it Quick Environment Setup
echo =================================
echo.

REM Check if .env.local exists
if exist ".env.local" (
    echo ⚠️ .env.local already exists!
    set /p overwrite="Do you want to overwrite it? (y/N): "
    if /i not "%overwrite%"=="y" (
        echo Setup cancelled.
        pause
        exit /b 1
    )
)

echo Please provide your API keys:
echo.

REM Get OpenAI API Key
echo 1️⃣ OpenAI API Key (from https://platform.openai.com/api-keys)
set /p OPENAI_KEY="Enter your OpenAI API key: "

REM Get Supabase keys
echo.
echo 2️⃣ Supabase Configuration (from Supabase Dashboard → Settings → API)
set /p SUPABASE_ANON_KEY="Enter your Supabase anon key: "

REM Create .env.local file
(
echo # meal.it Environment Variables
echo # Generated on %date% %time%
echo.
echo # OpenAI API Configuration
echo OPENAI_API_KEY="%OPENAI_KEY%"
echo.
echo # Supabase Configuration
echo NEXT_PUBLIC_SUPABASE_URL="https://sjrfqcphgtvwgcbumyot.supabase.co"
echo NEXT_PUBLIC_SUPABASE_ANON_KEY="%SUPABASE_ANON_KEY%"
echo.
echo # NextAuth Configuration
echo NEXTAUTH_URL="http://localhost:3000"
echo NEXTAUTH_SECRET="%RANDOM%%RANDOM%%RANDOM%"
) > .env.local

echo.
echo ✅ Environment file created successfully!
echo.
echo 📁 Created: .env.local
echo.
echo 🔧 Next steps:
echo    1. Run: npm install
echo    2. Set up Supabase database using: supabase_setup_steps.sql
echo    3. Run: npm run dev
echo.
echo 🚀 For deployment, see: DEPLOYMENT_GUIDE.md
echo.
echo ⚠️ Remember: Never commit .env.local to git!
echo.
pause