#!/bin/bash
# Linscope VirusTotal Integration - Setup Script

set -e

echo "🔧 Linscope VirusTotal Integration Setup"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env created. Please update with your VirusTotal API key."
    echo ""
    echo "📖 Steps to get your API key:"
    echo "   1. Go to: https://www.virustotal.com/"
    echo "   2. Sign up for a free account"
    echo "   3. Visit: https://www.virustotal.com/gui/my-apikey"
    echo "   4. Copy your API key"
    echo "   5. Add to .env: VIRUSTOTAL_API_KEY=your_key_here"
    echo ""
else
    echo "✅ .env file already exists"
fi

# Check backend
echo ""
echo "🔍 Checking Backend Setup..."
if [ -f "backend/virustotal.py" ]; then
    echo "✅ backend/virustotal.py found"
else
    echo "❌ backend/virustotal.py not found"
    exit 1
fi

# Check frontend
echo ""
echo "🔍 Checking Frontend Setup..."
if [ -f "frontend/src/hooks/useVirusTotal.ts" ]; then
    echo "✅ frontend/src/hooks/useVirusTotal.ts found"
else
    echo "❌ frontend/src/hooks/useVirusTotal.ts not found"
    exit 1
fi

# Summary
echo ""
echo "════════════════════════════════════════"
echo "✅ Setup Complete!"
echo "════════════════════════════════════════"
echo ""
echo "📚 Documentation:"
echo "   • Quick Start: docs/QUICK_REFERENCE.md"
echo "   • Full Guide: docs/VIRUSTOTAL_INTEGRATION.md"
echo "   • Technical: docs/IMPLEMENTATION_SUMMARY.md"
echo ""
echo "🚀 Next Steps:"
echo "   1. Edit .env with your VirusTotal API key"
echo "   2. Start Backend: cd backend && python -m uvicorn main:app --reload"
echo "   3. Start Frontend: cd frontend && npm run dev"
echo "   4. Open http://localhost:5173"
echo "   5. Go to Settings → Intelligence API → Add API Key"
echo ""
echo "✨ Enjoy real-time threat intelligence!"
