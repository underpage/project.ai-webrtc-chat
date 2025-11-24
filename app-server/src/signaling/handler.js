import { URL } from 'url';
import crypto from 'crypto';
import { pool } from '../_config/db.config.js';
import { roomStore } from './room.store.js';
import { chatContextStore } from '../ai/context.store.js';
import { VideoRoomHandler } from '../janus/videoroom.handle.js';
import { VideoRoomSubscriber } from '../janus/videoroom.subscriber.js';
import logger from '../_utils/logger.js';
import { processQuery } from '../ai/chat.processor.js';

// --- DB Helper Functions ---

async function validateJoinToken(token) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT * FROM room_participants WHERE join_token = ? AND status = 'pending'`,
      [token]
    );
    return rows.length > 0 ? rows[0] : null;
  } finally {
    connection.release();
  }
}

async function updateUserStatus(participantDbId, status, feedId = null) {
  try {
    await pool.execute(
      `UPDATE room_participants SET status = ?, feed_id = ?, updated_at = NOW() WHERE id = ?`,
      [status, feedId, participantDbId]
    );
  } catch (error) {
    logger.error(`참가자 ${participantDbId}의 상태 업데이트 실패:`, error);
  }
}

// --- WebSocket Logic ---

function setupWebSocketListeners(ws, roomId, participantId) {
  const participant = roomStore.getParticipant(roomId, participantId);
  if (!participant) return;
  const { publisher } = participant;

  ws.on('message', async message => {
    try {
      const msg = JSON.parse(message.toString());
      const { type, data } = msg;
      logger.debug(`[${roomId}] ${participantId}로부터 메시지: ${type}`);

      switch (type) {
        case 'publish': // Client offers to publish
          await publisher.publish(data.jsep);
          break;
        
        case 'subscribe': { // Client wants to subscribe to a feed
          const { targetFeedId } = data;
          const subscriber = new VideoRoomSubscriber(participantId, roomId, targetFeedId);
          roomStore.addSubscriber(roomId, participantId, targetFeedId, subscriber);
          
          subscriber.on('jsep', (jsep) => {
            ws.send(JSON.stringify({
              type: 'sdp-offer',
              data: { usage: 'subscribe', targetFeedId, jsep },
            }));
          });

          subscriber.on('candidate', (candidate) => {
            ws.send(JSON.stringify({
              type: 'ice-candidate',
              data: { usage: 'subscribe', targetFeedId, candidate },
            }));
          });
          
          await subscriber.start();
          break;
        }

        case 'sdp-answer': { // Client answers a subscription offer
          const { targetFeedId, jsep } = data;
          const subscriber = roomStore.getSubscriber(roomId, participantId, targetFeedId);
          if (subscriber) {
            await subscriber.answer(jsep);
          }
          break;
        }

        case 'ice-candidate': { // ICE candidate for publish or subscribe
          const { usage, targetFeedId, candidate } = data;
          if (usage === 'publish') {
            await publisher.trickleCandidate(candidate);
          } else if (usage === 'subscribe' && targetFeedId) {
            const subscriber = roomStore.getSubscriber(roomId, participantId, targetFeedId);
            if (subscriber) {
              await subscriber.trickleCandidate(candidate);
            }
          }
          break;
        }

        case 'ai-query': {
          const { query } = data;
          processQuery(ws, roomId, query);
          break;
        }

        case 'send-message': {
          const { text } = data;
          if (text && typeof text === 'string' && text.length > 0) {
            const sender = roomStore.getParticipant(roomId, participantId);
            if (sender) {
              roomStore.broadcast(roomId, {
                type: 'chat-message',
                data: {
                  roomId,
                  from: {
                    userId: sender.info.user_id,
                    displayName: sender.info.display_name,
                  },
                  text,
                  timestamp: new Date().toISOString(),
                }
              });
            }
          }
          break;
        }

        default:
          logger.warn(`[${roomId}] ${participantId}로부터 알 수 없는 메시지 유형: ${type}`);
          ws.send(JSON.stringify({ type: 'error', code: 'UNKNOWN_MESSAGE_TYPE' }));
      }
    } catch (error) {
      logger.error(`[${roomId}] ${participantId}로부터 메시지 처리 오류:`, error);
      ws.send(JSON.stringify({ type: 'error', code: 'MESSAGE_PROCESSING_ERROR', message: error.message }));
    }
  });

  ws.on('close', async () => {
    logger.info(`[${roomId}] ${participantId}의 WebSocket이 닫혔습니다.`);
    const participantToClose = roomStore.getParticipant(roomId, participantId);
    if (participantToClose) {
      await participantToClose.publisher.leave();
      roomStore.removeParticipant(roomId, participantId);
      await updateUserStatus(participantToClose.info.id, 'left');

      roomStore.broadcast(roomId, {
        type: 'participant-left',
        data: {
          roomId,
          userId: participantToClose.info.user_id,
          feedId: participantToClose.feedId,
          reason: 'left',
        }
      }, participantId);
      
      // If the room is now empty, clear the AI chat context to prevent memory leaks
      if (roomStore.getRoomParticipants(roomId).length === 0) {
        chatContextStore.clearContext(roomId);
        logger.info(`[${roomId}] 룸이 비었습니다. AI 채팅 컨텍스트를 지웠습니다.`);
      }
    }
  });

  ws.on('error', (error) => logger.error(`[${roomId}] ${participantId}의 WebSocket 오류:`, error));
}

function setupHandlerListeners(ws, roomId, participantId) {
  const participant = roomStore.getParticipant(roomId, participantId);
  if (!participant) return;
  const { publisher } = participant;
  
  publisher.on('jsep', (jsep) => {
    ws.send(JSON.stringify({ type: 'sdp-answer', data: { usage: 'publish', jsep } }));
  });

  publisher.on('candidate', (candidate) => {
    ws.send(JSON.stringify({ type: 'ice-candidate', data: { usage: 'publish', candidate } }));
  });

  publisher.on('joined', async ({ feedId }) => {
    logger.info(`[${roomId}] ${participantId}의 feedId ${feedId}에 대한 Publisher 'joined' 이벤트`);
    
    roomStore.setParticipantFeedId(roomId, participantId, feedId);
    await updateUserStatus(participant.info.id, 'active', feedId);
    
    const otherParticipants = roomStore.getRoomParticipants(roomId)
      .filter(p => p.participantId !== participantId && p.feedId)
      .map(p => ({
        feedId: p.feedId,
        userInfo: { userId: p.info.user_id, displayName: p.info.display_name }
      }));

    ws.send(JSON.stringify({
      type: 'joined',
      data: { roomId, feedId, participants: otherParticipants }
    }));

    roomStore.broadcast(roomId, {
      type: 'participant-joined',
      data: {
        roomId,
        feedId,
        user: { userId: participant.info.user_id, displayName: participant.info.display_name }
      }
    }, participantId);
  });
  
  publisher.on('publishers', (publishers) => {
    for (const pub of publishers) {
        roomStore.broadcast(roomId, {
            type: 'participant-joined',
            data: {
                roomId,
                feedId: pub.id,
                user: { displayName: pub.display }
            }
        });
    }
  });
}

// --- Main Setup Function ---

export function setupSignalingHandler(wss) {
  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const joinToken = url.searchParams.get('token');

    if (!joinToken) return ws.close(4001, 'Join token is required.');

    const participantInfo = await validateJoinToken(joinToken);
    if (!participantInfo) return ws.close(4002, 'Invalid join token.');
    
    const { room_id: roomId, display_name: displayName } = participantInfo;
    const participantId = crypto.randomUUID();
    
    logger.info(`[${roomId}] ${displayName} (${participantId})의 연결을 수락했습니다.`);
    
    const publisher = new VideoRoomHandler(participantId, roomId, displayName);
    
    roomStore.addParticipant(roomId, participantId, ws, publisher, participantInfo);
    
    setupWebSocketListeners(ws, roomId, participantId);
    setupHandlerListeners(ws, roomId, participantId);
    
    await publisher.joinPublisher();

    ws.send(JSON.stringify({ type: 'connection-ready' }));
  });

  logger.info('✅ 시그널링 핸들러 설정 완료.');
}
