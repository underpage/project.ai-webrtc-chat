import crypto from 'crypto';
import { ollamaClient } from './ollama.client.js';
import { chatContextStore } from './context.store.js';
import { validateInput, sanitizeOutput } from './llm.guard.js';
import logger from '../_utils/logger.js';

const FIRST_CHUNK_TIMEOUT = 10000; // 10 seconds
const TOTAL_RESPONSE_TIMEOUT = 30000; // 30 seconds

/**
 * GEMINI NOTE:
 * This is the main AI query orchestrator, as outlined in GEMIN.md.
 * It uses the guard, context store, and Ollama client to process
 * a query and stream the response, with timeout policies.
 *
 * @param {object} ws - The client's WebSocket connection.
 * @param {string} roomId - The ID of the room where the query originated.
 * @param {string} query - The user's question.
 */
export async function processQuery(ws, roomId, query) {
  const chatId = crypto.randomUUID();
  let totalResponse = '';
  let firstChunkReceived = false;

  const controller = new AbortController(); // Create AbortController
  const { signal } = controller;

  // Set up timeouts
  const firstChunkTimer = setTimeout(() => {
    if (!firstChunkReceived) {
      logger.warn(`[AI] 룸 ${roomId}의 첫 청크 시간 초과`);
      ws.send(JSON.stringify({ type: 'ai-error', data: { code: 'AI_TIMEOUT' } }));
      controller.abort(); // Abort the request
    }
  }, FIRST_CHUNK_TIMEOUT);

  const totalTimeoutTimer = setTimeout(() => {
    logger.warn(`[AI] 룸 ${roomId}의 전체 응답 시간 초과`);
    ws.send(JSON.stringify({ type: 'ai-error', data: { code: 'AI_TIMEOUT' } }));
    controller.abort(); // Abort the request
  }, TOTAL_RESPONSE_TIMEOUT);

  try {
    validateInput(query);

    ws.send(JSON.stringify({ type: 'ai-response-start', data: { chatId } }));

    const context = chatContextStore.getContext(roomId);
    chatContextStore.addMessage(roomId, 'user', query);
    const messages = [...context, { role: 'user', content: query }];

    // Pass the signal to the chatStream
    const stream = ollamaClient.chatStream(messages, signal);
    for await (const chunk of stream) {
      if (signal.aborted) { // Check if request was aborted by timeout
        logger.warn(`[AI] 룸 ${roomId}의 Ollama 스트림이 시간 초과로 중단되었습니다.`);
        break;
      }
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        clearTimeout(firstChunkTimer);
      }

      const sanitizedChunk = sanitizeOutput(chunk);
      totalResponse += sanitizedChunk;

      ws.send(JSON.stringify({
        type: 'ai-response-chunk',
        data: { chatId, chunk: sanitizedChunk, done: false },
      }));
    }

    if (!signal.aborted) { // Only finalize if not aborted by timeout
      ws.send(JSON.stringify({
        type: 'ai-response-chunk',
        data: { chatId, chunk: '', done: true },
      }));
      chatContextStore.addMessage(roomId, 'assistant', totalResponse);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      logger.warn(`[AI] 룸 ${roomId}의 Ollama 요청이 시간 초과로 중단되었습니다.`);
      // Error already sent by the timeout handler, no need to resend
    } else {
      logger.error(`[AI] 룸 ${roomId}의 쿼리 처리 오류:`, error);
      const errorCode = error.code === 'AI_POLICY_VIOLATION' ? error.code : 'AI_ERROR';
      ws.send(JSON.stringify({ type: 'ai-error', data: { code: errorCode, message: error.message } }));
    }
  } finally {
    clearTimeout(firstChunkTimer);
    clearTimeout(totalTimeoutTimer);
  }
}