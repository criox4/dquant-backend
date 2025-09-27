/**
 * Tool Registry - Central registry for all AI-accessible tools
 *
 * This module manages the registration and discovery of tools that the AI can use
 * to perform complex multi-step tasks.
 */

import { apiLogger } from '@/services/logger';

export interface ToolFunction {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  function: ToolFunction;
  execute: (params: any) => Promise<any>;
  requiresApproval?: boolean;
  category?: string;
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register a tool in the registry
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      apiLogger.warn(`Tool ${tool.name} is already registered, overwriting`);
    }

    this.tools.set(tool.name, tool);
    apiLogger.info(`Registered tool: ${tool.name}`);
  }

  /**
   * Get a specific tool by name
   */
  get(name: string): ToolDefinition | null {
    return this.tools.get(name) || null;
  }

  /**
   * List all registered tools
   */
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool definitions formatted for OpenRouter API
   */
  getToolDefinitions(): any[] {
    return this.list()
      .filter(tool => tool.name !== 'run_backtest') // Exclude run_backtest as per JS version
      .map(tool => ({
        type: 'function',
        function: tool.function
      }));
  }

  /**
   * Get tools by category
   */
  getByCategory(category: string): ToolDefinition[] {
    return this.list().filter(tool => tool.category === category);
  }

  /**
   * Check if a tool requires user approval
   */
  requiresApproval(toolName: string): boolean {
    const tool = this.get(toolName);
    return tool?.requiresApproval ?? true; // Default to requiring approval
  }

  /**
   * Register default tools from the original JavaScript implementation
   */
  private registerDefaultTools(): void {
    // Create DSL Tool
    this.register({
      name: 'create_dsl',
      label: 'Create Strategy DSL',
      description: 'Create a Domain Specific Language (DSL) definition for a trading strategy',
      category: 'strategy',
      requiresApproval: false,
      function: {
        name: 'create_dsl',
        description: 'Create a DSL definition for a trading strategy based on user requirements and market analysis',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of the strategy they want to create'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol (e.g., BTC/USDT)',
              default: 'BTC/USDT'
            },
            timeframe: {
              type: 'string',
              description: 'Timeframe for the strategy (e.g., 1h, 4h, 1d)',
              default: '1h'
            },
            risk_level: {
              type: 'string',
              enum: ['conservative', 'moderate', 'aggressive'],
              description: 'Risk level for the strategy',
              default: 'moderate'
            },
            previous_backtest: {
              type: 'object',
              description: 'Previous backtest results to improve upon',
              properties: {
                totalReturn: { type: 'number' },
                sharpeRatio: { type: 'number' },
                maxDrawdown: { type: 'number' },
                winRate: { type: 'number' },
                totalTrades: { type: 'number' },
                issues: { type: 'array', items: { type: 'string' } }
              }
            },
            market_analysis: {
              type: 'object',
              description: 'Current market analysis data',
              properties: {
                symbol: { type: 'string' },
                timeframe: { type: 'string' },
                latestPrice: { type: 'number' },
                priceChange24h: { type: 'number' },
                indicators: { type: 'object' },
                summary: { type: 'object' },
                patterns: { type: 'array' },
                recentCandles: { type: 'array' }
              }
            }
          },
          required: ['description']
        }
      },
      execute: async (params) => {
        // TODO: Implement actual DSL creation logic
        apiLogger.info('Creating DSL with params:', params);
        return {
          status: 'success',
          dsl: {
            strategy_name: `Strategy_${Date.now()}`,
            symbol: params.symbol || 'BTC/USDT',
            timeframe: params.timeframe || '1h',
            entry: [],
            exit: [],
            risk: {
              stop_loss: 0.02,
              take_profit: 0.04
            },
            params: {
              initial_cash: 10000,
              fee: 0.001
            }
          }
        };
      }
    });

    // Generate Strategy Code Tool
    this.register({
      name: 'generate_strategy_code',
      label: 'Generate Strategy Code',
      description: 'Generate executable Python strategy code from DSL definition',
      category: 'strategy',
      requiresApproval: false,
      function: {
        name: 'generate_strategy_code',
        description: 'Convert a DSL definition into executable Python strategy code',
        parameters: {
          type: 'object',
          properties: {
            dsl: {
              type: 'object',
              description: 'The DSL definition to convert to code'
            },
            optimization: {
              type: 'boolean',
              description: 'Whether to include optimization parameters',
              default: false
            }
          },
          required: ['dsl']
        }
      },
      execute: async (params) => {
        // TODO: Implement actual code generation logic
        apiLogger.info('Generating strategy code with params:', params);
        return {
          status: 'success',
          strategy: {
            name: params.dsl?.strategy_name || 'Generated Strategy',
            code: '# Generated strategy code would be here',
            timeframe: params.dsl?.timeframe || '1h',
            asset: params.dsl?.symbol || 'BTC/USDT'
          }
        };
      }
    });

    // Run Backtest Tool
    this.register({
      name: 'run_backtest',
      label: 'Run Backtest',
      description: 'Execute a comprehensive backtest of a trading strategy',
      category: 'analysis',
      requiresApproval: true,
      function: {
        name: 'run_backtest',
        description: 'Run a full backtest simulation of a trading strategy',
        parameters: {
          type: 'object',
          properties: {
            strategy: {
              type: 'object',
              description: 'The strategy object to backtest'
            },
            symbol: {
              type: 'string',
              description: 'Trading symbol for the backtest',
              default: 'BTC/USDT'
            },
            start_date: {
              type: 'string',
              description: 'Start date for backtest (YYYY-MM-DD)',
              default: '2023-01-01'
            },
            end_date: {
              type: 'string',
              description: 'End date for backtest (YYYY-MM-DD)'
            },
            initial_capital: {
              type: 'number',
              description: 'Initial capital for backtest',
              default: 10000
            }
          },
          required: ['strategy']
        }
      },
      execute: async (params) => {
        // TODO: Implement actual backtest execution
        apiLogger.info('Running backtest with params:', params);
        return {
          status: 'success',
          backtest: {
            summary: {
              totalReturn: 15.5,
              sharpeRatio: 1.2,
              maxDrawdown: -8.5,
              winRate: 65.0,
              totalTrades: 42,
              finalEquity: 11550,
              initialCapital: 10000,
              symbol: params.symbol || 'BTC/USDT',
              timeframe: '1h'
            },
            trades: [],
            equity_curve: []
          }
        };
      }
    });

    // Save Strategy Tool
    this.register({
      name: 'save_strategy',
      label: 'Save Strategy',
      description: 'Save a completed strategy to the database',
      category: 'storage',
      requiresApproval: true,
      function: {
        name: 'save_strategy',
        description: 'Save a trading strategy to the database for future use',
        parameters: {
          type: 'object',
          properties: {
            strategy: {
              type: 'object',
              description: 'The strategy object to save'
            },
            name: {
              type: 'string',
              description: 'Name for the saved strategy'
            },
            description: {
              type: 'string',
              description: 'Description of what the strategy does'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Tags to categorize the strategy'
            }
          },
          required: ['strategy']
        }
      },
      execute: async (params) => {
        // TODO: Implement actual strategy saving logic
        apiLogger.info('Saving strategy with params:', params);
        return {
          status: 'success',
          savedStrategy: {
            strategyId: `strategy_${Date.now()}`,
            status: 'saved',
            name: params.name || params.strategy?.name || 'Untitled Strategy'
          }
        };
      }
    });

    // Analyze Market Data Tool
    this.register({
      name: 'analyze_market_data',
      label: 'Analyze Market Data',
      description: 'Analyze current market conditions and technical indicators',
      category: 'analysis',
      requiresApproval: false,
      function: {
        name: 'analyze_market_data',
        description: 'Fetch and analyze current market data with technical indicators',
        parameters: {
          type: 'object',
          properties: {
            symbol: {
              type: 'string',
              description: 'Trading symbol to analyze',
              default: 'BTC/USDT'
            },
            timeframe: {
              type: 'string',
              description: 'Timeframe for analysis',
              default: '1h'
            },
            limit: {
              type: 'number',
              description: 'Number of candles to fetch',
              default: 200
            },
            indicators: {
              type: 'array',
              items: { type: 'string' },
              description: 'Technical indicators to calculate',
              default: ['RSI', 'SMA', 'MACD', 'BB']
            }
          },
          required: ['symbol']
        }
      },
      execute: async (params) => {
        // TODO: Implement actual market analysis logic
        apiLogger.info('Analyzing market data with params:', params);
        return {
          status: 'success',
          analysis: {
            symbol: params.symbol,
            timeframe: params.timeframe || '1h',
            latestPrice: 45000,
            priceChange24h: 2.5,
            indicators: {
              RSI: 65.5,
              SMA_20: 44800,
              MACD: 0.8,
              BB_upper: 46000,
              BB_lower: 44000
            },
            summary: {
              trend: 'bullish',
              recommendation: {
                action: 'buy',
                confidence: 0.7
              }
            },
            patterns: ['bullish_engulfing', 'support_bounce']
          },
          candles: [],
          patterns: []
        };
      }
    });

    apiLogger.info(`Registered ${this.tools.size} default tools`);
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();
export default toolRegistry;

// Export helper functions for compatibility with JS version
export function getTool(name: string): ToolDefinition | null {
  return toolRegistry.get(name);
}

export function listToolDefinitions(): any[] {
  return toolRegistry.getToolDefinitions();
}