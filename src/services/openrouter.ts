import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '@/config/environment';
import { apiLogger, performanceLogger } from '@/services/logger';

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  useToolCalling: boolean;
  timeout: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  systemPrompt?: string;
  tools?: Tool[];
  toolChoice?: 'auto' | 'none' | string;
}

export interface StreamOptions extends CompletionOptions {
  onChunk?: (content: string, fullContent: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
}

export interface StrategyParsingResult {
  dsl: Record<string, any>;
  confidence: number;
  method: 'ai' | 'rules' | 'default';
  errors: string[];
}

export class OpenRouterService {
  private client: AxiosInstance;
  private config: OpenRouterConfig;
  private models: Record<string, string>;

  constructor(customConfig?: Partial<OpenRouterConfig>) {
    this.config = {
      apiKey: config.OPENROUTER_API_KEY || '',
      baseUrl: config.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      defaultModel: config.DEFAULT_MODEL || 'anthropic/claude-sonnet-4',
      useToolCalling: config.USE_TOOL_CALLING === 'true',
      timeout: 30000,
      ...customConfig
    };

    // Model mapping for flexibility
    this.models = {
      'claude-3-opus': 'anthropic/claude-sonnet-4',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet',
      'claude-sonnet-4': 'anthropic/claude-sonnet-4',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'gpt-4': 'openai/gpt-4',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      'llama-3-70b': 'meta-llama/llama-3-70b-instruct',
      'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct'
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://dquant.ai',
        'X-Title': 'DQuant Trading Agent'
      }
    });

