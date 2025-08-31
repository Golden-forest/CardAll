#!/bin/bash

echo "🚀 CardAll Production Setup Script"
echo "=================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your Supabase credentials."
    echo ""
else
    echo "✅ .env file already exists."
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo "✅ Dependencies installed."
    echo ""
fi

# Build the project
echo "🔨 Building production version..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
    
    # Show next steps
    echo "🎯 Next Steps:"
    echo "1. Set up Supabase project (see docs/supabase-setup.md)"
    echo "2. Configure GitHub OAuth (see docs/github-oauth-setup.md)"
    echo "3. Update .env with your credentials"
    echo "4. Deploy to production (see docs/deployment-guide.md)"
    echo "5. Run comprehensive tests (see docs/testing-guide.md)"
    echo ""
    echo "📚 Documentation available in /docs folder:"
    echo "   - supabase-setup.md"
    echo "   - github-oauth-setup.md" 
    echo "   - deployment-guide.md"
    echo "   - testing-guide.md"
    echo ""
    echo "🧪 Test locally with: npm run preview"
    echo "🚀 Ready for deployment!"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi