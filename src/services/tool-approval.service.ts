/**
 * Tool Approval Service - Manages user approval flow for AI-initiated tool calls
 *
 * This service creates pending tool calls that require user consent before execution,
 * providing a safety layer for potentially impactful AI actions.
 */

import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { apiLogger } from './logger';
import { broadcastToUser, broadcastToRoom } from '@/websocket/server';

export interface PendingToolCall {
  callId: string;
  conversationId: string;
  userId: string;
  toolName: string;
  toolLabel: string;
  reason: string;
  params: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  resolvedAt: string | null;
  toolCallId?: string;
}

export interface ToolCallDecision {
  status: 'approved' | 'rejected' | 'cancelled';
  overrides?: Record<string, any>;
  feedback?: string;
}

export interface CreatePendingCallParams {
  conversationId: string;
  userId: string;
  toolName: string;
  toolLabel: string;
  reason: string;
  params?: Record<string, any>;
  toolCallId?: string;
}

interface PendingCallEntry extends PendingToolCall {
  decisionPromise: Promise<ToolCallDecision>;
  resolve: (decision: ToolCallDecision) => void;
  reject: (error: Error) => void;
}

class ToolApprovalService extends EventEmitter {
  private pendingCalls = new Map<string, PendingCallEntry>();

  constructor() {
    super();
    apiLogger.info('Tool Approval Service initialized');
  }

  /**
   * Create a pending tool call that requires user approval
   */
  createPendingCall({
    conversationId,
    userId,
    toolName,
    toolLabel,
    reason,
    params = {},
    toolCallId = null
  }: CreatePendingCallParams): PendingToolCall {
    const callId = `tool_${Date.now()}_${uuidv4().substring(0, 8)}`;

    let decisionResolver: (decision: ToolCallDecision) => void;
    let decisionRejecter: (error: Error) => void;

    const decisionPromise = new Promise<ToolCallDecision>((resolve, reject) => {
      decisionResolver = resolve;
      decisionRejecter = reject;
    });

    const entry: PendingCallEntry = {
      callId,
      conversationId,
      userId,
      toolName,
      toolLabel,
      reason,
      params,
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      decisionPromise,
      resolve: decisionResolver!,
      reject: decisionRejecter!,
      toolCallId: toolCallId || undefined,
    };

    this.pendingCalls.set(callId, entry);

    apiLogger.info('Created pending tool call', {
      callId,
      conversationId,
      toolName,
      userId
    });

    // Emit event for real-time notifications
    this.emit('toolCallRequested', this.toPublic(entry));

    // Broadcast to user via WebSocket
    broadcastToUser(userId, {
      event: 'tool_call_requested',
      data: this.toPublic(entry),
      timestamp: new Date().toISOString()
    }).catch(error => {
      apiLogger.warn('Failed to broadcast tool call request:', error);
    });

    // Also broadcast to conversation room
    broadcastToRoom(`conversation_${conversationId}`, {
      event: 'tool_call_requested',
      data: this.toPublic(entry),
      timestamp: new Date().toISOString()
    }).catch(error => {
      apiLogger.warn('Failed to broadcast to conversation room:', error);
    });

    return this.toPublic(entry);
  }

  /**
   * Wait for user decision on a specific tool call
   */
  async waitForDecision(callId: string): Promise<ToolCallDecision> {
    const entry = this.pendingCalls.get(callId);

    if (!entry) {
      throw new Error(`Tool call ${callId} not found`);
    }

    apiLogger.info('Waiting for tool call decision', { callId });

    try {
      const decision = await entry.decisionPromise;
      apiLogger.info('Tool call decision received', {
        callId,
        status: decision.status,
        hasOverrides: !!decision.overrides
      });
      return decision;
    } finally {
      // Clean up after decision is made
      this.pendingCalls.delete(callId);
    }
  }

  /**
   * Approve a pending tool call
   */
  approve(callId: string, overrides: Record<string, any> = {}): PendingToolCall {
    const entry = this.pendingCalls.get(callId);
    if (!entry) {
      throw new Error('Tool call not found or already resolved');
    }

    entry.status = 'approved';
    entry.resolvedAt = new Date().toISOString();

    const decision: ToolCallDecision = {
      status: 'approved',
      overrides: Object.keys(overrides).length > 0 ? overrides : undefined
    };

    entry.resolve(decision);

    apiLogger.info('Tool call approved', {
      callId,
      conversationId: entry.conversationId,
      toolName: entry.toolName,
      hasOverrides: !!decision.overrides
    });

    // Emit event for real-time notifications
    this.emit('toolCallApproved', { callId, decision });

    // Broadcast approval to user and conversation
    const approvalEvent = {
      event: 'tool_call_approved',
      data: { callId, decision, toolCall: this.toPublic(entry) },
      timestamp: new Date().toISOString()
    };

    broadcastToUser(entry.userId, approvalEvent).catch(error => {
      apiLogger.warn('Failed to broadcast tool call approval:', error);
    });

    broadcastToRoom(`conversation_${entry.conversationId}`, approvalEvent).catch(error => {
      apiLogger.warn('Failed to broadcast approval to conversation room:', error);
    });

    return this.toPublic(entry);
  }

