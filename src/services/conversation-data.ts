import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ConversationData, ConversationStatus, ConversationMessage, MessageMetadata } from '@/types/conversation';
import { databaseLogger } from '@/services/logger';
import { getPrismaClient } from '@/config/database';

export class ConversationDataService {
  private get db(): PrismaClient {
    return getPrismaClient();
  }

  async createConversation(userId: string, title?: string): Promise<ConversationData> {
    const conversationId = uuidv4();

    try {
      const conversation = await this.db.conversation.create({
        data: {
          conversationId,
          userId,
          title,
          status: 'ACTIVE',
          metadata: {}
        }
      });

      databaseLogger.info('Conversation created', {
        conversationId,
        userId,
        hasTitle: !!title
      });

      return this.mapConversationData(conversation);
    } catch (error) {
      databaseLogger.error('Failed to create conversation', error as Error, {
        userId,
        title
      });
      throw new Error(`Failed to create conversation: ${(error as Error).message}`);
    }
  }

  async getConversation(conversationId: string): Promise<ConversationData | null> {
    try {
      const conversation = await this.db.conversation.findUnique({
        where: { conversationId }
      });

      if (!conversation) {
        return null;
      }

      return this.mapConversationData(conversation);
    } catch (error) {
      databaseLogger.error('Failed to get conversation', error as Error, {
        conversationId
      });
      throw new Error(`Failed to get conversation: ${(error as Error).message}`);
    }
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<Pick<ConversationData, 'status' | 'title' | 'summary' | 'metadata'>>
  ): Promise<ConversationData> {
    try {
      const conversation = await this.db.conversation.update({
        where: { conversationId },
        data: {
          ...(updates.status && { status: updates.status }),
          ...(updates.title !== undefined && { title: updates.title }),
          ...(updates.summary !== undefined && { summary: updates.summary }),
          ...(updates.metadata && { metadata: updates.metadata }),
          lastMessageAt: new Date(),
          updatedAt: new Date()
        }
      });

      databaseLogger.debug('Conversation updated', {
        conversationId,
        updatedFields: Object.keys(updates)
      });

      return this.mapConversationData(conversation);
    } catch (error) {
      databaseLogger.error('Failed to update conversation', error as Error, {
        conversationId,
        updates
      });
      throw new Error(`Failed to update conversation: ${(error as Error).message}`);
    }
  }

  async addMessage(
    conversationId: string,
    role: 'USER' | 'ASSISTANT' | 'SYSTEM',
    content: string,
    metadata?: MessageMetadata
  ): Promise<ConversationMessage> {
    try {
      const messageId = uuidv4();
      const tokenCount = this.estimateTokenCount(content);

      const message = await this.db.message.create({
        data: {
          messageId,
          conversationId,
          role,
          content,
          tokenCount,
          metadata: metadata || {},
          isCompressed: false
        }
      });

      // Update conversation last message time and token count
      await this.db.conversation.update({
        where: { conversationId },
        data: {
          lastMessageAt: new Date(),
          totalTokens: {
            increment: tokenCount
          }
        }
      });

      databaseLogger.debug('Message added to conversation', {
        conversationId,
        messageId,
        role,
        contentLength: content.length,
        tokenCount,
        hasMetadata: !!metadata
      });

      return this.mapMessageData(message);
    } catch (error) {
      databaseLogger.error('Failed to add message', error as Error, {
        conversationId,
        role,
        contentLength: content.length
      });
      throw new Error(`Failed to add message: ${(error as Error).message}`);
    }
  }

  async getConversationHistory(
    conversationId: string,
    limit: number = 50
  ): Promise<ConversationMessage[]> {
    try {
      const messages = await this.db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit
      });

