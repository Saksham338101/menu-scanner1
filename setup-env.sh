#!/bin/bash

# meal.it Environment Setup Script
# This script helps you create your .env.local file with the correct variables

echo "🍎 meal.it Environment Setup"
echo "=============================="
echo ""

# Check if .env.local already exists
if [ -f ".env.local" ]; then
    echo "⚠️  .env.local already exists!"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 1
    fi
fi

echo "Please provide the following API keys and configuration:"
echo ""

# Get OpenAI API Key
echo "1️⃣  OpenAI API Key"
echo "   Get from: https://platform.openai.com/api-keys"
echo "   Should start with: sk-proj-..."
read -p "   Enter your OpenAI API key: " OPENAI_KEY

# Get Supabase URL
echo ""
echo "2️⃣  Supabase URL"
echo "   Default: https://sjrfqcphgtvwgcbumyot.supabase.co"
read -p "   Enter Supabase URL (or press Enter for default): " SUPABASE_URL
if [ -z "$SUPABASE_URL" ]; then
    SUPABASE_URL="https://sjrfqcphgtvwgcbumyot.supabase.co"
fi

# Get Supabase Anon Key
echo ""
echo "3️⃣  Supabase Anonymous Key"
echo "   Get from: Supabase Dashboard → Settings → API"
echo "   Should start with: eyJ..."
read -p "   Enter your Supabase anon key: " SUPABASE_ANON_KEY

# Generate random secret for NextAuth
NEXTAUTH_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "$(date +%s | sha256sum | head -c 32)")

# Create .env.local file
cat > .env.local << EOF
# meal.it Environment Variables
# Generated on $(date)

# OpenAI API Configuration
OPENAI_API_KEY="$OPENAI_KEY"

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
EOF

echo ""
echo "✅ Environment file created successfully!"
echo ""
echo "📁 Created: .env.local"
echo ""
echo "🔧 Next steps:"
echo "   1. Run: npm install"
echo "   2. Set up Supabase database using: supabase_setup_steps.sql"
echo "   3. Run: npm run dev"
echo ""
echo "🚀 For deployment, use the DEPLOYMENT_GUIDE.md"
echo ""
echo "⚠️  Remember: Never commit .env.local to git!"