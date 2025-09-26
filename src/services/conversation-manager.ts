import {
  ConversationData,
  ConversationStatus,
  ConversationMessage,
  IntentResult,
  ProcessMessageResponse,
  ConversationStats,
  ConversationManagerConfig,
  StreamingOptions
} from '@/types/conversation';
import { ConversationDataService, getConversationDataService } from '@/services/conversation-data';
import { StrategyManager } from '@/services/strategy-manager';
import { OpenRouterService } from '@/services/openrouter';
import { apiLogger, performanceLogger } from '@/services/logger';
import { broadcastToRoom } from '@/websocket/server';
import { WebSocketEvent } from '@/types/common';

export class ConversationManager {
  private activeConversations = new Map<string, ConversationData>();
  private config: ConversationManagerConfig;
  private stats = {
    messagesProcessed: 0,
    totalResponseTime: 0,
    conversationStates: new Map<ConversationStatus, number>()
  };

  public conversationDataService: ConversationDataService;
  public strategyManager: StrategyManager;
  public openRouterService: OpenRouterService;

  constructor(
    conversationDataService?: ConversationDataService,
    strategyManager?: StrategyManager,
    config: Partial<ConversationManagerConfig> = {}
  ) {
    this.conversationDataService = conversationDataService || getConversationDataService();
    this.strategyManager = strategyManager || new StrategyManager();
    this.openRouterService = new OpenRouterService();
    this.config = {
      contextWindow: 10,
      maxActiveConversations: 1000,
      conversationTimeout: 24 * 60 * 60 * 1000, // 24 hours
      enableStreaming: true,
      defaultStreamingOptions: {
        chunkSize: 10,
        delay: 50,
        includeThinking: true
      },
      ...config
    };

    // Cleanup old conversations periodically
    this.startPeriodicCleanup();
  }

  async createConversation(userId: string, title?: string): Promise<ConversationData> {
    try {
      const conversation = await this.conversationDataService.createConversation(userId, title);

      // Cache to memory for quick access
      this.activeConversations.set(conversation.conversationId, conversation);

      // Update stats
      this.updateConversationStateStats(conversation.status, 1);

      apiLogger.info('Conversation created', {
        conversationId: conversation.conversationId,
        userId,
        hasTitle: !!title,
        totalActiveConversations: this.activeConversations.size
      });

      return conversation;
    } catch (error) {
      apiLogger.error('Failed to create conversation', error as Error, {
        userId,
        title
      });
      throw error;
    }
  }

  async processMessage(conversationId: string, message: string): Promise<ProcessMessageResponse> {
    const timer = performanceLogger.startTimer(`processMessage:${conversationId}`);

    try {
      // Get conversation (from cache or database)
      let conversation = await this.getOrLoadConversation(conversationId);

      // Add user message to history
      await this.conversationDataService.addMessage(conversationId, 'USER', message);

      // Identify user intent
      const intent = await this.identifyIntent(message, conversation.metadata);

      apiLogger.info('Processing message', {
        conversationId,
        messageLength: message.length,
        intentType: intent.type,
        intentConfidence: intent.confidence
      });

      // Process based on intent
      const response = await this.handleIntent(conversationId, intent, message, conversation);

      // Save assistant response
      await this.conversationDataService.addMessage(
        conversationId,
        'ASSISTANT',
        response.message,
        response.metadata
      );

      // Update conversation status if needed
      if (response.conversationStatus && response.conversationStatus !== conversation.status) {
        await this.updateConversationStatus(conversationId, response.conversationStatus);
      }

      // Update stats
      this.stats.messagesProcessed++;
      this.stats.totalResponseTime += Date.now() - timer.startTime;

      performanceLogger.endTimer(timer);

      return response;
    } catch (error) {
      apiLogger.error('Error processing message', error as Error, {
        conversationId,
        messageLength: message.length
      });

      throw error;
    }
  }