      return messages.map(message => this.mapMessageData(message));
    } catch (error) {
      databaseLogger.error('Failed to get conversation history', error as Error, {
        conversationId,
        limit
      });
      throw new Error(`Failed to get conversation history: ${(error as Error).message}`);
    }
  }

  async getUserConversations(userId: string, limit: number = 20): Promise<ConversationData[]> {
    try {
      const conversations = await this.db.conversation.findMany({
        where: { userId },
        orderBy: { lastMessageAt: 'desc' },
        take: limit
      });

      return conversations.map(conversation => this.mapConversationData(conversation));
    } catch (error) {
      databaseLogger.error('Failed to get user conversations', error as Error, {
        userId,
        limit
      });
      throw new Error(`Failed to get user conversations: ${(error as Error).message}`);
    }
  }

  async archiveConversation(conversationId: string): Promise<void> {
    try {
      await this.db.conversation.update({
        where: { conversationId },
        data: {
          status: 'ARCHIVED',
          updatedAt: new Date()
        }
      });

      databaseLogger.info('Conversation archived', { conversationId });
    } catch (error) {
      databaseLogger.error('Failed to archive conversation', error as Error, {
        conversationId
      });
      throw new Error(`Failed to archive conversation: ${(error as Error).message}`);
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      await this.db.conversation.update({
        where: { conversationId },
        data: {
          status: 'DELETED',
          updatedAt: new Date()
        }
      });

      databaseLogger.info('Conversation deleted', { conversationId });
    } catch (error) {
      databaseLogger.error('Failed to delete conversation', error as Error, {
        conversationId
      });
      throw new Error(`Failed to delete conversation: ${(error as Error).message}`);
    }
  }

  async getActiveConversations(): Promise<ConversationData[]> {
    try {
      const conversations = await this.db.conversation.findMany({
        where: {
          status: 'ACTIVE'
        },
        orderBy: { lastMessageAt: 'desc' }
      });

      return conversations.map(conversation => this.mapConversationData(conversation));
    } catch (error) {
      databaseLogger.error('Failed to get active conversations', error as Error);
      throw new Error(`Failed to get active conversations: ${(error as Error).message}`);
    }
  }

  async cleanupOldConversations(olderThanHours: number = 24 * 7): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

      const result = await this.db.conversation.updateMany({
        where: {
          lastMessageAt: { lt: cutoffDate },
          status: 'ACTIVE'
        },
        data: {
          status: 'ARCHIVED',
          updatedAt: new Date()
        }
      });

      databaseLogger.info('Old conversations cleaned up', {
        count: result.count,
        cutoffDate: cutoffDate.toISOString()
      });

      return result.count;
    } catch (error) {
      databaseLogger.error('Failed to cleanup old conversations', error as Error, {
        olderThanHours
      });
      throw new Error(`Failed to cleanup old conversations: ${(error as Error).message}`);
    }
  }

  private mapConversationData(conversation: any): ConversationData {
    return {
      conversationId: conversation.conversationId,
      userId: conversation.userId,
      title: conversation.title,
      summary: conversation.summary,
      status: conversation.status as ConversationStatus,
      lastMessageAt: conversation.lastMessageAt,
      totalTokens: conversation.totalTokens,
      metadata: conversation.metadata,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };
  }

  private mapMessageData(message: any): ConversationMessage {
    return {
      id: message.id,
      messageId: message.messageId,
      conversationId: message.conversationId,
      role: message.role as 'USER' | 'ASSISTANT' | 'SYSTEM',
      content: message.content,
      tokenCount: message.tokenCount,
      metadata: message.metadata as MessageMetadata,
      isCompressed: message.isCompressed,
      originalId: message.originalId,
      createdAt: message.createdAt
    };
  }

  private estimateTokenCount(text: string): number {
    // Simple token estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}

// Lazy initialization to avoid issues with database setup order
let conversationDataServiceInstance: ConversationDataService | null = null;

export function getConversationDataService(): ConversationDataService {
  if (!conversationDataServiceInstance) {
    conversationDataServiceInstance = new ConversationDataService();
  }
  return conversationDataServiceInstance;
}

export const conversationDataService = getConversationDataService();