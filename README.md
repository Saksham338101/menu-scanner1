# Partner Authentication & Dashboard

- Partners (restaurants) can register/login via the unified `/auth` page by choosing "Login as Partner".
- Partner credentials are stored in the `restaurant_partners` table (see Supabase schema).
- After login/register, a partner session is stored in `localStorage` and the partner is redirected to `/partner-dashboard`.
- The `/partner-dashboard` page allows partners to manage their restaurant, menu, and QR codes (menu management and QR generation coming soon).
- User and partner authentication are strictly separated; user sessions and partner sessions do not overlap.



# meal.it - Smart Nutrition Analysis Platform

Professional nutrition tracking with AI-powered food analysis for health-conscious individuals.

## 🚀 Quick Start

### 1. **Environment Setup** ✅ 
```bash
# Environment files are already included in this private repository
# .env.local - Contains all required API keys for development
# .env.production - Contains production environment variables

# No additional setup needed - API keys are pre-configured!
```

### 2. **Database Setup**
- Go to [Supabase Dashboard](https://supabase.com/dashboard)
- Run SQL from `supabase_setup_steps.sql` step by step
- Enable authentication providers

### 3. **Run Development Server**
```bash
npm install
npm run dev
```

## 📦 **Deployment**

### **Vercel (Recommended)**
```bash
vercel --prod
# Set environment variables in Vercel dashboard
```

### **Other Platforms**
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions for:
- Netlify
- Railway  
- Heroku
- Docker

## 🔑 **Required API Keys**
- **OpenAI API Key**: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Supabase Keys**: Get from your [Supabase Dashboard](https://supabase.com/dashboard)

## 🎯 **Features**
- ✅ AI-powered food image analysis
- ✅ Multi-user authentication & data privacy
- ✅ Personal nutrition tracking & history
- ✅ Community forum for health discussions
- ✅ Professional design optimized for mobile
- ✅ Real-time macro tracking & goals

## 🛠 **Tech Stack**
- **Frontend**: Next.js, React, TailwindCSS
- **Backend**: Supabase (Database + Auth)
- **AI**: OpenAI GPT-5-mini-2025-08-07
- **Hosting**: Vercel, Netlify, Railway compatible

## 📖 **Documentation**
- [Multi-User Setup Guide](./MULTI_USER_SETUP.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md) 
- [SQL Setup Fix](./SQL_SETUP_FIX.md)

## Run the Project