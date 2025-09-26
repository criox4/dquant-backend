-- CreateEnum
CREATE TYPE "conversation_status" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "message_role" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "strategy_status" AS ENUM ('DRAFT', 'TESTING', 'ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "trade_type" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "trade_side" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "trade_status" AS ENUM ('PENDING', 'EXECUTED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "conversations" (
    "id" SERIAL NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "status" "conversation_status" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" SERIAL NOT NULL,
    "message_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "message_role" NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "is_compressed" BOOLEAN NOT NULL DEFAULT false,
    "original_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_snapshots" (
    "id" SERIAL NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "strategies" JSONB NOT NULL,
    "message_count" INTEGER NOT NULL,
    "tokens_saved" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" SERIAL NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT 'v1.0',
    "asset" TEXT NOT NULL DEFAULT 'BTC/USDT',
    "timeframe" TEXT NOT NULL DEFAULT '1h',
    "indicators" JSONB NOT NULL DEFAULT '[]',
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "entry_rules" JSONB NOT NULL DEFAULT '[]',
    "exit_rules" JSONB NOT NULL DEFAULT '[]',
    "risk_management" JSONB NOT NULL DEFAULT '{}',
    "code" TEXT,
    "backtest_results" JSONB NOT NULL DEFAULT '[]',
    "performance" JSONB,
    "status" "strategy_status" NOT NULL DEFAULT 'DRAFT',
    "saved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" SERIAL NOT NULL,
    "trade_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "type" "trade_type" NOT NULL,
    "side" "trade_side" NOT NULL DEFAULT 'LONG',
    "price" DECIMAL(20,8) NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "value" DECIMAL(20,8) NOT NULL,
    "commission" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "slippage" DECIMAL(20,8) NOT NULL DEFAULT 0,
    "pnl" DECIMAL(20,8),
    "pnl_percent" DECIMAL(10,4),
    "reason" TEXT,
    "signal" JSONB NOT NULL DEFAULT '{}',
    "execution_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_backtest" BOOLEAN NOT NULL DEFAULT false,
    "exchange_order_id" TEXT,
    "status" "trade_status" NOT NULL DEFAULT 'EXECUTED',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "api_keys" JSONB,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_conversation_id_key" ON "conversations"("conversation_id");

-- CreateIndex
CREATE INDEX "conversations_user_id_idx" ON "conversations"("user_id");

-- CreateIndex
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_message_id_key" ON "messages"("message_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_role_idx" ON "messages"("role");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_snapshots_snapshot_id_key" ON "conversation_snapshots"("snapshot_id");

-- CreateIndex
CREATE INDEX "conversation_snapshots_conversation_id_idx" ON "conversation_snapshots"("conversation_id");

-- CreateIndex
CREATE INDEX "conversation_snapshots_created_at_idx" ON "conversation_snapshots"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "strategies_strategy_id_key" ON "strategies"("strategy_id");

-- CreateIndex
CREATE INDEX "strategies_user_id_idx" ON "strategies"("user_id");

-- CreateIndex
CREATE INDEX "strategies_conversation_id_idx" ON "strategies"("conversation_id");

-- CreateIndex
CREATE INDEX "strategies_status_idx" ON "strategies"("status");

-- CreateIndex
CREATE INDEX "strategies_asset_idx" ON "strategies"("asset");

-- CreateIndex
CREATE UNIQUE INDEX "trades_trade_id_key" ON "trades"("trade_id");

-- CreateIndex
CREATE INDEX "trades_user_id_idx" ON "trades"("user_id");

-- CreateIndex
CREATE INDEX "trades_strategy_id_idx" ON "trades"("strategy_id");

-- CreateIndex
CREATE INDEX "trades_symbol_idx" ON "trades"("symbol");

-- CreateIndex
CREATE INDEX "trades_type_idx" ON "trades"("type");

-- CreateIndex
CREATE INDEX "trades_execution_time_idx" ON "trades"("execution_time");

-- CreateIndex
CREATE INDEX "trades_is_backtest_idx" ON "trades"("is_backtest");

-- CreateIndex
CREATE UNIQUE INDEX "users_user_id_key" ON "users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_snapshots" ADD CONSTRAINT "conversation_snapshots_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("conversation_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("conversation_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("strategy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
