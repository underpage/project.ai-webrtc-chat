import { getSocketClient } from './socket.js';
import { $ } from '../utils/dom.js';
import { logger } from '../utils/logger.js';

export class ChatManager {
  constructor() {
    this.socket = getSocketClient();
    this.chatMessagesEl = $('#chat-messages');
    this.chatInputEl = $('#chat-input');
    this.sendChatBtn = $('#send-chat-btn');
    this.pendingAiMessages = new Map(); // chatId -> message element

    this._setupSocketListeners();
    this._setupUIListeners();
    logger.info('ChatManager initialized.');
  }

  _setupSocketListeners() {
    this.socket.on('chat-message', (data) => this.displayMessage(data));
    this.socket.on('ai-response-start', (data) => this.handleAiStart(data));
    this.socket.on('ai-response-chunk', (data) => this.handleAiChunk(data));
    this.socket.on('ai-error', (data) => this.handleAiError(data));
  }

  _setupUIListeners() {
    this.sendChatBtn.addEventListener('click', () => this.processInput());
    this.chatInputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.processInput();
      }
    });
  }

  processInput() {
    const text = this.chatInputEl.value.trim();
    if (!text) return;

    if (text.startsWith('/ai ')) {
      const query = text.substring(4);
      this.sendAiQuery(query);
    } else {
      this.sendChatMessage(text);
    }
    this.chatInputEl.value = '';
  }

  sendChatMessage(text) {
    this.socket.send({
      type: 'send-message',
      data: { text },
    });
  }
  
  sendAiQuery(query) {
    this.socket.send({
      type: 'ai-query',
      data: { query },
    });

    this.displayMessage({
      from: { displayName: 'You' },
      text: `(AI Query) ${query}`,
    }, true);
  }

  displayMessage(data, isOptimistic = false) {
    const { from, text } = data;
    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${isOptimistic ? 'optimistic' : ''}`;
    
    const senderEl = document.createElement('div');
    senderEl.className = 'sender';
    senderEl.textContent = from.displayName;
    
    const textEl = document.createElement('div');
    textEl.className = 'text';
    textEl.textContent = text;
    
    msgEl.append(senderEl, textEl);
    this.chatMessagesEl.appendChild(msgEl);
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
    
    return msgEl;
  }
  
  handleAiStart(data) {
    const { chatId } = data;
    const msgEl = this.displayMessage({
      from: { displayName: 'AI Assistant' },
      text: '...',
    });
    msgEl.classList.add('ai-message');
    msgEl.dataset.chatId = chatId;
    msgEl.querySelector('.text').textContent = '';
    this.pendingAiMessages.set(chatId, msgEl);
  }
  
  handleAiChunk(data) {
    const { chatId, chunk, done } = data;
    const msgEl = this.pendingAiMessages.get(chatId);
    
    if (msgEl) {
      const textEl = msgEl.querySelector('.text');
      textEl.textContent += chunk;
      this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
      
      if (done) {
        this.pendingAiMessages.delete(chatId);
      }
    }
  }

  handleAiError(data) {
    this.displayMessage({
      from: { displayName: 'System' },
      text: `AI Error: ${data.message || data.code}`,
    });
  }
}