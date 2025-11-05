# meal.it Multi-User Authentication Setup Guide

This guide will help you set up proper user authentication and multi-user support for meal.it using Supabase.

## Prerequisites

- Supabase project (already configured in your `supabaseClient.js`)
- OpenAI API key (already configured)

## Step 1: Update Supabase Database Schema

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to your project: https://sjrfqcphgtvwgcbumyot.supabase.co
3. Go to the SQL Editor
4. Use the step-by-step setup from `supabase_setup_steps.sql` - **Run each step one by one as indicated in the file**
   - This avoids permission errors and ensures proper setup
   - Each step creates tables, policies, and functions in the correct order

## Step 2: Enable Authentication Providers

1. In your Supabase Dashboard, go to **Authentication > Providers**
2. Enable the following providers:
   - **Email**: Already enabled by default
   - **Google** (recommended): 
     - Enable Google provider
     - Add your Google OAuth credentials (Client ID and Secret)
     - Set redirect URL to: `http://localhost:3000` (for development)

### Google OAuth Setup (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
5. Set up OAuth consent screen
6. Add authorized redirect URIs:
   - Development: `https://sjrfqcphgtvwgcbumyot.supabase.co/auth/v1/callback`
   - Production: `https://yourdomain.com` (replace with your domain)
7. Copy Client ID and Secret to Supabase Auth settings

## Step 3: Configure Email Templates (Optional)

1. Go to **Authentication > Email Templates**
2. Customize the email templates for:
   - Confirm signup
   - Reset password
   - Magic link

## Step 4: Set Up Row Level Security Policies

The schema in `supabase_auth_schema.sql` already includes RLS policies that:

- Allow users to only see their own nutrition history
- Allow users to create/edit/delete their own posts
- Allow everyone to view community posts (public forum)
- Automatically create user profiles when users sign up

## Step 5: Update Environment Variables

Make sure your `.env.local` file contains:

```env
NEXT_PUBLIC_SUPABASE_URL=https://sjrfqcphgtvwgcbumyot.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=your-openai-key-here
```

## Step 6: Test Multi-User Functionality

1. Start your development server: `npm run dev`
2. Open multiple browser windows/incognito tabs
3. Create different user accounts in each
4. Test that:
   - Each user only sees their own nutrition data
   - Community posts are visible to all users
   - Only authenticated users can create posts
   - Users can only edit/delete their own content

## Features Enabled

✅ **User Authentication**: Email/password and Google OAuth  
✅ **Data Privacy**: Each user's nutrition data is completely private  
✅ **Community Forum**: Public forum where authenticated users can participate  
✅ **Row Level Security**: Database-level security ensuring data isolation  
✅ **User Profiles**: Automatic profile creation with customizable display names  
✅ **Session Management**: Secure JWT-based authentication  

## Production Deployment Checklist

Before deploying to production:

1. **Update redirect URLs** in Supabase and Google OAuth to your production domain
2. **Enable email confirmations** in Supabase Auth settings
3. **Set up proper CORS** policies in Supabase
4. **Test with real email delivery** (not just console logs)
5. **Configure rate limiting** to prevent abuse
6. **Set up monitoring** for authentication events

## Security Features

- **Row Level Security (RLS)**: Prevents users from accessing other users' data
- **JWT Authentication**: Secure session management
- **API Authentication**: All sensitive endpoints require valid user tokens
- **Input Validation**: Proper validation on both client and server
- **CORS Protection**: Configured for your domain only

## Troubleshooting

### Authentication Issues
- Check browser console for errors
- Verify environment variables are set correctly
- Ensure Supabase project URL and keys are correct

### Data Not Showing
- Confirm RLS policies are applied correctly
- Check that user is properly authenticated
- Verify API calls include authentication headers

### Community Features Not Working
- Ensure user is signed in for posting/upvoting
- Check that community table exists and has proper policies
- Verify API endpoints are returning data correctly

## Support

If you encounter issues:
1. Check the browser console for JavaScript errors
2. Check the Network tab for failed API calls
3. Verify your Supabase dashboard for authentication events
4. Review the server logs for API errors

Your meal.it app now supports multiple concurrent users with complete data privacy and security! 🎉