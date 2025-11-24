import EventEmitter from 'events';
import Janode from 'janode';
import { janusConfig } from '../_config/janus.config.js';
import logger from '../_utils/logger.js';

/**
 * @class JanusConnectionManager
 * @description
 * Janus Gateway와의 연결을 관리하고, 비디오룸 생성/삭제 및 연결 상태를 제어하는 클래스입니다.
 * 재연결 로직과 헬스 체크 기능을 포함합니다.
 */
class JanusConnectionManager extends EventEmitter {
  /**
   * JanusConnectionManager 클래스의 생성자입니다.
   * 연결 및 세션 상태, 타이머를 초기화합니다.
   */
  constructor() {
    super();
    /** @type {Janode.Connection|null} Janus Gateway와의 연결 인스턴스 */
    this.connection = null;
    /** @type {Janode.Session|null} Janus 세션 인스턴스 */
    this.session = null;
    /** @type {boolean} Janus에 연결되어 있는지 여부 */
    this.isConnected = false;
    /** @type {NodeJS.Timeout|null} 재연결 타이머 ID */
    this.reconnectTimer = null;
    /** @type {NodeJS.Timeout|null} 헬스 체크 타이머 ID */
    this.healthCheckTimer = null;
    /** @type {Promise<void>|null} 현재 진행 중인 재연결 Promise */
    this._reconnectPromise = null;
  }

  /**
   * Janus Gateway에 초기 연결을 설정하고 세션을 생성합니다.
   * 연결 실패 시 오류를 로깅하고 예외를 발생시킵니다.
   * @returns {Promise<Janode.Session>} 생성된 Janus 세션 인스턴스
   * @throws {Error} Janus Gateway 연결 실패 시
   */
  async connect() {
    try {
      logger.debug(`[Janus] Connecting to ${janusConfig.wsUrl} with adminKey: ${janusConfig.adminKey ? '****' : 'undefined'}`);
      this.connection = await Janode.connect({
        address: {
          url: janusConfig.wsUrl,      // Janus WebSocket URL
          apisecret: janusConfig.adminKey, // Janus Admin API 시크릿 키
        },
        ...janusConfig.retry, // 재연결 관련 설정 (옵션)
      });

      this.session = await this.connection.create(); // 새 Janus 세션 생성
      this.isConnected = true; // 연결 상태를 true로 설정
      this.emit('connected'); // Emit 'connected' event

      this._setupEventListeners(); // 연결 이벤트 리스너 설정
      this._startHealthCheck();   // 헬스 체크 시작

      logger.info('✅ Janus Gateway에 성공적으로 연결되었습니다.');
      return this.session;

    } catch (error) {
      logger.error('❌ Janus Gateway 연결에 실패했습니다:', error);
      throw error; // 오류 재발생
    }
  }

