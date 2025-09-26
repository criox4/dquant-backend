-- CreateEnum
CREATE TYPE "backtest_status" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "backtest_results" (
    "id" SERIAL NOT NULL,
    "backtest_id" TEXT NOT NULL,
    "strategy_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "initial_capital" DECIMAL(20,8) NOT NULL,
    "commission" DECIMAL(10,4) NOT NULL,
    "slippage" DECIMAL(10,4) NOT NULL,
    "final_equity" DECIMAL(20,8) NOT NULL,
    "total_return" DECIMAL(10,4) NOT NULL,
    "annualized_return" DECIMAL(10,4),
    "sharpe_ratio" DECIMAL(10,4),
    "max_drawdown" DECIMAL(10,4) NOT NULL,
    "win_rate" DECIMAL(10,4) NOT NULL,
    "profit_factor" DECIMAL(10,4),
    "total_trades" INTEGER NOT NULL,
    "winning_trades" INTEGER NOT NULL,
    "losing_trades" INTEGER NOT NULL,
    "gross_profit" DECIMAL(20,8),
    "gross_loss" DECIMAL(20,8),
    "average_win" DECIMAL(10,4),
    "average_loss" DECIMAL(10,4),
    "trades" JSONB NOT NULL,
    "equity_curve" JSONB NOT NULL,
    "drawdown_curve" JSONB,
    "metrics" JSONB,
    "status" "backtest_status" NOT NULL DEFAULT 'COMPLETED',
    "execution_time" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtest_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "backtest_results_backtest_id_key" ON "backtest_results"("backtest_id");

-- CreateIndex
CREATE INDEX "backtest_results_strategy_id_idx" ON "backtest_results"("strategy_id");

-- CreateIndex
CREATE INDEX "backtest_results_user_id_idx" ON "backtest_results"("user_id");

-- CreateIndex
CREATE INDEX "backtest_results_created_at_idx" ON "backtest_results"("created_at");

-- AddForeignKey
ALTER TABLE "backtest_results" ADD CONSTRAINT "backtest_results_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("strategy_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtest_results" ADD CONSTRAINT "backtest_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
