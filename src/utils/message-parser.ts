/**
 * Message Parser - Utilities for parsing AI assistant messages
 *
 * This module handles parsing of special tags in AI messages, particularly
 * thinking tags that contain internal reasoning that should be hidden from users.
 */

import { apiLogger } from '@/services/logger';

export interface ParsedMessage {
  content: string;
  thinking: string | null;
  hasThinking: boolean;
}

export interface ThinkingSection {
  content: string;
  startIndex: number;
  endIndex: number;
}

class MessageParser {
  private static readonly THINKING_START_PATTERN = /<thinking>/gi;
  private static readonly THINKING_END_PATTERN = /<\/thinking>/gi;
  private static readonly THINKING_FULL_PATTERN = /<thinking>([\s\S]*?)<\/thinking>/gi;

  /**
   * Parse thinking tags from an AI message
   * Extracts internal reasoning that should be hidden from users
   */
  static parseThinkingTags(message: string): ParsedMessage {
    if (!message || typeof message !== 'string') {
      return {
        content: message || '',
        thinking: null,
        hasThinking: false
      };
    }

    try {
      const thinkingSections = this.extractThinkingSections(message);

      if (thinkingSections.length === 0) {
        return {
          content: message.trim(),
          thinking: null,
          hasThinking: false
        };
      }

      // Extract all thinking content
      const thinkingContent = thinkingSections
        .map(section => section.content.trim())
        .filter(content => content.length > 0)
        .join('\n\n');

      // Remove thinking tags from the main content
      let cleanContent = message;

      // Remove all thinking sections (in reverse order to maintain indices)
      for (let i = thinkingSections.length - 1; i >= 0; i--) {
        const section = thinkingSections[i];
        cleanContent = cleanContent.substring(0, section.startIndex) +
                     cleanContent.substring(section.endIndex);
      }

      // Clean up extra whitespace
      cleanContent = cleanContent
        .replace(/\n\s*\n\s*\n/g, '\n\n') // Multiple newlines to double
        .trim();

      return {
        content: cleanContent,
        thinking: thinkingContent || null,
        hasThinking: thinkingContent.length > 0
      };

    } catch (error) {
      apiLogger.error('Error parsing thinking tags:', error);
      return {
        content: message.trim(),
        thinking: null,
        hasThinking: false
      };
    }
  }

  /**
   * Extract all thinking sections from a message
   */
  private static extractThinkingSections(message: string): ThinkingSection[] {
    const sections: ThinkingSection[] = [];
    let match;

    // Reset regex state
    this.THINKING_FULL_PATTERN.lastIndex = 0;

    while ((match = this.THINKING_FULL_PATTERN.exec(message)) !== null) {
      const fullMatch = match[0];
      const thinkingContent = match[1];
      const startIndex = match.index;
      const endIndex = match.index + fullMatch.length;

      sections.push({
        content: thinkingContent,
        startIndex,
        endIndex
      });
    }

    return sections;
  }

  /**
   * Check if a message contains thinking tags
   */
  static hasThinkingTags(message: string): boolean {
    if (!message || typeof message !== 'string') {
      return false;
    }

    return this.THINKING_START_PATTERN.test(message) &&
           this.THINKING_END_PATTERN.test(message);
  }

  /**
   * Extract only the thinking content from a message
   */
  static extractThinking(message: string): string | null {
    const parsed = this.parseThinkingTags(message);
    return parsed.thinking;
  }

  /**
   * Remove thinking tags and return clean content
   */
  static removeThinkingTags(message: string): string {
    const parsed = this.parseThinkingTags(message);
    return parsed.content;
  }

  /**
   * Validate thinking tag structure
   */
  static validateThinkingTags(message: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!message || typeof message !== 'string') {
      return { isValid: true, errors, warnings };
    }

    // Count opening and closing tags
    const openingTags = (message.match(this.THINKING_START_PATTERN) || []).length;
    const closingTags = (message.match(this.THINKING_END_PATTERN) || []).length;

    // Reset regex state
    this.THINKING_START_PATTERN.lastIndex = 0;
    this.THINKING_END_PATTERN.lastIndex = 0;

    if (openingTags !== closingTags) {
      errors.push(`Mismatched thinking tags: ${openingTags} opening, ${closingTags} closing`);
    }

    // Check for nested thinking tags
    if (openingTags > 1) {
      const sections = this.extractThinkingSections(message);
      if (sections.length !== openingTags) {
        errors.push('Nested thinking tags detected - thinking tags cannot be nested');
      }
    }

    // Check for empty thinking sections
    const sections = this.extractThinkingSections(message);
    const emptySections = sections.filter(section => !section.content.trim());
    if (emptySections.length > 0) {
      warnings.push(`${emptySections.length} empty thinking section(s) found`);
    }

    // Check for very long thinking sections
    const longSections = sections.filter(section => section.content.length > 2000);
    if (longSections.length > 0) {
      warnings.push(`${longSections.length} very long thinking section(s) found (>2000 chars)`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Format thinking content for display in development/debugging
   */
  static formatThinkingForDebug(thinking: string): string {
    if (!thinking) return '';

    return `[THINKING]\n${thinking}\n[/THINKING]`;
  }

  /**
   * Sanitize message content for safe display
   */
  static sanitizeContent(content: string): string {
    if (!content || typeof content !== 'string') {
      return '';
    }

    return content
      .trim()
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n');
  }

  /**
   * Parse and sanitize a complete message
   */
  static parseAndSanitize(message: string): ParsedMessage {
    const sanitized = this.sanitizeContent(message);
    const parsed = this.parseThinkingTags(sanitized);

    return {
      content: this.sanitizeContent(parsed.content),
      thinking: parsed.thinking ? this.sanitizeContent(parsed.thinking) : null,
      hasThinking: parsed.hasThinking
    };
  }
}

export default MessageParser;