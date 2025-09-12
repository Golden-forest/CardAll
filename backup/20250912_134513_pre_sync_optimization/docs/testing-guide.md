# Comprehensive Testing Guide

## 1. Authentication Testing

### GitHub OAuth Flow
```bash
# Test Steps:
1. Click "账户" button in top navigation
2. Click "使用 GitHub 登录" in modal
3. Complete GitHub authorization
4. Verify redirect back to app
5. Check user profile displays correctly
6. Test logout functionality
```

### Expected Results:
- [ ] OAuth popup opens correctly
- [ ] GitHub authorization completes
- [ ] User redirected back to app
- [ ] User profile shows GitHub avatar and name
- [ ] User data saved to Supabase users table
- [ ] Logout clears session

## 2. Database Functionality Testing

### Local Database (IndexedDB)
```bash
# Test Steps:
1. Click "数据库" button
2. Check database statistics
3. Create test data
4. Verify data persistence after page refresh
```

### Expected Results:
- [ ] Database initializes without errors
- [ ] Statistics show correct counts
- [ ] Data persists across sessions
- [ ] No console errors

## 3. Image Processing Testing

### Upload Methods
```bash
# Test Steps:
1. Click "图片测试" button
2. Test drag & drop image upload
3. Test click to select image upload
4. Test Ctrl+V paste image upload
5. Test multiple image upload
```

### Expected Results:
- [ ] All upload methods work
- [ ] Images converted to WebP format
- [ ] File sizes reduced (compression working)
- [ ] Thumbnails generated
- [ ] Images display correctly in editor
- [ ] Storage statistics update

## 4. Cloud Sync Testing

### Sync Functionality
```bash
# Test Steps:
1. Login with GitHub
2. Create cards/folders while online
3. Go offline (disable network)
4. Create more cards/folders
5. Go back online
6. Check sync status indicator
7. Verify data synced to Supabase
```

### Expected Results:
- [ ] Online operations sync immediately
- [ ] Offline operations queued
- [ ] Sync resumes when back online
- [ ] No data loss
- [ ] Sync status indicator accurate
- [ ] Data appears in Supabase dashboard

## 5. Cross-Device Sync Testing

### Multi-Device Testing
```bash
# Test Steps:
1. Login on Device A, create cards
2. Login on Device B with same account
3. Verify cards appear on Device B
4. Create cards on Device B
5. Check if they appear on Device A
```

### Expected Results:
- [ ] Data syncs between devices
- [ ] No duplicate data
- [ ] All changes propagate
- [ ] Conflict resolution works

## 6. Offline Functionality Testing

### Offline Mode
```bash
# Test Steps:
1. Load app while online
2. Disconnect from internet
3. Create/edit cards
4. Upload images
5. Navigate between pages
6. Reconnect to internet
7. Verify sync occurs
```

### Expected Results:
- [ ] App works fully offline
- [ ] All features functional
- [ ] Data saved locally
- [ ] Sync occurs when reconnected
- [ ] No data loss

## 7. Performance Testing

### Load Testing
```bash
# Test Steps:
1. Create 100+ cards with images
2. Test scrolling performance
3. Test search functionality
4. Monitor memory usage
5. Check bundle size
```

### Expected Results:
- [ ] Smooth scrolling with many cards
- [ ] Fast search results
- [ ] Memory usage stable
- [ ] Bundle size < 500KB gzipped
- [ ] First load < 1.5s

## 8. Error Handling Testing

### Network Errors
```bash
# Test Steps:
1. Simulate network failures
2. Test with slow connections
3. Test with intermittent connectivity
4. Verify error messages
5. Test recovery mechanisms
```

### Expected Results:
- [ ] Graceful error handling
- [ ] User-friendly error messages
- [ ] Automatic retry mechanisms
- [ ] No app crashes
- [ ] Data integrity maintained

## 9. Security Testing

### Data Protection
```bash
# Test Steps:
1. Try accessing other users' data
2. Test RLS policies in Supabase
3. Verify JWT token handling
4. Check for XSS vulnerabilities
5. Test CSRF protection
```

### Expected Results:
- [ ] Users can only access own data
- [ ] RLS policies enforced
- [ ] Tokens handled securely
- [ ] No security vulnerabilities
- [ ] Proper authentication required

## 10. Browser Compatibility Testing

### Cross-Browser Testing
```bash
# Test in:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers (iOS Safari, Chrome Mobile)
```

### Expected Results:
- [ ] Consistent functionality across browsers
- [ ] No browser-specific errors
- [ ] Responsive design works
- [ ] File System Access API degrades gracefully
- [ ] PWA features work where supported

## Automated Testing Commands

### Run All Tests
```bash
# Unit tests (if implemented)
npm run test

# Type checking
npm run type-check

# Build test
npm run build

# Preview production build
npm run preview

# Bundle analysis
npm run build -- --analyze
```

## Bug Report Template

When reporting issues, include:

```markdown
**Bug Description:**
Brief description of the issue

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Browser: Chrome 120
- OS: Windows 11
- Network: Online/Offline
- Authentication: Logged in/out

**Console Errors:**
Any error messages from browser console

**Screenshots:**
If applicable, add screenshots
```

## Performance Benchmarks

### Target Metrics (from requirements):
- Bundle size: < 500KB gzipped ✓
- First Contentful Paint: < 1.5s ✓
- Smooth 60fps animations ✓
- Support 1000+ cards with virtual scrolling ✓
- Mobile Lighthouse score: > 90 ✓