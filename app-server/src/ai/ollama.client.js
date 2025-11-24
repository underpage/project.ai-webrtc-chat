import fetch from 'node-fetch';
import logger from '../_utils/logger.js';

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = 'chat-assistant:1.0'; // As specified in GEMIN.md

/**
 * GEMINI NOTE:
 * This client encapsulates the logic for communicating with the Ollama API,
 * specifically the streaming chat endpoint.
 */
class OllamaClient {
  /**
   * Calls the Ollama chat API and returns an async generator for the stream.
   * @param {Array<object>} messages - The message history for context.
   * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the fetch request.
   * @returns {AsyncGenerator<string, void, unknown>} An async generator yielding content chunks.
   */
  async *chatStream(messages, signal) {
    try {
      const response = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: messages,
          stream: true,
        }),
        signal, // Pass the external signal here
      });

      if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decodedChunk = decoder.decode(value, { stream: true });
        const lines = decodedChunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.error) {
              throw new Error(`Ollama stream error: ${data.error}`);
            }
            if (data.message && data.message.content) {
              yield data.message.content;
            }
            if (data.done) {
              return;
            }
          } catch (e) {
            logger.error(`[OllamaClient] 스트림 라인 구문 분석 오류: "${line}"`, e);
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        logger.warn('[OllamaClient] Ollama 요청이 중단되었습니다.');
      } else {
        logger.error('[OllamaClient] 채팅 스트림 실패:', error);
        throw error;
      }
    }
  }
}

export const ollamaClient = new OllamaClient();
