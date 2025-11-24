import logger from '../_utils/logger.js';

const MAX_CONTEXT_MESSAGES = 20; // Maximum number of messages to keep per room

/**
 * GEMINI NOTE:
 * This class provides an in-memory store for chat conversation history,
 * as required by GEMIN.md. It's used to provide context to the LLM.
 */
class ChatContextStore {
  constructor() {
    // Map<roomId, message[]>
    this.contexts = new Map();
  }

  /**
   * Retrieves the message history for a room.
   * @param {string} roomId 
   * @returns {Array} An array of message objects.
   */
  getContext(roomId) {
    return this.contexts.get(roomId) || [];
  }

  /**
   * Adds a message to a room's context.
   * @param {string} roomId 
   * @param {'user' | 'assistant'} role 
   * @param {string} content 
   */
  addMessage(roomId, role, content) {
    if (!this.contexts.has(roomId)) {
      this.contexts.set(roomId, []);
    }
    const context = this.contexts.get(roomId);
    
    context.push({ role, content });

    // Trim the context if it gets too long
    if (context.length > MAX_CONTEXT_MESSAGES) {
      context.splice(0, context.length - MAX_CONTEXT_MESSAGES);
    }
    logger.debug(`[ContextStore] 룸 ${roomId}에 메시지가 추가되었습니다. 길이: ${context.length}`);
  }

  /**
   * Clears the chat context for a specific room.
   * @param {string} roomId 
   */
  clearContext(roomId) {
    if (this.contexts.has(roomId)) {
      this.contexts.delete(roomId);
      logger.info(`[ContextStore] 룸 ${roomId}의 채팅 컨텍스트가 지워졌습니다.`);
    }
  }
}

export const chatContextStore = new ChatContextStore();
