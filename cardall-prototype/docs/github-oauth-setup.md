# GitHub OAuth Configuration Guide

## Step 1: Create GitHub OAuth App

1. **Go to GitHub Settings**
   - Visit https://github.com/settings/developers
   - Click "OAuth Apps"
   - Click "New OAuth App"

2. **Configure OAuth App**
   ```
   Application name: CardAll
   Homepage URL: https://your-domain.com (or http://localhost:5173 for development)
   Application description: Advanced knowledge card management platform
   Authorization callback URL: https://your-project-id.supabase.co/auth/v1/callback
   ```

3. **Save Credentials**
   - After creating, copy:
     - Client ID
     - Client Secret (click "Generate a new client secret")

## Step 2: Configure Supabase Authentication

1. **Open Supabase Dashboard**
   - Go to "Authentication" → "Providers"
   - Find "GitHub" in the list

2. **Enable GitHub Provider**
   - Toggle "Enable sign in with GitHub"
   - Enter your GitHub OAuth credentials:
     ```
     Client ID: your-github-client-id
     Client Secret: your-github-client-secret
     ```

3. **Configure Redirect URLs**
   - Site URL: `https://your-domain.com` (production)
   - Redirect URLs: Add both:
     - `http://localhost:5173` (development)
     - `https://your-domain.com` (production)

## Step 3: Test Authentication Flow

1. **Development Testing**
   - Restart your dev server: `npm run dev`
   - Click "账户" button in the app
   - Click "使用 GitHub 登录"
   - Complete GitHub authorization
   - Verify you're redirected back to the app

2. **Verify User Data**
   - Check Supabase "Authentication" → "Users"
   - Your GitHub user should appear
   - Check "Table Editor" → "users" table
   - User profile should be automatically created

## Step 4: Production Configuration

1. **Update GitHub OAuth App**
   - Change Homepage URL to your production domain
   - Update Authorization callback URL to production Supabase URL

2. **Update Supabase Settings**
   - Change Site URL to production domain
   - Update Redirect URLs for production

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files to git
   - Use different OAuth apps for dev/production
   - Rotate client secrets regularly

2. **Domain Restrictions**
   - Only allow your actual domains in redirect URLs
   - Remove localhost URLs from production config

## Troubleshooting

### Common Issues:
- **Redirect URI mismatch**: Check callback URLs match exactly
- **Invalid client**: Verify client ID/secret are correct
- **CORS errors**: Ensure domains are whitelisted in Supabase

### Testing Checklist:
1. GitHub OAuth app created ✓
2. Supabase provider configured ✓
3. Redirect URLs match ✓
4. Authentication flow works ✓
5. User data syncs to database ✓