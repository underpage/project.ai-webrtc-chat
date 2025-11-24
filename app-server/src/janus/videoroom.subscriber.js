import EventEmitter from 'events';
import { janusManager } from './janus.client.js';
import logger from '../_utils/logger.js';

const VIDEO_ROOM_PLUGIN = 'janus.plugin.videoroom';

/**
 * GEMINI NOTE:
 * This class manages a single subscription to a remote feed in a Janus Videoroom.
 * Each participant will have one of these for each peer they subscribe to.
 */
class VideoRoomSubscriber extends EventEmitter {
  constructor(participantId, roomId, feedId) {
    super();
    this.participantId = participantId;
    this.roomId = roomId;
    this.feedId = feedId; // The feed ID we want to subscribe to
    this.handle = null;
    logger.debug(`[${this.roomId}] VideoRoomSubscriber가 ${participantId}를 위해 생성되어 ${feedId}를 구독합니다.`);
  }

  /**
   * Starts the subscription process.
   * 1. Attaches a new plugin handle.
   * 2. Sends a 'join' request as a subscriber.
   * 3. Janus will reply with an SDP Offer (via an event).
   */
  async start() {
    try {
      const session = janusManager.session;
      if (!session) {
        throw new Error('Janus session is not available.');
      }
      this.handle = await session.attach(VIDEO_ROOM_PLUGIN);
      logger.info(`[${this.roomId}] 구독자 핸들(${this.participantId} -> ${this.feedId})이 연결되었습니다.`);
      
      this._setupHandleListeners();
      
      const joinRequest = {
        request: 'join',
        ptype: 'subscriber',
        room: this.roomId,
        feed: this.feedId,
        private_id: this.participantId, // Link this handle to our internal ID
      };
      
      // This will trigger a 'message' event with a JSEP offer from Janus
      await this.handle.message(joinRequest);
      logger.info(`[${this.roomId}] 구독자 참여 요청이 ${this.participantId} -> ${this.feedId}로 전송되었습니다.`);

    } catch (error) {
      logger.error(`[${this.roomId}] ${this.participantId} -> ${this.feedId} 구독 시작 오류:`, error);
      this.emit('error', error);
      this.destroy();
    }
  }

  _setupHandleListeners() {
    this.handle.on('message', async (msg) => {
      const { jsep, plugindata } = msg;
      const data = plugindata ? plugindata.data : null;

      if (data && data.videoroom === 'attached') {
        logger.info(`[${this.roomId}] ${this.participantId} -> ${this.feedId} 구독이 성공적으로 연결되었습니다.`);
        // Now we wait for the client's answer
      }

      if (jsep) {
        // This is the SDP Offer from Janus for this subscription.
        // We emit it so the signaling handler can forward it to the client.
        this.emit('jsep', jsep);
      }
    });

    this.handle.on('candidate', (candidate) => {
      this.emit('candidate', candidate);
    });

    this.handle.on('hangup', () => {
      logger.info(`[${this.roomId}] ${this.participantId} -> ${this.feedId} 구독 핸들 중단`);
      this.emit('hangup');
      this.destroy();
    });
  }
  
  /**
   * Called when the client sends back its SDP Answer.
   * @param {object} jsep - The client's SDP Answer.
   */
  async answer(jsep) {
    if (!this.handle) {
      throw new Error('Subscriber handle not attached.');
    }
    const startRequest = { request: 'start', room: this.roomId };
    await this.handle.message(startRequest, { jsep });
    logger.info(`[${this.roomId}] ${this.participantId} -> ${this.feedId}를 위한 클라이언트의 응답을 Janus에 전송했습니다.`);
  }

  async trickleCandidate(candidate) {
    if (!this.handle) return;
    await this.handle.trickle(candidate);
  }

  destroy() {
    this.removeAllListeners();
    if (this.handle) {
      this.handle.detach().catch(e => logger.error(`[${this.roomId}] ${this.participantId}에 대한 구독자 핸들 분리 오류:`, e));
      this.handle = null;
    }
    logger.debug(`VideoRoomSubscriber가 ${this.participantId} -> ${this.feedId}를 위해 파괴되었습니다.`);
  }
}

export { VideoRoomSubscriber };
