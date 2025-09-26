# DQuant Backend TypeScript Environment Configuration

# Server Configuration
NODE_ENV=development
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Database Configuration (PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/dquant_db"

# Redis Configuration
REDIS_URL="redis://localhost:6379"
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Binance API Configuration (for live trading)
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_SECRET=your_binance_secret_key_here
ENABLE_LIVE_TRADING=false

# OpenRouter AI Configuration
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
DEFAULT_MODEL=anthropic/claude-sonnet-4

# Security Configuration
JWT_SECRET=your_jwt_secret_at_least_32_characters_long_for_security
SESSION_SECRET=your_session_secret_at_least_32_characters_long_for_security

# Trading Risk Management Configuration
MAX_DAILY_LOSS=500
MAX_OPEN_POSITIONS=5
MAX_POSITION_SIZE=10000
MIN_ACCOUNT_BALANCE=1000

# External Services Configuration
FRONTEND_URL=http://localhost:5173
SOCKET_PORT=3001

# Development/Testing Configuration
# Uncomment for development overrides
# DATABASE_URL="postgresql://dev:dev@localhost:5432/dquant_dev"
# REDIS_URL="redis://localhost:6380"
# ENABLE_LIVE_TRADING=false