#!/bin/bash

# Purex Protocol — Robust Start Script
# Usage: ./start.sh [dev|prod]

set -e  # Exit on any error

MODE="${1:-dev}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-3001}"
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 Starting Purex Protocol in $MODE mode..."
echo "📍 Backend port: $BACKEND_PORT"
echo "📍 Frontend port: $FRONTEND_PORT"
echo "📍 Project root: $PROJECT_ROOT"
echo ""

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -i :$port >/dev/null 2>&1; then
        echo "❌ Port $port is already in use"
        return 1
    fi
    return 0
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $url to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo "✅ $url is ready!"
            return 0
        fi
        echo "⏳ Attempt $attempt/$max_attempts..."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    echo "❌ $url failed to start"
    return 1
}

# Stop existing processes
echo "🛑 Stopping existing servers..."
pkill -f "manage.py runserver" 2>/dev/null || true
pkill -f "node.*vite" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
pkill -f "ngrok" 2>/dev/null || true
sleep 2

# Check ports
echo "🔍 Checking ports..."
check_port $BACKEND_PORT || exit 1
check_port $FRONTEND_PORT || exit 1

# Start PostgreSQL
echo "🐘 Starting PostgreSQL on port 5433..."
if ! pg_ctl -D /opt/homebrew/var/postgresql@14 -o "-p 5433" status >/dev/null 2>&1; then
    pg_ctl -D /opt/homebrew/var/postgresql@14 -o "-p 5433" start
    sleep 2
else
    echo "✅ PostgreSQL already running"
fi

# Start Redis (required for Celery)
echo "🔴 Starting Redis..."
if ! redis-cli ping >/dev/null 2>&1; then
    redis-server --daemonize yes --port 6379 > /tmp/redis.log 2>&1
    sleep 2
    echo "✅ Redis started"
else
    echo "✅ Redis already running"
fi

# Backend
echo "🔧 Starting Django backend..."
cd "$PROJECT_ROOT/Backend"
if [ "$MODE" = "prod" ]; then
    export DJANGO_SETTINGS_MODULE=config.settings_production
    python3 manage.py runserver 0.0.0.0:$BACKEND_PORT > /tmp/backend.log 2>&1 &
else
    export DJANGO_SETTINGS_MODULE=config.settings
    python3 manage.py runserver 0.0.0.0:$BACKEND_PORT > /tmp/backend.log 2>&1 &
fi
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait for backend to be ready
if ! wait_for_service "http://localhost:$BACKEND_PORT"; then
    echo "❌ Backend failed to start. Check /tmp/backend.log"
    tail -10 /tmp/backend.log
    exit 1
fi

# Start Celery worker
echo "🔄 Starting Celery worker..."
cd "$PROJECT_ROOT/Backend"
celery -A config worker --loglevel=info > /tmp/celery_worker.log 2>&1 &
CELERY_WORKER_PID=$!
echo "✅ Celery worker started (PID: $CELERY_WORKER_PID)"

# Start Celery beat (scheduler)
echo "⏰ Starting Celery beat..."
celery -A config beat --loglevel=info > /tmp/celery_beat.log 2>&1 &
CELERY_BEAT_PID=$!
echo "✅ Celery beat started (PID: $CELERY_BEAT_PID)"

sleep 2

# Frontend
echo "⚡ Starting React frontend..."
cd "$PROJECT_ROOT/Front/Phoenix-Protocol"
# Clear Vite dep cache to prevent stale module errors (Invalid hook call, duplicate React, etc.)
rm -rf node_modules/.vite 2>/dev/null || true
if [ "$MODE" = "prod" ]; then
    npm run build && npm run preview > /tmp/frontend.log 2>&1 &
else
    npm run dev > /tmp/frontend.log 2>&1 &
fi
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

# Wait for frontend to be ready
if ! wait_for_service "http://localhost:$FRONTEND_PORT"; then
    echo "❌ Frontend failed to start. Check /tmp/frontend.log"
    tail -10 /tmp/frontend.log
    exit 1
fi

# Ngrok
echo "🌐 Starting ngrok..."
cd "$PROJECT_ROOT/Front/Phoenix-Protocol"
ngrok http $FRONTEND_PORT > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo "✅ Ngrok started (PID: $NGROK_PID)"

# Wait for ngrok to be ready
sleep 5
NGROK_URL=$(curl -s http://127.0.0.1:4040/api/tunnels | grep -o 'https://[^"]*\.ngrok[^"]*' | head -1)
if [ -z "$NGROK_URL" ]; then
    echo "❌ Ngrok failed to start. Check /tmp/ngrok.log"
    tail -10 /tmp/ngrok.log
    exit 1
fi

# Auto-update vite.config.ts allowedHosts with new ngrok domain
NGROK_DOMAIN=$(echo "$NGROK_URL" | sed 's|https://||')
VITE_CONFIG="$PROJECT_ROOT/Front/Phoenix-Protocol/vite.config.ts"
if [ -n "$NGROK_DOMAIN" ] && [ -f "$VITE_CONFIG" ]; then
    sed -i '' "s|allowedHosts: \[.*\]|allowedHosts: ['$NGROK_DOMAIN']|" "$VITE_CONFIG"
    echo "✅ Updated vite.config.ts allowedHosts → $NGROK_DOMAIN"
fi

echo ""
echo "🎉 Purex Protocol is up!"
echo "🔗 Frontend: http://localhost:$FRONTEND_PORT"
echo "🔗 Backend API: http://localhost:$BACKEND_PORT"
echo "🔗 Django Admin: http://localhost:$BACKEND_PORT/admin/"
echo "🔗 Ngrok URL: $NGROK_URL"
echo "🔗 Ngrok UI: http://127.0.0.1:4040"
echo ""
echo "📋 Logs:"
echo "   Backend: /tmp/backend.log"
echo "   Frontend: /tmp/frontend.log"
echo "   Ngrok: /tmp/ngrok.log"
echo "   Celery Worker: /tmp/celery_worker.log"
echo "   Celery Beat: /tmp/celery_beat.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Trap Ctrl+C to clean up
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID $NGROK_PID $CELERY_WORKER_PID $CELERY_BEAT_PID 2>/dev/null || true
    echo "✅ All services stopped"
    exit 0
}
trap cleanup INT

# Wait for background processes
wait
