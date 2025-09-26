# DQuant Trading Backend - TypeScript Edition

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=for-the-badge&logo=fastify&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)

Intelligent Trading Strategy Agent Backend Service built with TypeScript, Fastify, and comprehensive type safety.

## 🚀 Features

- **🔥 High Performance**: Built on Fastify for superior performance
- **📝 Full Type Safety**: Complete TypeScript coverage with strict typing
- **📚 API Documentation**: Comprehensive Swagger/OpenAPI documentation
- **🎯 AI-Driven**: Strategy generation using OpenRouter AI integration
- **📊 Real-time Data**: WebSocket streaming for live market data
- **💱 Multi-Mode Trading**: Paper trading, backtesting, and live trading
- **🔒 Enterprise Security**: JWT authentication, rate limiting, input validation
- **📈 Risk Management**: Built-in position sizing and risk controls
- **🎛️ Monitoring**: Structured logging and health checks

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Fastify 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **WebSocket**: Fastify WebSocket plugin
- **Documentation**: Swagger/OpenAPI 3.0
- **Testing**: Jest with TypeScript
- **Linting**: ESLint + TypeScript ESLint

### Core Components
- **API Layer**: RESTful endpoints with full OpenAPI documentation
- **WebSocket Server**: Real-time data streaming and notifications
- **Trading Engine**: Strategy execution with paper and live trading
- **AI Integration**: Strategy generation and optimization
- **Risk Management**: Position sizing and loss protection
- **Data Pipeline**: Real-time market data processing

## 🛠️ Quick Start

### Prerequisites
```bash
node >= 18.0.0
npm >= 9.0.0
postgresql >= 14.0
redis >= 6.0
```

### Installation

1. **Clone and Install**
```bash
git clone <repository>
cd backend
cp .env.example.ts .env
npm install
```

2. **Environment Configuration**
```bash
# Edit .env with your configuration
nano .env

# Required variables:
DATABASE_URL="postgresql://user:pass@localhost:5432/dquant"
REDIS_URL="redis://localhost:6379"
BINANCE_API_KEY="your_api_key"
BINANCE_SECRET="your_secret"
OPENROUTER_API_KEY="your_openrouter_key"
JWT_SECRET="your_jwt_secret_32_chars_minimum"
SESSION_SECRET="your_session_secret_32_chars_minimum"
```

3. **Database Setup**
```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Optional: Seed database
npm run prisma:seed
```

4. **Development Server**
```bash
# Start development server with hot reload
npm run dev

# Or build and start production
npm run build
npm start
```

### 🌐 API Access

- **API Base**: `http://localhost:3000/api`
- **Documentation**: `http://localhost:3000/documentation`
- **Health Check**: `http://localhost:3000/health`
- **OpenAPI Spec**: `http://localhost:3000/openapi.json`
- **WebSocket**: `ws://localhost:3000/ws`

## 📖 API Documentation

### Core Endpoints

#### Health & Status
- `GET /health` - System health check
- `GET /api/` - API information
- `GET /api/status` - Detailed API status

#### Conversations (AI Chat)
- `GET /api/conversations` - List conversations
- `POST /api/conversations` - Create conversation
- `POST /api/conversations/:id/messages` - Add message
- `POST /api/conversations/:id/compress` - Compress memory

#### Trading Strategies
- `GET /api/strategies` - List strategies
- `POST /api/strategies` - Create strategy
- `PUT /api/strategies/:id` - Update strategy
- `POST /api/strategies/:id/optimize` - Optimize parameters

#### Backtesting
- `POST /api/backtest/run` - Run backtest
- `GET /api/backtest/:id` - Get results

#### Paper Trading
- `POST /api/paper/start` - Start simulation
- `GET /api/paper/portfolio` - Get portfolio

#### Live Trading
- `POST /api/live/start` - Start live trading
- `POST /api/live/stop` - Stop trading
- `GET /api/live/positions` - Get positions

### WebSocket Events

#### Connection Events
- `connected` - Connection established
- `authenticated` - User authenticated
- `ping/pong` - Connection heartbeat

#### Room Management
- `join_room` - Join event room
- `leave_room` - Leave event room
- `room_joined/room_left` - Room status updates

#### Data Streams
- `subscribe_market_data` - Real-time prices
- `subscribe_strategy_updates` - Strategy events
- `subscribe_trading_updates` - Trade notifications

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix
```

## 🔧 Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm start               # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
npm run prisma:seed     # Seed database

# Code Quality
npm run type-check      # TypeScript type checking
npm run lint            # ESLint checking
npm run lint:fix        # Fix linting issues
npm test               # Run tests
npm run clean          # Clean build directory
```

## 📊 Monitoring & Logging

### Structured Logging
- **Winston** for structured logging
- **Category-based** loggers (API, Database, Trading, etc.)
- **Context-aware** logging with request tracking
- **Performance** metrics and slow query detection

### Health Checks
- Database connectivity
- Redis connectivity
- External service status
- Memory and CPU usage

### Error Handling
- **Typed exceptions** with proper error codes
- **Validation errors** with detailed messages
- **External service errors** with retry logic
- **Rate limiting** with security logging

## 🔐 Security

### Authentication & Authorization
- JWT-based authentication
- API key support
- Role-based access control (planned)
- Session management

### Security Middleware
- Helmet.js security headers
- CORS configuration
- Rate limiting by IP
- Input validation and sanitization
- Request size limits

### Data Protection
- Environment variable validation
- Secret key requirements
- SQL injection prevention (Prisma)
- XSS protection

## 🏭 Production Deployment

### Environment Variables
Ensure all required environment variables are set:
- Database connection
- Redis connection
- API keys and secrets
- Security tokens
- External service URLs

### Performance Optimization
- Enable production logging
- Configure proper memory limits
- Set up connection pooling
- Enable HTTP/2 (if using reverse proxy)

### Monitoring
- Health check endpoints
- Structured logging
- Error tracking
- Performance metrics

## 📋 Migration Progress

This is the TypeScript migration of the original JavaScript backend. See [MIGRATION_DOCUMENTATION.md](./MIGRATION_DOCUMENTATION.md) for detailed migration status and plans.

### ✅ Completed (Phase 1)
- TypeScript project structure
- Fastify application setup
- Environment configuration with validation
- Database integration with Prisma
- Structured logging system
- WebSocket server foundation
- Error handling and middleware
- API documentation with Swagger

### 🚧 In Progress
- Core service migrations
- API endpoint implementations
- Trading system components

### 📅 Planned
- Strategy DSL processor
- AI integration services
- Live trading implementation
- Complete API coverage

## 🤝 Contributing

1. Follow TypeScript best practices
2. Maintain type safety (no `any` types)
3. Add comprehensive tests
4. Update API documentation
5. Follow existing code patterns

## 📄 License

MIT License - see LICENSE file for details

---

**DQuant Backend TypeScript Edition** - Built for performance, type safety, and developer experience.