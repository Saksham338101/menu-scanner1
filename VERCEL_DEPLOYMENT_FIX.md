# 🚀 Vercel Deployment Fix for meal.it

## The Problem
The error `Environment Variable "OPENAI_API_KEY" references Secret "openai-api-key", which does not exist` occurs because the `vercel.json` file was referencing non-existent secrets.

## ✅ Solution: Deploy with Environment Variables

### **Method 1: Set Environment Variables via Vercel CLI (Recommended)**

1. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

2. **Set Environment Variables:**
   ```bash
   # Set OpenAI API Key
   vercel env add OPENAI_API_KEY
   # When prompted, enter: sk-proj-MzW3UoLWnGvkF14NjLOhrkGkv2dz5g0cnG0iSLBCWfqZ7APfGeBVFE8DRqoMcyLfQMT3BlbkFJNIe_PJ5ArOH1KJZYCjJSvBgANqHxzKKXiX9LOqbTVKMvsLdEJsdZqjLQWaSgtMcsDcDlOlmxbLSKsE2s8A

   # Set Supabase URL
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   # When prompted, enter: https://sjrfqcphgtvwgcbumyot.supabase.co

   # Set Supabase Anon Key
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # When prompted, enter: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmZxY3BoZ3R2d2djYnVteW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMTE4NDksImV4cCI6MjA3NTc4Nzg0OX0.POyZWtK4T1pKVwnB_ec0gXJJopcwT4VZ9U2DUGIQmno
   ```

3. **Redeploy:**
   ```bash
   vercel --prod
   ```

### **Method 2: Set Environment Variables via Vercel Dashboard**

1. **Go to Vercel Dashboard:** https://vercel.com/dashboard
2. **Select your project:** meal-it (or whatever you named it)
3. **Go to Settings → Environment Variables**
4. **Add these variables:**

   | Name | Value |
   |------|-------|
   | `OPENAI_API_KEY` | `sk-proj-MzW3UoLWnGvkF14NjLOhrkGkv2dz5g0cnG0iSLBCWfqZ7APfGeBVFE8DRqoMcyLfQMT3BlbkFJNIe_PJ5ArOH1KJZYCjJSvBgANqHxzKKXiX9LOqbTVKMvsLdEJsdZqjLQWaSgtMcsDcDlOlmxbLSKsE2s8A` |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://sjrfqcphgtvwgcbumyot.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmZxY3BoZ3R2d2djYnVteW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMTE4NDksImV4cCI6MjA3NTc4Nzg0OX0.POyZWtK4T1pKVwnB_ec0gXJJopcwT4VZ9U2DUGIQmno` |

5. **Trigger a new deployment** (Vercel will automatically redeploy when you add environment variables)

### **Method 3: Quick Deploy (One Command)**

```bash
# Deploy with environment variables in one go
vercel --prod -e OPENAI_API_KEY="sk-proj-MzW3UoLWnGvkF14NjLOhrkGkv2dz5g0cnG0iSLBCWfqZ7APfGeBVFE8DRqoMcyLfQMT3BlbkFJNIe_PJ5ArOH1KJZYCjJSvBgANqHxzKKXiX9LOqbTVKMvsLdEJsdZqjLQWaSgtMcsDcDlOlmxbLSKsE2s8A" -e NEXT_PUBLIC_SUPABASE_URL="https://sjrfqcphgtvwgcbumyot.supabase.co" -e NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqcmZxY3BoZ3R2d2djYnVteW90Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMTE4NDksImV4cCI6MjA3NTc4Nzg0OX0.POyZWtK4T1pKVwnB_ec0gXJJopcwT4VZ9U2DUGIQmno"
```

## 🔧 **Alternative: Automatic Environment Detection**

Since your `.env.local` file is now committed to your private repository, Vercel should automatically detect and use those variables. Try this simple approach:

```bash
# Simple deployment - Vercel will use .env.local
vercel --prod
```

## ✅ **Testing Your Deployment**

After deployment, test these features:
1. **Food Image Upload**: Should work with OpenAI API
2. **User Registration**: Should work with Supabase
3. **Data Persistence**: Should save/load user data
4. **Community Features**: Should allow posts and interactions

## 🚨 **If You Still Get Errors**

1. **Check Vercel Functions Logs:**
   - Go to Vercel Dashboard → Your Project → Functions
   - Look for any API errors

2. **Verify Environment Variables:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Make sure all 3 variables are present and correct

3. **Check OpenAI API Quota:**
   - Make sure your OpenAI account has sufficient credits
   - Verify the API key is active

## 🎉 **Success!**

Once deployed successfully, your meal.it app will be live with:
- ✅ AI-powered food analysis
- ✅ Multi-user authentication
- ✅ Private nutrition tracking
- ✅ Community forum features

Your live app will be available at: `https://your-project-name.vercel.app`