  /**
   * Janus가 연결될 때까지 기다립니다. 연결되어 있으면 즉시 해결됩니다.
   * 재연결 중인 경우 재연결이 완료될 때까지 기다립니다.
   */
  async waitUntilConnected() {
    if (this.isConnected && this.session) {
      return;
    }
    
    // 재연결이 진행 중인 경우, 해당 Promise를 기다립니다.
    if (this._reconnectPromise) {
      await this._reconnectPromise;
      if (this.isConnected && this.session) return; // 재연결 성공 시
    }

    // 연결되어 있지 않으면 연결될 때까지 기다립니다. (타임아웃 포함)
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off('connected', onConnected);
        reject(new Error('Janus 연결 대기 시간 초과'));
      }, janusConfig.connectionTimeout);

      const onConnected = () => {
        clearTimeout(timeoutId);
        resolve();
      };
      
      this.once('connected', onConnected);
    });
  }

  /**
   * Janus에 새로운 비디오룸을 생성합니다.
   * @param {object} options - 비디오룸 생성에 필요한 옵션 (예: room ID, description, publishers 등)
   * @returns {Promise<number>} 생성된 비디오룸의 ID
   * @throws {Error} Janus에 연결되지 않았거나 룸 생성 실패 시
   */
  async createRoom(options) {
    await this.waitUntilConnected(); // Janus가 연결될 때까지 기다립니다.

    if (!this.isConnected || !this.session) {
      // waitUntilConnected 호출 후에도 연결되지 않았다면 오류를 발생시킵니다.
      throw new Error('Janus에 연결되어 있지 않습니다. 룸을 생성할 수 없습니다.');
    }

    try {
      const handle = await this.session.attach('janus.plugin.videoroom'); // 비디오룸 플러그인에 핸들 연결
      const response = await handle.message({
        request: 'create', // 룸 생성 요청
        ...options,        // 사용자 정의 옵션
        string_ids: true,  // 룸 ID를 문자열로 사용
        admin_key: janusConfig.adminKey, // 관리자 키
      });

      const room = response.get('plugindata').get('data').room; // 응답에서 룸 ID 추출
      logger.info(`✅ Janus 비디오룸 생성: ${room}`);
      await handle.detach(); // 핸들 분리
      return room;
    } catch (error) {
      logger.error('❌ Janus 비디오룸 생성에 실패했습니다:', error);
      throw error; // 오류 재발생
    }
  }

  /**
   * Janus에서 지정된 비디오룸을 제거합니다.
   * @param {string} roomId - 제거할 비디오룸의 ID
   * @throws {Error} Janus에 연결되지 않았을 경우
   */
  async destroyRoom(roomId) {
    await this.waitUntilConnected(); // Janus가 연결될 때까지 기다립니다.

    if (!this.isConnected || !this.session) {
      throw new Error('Janus에 연결되어 있지 않습니다. 룸을 제거할 수 없습니다.');
    }
    
    try {
      const handle = await this.session.attach('janus.plugin.videoroom'); // 비디오룸 플러그인에 핸들 연결
      await handle.message({
        request: 'destroy', // 룸 제거 요청
        room: roomId,       // 제거할 룸 ID
        admin_key: janusConfig.adminKey, // 관리자 키
      });
      logger.info(`✅ Janus 비디오룸 제거: ${roomId}`);
      await handle.detach(); // 핸들 분리
    } catch (error) {
      // 룸이 이미 없는 경우 등은 치명적인 에러로 처리하지 않습니다.
      logger.warn(`⚠️ Janus 비디오룸 ${roomId} 제거 실패: ${error.message}`);
    }
  }

  /**
   * Janus에서 특정 비디오룸의 상세 정보를 가져옵니다.
   * @param {string|number} roomId - 정보를 가져올 비디오룸의 ID.
   * @returns {Promise<object|null>} 비디오룸 정보 객체 또는 찾을 수 없는 경우 null.
   * @throws {Error} Janus에 연결되지 않았거나 룸 정보 조회 실패 시
   */
  async getRoomDetails(roomId) {
    await this.waitUntilConnected();

    if (!this.isConnected || !this.session) {
      throw new Error('Janus에 연결되어 있지 않습니다. 룸 정보를 조회할 수 없습니다.');
    }

    let handle = null;
    try {
      handle = await this.session.attach('janus.plugin.videoroom');
      const response = await handle.message({
        request: 'list',
        room: roomId, // Request details for a specific room
        admin_key: janusConfig.adminKey,
      });

      const list = response.get('plugindata').get('data').list;
      if (list && list.length > 0) {
        // Find the specific room, Janode's list might return an array even for 'room' filter
        const roomDetails = list.find(r => r.room.toString() === roomId.toString());
        return roomDetails || null;
      }
      return null;
    } catch (error) {
      logger.error(`❌ Janus 룸 ${roomId} 정보 조회 실패: ${error.message}`);
      throw error;
    } finally {
      if (handle) {
        await handle.detach().catch(e => logger.warn(`Janus 핸들 분리 실패 (getRoomDetails): ${e.message}`));
      }
    }
  }




  /**
   * Janus 연결에 대한 이벤트 리스너를 설정합니다.
   * 연결 종료 및 오류 이벤트를 처리합니다.
   */
  _setupEventListeners() {
    // 연결 종료 시 재연결 로직을 시작합니다.
    this.connection.once('close', (reason) => {
      logger.warn(`Janus 연결이 종료되었습니다. 이유: ${reason || '알 수 없음'}`);
      this.isConnected = false; // 연결 상태 업데이트
      this._stopHealthCheck(); // 헬스 체크 중지
      this._scheduleReconnect(); // 재연결 스케줄링
    });

    // 연결 오류 발생 시 로그를 기록합니다.
    this.connection.once('error', (error) => {
      logger.error('Janus 연결 오류 발생:', error);
      this.isConnected = false; // 연결 상태 업데이트
    });
  }

  /**
   * Janus Gateway와의 연결 상태를 주기적으로 확인하는 헬스 체크를 시작합니다.
   * `janusConfig.healthCheckInterval`에 정의된 간격마다 실행됩니다.
   */
  _startHealthCheck() {
    this.healthCheckTimer = setInterval(async () => {
      if (!this.session) return; // 세션이 없으면 헬스 체크를 건너김

      try {
        await this.session.getInfo(); // 세션 정보 요청으로 연결 상태 확인
        logger.debug('Janus 헬스 체크 OK');
      } catch (error) {
        logger.error('Janus 헬스 체크 실패. 재연결을 시도합니다.');
        this._stopHealthCheck(); // 헬스 체크 중지
        await this._reconnect(); // 재연결 시도
      }
    }, janusConfig.healthCheckInterval);
  }

  /**
   * 헬스 체크 타이머를 중지합니다.
   */
  _stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }

  /**
   * Janus Gateway에 대한 재연결을 스케줄링합니다.
   * 5초 후에 재연결을 시도합니다.
   */
  _scheduleReconnect() {
    if (this.reconnectTimer) return; // 이미 재연결이 스케줄링되어 있으면 건너김

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null; // 타이머 초기화
      this._reconnectPromise = this._reconnect(); // Set the promise
      await this._reconnectPromise;
      this._reconnectPromise = null; // Clear the promise after completion
    }, 5000); // 5초 후 재연결
  }

  /**
   * 재연결 실행
   */
  async _reconnect() {
    try {
      logger.info('Janus에 재연결을 시도합니다...');
      
      // 기존 세션 및 연결을 안전하게 종료합니다.
      if (this.session) {
        await this.session.destroy().catch(() => {});
      }
      if (this.connection) {
        await this.connection.close().catch(() => {});
      }

      await this.connect(); // 새로운 연결 시도
      this.emit('reconnected'); // Emit 'reconnected' event after successful reconnection

    } catch (error) {
      logger.error('Janus 재연결 실패:', error);
      this._scheduleReconnect(); // 재연결 실패 시 다시 스케줄링
      throw error; // Propagate error
    }
  }

  /**
   * Janus 재연결 성공을 애플리케이션에 알립니다.
   * (예: WebSocket 등으로 전달)
   */
  _notifyReconnect() {
    this.emit('reconnected'); // Node.js 이벤트 이미터를 통해 알림
  }

  /**
   * 연결 상태 확인
   * @returns {{isConnected: boolean, session: string}} 연결 상태 객체
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      session: this.session ? 'active' : 'inactive'
    };
  }

  /**
   * Janus Gateway와의 연결을 안전하게 종료합니다.
   * 헬스 체크 및 재연결 타이머를 중지하고 모든 연결을 닫습니다.
   */
  async disconnect() {
    this._stopHealthCheck(); // 헬스 체크 중지
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer); // 재연결 타이머 중지
    }

    if (this.session) {
      await this.session.destroy().catch(() => {}); // 세션 종료
    }
    if (this.connection) {
      await this.connection.close().catch(() => {}); // 연결 종료
    }

    this.isConnected = false; // 연결 상태 업데이트
    logger.info('Janus 연결이 종료되었습니다.');
  }
}

// JanusConnectionManager의 싱글톤 인스턴스를 내보냅니다.
export const janusManager = new JanusConnectionManager();
