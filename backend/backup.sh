#!/bin/bash

# Database Backup Script for ColorBook Engine
# Usage: ./backup.sh [backup_directory]
# Requires pg_dump to be installed and accessible

set -e
BACKUP_DIR=${1:-./backups}
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "❌ .env file not found"
  exit 1
fi

if [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
  echo "❌ Database configuration missing in .env"
  exit 1
fi

FILENAME="$BACKUP_DIR/${DB_NAME}_$TIMESTAMP.sql"

# Use PGPASSWORD for authentication if DB_PASSWORD is set
if [ -n "$DB_PASSWORD" ]; then
  PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$FILENAME"
else
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$FILENAME"
fi

echo "✅ Backup created at $FILENAME"
