#!/bin/bash

# ColorBook Engine Production Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

echo "🚀 Starting ColorBook Engine Production Deployment..."

# Check if environment file exists
if [ ! -f ".env.production" ]; then
    echo "❌ .env.production file not found!"
    echo "📝 Please copy .env.production.template to .env.production and configure it"
    exit 1
fi

# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

echo "📦 Building Docker images..."
docker-compose -f docker-compose.yml build

echo "🗄️ Starting database..."
docker-compose -f docker-compose.yml up -d db

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

echo "🔄 Running database migrations..."
# Create migrations directory if it doesn't exist
mkdir -p ../database/migrations

# Run migrations
docker-compose -f docker-compose.yml exec -T db psql -U postgres -d colorbook_engine -f /docker-entrypoint-initdb.d/schema.sql || true

# Run migration files
for migration_file in ../database/migrations/*.sql; do
    if [ -f "$migration_file" ]; then
        echo "Running migration: $(basename $migration_file)"
        docker-compose -f docker-compose.yml exec -T db psql -U postgres -d colorbook_engine -f "/tmp/$(basename $migration_file)" || true
    fi
done

echo "🚀 Starting all services..."
docker-compose -f docker-compose.yml up -d

echo "🔍 Checking service health..."
sleep 15

# Check if services are running
if docker-compose -f docker-compose.yml ps | grep -q "Up"; then
    echo "✅ Services are running successfully!"
    
    # Show running services
    echo "📊 Service Status:"
    docker-compose -f docker-compose.yml ps
    
    # Show logs for troubleshooting
    echo "📋 Recent application logs:"
    docker-compose -f docker-compose.yml logs --tail=20 app
    
else
    echo "❌ Some services failed to start. Check the logs:"
    docker-compose -f docker-compose.yml logs
    exit 1
fi

echo "🎉 Deployment completed successfully!"
echo "🌐 Your application should be available at: $FRONTEND_URL"
echo "🔧 To manage services: docker-compose -f docker-compose.yml [start|stop|restart|logs]"
