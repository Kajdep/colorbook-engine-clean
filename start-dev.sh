#!/bin/bash

echo "🎨 Starting ColorBook Engine Development Server..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

echo "🚀 Starting development server..."
echo "📍 Open your browser to http://localhost:3000"
echo ""

# Start the development server
npm run dev
