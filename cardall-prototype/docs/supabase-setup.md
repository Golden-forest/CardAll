# Supabase Project Setup Guide

## Step 1: Create Supabase Project

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com
   - Click "Start your project"
   - Sign in with GitHub (recommended)

2. **Create New Project**
   - Click "New Project"
   - Choose your organization
   - Project name: `cardall-production`
   - Database password: Generate a strong password (save it!)
   - Region: Choose closest to your users
   - Click "Create new project"

3. **Wait for Setup**
   - Project creation takes 2-3 minutes
   - You'll see a progress indicator

## Step 2: Configure Database Schema

1. **Open SQL Editor**
   - In your Supabase dashboard, go to "SQL Editor"
   - Click "New query"

2. **Run Migration**
   - Copy the entire content from `supabase/migrations/001_initial_schema.sql`
   - Paste it into the SQL editor
   - Click "Run" to execute the migration

3. **Verify Tables**
   - Go to "Table Editor" in the sidebar
   - You should see: users, folders, cards, tags, images tables
   - Each table should have proper columns and relationships

## Step 3: Get Project Credentials

1. **Find Project Settings**
   - Go to "Settings" → "API"
   - Copy these values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. **Create Environment File**
   - Copy `.env.example` to `.env` in your project root
   - Replace the placeholder values with your actual credentials

## Step 4: Test Database Connection

1. **Update your .env file**
2. **Restart your development server**: `npm run dev`
3. **Check browser console** for any connection errors
4. **Test authentication** by clicking the "账户" button

## Troubleshooting

### Common Issues:
- **Connection refused**: Check your URL and key
- **CORS errors**: Ensure your domain is added to allowed origins
- **RLS errors**: Verify Row Level Security policies are applied

### Verification Steps:
1. Tables created successfully ✓
2. RLS policies active ✓
3. Environment variables set ✓
4. Application connects without errors ✓