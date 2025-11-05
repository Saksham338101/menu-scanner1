# meal.it - Complete Deployment Guide

## ✅ What's Ready

### Core Features
- ✅ **Multi-user Authentication** (Supabase Auth)
- ✅ **AI Food Analysis** (OpenAI GPT-4 Vision)
- ✅ **Nutrition Tracking** (Per-user with RLS)
- ✅ **Smart Charts** (5/7/30-day trends with Chart.js)
- ✅ **AI Diet Advice** (Per-meal + overall recommendations)
- ✅ **Image Caching** (Deduplication by hash)
- ✅ **Health Profiles** (User goals/allergies/targets)
- ✅ **Restaurants & Menu** (Public read, owner-manage)
- ✅ **QR Code Generation** (External API integration)

### Database Schema (All Applied)
1. `nutrition_history` - Meal tracking with health status/advice
2. `nutrition_recommendations` - AI advice cache
3. `user_health_profiles` - User health data
4. `restaurants` - Restaurant directory
5. `menu_items` - Restaurant menus
6. `restaurant_reviews` - User/imported reviews
7. `ai_requests` - OpenAI call logging
8. `food_analysis_cache` - Image analysis deduplication
9. `menu_item_ai_assessments` - AI menu insights

### Security
- ✅ Row Level Security (RLS) on all tables
- ✅ Per-request auth context (Bearer tokens)
- ✅ Middleware security headers (CSP/HSTS/COOP/COEP)
- ✅ Rate limiting on sensitive endpoints

## 🚀 Quick Start

### 1. Environment Setup
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
OPENAI_API_KEY=your_openai_key
```

### 2. Run Development Server
```powershell
npm install
npm run dev
```
Visit: http://localhost:3000

### 3. Production Build
```powershell
npm run build
npm start
```

## 📊 Database Migrations

All three SQL files are in `supabase_migrations/`:
1. `2025-10-14_nutrition_rls.sql` - Core nutrition tables
2. `2025-10-18_health_profiles_restaurants.sql` - Profile/restaurant schema
3. `2025-10-18_ai_infra.sql` - AI logging and cache

Run in Supabase Studio → SQL Editor in order.

## 🔍 Key Endpoints

### Authentication
- Sign up/Sign in via UI modal
- Auto-refreshing session tokens
- Profile stored in `user_health_profiles`

### Food Analysis
- `POST /api/detect_food` - Analyze image → nutrition + AI advice
  - Caches results per (user_id, image_hash)
  - Logs to `ai_requests`

### Nutrition History
- `GET /api/nutrition` - Fetch user's meals (RLS filtered)
- `POST /api/nutrition` - Save meal with health status/advice
- Charts aggregate by calendar day with zero-fill

### Profile & Restaurants
- `GET /api/profile` - User health profile
- `PUT /api/profile` - Update profile
- `GET /api/restaurants` - List all restaurants
- `POST /api/restaurants` - Create restaurant (owner)
- `GET /api/menu?restaurant_id=X` - Menu items
- `POST /api/menu` - Add menu item (owner only)

### QR Codes
- `GET /api/qr?data=URL&size=200x200` - Returns QR URL
- Or use `<QrImage data="..." />` component

## 🧪 Testing Checklist

### 1. Auth Flow
- [ ] Sign up with email/password
- [ ] Sign in
- [ ] Profile loads in header
- [ ] Sign out clears session

### 2. Food Analysis
- [ ] Upload image → AI analysis returns
- [ ] Save meal → appears in history
- [ ] Re-upload same image → cache hit (check `ai_requests`)

### 3. Charts
- [ ] Log meals on 5+ different days
- [ ] Charts appear with daily aggregation
- [ ] Toggle 5d/7d/30d ranges
- [ ] Zero-filled days show correctly

### 4. AI Advice
- [ ] Per-meal advice shows in "Food Analysis" card
- [ ] Overall diet advice in "AI Advice" tab
- [ ] Recommendations based on history patterns

### 5. Database
- [ ] Check `nutrition_history` has rows with your user_id
- [ ] Verify RLS: other users can't see your rows
- [ ] `food_analysis_cache` stores repeated images
- [ ] `ai_requests` logs detect_food calls

## 📱 Features Tour

### Dashboard (/)
- **Upload Tab**: Analyze food images
- **Trends Tab**: 5/7/30-day charts (requires ≥5 days of data)
- **AI Advice Tab**: 
  - Latest food-specific advice
  - Overall diet pattern analysis
  - Personalized recommendations
- **History Tab**: List of saved meals with health badges

### Header
- Brand link (meal.it)
- User welcome + Sign Out (when authenticated)
- Responsive mobile menu

## 🎯 Next Steps (Optional)

### Add Restaurant Admin Page
Create `src/pages/restaurants.js`:
- List user's restaurants
- CRUD for menu items
- Generate QR code for public menu link

### Add Profile Editor Page
Create `src/pages/profile.js`:
- Edit height, weight, diet type
- Set allergies, conditions, fitness targets
- Used for personalized menu assessments

### Personalized Menu AI
Create `src/pages/api/menu/assess.js`:
- Fetch user profile + menu item
- Call OpenAI with context
- Store in `menu_item_ai_assessments`

## 🐛 Troubleshooting

### Build Fails with .next Error
```powershell
Remove-Item -Path ".next" -Recurse -Force
npm run build
```

### RLS Insert Fails
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Check API routes use per-request client with Authorization header
- Run debug endpoint: `GET /api/nutrition/debug` (dev only)

### Charts Don't Show
- Need ≥5 distinct calendar days with logged meals
- Check browser console for errors
- Verify `nutrition_history` has rows for your user

### OpenAI Errors
- Confirm `OPENAI_API_KEY` is valid
- Check model name: `gpt-4-vision-preview` or `gpt-4o`
- Review `ai_requests` table for error logs

## 📦 Deployment

### Vercel (Recommended)
```powershell
npm install -g vercel
vercel
```
Add env vars in Vercel dashboard.

### Other Platforms
- Build: `npm run build`
- Start: `npm start`
- Expose port 3000
- Set environment variables

## 🎉 You're Done!

Your full-stack nutrition app is ready with:
- Secure multi-user auth
- AI-powered food analysis
- Persistent tracking with RLS
- Smart charts and recommendations
- Restaurant/menu infrastructure
- QR code integration

Test it out and enjoy! 🚀