    this.validateConfiguration();
  }

  /**
   * Main chat completion with optional tool calling
   */
  async chatWithTools(
    messages: ChatMessage[],
    options: CompletionOptions = {}
  ): Promise<string> {
    const timer = performanceLogger.startTimer('openrouter_chat_with_tools');

    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const model = this.resolveModel(options.model || this.config.defaultModel);
      const payload: any = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      };

      // Add tools if provided and model supports it
      if (options.tools && options.tools.length > 0 && this.supportsToolCalling(model)) {
        payload.tools = options.tools;
        payload.tool_choice = options.toolChoice || 'auto';
        payload.temperature = 0.2; // Lower temperature for tool calling
      }

      // Add response format for compatible models
      if (options.responseFormat === 'json' && this.supportsJsonMode(model)) {
        payload.response_format = { type: 'json_object' };
      }

      apiLogger.debug('OpenRouter request', {
        model,
        messageCount: messages.length,
        hasTools: !!options.tools,
        temperature: payload.temperature
      });

      const response: AxiosResponse = await this.client.post('/chat/completions', payload);

      const choice = response.data.choices[0];
      if (!choice) {
        throw new Error('No response choice returned from OpenRouter');
      }

      let content = '';

      // Handle tool calls
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCall = choice.message.tool_calls[0];
        try {
          const toolResult = JSON.parse(toolCall.function.arguments);
          content = JSON.stringify(toolResult);
        } catch (error) {
          apiLogger.warn('Failed to parse tool call arguments', {
            toolCall: toolCall.function.arguments
          });
          content = choice.message.content || '';
        }
      } else {
        content = choice.message.content || '';
      }

      performanceLogger.endTimer(timer);

      apiLogger.info('OpenRouter chat completed', {
        model,
        responseLength: content.length,
        tokensUsed: this.estimateTokens(messages, content),
        processingTime: Date.now() - timer.startTime
      });

      return content;

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('OpenRouter chat failed', error as Error, {
        model: options.model,
        messageCount: messages.length
      });

      // Graceful fallback
      return this.generateFallbackResponse(messages, options);
    }
  }

  /**
   * Standard completion with structured response handling
   */
  async complete(
    prompt: string,
    options: CompletionOptions = {}
  ): Promise<string> {
    const messages: ChatMessage[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return await this.chatWithTools(messages, options);
  }

  /**
   * Streaming completion with real-time response
   */
  async streamComplete(
    prompt: string,
    options: StreamOptions = {}
  ): Promise<string> {
    const timer = performanceLogger.startTimer('openrouter_stream');

    try {
      if (!this.config.apiKey) {
        throw new Error('OpenRouter API key not configured');
      }

      const model = this.resolveModel(options.model || this.config.defaultModel);
      const messages: ChatMessage[] = [];

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const payload = {
        model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000,
        stream: true
      };

      const response = await this.client.post('/chat/completions', payload, {
        responseType: 'stream'
      });

      let fullContent = '';

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          const lines = chunk.toString().split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                performanceLogger.endTimer(timer);
                options.onComplete?.(fullContent);
                resolve(fullContent);
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices[0]?.delta?.content || '';

                if (delta) {
                  fullContent += delta;
                  options.onChunk?.(delta, fullContent);
                }
              } catch (error) {
                // Skip malformed JSON chunks
                continue;
              }
            }
          }
        });

        response.data.on('error', (error: Error) => {
          performanceLogger.endTimer(timer);
          apiLogger.error('OpenRouter stream error', error);
          options.onError?.(error);
          reject(error);
        });

        response.data.on('end', () => {
          performanceLogger.endTimer(timer);
          options.onComplete?.(fullContent);
          resolve(fullContent);
        });
      });

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('OpenRouter streaming failed', error as Error);

      // Fallback to standard completion
      apiLogger.info('Falling back to standard completion');
      const messages: ChatMessage[] = [];
      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const fallbackResponse = await this.chatWithTools(messages, options);
      options.onComplete?.(fallbackResponse);
      return fallbackResponse;
    }
  }

  /**
   * Parse natural language strategy description to DSL
   */
  async parseStrategy(
    description: string,
    context?: Record<string, any>
  ): Promise<StrategyParsingResult> {
    const timer = performanceLogger.startTimer('openrouter_parse_strategy');

    try {
      // Build context-aware prompt
      const systemPrompt = `You are an expert trading strategy analyst. Convert natural language descriptions into structured DSL format for algorithmic trading.

Output a JSON object with this exact structure:
{
  "strategy_name": "string",
  "symbol": "ASSET/USDT format",
  "timeframe": "1m|5m|15m|30m|1h|4h|1d|1w",
  "indicators": [{"name": "string", "alias": "string", "params": {}}],
  "entry": [{"left": "string", "op": "string", "right": "number|string"}],
  "exit": [{"left": "string", "op": "string", "right": "number|string"}],
  "risk": {"stop_loss": "number 0-1", "take_profit": "number"},
  "params": {"initial_cash": "number", "fee": "number"}
}

Supported indicators: SMA, EMA, RSI, MACD, BB, STOCH, ATR, ADX, OBV, VWAP, WR, CCI, MFI, KDJ, DMI, SAR, ICHIMOKU, VOLUME
Supported operators: >, <, >=, <=, ==, !=, crosses_above, crosses_below, touches, breaks_above, breaks_below`;

      const userPrompt = `Strategy description: "${description}"

${context ? `Additional context: ${JSON.stringify(context, null, 2)}` : ''}

Convert this to the required JSON DSL format:`;

      const response = await this.complete(userPrompt, {
        systemPrompt,
        responseFormat: 'json',
        temperature: 0.3
      });

      // Try to parse as JSON
      try {
        const dsl = JSON.parse(response);

        // Validate required fields
        if (!dsl.strategy_name || !dsl.symbol || !dsl.timeframe) {
          throw new Error('Missing required DSL fields');
        }

        performanceLogger.endTimer(timer);

        apiLogger.info('Strategy parsed successfully via AI', {
          strategyName: dsl.strategy_name,
          symbol: dsl.symbol,
          indicatorCount: dsl.indicators?.length || 0
        });

        return {
          dsl,
          confidence: 0.9,
          method: 'ai',
          errors: []
        };

      } catch (parseError) {
        apiLogger.warn('Failed to parse AI strategy response', {
          response: response.substring(0, 500),
          error: (parseError as Error).message
        });

        // Fallback to rule-based parsing
        return await this.parseStrategyWithRules(description);
      }

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('AI strategy parsing failed', error as Error);

      // Fallback to rule-based parsing
      return await this.parseStrategyWithRules(description);
    }
  }

  /**
   * Process conversation with context and intent recognition
   */
  async processConversation(
    message: string,
    conversationHistory: ChatMessage[],
    sessionContext?: Record<string, any>
  ): Promise<{
    response: string;
    intent?: string;
    action?: string;
    data?: any;
  }> {
    const timer = performanceLogger.startTimer('openrouter_process_conversation');

    try {
      // Build context-aware system prompt
      const systemPrompt = `You are DQuant, an intelligent trading assistant. You help users create, analyze, and optimize trading strategies.

Current session context: ${sessionContext ? JSON.stringify(sessionContext) : 'New session'}

Provide helpful, professional trading advice. If the user is asking about strategy creation, guide them through the process. If they want to modify existing strategies, help with specific improvements.

Respond in a conversational, helpful manner while being technically accurate.`;

      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-8), // Keep recent context
        { role: 'user', content: message }
      ];

      const response = await this.chatWithTools(messages, {
        temperature: 0.7,
        maxTokens: 1500
      });

      performanceLogger.endTimer(timer);

      // Simple intent detection based on response content
      let intent = 'general';
      let action = 'response';

      const lowerResponse = response.toLowerCase();
      if (lowerResponse.includes('strategy') || lowerResponse.includes('trading')) {
        intent = 'strategy';
      }
      if (lowerResponse.includes('backtest') || lowerResponse.includes('test')) {
        intent = 'backtest';
      }

      return {
        response,
        intent,
        action,
        data: { processingTime: Date.now() - timer.startTime }
      };

    } catch (error) {
      performanceLogger.endTimer(timer);
      apiLogger.error('Conversation processing failed', error as Error);

      return {
        response: "I'm having trouble processing your request right now. Could you please try rephrasing your question?",
        intent: 'error',
        action: 'fallback'
      };
    }
  }

  // Private helper methods

  private validateConfiguration(): void {
    if (!this.config.apiKey) {
      apiLogger.warn('OpenRouter API key not configured. AI features will be limited.');
    }

    if (!this.config.baseUrl) {
      throw new Error('OpenRouter base URL must be configured');
    }
  }

  private resolveModel(model: string): string {
    return this.models[model] || model;
  }

  private supportsToolCalling(model: string): boolean {
    return model.includes('claude') || model.includes('gpt-4');
  }

  private supportsJsonMode(model: string): boolean {
    return model.includes('gpt-4') || model.includes('gpt-3.5');
  }

  private estimateTokens(messages: ChatMessage[], response: string): number {
    const totalContent = messages.map(m => m.content).join(' ') + response;
    return Math.ceil(totalContent.length / 4); // Rough estimation
  }

  private generateFallbackResponse(messages: ChatMessage[], options: CompletionOptions): string {
    apiLogger.info('Generating fallback response');

    // Extract the user's last message
    const userMessage = messages.filter(m => m.role === 'user').pop()?.content || '';

    if (userMessage.toLowerCase().includes('strategy')) {
      return "I'd be happy to help you create a trading strategy. Please describe what type of strategy you're looking for, including the asset, timeframe, and any specific indicators you'd like to use.";
    }

    if (userMessage.toLowerCase().includes('backtest')) {
      return "To run a backtest, I'll need your strategy details and the time period you'd like to test. Please provide your strategy configuration and I'll help you set up the backtest.";
    }

    return "I'm here to help you with trading strategies, backtesting, and market analysis. How can I assist you today?";
  }

  private async parseStrategyWithRules(description: string): Promise<StrategyParsingResult> {
    apiLogger.info('Using rule-based strategy parsing');

    const lowerDesc = description.toLowerCase();

    // Default strategy structure
    const dsl = {
      strategy_name: 'Custom Strategy',
      symbol: 'BTC/USDT',
      timeframe: '1h',
      indicators: [] as any[],
      entry: [] as any[],
      exit: [] as any[],
      risk: {
        stop_loss: 0.02,
        take_profit: 0.04
      },
      params: {
        initial_cash: 10000,
        fee: 0.001
      }
    };

    const errors: string[] = [];

    // Extract indicators
    if (lowerDesc.includes('rsi')) {
      dsl.indicators.push({
        name: 'RSI',
        alias: 'rsi_14',
        params: { period: 14 }
      });

      if (lowerDesc.includes('below') || lowerDesc.includes('under')) {
        dsl.entry.push({ left: 'rsi_14', op: '<', right: 30 });
      }
      if (lowerDesc.includes('above') || lowerDesc.includes('over')) {
        dsl.exit.push({ left: 'rsi_14', op: '>', right: 70 });
      }
    }

    if (lowerDesc.includes('sma') || lowerDesc.includes('moving average')) {
      dsl.indicators.push({
        name: 'SMA',
        alias: 'sma_20',
        params: { period: 20 }
      });
    }

    // If no indicators detected, add default
    if (dsl.indicators.length === 0) {
      errors.push('No indicators detected, using default RSI');
      dsl.indicators.push({
        name: 'RSI',
        alias: 'rsi_14',
        params: { period: 14 }
      });
      dsl.entry.push({ left: 'rsi_14', op: '<', right: 30 });
      dsl.exit.push({ left: 'rsi_14', op: '>', right: 70 });
    }

    return {
      dsl,
      confidence: 0.6,
      method: 'rules',
      errors
    };
  }
}

// Singleton instance
let openRouterServiceInstance: OpenRouterService | null = null;

export function getOpenRouterService(): OpenRouterService {
  if (!openRouterServiceInstance) {
    openRouterServiceInstance = new OpenRouterService();
  }
  return openRouterServiceInstance;
}

export const openRouterService = getOpenRouterService();