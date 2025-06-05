#!/bin/bash
# Load API credentials for tests and run backend tests
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.test"

if [ -f "$ENV_FILE" ]; then
  echo "Loading test credentials from $ENV_FILE"
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
else
  echo "No .env.test file found. Using existing environment variables."
fi

cd "$ROOT_DIR/backend" || exit 1
npm test "$@"
