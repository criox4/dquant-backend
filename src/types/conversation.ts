export interface ConversationData {
  conversationId: string;
  userId: string;
  title?: string | null;
  summary?: string | null;
  status: ConversationStatus;
  lastMessageAt: Date;
  totalTokens: number;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationStatus = 'ACTIVE' | 'ARCHIVED' | 'DELETED';

export interface ConversationContext {
  currentStrategy?: string;
  tradingMode?: 'paper' | 'live';
  preferences?: UserPreferences;
  metadata?: Record<string, any>;
}

export interface ConversationMessage {
  id: number;
  messageId: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  tokenCount: number;
  metadata?: MessageMetadata;
  isCompressed: boolean;
  originalId?: string | null;
  createdAt: Date;
}

export interface MessageMetadata {
  action?: string;
  backtestResult?: any;
  strategy?: any;
  config?: any;
  thinking?: string;
  error?: string;
  [key: string]: any;
}

export interface UserPreferences {
  language?: string;
  riskLevel?: 'conservative' | 'moderate' | 'aggressive';
  defaultTimeframe?: string;
  preferredExchanges?: string[];
  notifications?: {
    email?: boolean;
    push?: boolean;
    webhook?: string;
  };
}

export interface IntentResult {
  type: IntentType;
  confidence: number;
  parameters: Record<string, any>;
  context?: Record<string, any>;
}

export type IntentType =
  | 'GENERAL_QUERY'
  | 'STRATEGY_REQUEST'
  | 'BACKTEST_REQUEST'
  | 'LIVE_TRADING_REQUEST'
  | 'PORTFOLIO_INQUIRY'
  | 'MARKET_DATA_REQUEST'
  | 'TECHNICAL_ANALYSIS'
  | 'RISK_MANAGEMENT'
  | 'HELP_REQUEST'
  | 'GREETING'
  | 'GOODBYE';

export interface ProcessMessageResponse {
  message: string;
  data?: any;
  metadata?: MessageMetadata;
  conversationStatus?: ConversationStatus;
}

export interface ConversationStats {
  totalConversations: number;
  activeConversations: number;
  messagesProcessed: number;
  averageResponseTime: number;
  conversationsByStatus: Record<ConversationStatus, number>;
}

export interface StreamingOptions {
  chunkSize?: number;
  delay?: number;
  includeThinking?: boolean;
}

export interface ConversationManagerConfig {
  contextWindow: number;
  maxActiveConversations: number;
  conversationTimeout: number;
  enableStreaming: boolean;
  defaultStreamingOptions: StreamingOptions;
}