import EventEmitter from 'events';
import { janusManager } from './janus.client.js';
import logger from '../_utils/logger.js';

const VIDEO_ROOM_PLUGIN = 'janus.plugin.videoroom';

class VideoRoomHandler extends EventEmitter {
  constructor(participantId, roomId, display) {
    super();
    this.participantId = participantId;
    this.roomId = roomId;
    this.display = display;
    this.handle = null;
    this.feedId = null; // Our unique ID in the room (publisher ID)
    logger.debug(`VideoRoomHandler가 참가자 ${participantId}, 룸 ${roomId}를 위해 생성되었습니다.`);
  }

  async attachPlugin() {
    try {
      const session = janusManager.session; // Use the singleton session
      if (!session) {
        throw new Error('Janus session is not available.');
      }
      this.handle = await session.attach(VIDEO_ROOM_PLUGIN);
      logger.info(`[${this.roomId}] ${this.participantId}에 대한 Janus 플러그인이 연결되었습니다.`);
      
      this._setupHandleListeners();
      return this.handle;

    } catch (error) {
      logger.error(`[${this.roomId}] ${this.participantId}에 대한 Janus 플러그인 연결 오류:`, error);
      throw error;
    }
  }

  _setupHandleListeners() {
    this.handle.on('webrtc-up', () => {
      logger.info(`[${this.roomId}] ${this.participantId}에 대한 WebRTC UP`);
      this.emit('webrtc-up');
    });

    this.handle.on('media', (data) => {
      // logger.debug(`[${this.roomId}] Media event for ${this.participantId}:`, data);
    });

    this.handle.on('slowlink', (data) => {
      logger.warn(`[${this.roomId}] ${this.participantId}에 대한 Slowlink 이벤트:`, data);
      this.emit('slowlink', data);
    });

    this.handle.on('hangup', () => {
      logger.info(`[${this.roomId}] ${this.participantId}에 대한 Hangup 이벤트`);
      this.emit('hangup');
    });

    this.handle.on('detached', () => {
      logger.info(`[${this.roomId}] ${this.participantId}에 대한 Janus 핸들이 분리되었습니다.`);
    });

    this.handle.on('message', async (msg) => {
      const { plugindata, jsep } = msg;
      const data = plugindata ? plugindata.data : null;

      if (jsep) {
        this.emit('jsep', jsep);
      }

      if (data) {
        const event = data.videoroom;
        if (event === 'joined') {
          this.feedId = data.id;
          logger.info(`[${this.roomId}] 참가자 ${this.display} (${this.participantId})가 feedId: ${this.feedId}로 Publisher로 참여했습니다.`);
          this.emit('joined', {
            feedId: this.feedId,
            publishers: data.publishers || [],
          });
        } else if (event === 'event') {
          if (data.publishers) {
            this.emit('publishers', data.publishers);
          }
          if (data.leaving) {
            this.emit('leaving', data.leaving);
          }
          if (data.unpublished) {
            this.emit('unpublished', data.unpublished);
          }
          if (data.error) {
            logger.error(`[${this.roomId}] ${this.participantId}에 대한 비디오룸 오류 메시지: ${data.error}`);
            this.emit('error', new Error(data.error));
          }
        }
      }
    });

    this.handle.on('candidate', (candidate) => {
      this.emit('candidate', candidate);
    });
  }

  async joinPublisher(jsep) {
    if (!this.handle) {
      await this.attachPlugin();
    }

    const joinRequest = {
      request: 'join',
      ptype: 'publisher',
      room: this.roomId,
      display: this.display,
      // The private_id is a way to associate the handle with our internal ID
      private_id: this.participantId,
    };

    logger.info(`[${this.roomId}] ${this.participantId}에 대한 참여 요청을 보냅니다.`);
    return this.handle.message(joinRequest, { jsep });
  }
  
  async publish(jsep) {
    if (!this.handle) {
      throw new Error('Cannot publish, handle not attached.');
    }
    
    const publishRequest = {
      request: 'publish',
      audio: true,
      video: true, // Assuming default is to publish both
    };
    
    logger.info(`[${this.roomId}] ${this.participantId}에 대한 publish 요청을 보냅니다.`);
    return this.handle.message(publishRequest, { jsep });
  }


  async trickleCandidate(candidate) {
    if (!this.handle) {
      // logger.warn(`[${this.roomId}] Handle not ready, queueing candidate for ${this.participantId}`);
      // You could implement a queue here if needed
      return;
    }
    await this.handle.trickle(candidate);
  }

  async leave() {
    if (this.handle) {
      logger.info(`[${this.roomId}] 참가자 ${this.participantId}가 룸을 떠나고 있습니다.`);
      await this.handle.message({ request: 'leave' });
      await this.handle.detach();
      this.handle = null;
    }
  }

  destroy() {
    this.removeAllListeners();
    if (this.handle) {
      this.handle.detach().catch(e => logger.error(`[${this.roomId}] ${this.participantId}의 핸들 분리 오류 (파괴 중):`, e));
      this.handle = null;
    }
    logger.debug(`VideoRoomHandler가 ${this.participantId}를 위해 파괴되었습니다.`);
  }
}

export { VideoRoomHandler };
