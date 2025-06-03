#!/bin/bash

# ColorBook Engine Backend Setup Script

echo "🎨 Setting up ColorBook Engine Backend..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL is not installed or not in PATH"
    echo "Please install PostgreSQL 12+ before continuing"
    echo "- Windows: https://www.postgresql.org/download/windows/"
    echo "- macOS: brew install postgresql"
    echo "- Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Navigate to backend directory
cd backend

echo "📦 Installing dependencies..."
npm install

# Copy environment file
if [ ! -f .env ]; then
    echo "📋 Creating environment file..."
    cp .env.example .env
    echo "✅ Created .env file. Please update it with your configuration."
else
    echo "⚠️  .env file already exists"
fi

# Create uploads directory
mkdir -p uploads/{images,drawings,exports}
echo "📁 Created upload directories"

# Create logs directory
mkdir -p logs
echo "📁 Created logs directory"

# Database setup
echo "🗄️  Setting up database..."
read -p "Do you want to create the database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter PostgreSQL username (default: postgres): " DB_USER
    DB_USER=${DB_USER:-postgres}
    
    read -p "Enter database name (default: colorbook_engine): " DB_NAME
    DB_NAME=${DB_NAME:-colorbook_engine}
    
    echo "Creating database $DB_NAME..."
    createdb -U $DB_USER $DB_NAME 2>/dev/null || echo "Database might already exist"
    
    echo "Running database schema..."
    psql -U $DB_USER -d $DB_NAME -f database/schema.sql
    
    echo "✅ Database setup complete"
fi

# Generate JWT secret
if grep -q "your-super-secret-jwt-key" .env; then
    echo "🔐 Generating JWT secret..."
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    if [ "$(uname)" = "Darwin" ]; then
        # macOS
        sed -i '' "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    else
        # Linux
        sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env
    fi
    echo "✅ JWT secret generated"
fi

# Generate encryption key
if grep -q "32-character-hex-key" .env; then
    echo "🔐 Generating encryption key..."
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    if [ "$(uname)" = "Darwin" ]; then
        # macOS
        sed -i '' "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    else
        # Linux
        sed -i "s/ENCRYPTION_KEY=.*/ENCRYPTION_KEY=$ENCRYPTION_KEY/" .env
    fi
    echo "✅ Encryption key generated"
fi

echo ""
echo "🎉 Backend setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update the .env file with your database credentials"
echo "2. Configure Stripe keys if you want payment functionality"
echo "3. Set up email configuration for notifications"
echo "4. Run 'npm run dev' to start the development server"
echo ""
echo "🚀 To start the backend:"
echo "cd backend && npm run dev"