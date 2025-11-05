# Supabase Authentication Configuration

## ⚠️ Required Supabase Settings

The authentication errors you're experiencing are due to Supabase's default security settings. Follow these steps to fix them:

### 1. Disable Email Confirmation (Development Only)

**In Supabase Dashboard:**
1. Go to **Authentication** → **Providers** → **Email**
2. **Uncheck** "Confirm email" option
3. Click **Save**

> **Note:** In production, keep email confirmation enabled for security. For development/testing, disabling it allows immediate sign-up without email verification.

### 2. Configure Email Provider (Optional for Development)

If you want to test with email confirmation enabled:

**Option A: Use Supabase's built-in email (development only)**
- Already configured by default
- Emails may go to spam
- Limited to testing purposes

**Option B: Configure custom SMTP (recommended for production)**
1. Go to **Project Settings** → **Auth**
2. Scroll to **SMTP Settings**
3. Configure your email provider (Gmail, SendGrid, etc.)
4. Test the connection

### 3. Enable Anonymous Sign-Ins (If Needed)

If you want to allow users without email/password:
1. Go to **Authentication** → **Providers**
2. Enable **Anonymous sign-ins**
3. Click **Save**

> **Note:** This is optional and not required for your current implementation.

### 4. Configure Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Add your site URLs to **Redirect URLs**:
   ```
   http://localhost:3000
   http://localhost:3000/**
   ```
3. For production, add your production domain:
   ```
   https://yourdomain.com
   https://yourdomain.com/**
   ```

### 5. Test Authentication Flow

After making the changes above:

1. **Clear your browser cache** or use incognito mode
2. Restart your Next.js dev server:
   ```powershell
   npm run dev
   ```
3. Try signing up with a new email
4. Try signing in with the credentials

## Common Error Messages & Fixes

### "Anonymous sign-in is not allowed"
- **Fix:** Disable email confirmation in Supabase (see step 1)
- **Or:** Enable anonymous sign-ins if you want that feature

### "Email not confirmed"
- **Fix:** Disable email confirmation in Supabase for development
- **Or:** Check your email inbox/spam for confirmation link

### "Invalid login credentials"
- **Fix:** Make sure you're using the correct email/password
- **Fix:** If just signed up, wait a few seconds for the account to be created
- **Fix:** Try resetting the password using the "Forgot Password" link

### "Missing email or phone number"
- **Fix:** Already fixed in the code - make sure the AuthContext changes are saved
- **Cause:** Was calling signIn/signUp with wrong parameter format

## Code Changes Made

### ✅ Fixed AuthContext.js
- Added proper object destructuring for email/password
- Added `signInWithGoogle()` method
- Added `resetPassword()` method
- Added email redirect URLs

### ✅ Fixed AuthModal.js
- Changed `signIn(email, password)` → `signIn({ email, password })`
- Changed `signUp(email, password, displayName)` → `signUp({ email, password })`
- Changed `resetPassword(email)` → `resetPassword({ email })`

## Quick Test Steps

1. **Disable email confirmation** in Supabase Dashboard (most important!)
2. **Restart dev server**: `npm run dev`
3. **Clear browser cache** or use incognito
4. **Sign up** with a new email (e.g., `test@example.com`)
5. **Sign in** with the same credentials
6. You should be logged in and see your email in the header

## Production Checklist

Before deploying to production:
- ✅ Re-enable email confirmation
- ✅ Configure custom SMTP provider
- ✅ Add production domain to redirect URLs
- ✅ Test the full auth flow with real email addresses
- ✅ Test password reset functionality
- ✅ Configure email templates in Supabase