  /**
   * Reject a pending tool call
   */
  reject(callId: string, feedback: string | null = null): PendingToolCall {
    const entry = this.pendingCalls.get(callId);
    if (!entry) {
      throw new Error('Tool call not found or already resolved');
    }

    entry.status = 'rejected';
    entry.resolvedAt = new Date().toISOString();

    const decision: ToolCallDecision = {
      status: 'rejected',
      feedback: feedback || undefined
    };

    entry.resolve(decision);

    apiLogger.info('Tool call rejected', {
      callId,
      conversationId: entry.conversationId,
      toolName: entry.toolName,
      feedback
    });

    // Emit event for real-time notifications
    this.emit('toolCallRejected', { callId, decision });

    // Broadcast rejection to user and conversation
    const rejectionEvent = {
      event: 'tool_call_rejected',
      data: { callId, decision, toolCall: this.toPublic(entry) },
      timestamp: new Date().toISOString()
    };

    broadcastToUser(entry.userId, rejectionEvent).catch(error => {
      apiLogger.warn('Failed to broadcast tool call rejection:', error);
    });

    broadcastToRoom(`conversation_${entry.conversationId}`, rejectionEvent).catch(error => {
      apiLogger.warn('Failed to broadcast rejection to conversation room:', error);
    });

    return this.toPublic(entry);
  }

  /**
   * Cancel and remove a pending call (typically on error)
   */
  cancel(callId: string, error?: Error): void {
    const entry = this.pendingCalls.get(callId);
    if (!entry) {
      return;
    }

    entry.status = 'cancelled';
    entry.resolvedAt = new Date().toISOString();

    if (error) {
      entry.reject(error);
    } else {
      entry.resolve({ status: 'cancelled' });
    }

    this.pendingCalls.delete(callId);

    apiLogger.info('Tool call cancelled', {
      callId,
      conversationId: entry.conversationId,
      toolName: entry.toolName,
      error: error?.message
    });

    // Emit event for real-time notifications
    this.emit('toolCallCancelled', { callId, error: error?.message });
  }

  /**
   * List pending calls, optionally filtered by conversation ID
   */
  listPending(conversationId?: string): PendingToolCall[] {
    const calls = Array.from(this.pendingCalls.values()).map((entry) => this.toPublic(entry));

    if (!conversationId) {
      return calls;
    }

    return calls.filter((call) => call.conversationId === conversationId);
  }

  /**
   * Get a specific pending call by ID
   */
  getPendingCall(callId: string): PendingToolCall | null {
    const entry = this.pendingCalls.get(callId);
    return entry ? this.toPublic(entry) : null;
  }

  /**
   * Get statistics about pending calls
   */
  getStats(): {
    totalPending: number;
    byConversation: Record<string, number>;
    byTool: Record<string, number>;
    oldestPending: string | null;
  } {
    const calls = Array.from(this.pendingCalls.values());

    const byConversation: Record<string, number> = {};
    const byTool: Record<string, number> = {};
    let oldestPending: string | null = null;
    let oldestTimestamp = Date.now();

    for (const call of calls) {
      // Count by conversation
      byConversation[call.conversationId] = (byConversation[call.conversationId] || 0) + 1;

      // Count by tool
      byTool[call.toolName] = (byTool[call.toolName] || 0) + 1;

      // Track oldest
      const timestamp = new Date(call.createdAt).getTime();
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp;
        oldestPending = call.callId;
      }
    }

    return {
      totalPending: calls.length,
      byConversation,
      byTool,
      oldestPending,
    };
  }

  /**
   * Clean up old pending calls (for maintenance)
   */
  cleanupOldCalls(maxAgeMs: number = 24 * 60 * 60 * 1000): number { // 24 hours default
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [callId, entry] of this.pendingCalls) {
      const age = now - new Date(entry.createdAt).getTime();
      if (age > maxAgeMs) {
        toDelete.push(callId);
      }
    }

    for (const callId of toDelete) {
      this.cancel(callId, new Error('Tool call expired due to age'));
    }

    if (toDelete.length > 0) {
      apiLogger.info('Cleaned up expired tool calls', {
        count: toDelete.length,
        maxAgeHours: maxAgeMs / (60 * 60 * 1000)
      });
    }

    return toDelete.length;
  }

  /**
   * Convert internal entry to public format (remove internal promise handlers)
   */
  private toPublic(entry: PendingCallEntry): PendingToolCall {
    if (!entry) return entry;

    const { resolve, reject, decisionPromise, ...publicEntry } = entry;
    return publicEntry;
  }
}

// Export singleton instance
export const toolApprovalService = new ToolApprovalService();
export default toolApprovalService;