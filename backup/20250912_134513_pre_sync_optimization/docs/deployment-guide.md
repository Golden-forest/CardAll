# Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] `.env` file configured with production Supabase credentials
- [ ] GitHub OAuth configured for production domain
- [ ] All sensitive data in environment variables (not hardcoded)

### 2. Build Optimization
- [ ] Run `npm run build` successfully
- [ ] Check bundle size (should be < 500KB gzipped as per requirements)
- [ ] Test production build locally: `npm run preview`

### 3. Database Setup
- [ ] Supabase project created and configured
- [ ] Database schema migrated successfully
- [ ] RLS policies active and tested
- [ ] GitHub OAuth provider enabled

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   cd cardall-prototype
   vercel
   ```

3. **Configure Environment Variables**
   - Go to Vercel dashboard → Your project → Settings → Environment Variables
   - Add:
     ```
     VITE_SUPABASE_URL=your-production-supabase-url
     VITE_SUPABASE_ANON_KEY=your-production-anon-key
     ```

4. **Update GitHub OAuth**
   - Update callback URL to: `https://your-vercel-domain.vercel.app`
   - Update Supabase redirect URLs

### Option 2: Netlify

1. **Build the Project**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   - Drag and drop `dist` folder to Netlify
   - Or connect GitHub repository for automatic deployments

3. **Configure Environment Variables**
   - Go to Site settings → Environment variables
   - Add your Supabase credentials

### Option 3: Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine AS builder
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   RUN npm run build

   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/nginx.conf
   EXPOSE 80
   CMD ["nginx", "-g", "daemon off;"]
   ```

2. **Create nginx.conf**
   ```nginx
   events {
       worker_connections 1024;
   }

   http {
       include /etc/nginx/mime.types;
       default_type application/octet-stream;

       server {
           listen 80;
           server_name localhost;
           root /usr/share/nginx/html;
           index index.html;

           location / {
               try_files $uri $uri/ /index.html;
           }
       }
   }
   ```

3. **Build and Run**
   ```bash
   docker build -t cardall .
   docker run -p 80:80 cardall
   ```

## Post-Deployment Verification

### 1. Functionality Testing
- [ ] Application loads without errors
- [ ] Authentication works (GitHub OAuth)
- [ ] Card creation and editing functions
- [ ] Image upload and processing works
- [ ] Data syncs to Supabase
- [ ] Offline functionality works
- [ ] Cross-device sync works

### 2. Performance Testing
- [ ] Lighthouse score > 90 (as per requirements)
- [ ] First Contentful Paint < 1.5s
- [ ] Bundle size < 500KB gzipped
- [ ] Images load quickly (WebP optimization)

### 3. Security Testing
- [ ] HTTPS enabled
- [ ] Environment variables not exposed
- [ ] RLS policies prevent unauthorized access
- [ ] OAuth flow secure

## Monitoring and Maintenance

### 1. Set up Monitoring
- **Vercel Analytics** (if using Vercel)
- **Supabase Dashboard** for database monitoring
- **Error tracking** with Sentry (optional)

### 2. Regular Maintenance
- Monitor Supabase usage and billing
- Update dependencies regularly
- Backup database periodically
- Monitor performance metrics

## Troubleshooting Common Issues

### Build Errors
- Check Node.js version (should be 18+)
- Clear node_modules and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check for TypeScript errors: `npm run type-check`

### Runtime Errors
- Check browser console for errors
- Verify environment variables are set correctly
- Check Supabase connection in network tab
- Verify GitHub OAuth configuration

### Performance Issues
- Analyze bundle with: `npm run build -- --analyze`
- Check image optimization is working
- Monitor Supabase query performance
- Use browser dev tools Performance tab