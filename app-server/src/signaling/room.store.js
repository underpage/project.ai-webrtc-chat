import logger  from '../_utils/logger.js';

/**
 * @typedef {import('./janus/videoroom.handle.js').VideoRoomHandler} VideoRoomHandler
 * @typedef {import('./janus/videoroom.subscriber.js').VideoRoomSubscriber} VideoRoomSubscriber
 */

/**
 * @typedef {object} Participant
 * @property {string} participantId - The unique ID for the WebSocket connection.
 * @property {object} ws - The WebSocket instance.
 * @property {VideoRoomHandler} publisher - The handler for publishing media.
 * @property {Map<number, VideoRoomSubscriber>} subscribers - A map of handlers for subscriptions.
 * @property {object} info - User information from the database.
 * @property {number|null} feedId - The Janus feed ID for the publisher.
 */

/**
 * @typedef {Map<string, Participant>} ParticipantMap
 */

class RoomStore {
  constructor() {
    /** @type {Map<string, ParticipantMap>} */
    this.rooms = new Map();
  }

  addParticipant(roomId, participantId, ws, publisherHandle, info) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Map());
    }
    const room = this.rooms.get(roomId);
    
    const participant = {
      participantId,
      ws,
      publisher: publisherHandle,
      subscribers: new Map(),
      info,
      feedId: null,
    };
    room.set(participantId, participant);
    
    logger.debug(`[RoomStore] 룸 ${roomId}에 참가자 ${participantId} 추가. 총원: ${room.size}`);
  }

  removeParticipant(roomId, participantId) {
    const room = this.rooms.get(roomId);
    if (!room || !room.has(participantId)) return;

    const participant = room.get(participantId);
    // Clean up all subscriber handles
    participant.subscribers.forEach(sub => sub.destroy());
    
    room.delete(participantId);
    logger.debug(`[RoomStore] 룸 ${roomId}에서 참가자 ${participantId} 제거. 총원: ${room.size}`);
    
    if (room.size === 0) {
      this.rooms.delete(roomId);
      logger.debug(`[RoomStore] 룸 ${roomId}가 비어 있어서 제거되었습니다.`);
    }
  }

  getParticipant(roomId, participantId) {
    const room = this.rooms.get(roomId);
    return room ? room.get(participantId) : undefined;
  }
  
  getRoomParticipants(roomId) {
    const room = this.rooms.get(roomId);
    return room ? Array.from(room.values()) : [];
  }

  setParticipantFeedId(roomId, participantId, feedId) {
    const participant = this.getParticipant(roomId, participantId);
    if (participant) {
      participant.feedId = feedId;
      logger.debug(`[RoomStore] 참가자 ${participantId}의 Publisher FeedId가 ${feedId}로 설정되었습니다.`);
    }
  }

  addSubscriber(roomId, participantId, feedId, subscriberHandle) {
    const participant = this.getParticipant(roomId, participantId);
    if (participant) {
      participant.subscribers.set(feedId, subscriberHandle);
      logger.debug(`[RoomStore] ${participantId} -> ${feedId}에 대한 구독자 추가`);
    }
  }

  getSubscriber(roomId, participantId, feedId) {
    const participant = this.getParticipant(roomId, participantId);
    return participant ? participant.subscribers.get(feedId) : undefined;
  }

  removeSubscriber(roomId, participantId, feedId) {
    const participant = this.getParticipant(roomId, participantId);
    if (participant && participant.subscribers.has(feedId)) {
      const sub = participant.subscribers.get(feedId);
      sub.destroy();
      participant.subscribers.delete(feedId);
      logger.debug(`[RoomStore] ${participantId} -> ${feedId}에 대한 구독자 제거`);
    }
  }

  broadcast(roomId, message, excludeParticipantId) {
    const participants = this.getRoomParticipants(roomId);
    const serializedMessage = JSON.stringify(message);

    for (const p of participants) {
      if (p.participantId !== excludeParticipantId && p.ws.readyState === p.ws.OPEN) {
        p.ws.send(serializedMessage);
      }
    }
    // logger.debug(`[RoomStore] Broadcasted message type '${message.type}' to room ${roomId}.`);
  }
}

export const roomStore = new RoomStore();