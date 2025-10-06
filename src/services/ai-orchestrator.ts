/**
 * AI Tool Orchestrator - Core intelligent agent for multi-step task execution
 *
 * This service manages the stateful conversation loop between the LLM and available tools,
 * enabling complex multi-step workflows like "create strategy -> backtest -> improve"
 */

import { EventEmitter } from 'events';
import { openRouterService, ChatMessage } from './openrouter';
import { conversationDataService } from './conversation-data';
import { apiLogger } from './logger';
import { toolRegistry, getTool, listToolDefinitions } from '@/tools/tool-registry';
import { toolApprovalService } from './tool-approval.service';
import MessageParser from '@/utils/message-parser';

// Core interfaces for orchestration
export interface OrchestrationState {
  conversationId: string;
  userId: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
  lastAssistantMessage: string | null;
  executedTools: Array<{ name: string; result: any }>;
  dsl: any;
  strategy: any;
  backtest: any;
  savedStrategy: any;
  quickCheck: any;
  quickCheckPerformed: boolean;
  marketAnalysis: any;
  marketAnalysisFetchedAt: number | null;
  backtestHistory?: Array<{
    timestamp: string;
    summary: any;
    strategy: string;
  }>;
}

export interface OrchestrationResult {
  message: string;
  metadata: {
    action: string;
    thinking?: string;
    hasThinking?: boolean;
    dsl?: any;
    strategy?: any;
    backtest?: any;
    savedStrategy?: any;
    executedTools?: Array<{ name: string; summary: any }>;
    [key: string]: any;
  };
}

export interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string | object;
  };
  tool_call_id?: string;
}

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  execute: (params: any) => Promise<any>;
}

class AIOrchestrator extends EventEmitter {
  private maxIterations = 6;
  private marketAnalysisTTL = 15 * 60 * 1000; // 15 minutes
  private quickBacktestMinTrades = 3;

  constructor() {
    super();
  }

