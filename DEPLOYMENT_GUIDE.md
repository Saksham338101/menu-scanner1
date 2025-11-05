# 🚀 meal.it Deployment Guide - Environment Variables & Hosting

This guide covers how to properly deploy meal.it with all environment variables configured correctly for production hosting.

## 🔑 **Required Environment Variables**

Your app needs these environment variables to work properly:

```env
# OpenAI API (Required for food detection)
OPENAI_API_KEY=sk-proj-your-actual-openai-key-here

# Supabase (Required for database and authentication)
NEXT_PUBLIC_SUPABASE_URL=https://sjrfqcphgtvwgcbumyot.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-actual-supabase-anon-key-here

# Optional: For production security
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-random-secret-string-here
```

## 📋 **Getting Your API Keys**

### 1. OpenAI API Key
1. Go to https://platform.openai.com/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-proj-...`)
4. **Important**: Add billing info to your OpenAI account or the API won't work

### 2. Supabase Keys
1. Go to https://supabase.com/dashboard
2. Select your project: https://sjrfqcphgtvwgcbumyot.supabase.co
3. Go to Settings → API
4. Copy:
   - **URL**: `https://sjrfqcphgtvwgcbumyot.supabase.co`
   - **Anon/Public Key**: `eyJ...` (long string)

## 🌐 **Deployment Platforms**

### **Option 1: Vercel (Recommended)**

1. **Deploy to Vercel**:
   ```bash
   npm install -g vercel
   vercel --prod
   ```

2. **Set Environment Variables**:
   ```bash
   # Method 1: Via CLI
   vercel env add OPENAI_API_KEY
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   
   # Method 2: Via Dashboard
   # Go to vercel.com → Your Project → Settings → Environment Variables
   ```

3. **Redeploy**:
   ```bash
   vercel --prod
   ```

### **Option 2: Netlify**

1. **Deploy to Netlify**:
   ```bash
   npm run build
   # Upload dist folder or connect GitHub repo
   ```

2. **Set Environment Variables**:
   - Go to Netlify Dashboard → Site Settings → Environment Variables
   - Add each variable:
     - `OPENAI_API_KEY` = your OpenAI key
     - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase anon key

### **Option 3: Railway**

1. **Deploy to Railway**:
   ```bash
   # Connect GitHub repo or use CLI
   railway login
   railway link
   railway up
   ```

2. **Set Environment Variables**:
   ```bash
   railway variables set OPENAI_API_KEY=your-key-here
   railway variables set NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   railway variables set NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
   ```

### **Option 4: Heroku**

1. **Deploy to Heroku**:
   ```bash
   heroku create your-meal-it-app
   git push heroku main
   ```

2. **Set Environment Variables**:
   ```bash
   heroku config:set OPENAI_API_KEY=your-key-here
   heroku config:set NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   heroku config:set NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
   ```

## ⚠️ **Common Issues & Fixes**

### **Issue: "OpenAI API key not found"**
**Fix**: 
- Verify the environment variable is set: `OPENAI_API_KEY`
- Check you have billing enabled on your OpenAI account
- Redeploy after setting the environment variable

### **Issue: "Supabase connection failed"**
**Fix**:
- Verify both Supabase variables are set correctly
- Check the URL doesn't have trailing slashes
- Ensure the anon key is correct (very long string starting with `eyJ`)

### **Issue: "Authentication not working"**
**Fix**:
- Set up the database schema using `supabase_setup_steps.sql`
- Enable authentication providers in Supabase dashboard
- Update redirect URLs in Supabase to match your domain

### **Issue: "Environment variables not loading"**
**Fix**:
- Environment variables starting with `NEXT_PUBLIC_` are exposed to the client
- Server-only variables (like `OPENAI_API_KEY`) should NOT have `NEXT_PUBLIC_`
- Restart/redeploy after setting environment variables

## 🔒 **Security Best Practices**

### **DO**:
- ✅ Use environment variables for all API keys
- ✅ Set up proper CORS in Supabase for your domain
- ✅ Enable email confirmation in Supabase for production
- ✅ Use HTTPS in production (most platforms provide this automatically)

### **DON'T**:
- ❌ Never commit `.env.local` or any file with real API keys
- ❌ Don't add `NEXT_PUBLIC_` to secret keys (only to public config)
- ❌ Don't use the same API keys for development and production

## 🧪 **Testing Your Deployment**

After deployment, test these features:
1. **Food Detection**: Upload an image → should analyze with OpenAI
2. **User Registration**: Sign up with email → should save to Supabase
3. **Data Persistence**: Add nutrition data → should save and reload
4. **Multi-user**: Test with different accounts → data should be isolated
5. **Community**: Create posts → should work for authenticated users

## 📞 **Deployment Checklist**

Before going live:

- [ ] **Environment Variables**: All keys set correctly on hosting platform
- [ ] **Database Schema**: Ran `supabase_setup_steps.sql` in Supabase
- [ ] **Authentication**: Enabled email and optionally Google OAuth in Supabase
- [ ] **Domain Setup**: Updated redirect URLs in Supabase to match your domain
- [ ] **Testing**: All features work with real API calls
- [ ] **Monitoring**: Set up error tracking (optional but recommended)

## 🎉 **Success!**

Once deployed with proper environment variables, your meal.it app will:
- ✅ Work for multiple concurrent users
- ✅ Properly analyze food images with OpenAI
- ✅ Securely store user data in Supabase
- ✅ Handle authentication and sessions
- ✅ Support the community forum features

Your users will have a fully functional nutrition tracking app with AI-powered food analysis! 🍎📱