  async streamResponse(
    conversationId: string,
    content: string,
    metadata: any = {},
    options: StreamingOptions = {}
  ): Promise<void> {
    if (!this.config.enableStreaming) {
      // Send complete message if streaming disabled
      await this.sendToConversation(conversationId, {
        event: 'response',
        data: {
          message: content,
          metadata,
          isComplete: true
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const streamOptions = { ...this.config.defaultStreamingOptions, ...options };
    const chunks = this.splitIntoChunks(content, streamOptions.chunkSize || 10);
    let accumulated = '';

    // Send thinking if available
    if (streamOptions.includeThinking && metadata.thinking) {
      await this.sendToConversation(conversationId, {
        event: 'thinking',
        data: {
          content: metadata.thinking,
          isThinking: true,
          conversationId
        },
        timestamp: new Date().toISOString()
      });
    }

    // Stream response chunks
    for (let i = 0; i < chunks.length; i++) {
      accumulated += chunks[i];

      await this.sendToConversation(conversationId, {
        event: 'stream',
        data: {
          chunk: chunks[i],
          accumulated,
          isComplete: i === chunks.length - 1,
          progress: (i + 1) / chunks.length,
          metadata: i === chunks.length - 1 ? metadata : undefined
        },
        timestamp: new Date().toISOString()
      });

      // Add delay between chunks for smooth streaming
      if (streamOptions.delay && i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, streamOptions.delay));
      }
    }

    apiLogger.debug('Response streamed', {
      conversationId,
      totalChunks: chunks.length,
      contentLength: content.length,
      hasMetadata: !!metadata && Object.keys(metadata).length > 0
    });
  }

  private async identifyIntent(message: string, context: any): Promise<IntentResult> {
    try {
      // Use OpenRouter AI for intelligent intent recognition
      const intentPrompt = `
        Analyze the following user message and classify the intent for a trading system.
        Context: ${JSON.stringify(context, null, 2)}

        User message: "${message}"

        Classify into one of these intents:
        - GREETING: User is greeting or starting conversation
        - STRATEGY_REQUEST: User wants to create, modify, or discuss trading strategies
        - BACKTEST_REQUEST: User wants to test strategies against historical data
        - MARKET_DATA_REQUEST: User wants market data, prices, charts, or analysis
        - GENERAL_QUERY: General questions about trading, markets, or the system

        Respond with JSON: {"intent": "INTENT_TYPE", "confidence": 0.0-1.0, "reasoning": "brief explanation", "parameters": {}}
      `;

      const response = await this.openRouterService.processConversation(
        [{ role: 'user', content: intentPrompt }],
        {
          model: 'claude-3.5-sonnet',
          maxTokens: 200,
          temperature: 0.1
        }
      );

      if (response.success && response.data?.choices?.[0]?.message?.content) {
        try {
          const intentData = JSON.parse(response.data.choices[0].message.content);

          return {
            type: intentData.intent,
            confidence: intentData.confidence || 0.7,
            parameters: {
              message,
              reasoning: intentData.reasoning,
              aiParsed: true,
              ...intentData.parameters
            }
          };
        } catch (parseError) {
          apiLogger.warn('Failed to parse AI intent response', {
            response: response.data.choices[0].message.content,
            error: parseError
          });
        }
      }

      // Fallback to simple keyword-based classification
      return this.simpleIntentClassification(message);

    } catch (error) {
      apiLogger.warn('AI intent recognition failed, using fallback', error as Error);
      return this.simpleIntentClassification(message);
    }
  }

  private simpleIntentClassification(message: string): IntentResult {
    const messageLower = message.toLowerCase();

    // Strategy-related keywords
    if (messageLower.includes('strategy') || messageLower.includes('trading') ||
        messageLower.includes('algorithm') || messageLower.includes('bot')) {
      return {
        type: 'STRATEGY_REQUEST',
        confidence: 0.8,
        parameters: { message, fallback: true }
      };
    }

    // Backtest keywords
    if (messageLower.includes('backtest') || messageLower.includes('test') ||
        messageLower.includes('historical') || messageLower.includes('performance')) {
      return {
        type: 'BACKTEST_REQUEST',
        confidence: 0.8,
        parameters: { message, fallback: true }
      };
    }

    // Market data keywords
    if (messageLower.includes('price') || messageLower.includes('chart') ||
        messageLower.includes('market') || messageLower.includes('data')) {
      return {
        type: 'MARKET_DATA_REQUEST',
        confidence: 0.7,
        parameters: { message, fallback: true }
      };
    }

    // Greeting
    if (messageLower.includes('hello') || messageLower.includes('hi') ||
        messageLower.includes('hey') || messageLower.includes('good morning')) {
      return {
        type: 'GREETING',
        confidence: 0.9,
        parameters: { message, fallback: true }
      };
    }

    // Default to general query
    return {
      type: 'GENERAL_QUERY',
      confidence: 0.5,
      parameters: { message, fallback: true }
    };
  }

  private async handleIntent(
    conversationId: string,
    intent: IntentResult,
    message: string,
    conversation: ConversationData
  ): Promise<ProcessMessageResponse> {
    apiLogger.debug('Handling intent', {
      conversationId,
      intentType: intent.type,
      confidence: intent.confidence
    });

    switch (intent.type) {
      case 'GREETING':
        return await this.handleGreeting(conversationId, message, conversation);

      case 'STRATEGY_REQUEST':
        return await this.handleStrategyRequest(conversationId, message, conversation);

      case 'BACKTEST_REQUEST':
        return await this.handleBacktestRequest(conversationId, message, conversation);

      case 'MARKET_DATA_REQUEST':
        return await this.handleMarketDataRequest(conversationId, message, conversation);

      case 'GENERAL_QUERY':
      default:
        return await this.handleGeneralQuery(conversationId, message, conversation);
    }
  }

  private async handleGreeting(
    _conversationId: string,
    _message: string,
    _conversation: ConversationData
  ): Promise<ProcessMessageResponse> {
    const responses = [
      "Hello! I'm DQuant, your intelligent trading assistant. How can I help you create or optimize your trading strategies today?",
      "Hi there! I'm here to help you with trading strategies, backtesting, and market analysis. What would you like to explore?",
      "Welcome to DQuant! I can help you generate trading strategies, run backtests, and analyze market data. What's your trading goal?"
    ];

    const response = responses[Math.floor(Math.random() * responses.length)];

    return {
      message: response,
      metadata: {
        action: 'GREETING_RESPONSE'
      }
    };
  }

  private async handleStrategyRequest(
    conversationId: string,
    message: string,
    conversation: ConversationData
  ): Promise<ProcessMessageResponse> {
    try {
      // Extract conversation context for strategy processing
      const context = {
        conversationId,
        currentStrategy: conversation.metadata?.currentStrategy,
        previousStrategies: conversation.metadata?.strategies || [],
        userPreferences: conversation.metadata?.userPreferences || {}
      };

      // Use strategy manager to process the request
      const response = await this.strategyManager.processStrategyMessage(
        conversationId,
        message,
        context
      );

      // If a strategy was created, update conversation metadata
      if (response.strategyId) {
        const updatedMetadata = {
          ...conversation.metadata,
          currentStrategy: {
            strategyId: response.strategyId,
            createdAt: new Date().toISOString(),
            name: response.data?.strategy?.name
          },
          strategies: [
            ...(conversation.metadata?.strategies || []),
            {
              strategyId: response.strategyId,
              createdAt: new Date().toISOString(),
              action: response.action
            }
          ]
        };

        await this.conversationDataService.updateConversation(conversationId, {
          metadata: updatedMetadata
        });

        // Send WebSocket notification about strategy creation
        await this.sendToConversation(conversationId, {
          event: 'strategy_created',
          data: {
            strategyId: response.strategyId,
            strategy: response.data?.strategy,
            conversationId
          },
          timestamp: new Date().toISOString()
        });
      }

      return response;

    } catch (error) {
      apiLogger.error('Failed to process strategy request', error as Error, {
        conversationId,
        messageLength: message.length
      });

      return {
        message: `I encountered an error while processing your strategy request: ${(error as Error).message}. Please try rephrasing your request with more specific details about the trading strategy you'd like to create.`,
        metadata: {
          action: 'STRATEGY_ERROR',
          error: (error as Error).message,
          parameters: { originalMessage: message }
        }
      };
    }
  }

  private async handleBacktestRequest(
    _conversationId: string,
    message: string,
    _conversation: ConversationData
  ): Promise<ProcessMessageResponse> {
    // TODO: Integrate with backtest service
    return {
      message: "I'll run a backtest for you. Please specify the strategy parameters, time period, and any other requirements...",
      metadata: {
        action: 'BACKTEST_STARTED',
        parameters: { originalMessage: message }
      }
    };
  }

  private async handleMarketDataRequest(
    _conversationId: string,
    message: string,
    _conversation: ConversationData
  ): Promise<ProcessMessageResponse> {
    // TODO: Integrate with market data service
    return {
      message: "I'll fetch the market data you requested. Which symbols and timeframes would you like to analyze?",
      metadata: {
        action: 'MARKET_DATA_REQUEST',
        parameters: { originalMessage: message }
      }
    };
  }

  private async handleGeneralQuery(
    conversationId: string,
    message: string,
    conversation: ConversationData
  ): Promise<ProcessMessageResponse> {
    try {
      // Get conversation history for context
      const history = await this.getConversationHistory(conversationId, 10);

      // Build context-aware prompt
      const contextualPrompt = `
        You are DQuant, an intelligent trading assistant. Answer the user's question with expertise in:
        - Trading strategies and algorithmic trading
        - Technical analysis and indicators
        - Risk management and portfolio optimization
        - Market analysis and financial markets
        - Backtesting and strategy validation

        Conversation history:
        ${history.slice(-5).map(msg => `${msg.sender}: ${msg.content}`).join('\n')}

        Current user question: "${message}"

        Provide a helpful, accurate, and concise response. If the question relates to trading strategies, suggest creating one. Be conversational and professional.
      `;

      const response = await this.openRouterService.processConversation(
        [{ role: 'user', content: contextualPrompt }],
        {
          model: 'claude-3.5-sonnet',
          maxTokens: 800,
          temperature: 0.3
        }
      );

      if (response.success && response.data?.choices?.[0]?.message?.content) {
        const aiResponse = response.data.choices[0].message.content;

        return {
          message: aiResponse,
          metadata: {
            action: 'GENERAL_AI_RESPONSE',
            parameters: {
              originalMessage: message,
              model: 'claude-3.5-sonnet',
              tokens: response.data.usage?.total_tokens || 0
            }
          }
        };
      }

      // Fallback response if AI fails
      return {
        message: "I understand your question about trading and markets. While I'm temporarily unable to provide a detailed AI-powered response, I can help you create trading strategies, run backtests, or analyze market data. What specific aspect would you like to explore?",
        metadata: {
          action: 'GENERAL_FALLBACK_RESPONSE',
          parameters: { originalMessage: message }
        }
      };

    } catch (error) {
      apiLogger.error('Error processing general query with AI', error as Error, {
        conversationId,
        messageLength: message.length
      });

      return {
        message: "I encountered an issue while processing your question. However, I can still help you with trading strategies, backtesting, or market analysis. What would you like to work on?",
        metadata: {
          action: 'GENERAL_ERROR_RESPONSE',
          error: (error as Error).message,
          parameters: { originalMessage: message }
        }
      };
    }
  }

  private async getOrLoadConversation(conversationId: string): Promise<ConversationData> {
    let conversation = this.activeConversations.get(conversationId);

    if (!conversation) {
      conversation = await this.conversationDataService.getConversation(conversationId);
      if (conversation === null) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      this.activeConversations.set(conversationId, conversation);
    }

    return conversation;
  }

  private async updateConversationStatus(conversationId: string, status: ConversationStatus): Promise<ConversationData> {
    const currentConversation = this.activeConversations.get(conversationId);

    if (currentConversation) {
      // Update stats
      this.updateConversationStateStats(currentConversation.status, -1);
      this.updateConversationStateStats(status, 1);
    }

    const conversation = await this.conversationDataService.updateConversation(conversationId, { status });
    this.activeConversations.set(conversationId, conversation);

    return conversation;
  }

  private async sendToConversation(conversationId: string, event: WebSocketEvent): Promise<void> {
    await broadcastToRoom(`conversation_${conversationId}`, event);
  }

  private splitIntoChunks(content: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    const words = content.split(' ');

    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  private updateConversationStateStats(status: ConversationStatus, delta: number): void {
    const current = this.stats.conversationStates.get(status) || 0;
    this.stats.conversationStates.set(status, Math.max(0, current + delta));
  }

  private startPeriodicCleanup(): void {
    // Cleanup every hour
    setInterval(async () => {
      try {
        const cleaned = await this.conversationDataService.cleanupOldConversations(24);
        if (cleaned > 0) {
          apiLogger.info('Periodic conversation cleanup completed', { cleanedConversations: cleaned });
        }
      } catch (error) {
        apiLogger.error('Error during periodic cleanup', error as Error);
      }
    }, 60 * 60 * 1000);
  }

  async getConversationHistory(conversationId: string, limit: number = 50): Promise<ConversationMessage[]> {
    return await this.conversationDataService.getConversationHistory(conversationId, limit);
  }

  async getUserConversations(userId: string, limit: number = 20): Promise<ConversationData[]> {
    return await this.conversationDataService.getUserConversations(userId, limit);
  }

  async archiveConversation(conversationId: string): Promise<void> {
    await this.conversationDataService.archiveConversation(conversationId);

    const conversation = this.activeConversations.get(conversationId);
    if (conversation) {
      this.updateConversationStateStats(conversation.status, -1);
      this.updateConversationStateStats('ARCHIVED', 1);
      this.activeConversations.delete(conversationId);
    }

    apiLogger.info('Conversation archived', { conversationId });
  }

  getStats(): ConversationStats {
    const statusStats: Record<ConversationStatus, number> = {
      ACTIVE: 0,
      ARCHIVED: 0,
      DELETED: 0
    };

    this.stats.conversationStates.forEach((count, status) => {
      statusStats[status] = count;
    });

    return {
      totalConversations: this.activeConversations.size,
      activeConversations: statusStats.ACTIVE,
      messagesProcessed: this.stats.messagesProcessed,
      averageResponseTime: this.stats.messagesProcessed > 0
        ? this.stats.totalResponseTime / this.stats.messagesProcessed
        : 0,
      conversationsByStatus: statusStats
    };
  }
}

export const conversationManager = new ConversationManager();