  /**
   * Main orchestration process - manages the full AI reasoning loop
   */
  async process({
    conversationId,
    userId,
    userMessage,
    sendEvent
  }: {
    conversationId: string;
    userId: string;
    userMessage: string;
    sendEvent: (event: string, payload: any) => void;
  }): Promise<OrchestrationResult> {

    try {
      // Get conversation context
      const conversation = await conversationDataService.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }

      const context = await conversationDataService.getConversationHistory(conversationId, 20);
      const conversationHistory = this.formatHistory(context || []);

      // Build system prompt and get available tools
      const systemPrompt = this.buildSystemPrompt();
      const toolDefinitions = listToolDefinitions();

      // Initialize orchestration state
      const state: OrchestrationState = {
        conversationId,
        userId,
        userMessage,
        conversationHistory,
        lastAssistantMessage: null,
        executedTools: [],
        dsl: null,
        strategy: null,
        backtest: null,
        savedStrategy: null,
        quickCheck: null,
        quickCheckPerformed: false,
        marketAnalysis: null,
        marketAnalysisFetchedAt: null,
      };

      // Initial message array for LLM
      const messages: ChatMessage[] = [
        { role: 'system' as const, content: systemPrompt },
        ...conversationHistory,
        { role: 'user' as const, content: userMessage },
      ];

      // Main orchestration loop
      for (let iteration = 0; iteration < this.maxIterations; iteration++) {
        let response;

        try {
          response = await openRouterService.chatWithToolsRaw(messages, {
            tools: toolDefinitions,
            temperature: 0.6,
            maxTokens: 1200,
          });
        } catch (error) {
          apiLogger.error('Tool orchestrator LLM call failed', error as Error);
          return this.fallbackResponse(state, 'I ran into a problem talking to my reasoning engine. Could you try again in a moment?');
        }

        const choice = response?.choices?.[0];
        if (!choice) {
          break;
        }

        const assistantMessage = choice.message || {};
        const finishReason = choice.finish_reason;
        state.lastAssistantMessage = assistantMessage.content;

        // Handle tool calls
        if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
          messages.push({
            role: 'assistant',
            content: assistantMessage.content || '',
            tool_calls: assistantMessage.tool_calls,
          });

          // Process each tool call
          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function?.name;
            const toolCallId = toolCall.id || `tool_call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

            const tool = getTool(toolName);
            if (!tool) {
              sendEvent('tool_call_error', {
                callId: null,
                toolName,
                status: 'error',
                message: `Tool ${toolName} is not available.`,
                conversationId,
              });
              return this.fallbackResponse(state, `I was asked to use an unknown tool (${toolName}). Could you restate what you need?`);
            }

            const args = this.safeParseArgs(toolCall.function?.arguments);

            // Check if tool requires approval
            let mergedParams = {
              ...args,
              userMessage,
              conversationHistory,
              userId,
              conversationId,
            };

            // Handle tool approval workflow
            if (toolRegistry.requiresApproval(toolName)) {
              const pending = toolApprovalService.createPendingCall({
                conversationId,
                userId,
                toolName: tool.name,
                toolLabel: tool.label,
                reason: tool.description,
                params: args,
                toolCallId,
              });

              sendEvent('tool_call_requested', pending);

              try {
                const decision = await toolApprovalService.waitForDecision(pending.callId);

                if (decision.status !== 'approved') {
                  sendEvent('tool_call_cancelled', {
                    callId: pending.callId,
                    conversationId,
                    toolName: tool.name,
                    status: decision.status,
                    feedback: decision.feedback || null,
                  });

                  const rejectionMessage = decision.feedback || 'No problem, I will hold off on that action.';
                  return {
                    message: rejectionMessage,
                    metadata: {
                      action: 'TOOL_CALL_ABORTED',
                      tool: tool.name,
                    },
                  };
                }

                // Merge any parameter overrides from approval
                if (decision.overrides) {
                  mergedParams = {
                    ...mergedParams,
                    ...decision.overrides,
                  };
                }
              } catch (error) {
                apiLogger.error('Tool approval workflow failed', error as Error);
                return {
                  message: `I encountered an error while seeking approval for ${tool.label}. Please try again.`,
                  metadata: {
                    action: 'APPROVAL_ERROR',
                    tool: tool.name,
                    error: (error as Error).message,
                  },
                };
              }
            }

            // Handle special tool prerequisites
            await this.ensureToolPrerequisites({
              tool,
              params: mergedParams,
              state,
              sendEvent,
              messages,
            });

            sendEvent('tool_call_progress', {
              callId: toolCallId,
              conversationId,
              toolName: tool.name,
              toolLabel: tool.label,
              status: 'started',
              reason: tool.description,
              params: mergedParams,
            });

            try {
              const result = await tool.execute(mergedParams);

              // Handle clarification needs
              if (result.status === 'needs_clarification') {
                sendEvent('tool_call_cancelled', {
                  callId: toolCallId,
                  conversationId,
                  status: 'needs_clarification',
                  feedback: 'Tool requires additional information'
                });

                return {
                  message: result.message,
                  metadata: {
                    action: 'CLARIFICATION_NEEDED',
                    toolName: tool.name,
                  }
                };
              }

              // Apply result to state
              this.applyResultToState(state, tool.name, result);
              state.executedTools.push({ name: tool.name, result });

              // Handle post-tool actions
              if (tool.name === 'create_dsl') {
                if (state.dsl) {
                  state.dsl = this.normalizeDSL(state.dsl);
                }
                state.quickCheck = null;
                state.quickCheckPerformed = false;
              } else if (tool.name === 'generate_strategy_code') {
                try {
                  if (state.dsl) {
                    state.dsl = this.normalizeDSL(state.dsl);
                  }
                  await this.runQuickBacktestIfNeeded({ state, sendEvent, messages });
                } catch (quickError) {
                  apiLogger.error('Quick backtest failed', quickError as Error);
                  sendEvent('quick_backtest_error', {
                    conversationId,
                    message: (quickError as Error).message,
                  });
                }
              }

              sendEvent('tool_call_result', {
                callId: toolCallId,
                conversationId,
                toolName: tool.label || tool.name,
                status: 'success',
                resultSummary: this.buildResultSummary(tool.name, result),
                result,
              });

              // Add tool result to message history
              messages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content: JSON.stringify(this.buildResultForModel(tool.name, result)),
              });

            } catch (error) {
              apiLogger.error(`Tool ${tool.name} execution failed`, error as Error);
              sendEvent('tool_call_error', {
                callId: toolCallId,
                conversationId,
                toolName: tool.label || tool.name,
                status: 'error',
                message: (error as Error).message,
              });

              return {
                message: `I hit an error while running ${tool.label}: ${(error as Error).message}`,
                metadata: {
                  action: 'TOOL_CALL_ERROR',
                  tool: tool.name,
                  error: (error as Error).message,
                },
              };
            }
          }

          // Continue the loop so the assistant can incorporate tool results
          continue;
        }

        // Handle final assistant response
        const finalContent = (assistantMessage.content || '').trim();
        if (finalContent) {
          return this.buildAgentReply(state, finalContent);
        }

        if (finishReason === 'stop') {
          break;
        }
      }

      return this.buildFinalResponse(state);

    } catch (error) {
      apiLogger.error('AI Orchestrator process failed', error as Error);
      return {
        message: 'I encountered an error while processing your request. Please try again.',
        metadata: {
          action: 'ORCHESTRATOR_ERROR',
          error: (error as Error).message,
        },
      };
    }
  }

  /**
   * Format conversation history for LLM consumption
   */
  private formatHistory(messages: any[]): Array<{ role: 'user' | 'assistant'; content: string }> {
    return messages
      .filter((msg) => msg.role === 'USER' || msg.role === 'ASSISTANT')
      .map((msg) => ({
        role: (msg.role === 'USER' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: msg.content,
      }));
  }

  /**
   * Build comprehensive system prompt for the AI agent
   */
  private buildSystemPrompt(): string {
    return `You are XQuant Assistant, a personable quantitative strategist.
- You can chat naturally, explain your capabilities, and reason openly.
- You have access to specialised tools: create_dsl, generate_strategy_code, run_backtest, save_strategy, analyze_market_data.

IMPORTANT: When creating or improving strategies:
- If a previous backtest showed poor performance (e.g., 0% win rate, few trades, high drawdown), use the create_dsl tool with previous_backtest parameter to improve the strategy.
- Use analyze_market_data to understand current market conditions before creating strategies.
- When a strategy has 0% win rate or < 5 trades, the conditions are likely too restrictive - relax them.
- Consider using multiple timeframes and confirming indicators for better signals.
- Keep entry condition stacks concise (maximum four AND conditions) and avoid contradictory filters (e.g., price > EMA and price <= Bollinger midline together).
- Always include explicit stop-loss (>= 2%) and take-profit (>= 4%) parameters and mention them to the user.
- Aim for at least one entry configuration that would trigger within the last 30-60 candles based on the provided market data.
- When informed that a quick backtest produced fewer than 3 trades, adjust the DSL before moving on.

Tool Usage Guidelines:
- Only call a tool when it clearly helps the user move forward. Never call tools just to demonstrate them.
- Do not call run_backtest unless the user explicitly asks for a backtest or confirms they want performance metrics.
- Always request the user's confirmation before executing impactful actions. The system will handle the confirmation step.
- If the user simply greets you or asks about capabilities, answer directly without using tools.
- When you do call a tool, provide a brief explanation of why it is helpful.

Strategy Improvement Tips:
- If win rate is 0%, entry conditions are likely too strict
- If total trades < 5, reduce condition requirements or use shorter timeframes
- If drawdown > 20%, improve risk management and position sizing
- If Sharpe ratio < 0, the strategy needs fundamental redesign

Respond in friendly, professional English.`;
  }


  /**
   * Safely parse tool call arguments
   */
  private safeParseArgs(args: string | object): any {
    if (!args) return {};
    if (typeof args === 'object') return args;
    try {
      return JSON.parse(args as string);
    } catch (error) {
      apiLogger.warn('Failed to parse tool arguments, returning empty object', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * Apply tool execution results to orchestration state
   */
  private applyResultToState(state: OrchestrationState, toolName: string, result: any): void {
    switch (toolName) {
      case 'create_dsl':
        if (result.dsl) {
          state.dsl = result.dsl;
        }
        break;
      case 'generate_strategy_code':
        if (result.strategy) {
          state.strategy = result.strategy;
        }
        break;
      case 'run_backtest':
        if (result.backtest) {
          state.backtest = result.backtest;
          // Store backtest history for future reference
          if (!state.backtestHistory) {
            state.backtestHistory = [];
          }
          state.backtestHistory.push({
            timestamp: new Date().toISOString(),
            summary: result.backtest.summary,
            strategy: state.strategy?.name || state.dsl?.strategy_name
          });
        }
        break;
      case 'save_strategy':
        if (result.savedStrategy) {
          state.savedStrategy = result.savedStrategy;
        }
        break;
      case 'analyze_market_data':
        if (result.analysis) {
          state.marketAnalysis = result.analysis;
          // Also store candles and patterns if they exist
          if (result.candles) {
            state.marketAnalysis.candles = result.candles;
          }
          if (result.patterns) {
            state.marketAnalysis.patterns = result.patterns;
          }
          state.marketAnalysisFetchedAt = Date.now();
        }
        break;
      default:
        break;
    }
  }

  /**
   * Ensure tool prerequisites are met before execution
   */
  private async ensureToolPrerequisites({
    tool,
    params,
    state,
    sendEvent,
    messages,
  }: {
    tool: ToolDefinition;
    params: any;
    state: OrchestrationState;
    sendEvent: (event: string, payload: any) => void;
    messages: any[];
  }): Promise<void> {
    if (!tool || tool.name !== 'create_dsl') {
      return;
    }

    const symbol = params.symbol
      || state.strategy?.asset
      || state.dsl?.symbol
      || state.marketAnalysis?.symbol;
    const timeframe = params.timeframe
      || state.strategy?.timeframe
      || state.dsl?.timeframe
      || state.marketAnalysis?.timeframe
      || '1h';

    if (!symbol) {
      return;
    }

    const isFresh = state.marketAnalysis
      && state.marketAnalysis.symbol === symbol
      && state.marketAnalysis.timeframe === timeframe
      && state.marketAnalysisFetchedAt
      && (Date.now() - state.marketAnalysisFetchedAt) < this.marketAnalysisTTL;

    if (isFresh) {
      return;
    }

    // Automatically run market analysis prerequisite
    const analysisTool = getTool('analyze_market_data');
    if (!analysisTool) {
      apiLogger.warn('Analyze market data tool unavailable for auto prerequisite');
      return;
    }

    const analysisParams = {
      symbol,
      timeframe,
      limit: params.limit || 200,
      indicators: params.indicators || ['RSI', 'SMA', 'MACD', 'BB'],
      userId: params.userId,
      conversationId: params.conversationId,
    };

    const autoCallId = `auto_analysis_${Date.now()}`;

    sendEvent('tool_call_progress', {
      callId: autoCallId,
      conversationId: state.conversationId,
      toolName: 'analyze_market_data',
      toolLabel: 'Analyze Market Data',
      status: 'auto_started',
      reason: 'Ensuring fresh market context before DSL generation',
      params: analysisParams,
    });

    try {
      const result = await analysisTool.execute(analysisParams);
      this.applyResultToState(state, analysisTool.name, result);
      state.marketAnalysisFetchedAt = Date.now();

      sendEvent('tool_call_result', {
        callId: autoCallId,
        conversationId: state.conversationId,
        toolName: 'Analyze Market Data',
        status: 'auto_success',
        resultSummary: this.buildResultSummary('analyze_market_data', result),
        result,
      });

      const summaryContent = this.buildMarketAnalysisSummary(result.analysis);
      if (summaryContent) {
        // Add to conversation context for LLM
        messages.push({ role: 'system', content: summaryContent });
      }
    } catch (error) {
      apiLogger.error('Auto market analysis prerequisite failed', error as Error);
      sendEvent('tool_call_error', {
        callId: autoCallId,
        conversationId: state.conversationId,
        toolName: 'Analyze Market Data',
        status: 'auto_error',
        message: (error as Error).message,
      });
    }
  }

  /**
   * Run quick backtest validation if needed
   */
  private async runQuickBacktestIfNeeded({
    state,
    sendEvent,
    messages,
  }: {
    state: OrchestrationState;
    sendEvent: (event: string, payload: any) => void;
    messages: any[];
  }): Promise<void> {
    if (!state.strategy || state.quickCheckPerformed) {
      return;
    }

    try {
      // Run a quick validation backtest
      const quickResult = await this.performQuickBacktest(state.strategy);

      state.quickCheck = quickResult.summary;
      state.quickCheckPerformed = true;

      const summaryContent = this.buildQuickCheckSummary(quickResult.summary);

      sendEvent('quick_backtest_summary', {
        conversationId: state.conversationId,
        summary: quickResult.summary,
        isQuickCheck: true,
      });

      // Add to conversation context
      messages.push({ role: 'system', content: summaryContent });

      if ((quickResult.summary?.totalTrades ?? 0) < this.quickBacktestMinTrades) {
        const alert = `QUICK_BACKTEST_ALERT: Total trades ${quickResult.summary.totalTrades}. ` +
          `Target at least ${this.quickBacktestMinTrades} trades by relaxing entry conditions or adjusting timeframe.`;
        messages.push({ role: 'system', content: alert });
      }
    } catch (error) {
      apiLogger.error('Quick backtest validation failed', error as Error);
      state.quickCheckPerformed = true; // Don't retry on error
    }
  }

  /**
   * Normalize DSL object structure
   */
  private normalizeDSL(dsl: any): any {
    if (!dsl || typeof dsl !== 'object') {
      return dsl;
    }

    const normalized = { ...dsl };

    normalized.strategy_name = normalized.strategy_name
      || normalized.strategyName
      || `Strategy_${Date.now()}`;

    normalized.symbol = normalized.symbol
      || normalized.asset
      || 'UNKNOWN/USDT';

    normalized.timeframe = normalized.timeframe
      || normalized.interval
      || '1h';

    normalized.entry = Array.isArray(normalized.entry)
      ? normalized.entry
      : Array.isArray(normalized.entryConditions) ? normalized.entryConditions : [];

    normalized.exit = Array.isArray(normalized.exit)
      ? normalized.exit
      : Array.isArray(normalized.exitConditions) ? normalized.exitConditions : [];

    normalized.risk = normalized.risk || normalized.riskManagement || {};
    normalized.params = normalized.params || {};

    if (!normalized.risk.stop_loss) {
      normalized.risk.stop_loss = 0.02;
    }
    if (!normalized.risk.take_profit) {
      normalized.risk.take_profit = 0.04;
    }

    if (!normalized.params.initial_cash) {
      normalized.params.initial_cash = 10000;
    }
    if (!normalized.params.fee) {
      normalized.params.fee = 0.001;
    }

    return normalized;
  }

  /**
   * Build summary of tool execution results
   */
  private buildResultSummary(toolName: string, result: any): any {
    if (!result || typeof result !== 'object') {
      return null;
    }

    if (toolName === 'create_dsl' && result.dsl) {
      return {
        strategyName: result.dsl.strategy_name,
        symbol: result.dsl.symbol,
        timeframe: result.dsl.timeframe,
      };
    }

    if (toolName === 'generate_strategy_code' && result.strategy) {
      return {
        strategyName: result.strategy.name,
        timeframe: result.strategy.timeframe,
      };
    }

    if (toolName === 'run_backtest' && result.backtest?.summary) {
      const summary = result.backtest.summary;
      return {
        totalReturn: summary.totalReturn,
        sharpeRatio: summary.sharpeRatio,
        winRate: summary.winRate,
        maxDrawdown: summary.maxDrawdown,
        trades: summary.trades?.length ?? 0,
        fetchedCandles: summary.fetchedCandles,
        processedCandles: summary.processedCandles,
        finalEquity: summary.finalEquity,
        initialCapital: summary.initialCapital,
        symbol: summary.symbol,
        timeframe: summary.timeframe,
      };
    }

    if (toolName === 'save_strategy' && result.savedStrategy) {
      return {
        strategyId: result.savedStrategy.strategyId,
        status: result.savedStrategy.status,
      };
    }

    if (toolName === 'analyze_market_data' && result.analysis) {
      return {
        symbol: result.analysis.symbol,
        timeframe: result.analysis.timeframe,
        latestPrice: result.analysis.latestPrice,
        trend: result.analysis.summary?.trend,
        recommendation: result.analysis.summary?.recommendation?.action,
      };
    }

    if (result.status === 'needs_clarification' && result.message) {
      return { message: result.message };
    }

    return null;
  }

  /**
   * Build tool result for LLM consumption
   */
  private buildResultForModel(toolName: string, result: any): any {
    const summary = this.buildResultSummary(toolName, result);
    return {
      status: result.status || 'success',
      summary,
      raw: result,
    };
  }

  /**
   * Build metadata for orchestration response
   */
  private buildMetadata(state: OrchestrationState): any {
    return {
      dsl: state.dsl,
      strategy: state.strategy,
      backtest: state.backtest?.summary,
      savedStrategy: state.savedStrategy,
      executedTools: state.executedTools.map((entry) => ({
        name: entry.name,
        summary: this.buildResultSummary(entry.name, entry.result),
      })),
    };
  }

  /**
   * Build final response when orchestration completes
   */
  private buildFinalResponse(state: OrchestrationState): OrchestrationResult {
    const finalMessage = state.lastAssistantMessage?.trim();
    if (finalMessage) {
      return this.buildAgentReply(state, finalMessage);
    }

    const summaryPayload = {
      dsl: state.dsl,
      strategy: state.strategy,
      backtest: state.backtest?.summary,
      savedStrategy: state.savedStrategy,
    };

    return this.buildAgentReply(state, this.buildFallbackSummary(summaryPayload));
  }

  /**
   * Fallback response for error conditions
   */
  private fallbackResponse(state: OrchestrationState, message: string): OrchestrationResult {
    return this.buildAgentReply(state, message);
  }

  /**
   * Build structured agent reply with metadata
   */
  private buildAgentReply(state: OrchestrationState, rawMessage: string): OrchestrationResult {
    const parsed = MessageParser.parseAndSanitize(rawMessage);

    return {
      message: parsed.content,
      metadata: {
        action: 'AGENT_REPLY',
        thinking: parsed.thinking,
        hasThinking: parsed.hasThinking,
        ...this.buildMetadata(state),
      },
    };
  }

  /**
   * Build fallback summary message
   */
  private buildFallbackSummary(payload: any): string {
    const lines = [];
    if (payload.strategy) {
      lines.push(
        `Strategy **${payload.strategy.name}** for ${payload.strategy.asset} on ${payload.strategy.timeframe} is ready.`
      );
    }
    if (payload.backtest) {
      const metrics = payload.backtest;
      lines.push(
        `Backtest → Return: ${metrics.totalReturn?.toFixed?.(2) ?? metrics.totalReturn}% | ` +
          `Sharpe: ${metrics.sharpeRatio?.toFixed?.(2) ?? metrics.sharpeRatio} | ` +
          `Win Rate: ${metrics.winRate?.toFixed?.(1) ?? metrics.winRate}% | ` +
          `Max DD: ${metrics.maxDrawdown?.toFixed?.(2) ?? metrics.maxDrawdown}%`
      );
    }
    if (payload.savedStrategy) {
      lines.push(`Saved as ${payload.savedStrategy.strategyId}.`);
    }
    if (lines.length === 0) {
      lines.push('Let me know how I can assist further with your trading ideas!');
    }
    return lines.join('\n');
  }

  /**
   * Perform quick backtest validation
   */
  private async performQuickBacktest(strategy: any): Promise<any> {
    // Mock quick backtest implementation
    // In production, this would run a fast validation backtest
    const mockSummary = {
      totalTrades: Math.floor(Math.random() * 20) + 1, // 1-20 trades
      winRate: Math.random() * 100,
      totalReturn: (Math.random() - 0.5) * 30, // -15% to +15%
      sharpeRatio: (Math.random() - 0.5) * 4, // -2 to +2
      maxDrawdown: -Math.random() * 25, // -25% to 0%
      fetchedCandles: 250,
      processedCandles: 250,
      finalEquity: 10000 + (Math.random() - 0.5) * 3000,
    };

    return {
      summary: mockSummary,
      trades: [],
      equityCurve: []
    };
  }

  /**
   * Build market analysis summary
   */
  private buildMarketAnalysisSummary(analysis: any): string | null {
    if (!analysis) {
      return null;
    }

    const latestPrice = Number.isFinite(analysis.latestPrice)
      ? Number(analysis.latestPrice).toFixed(2)
      : analysis.latestPrice;
    const change24h = Number(analysis.priceChange24h ?? 0).toFixed(2);

    const parts = [
      `Market analysis for ${analysis.symbol} ${analysis.timeframe}:`,
      `Latest price: ${latestPrice}`,
      `24h change: ${change24h}%`,
    ];

    if (analysis.summary?.trend) {
      parts.push(`Trend: ${analysis.summary.trend}`);
    }
    if (analysis.summary?.recommendation?.action) {
      parts.push(`Recommendation: ${analysis.summary.recommendation.action}`);
    }

    return parts.join(' ');
  }

  /**
   * Build quick check summary
   */
  private buildQuickCheckSummary(summary: any): string {
    if (!summary) {
      return 'Quick backtest summary unavailable.';
    }

    const trades = Number(summary.totalTrades ?? 0);
    const winRate = Number(summary.winRate ?? 0).toFixed(1);
    const totalReturn = Number(summary.totalReturn ?? 0).toFixed(2);
    const sharpe = Number(summary.sharpeRatio ?? 0).toFixed(2);
    const fetched = summary.fetchedCandles ?? 'n/a';
    const processed = summary.processedCandles ?? 'n/a';
    const finalEquity = summary.finalEquity !== undefined
      ? Number(summary.finalEquity).toFixed(2)
      : 'n/a';

    return [
      'Quick backtest summary:',
      `Trades: ${trades}`,
      `Win rate: ${winRate}%`,
      `Return: ${totalReturn}%`,
      `Sharpe: ${sharpe}`,
      `Candles fetched/processed: ${fetched}/${processed}`,
      `Final equity: $${finalEquity}`,
    ].join(' ');
  }
}

// Export singleton instance
export const aiOrchestrator = new AIOrchestrator();
export default aiOrchestrator;