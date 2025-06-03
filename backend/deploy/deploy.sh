#!/bin/bash

# ColorBook Engine Production Deployment Script
echo "🚀 Deploying ColorBook Engine to Production..."

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | xargs)
else
    echo "❌ .env.production file not found!"
    exit 1
fi

# Build and deploy with Docker
echo "📦 Building Docker containers..."
docker-compose -f deploy/docker-compose.yml build

echo "🗄️ Starting database..."
docker-compose -f deploy/docker-compose.yml up -d db

echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🚀 Starting application..."
docker-compose -f deploy/docker-compose.yml up -d

echo "✅ Deployment complete!"
echo "🌐 Application available at: http://localhost"
echo "📊 Health check: http://localhost/api/health"

# Health check
echo "🔍 Running health check..."
sleep 5
curl -f http://localhost/api/health || echo "❌ Health check failed"

echo "🎉 ColorBook Engine is now live!"
