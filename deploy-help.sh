#!/bin/bash
# Deploy meal.it with pre-configured environment variables

echo "🚀 meal.it Deployment Helper"
echo "=============================="
echo ""
echo "Environment variables are pre-configured in this private repository:"
echo ""
echo "📋 CONFIGURED API KEYS:"
echo "   ✅ OpenAI API Key: sk-proj-MzW3Uo...E2s8A"
echo "   ✅ Supabase URL: https://sjrfqcphgtvwgcbumyot.supabase.co"
echo "   ✅ Supabase Anon Key: eyJhbGci...9h5c4"
echo ""
echo "🌐 DEPLOYMENT OPTIONS:"
echo ""

# Vercel deployment
echo "1️⃣  VERCEL (Recommended)"
echo "   Command: vercel --prod"
echo "   The .env.local file will be automatically used"
echo ""

# Netlify deployment
echo "2️⃣  NETLIFY"
echo "   Build command: npm run build"
echo "   Publish directory: .next"
echo "   Copy these to Netlify environment variables:"
echo "   - OPENAI_API_KEY=sk-proj-MzW3UoLWnGvkF14NjLOhrkGkv2dz5g0cnG0iSLBCWfqZ7APfGeBVFE8DRqoMcyLfQMT3BlbkFJNIe_PJ5ArOH1KJZYCjJSvBgANqHxzKKXiX9LOqbTVKMvsLdEJsdZqjLQWaSgtMcsDcDlOlmxbLSKsE2s8A"
echo "   - NEXT_PUBLIC_SUPABASE_URL=https://sjrfqcphgtvwgcbumyot.supabase.co"
echo "   - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmZxY3BoZ3R2d2djYnVteW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMTE4NDksImV4cCI6MjA3NTc4Nzg0OX0.POyZWtK4T1pKVwnB_ec0gXJJopcwT4VZ9U2DUGIQmno"
echo ""

# Railway deployment  
echo "3️⃣  RAILWAY"
echo "   Command: railway up"
echo "   Environment variables are automatically read from .env.local"
echo ""

echo "✅ Your meal.it app is ready for deployment with all API keys configured!"
echo ""
echo "🔧 Next steps:"
echo "   1. Ensure Supabase database is set up (run supabase_setup_steps.sql)"
echo "   2. Choose a deployment platform above"
echo "   3. Deploy and test all features"
echo ""