import logger from '../utils/logger.js';

const RECONNECT_INTERVAL_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 5;

class SocketClientImpl {
    constructor() {
        this.url = null;
        this.ws = null;
        this.isConnected = false;
        this.isInitialized = false;
        this.messageQueue = [];
        this.eventListeners = new Map();
        this.reconnectAttempts = 0;
        this.reconnectTimeout = null;
    }

    initialize(joinToken) {
        if (this.isInitialized) {
            logger.warn('SocketClient is already initialized.');
            return;
        }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = window.location.hostname;
        const port = window.location.port;
        this.url = `${protocol}//${hostname}:${port}/ws?token=${joinToken}`;
        this.isInitialized = true;
        logger.info('SocketClient initialized.');
    }

    connect() {
        if (!this.isInitialized) {
            return Promise.reject(new Error('SocketClient must be initialized with a joinToken before connecting.'));
        }
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            logger.info(`Connecting to WebSocket: ${this.url}`);
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => {
                logger.info('WebSocket connected.');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
                this.reconnectTimeout = null;
                this._flushMessageQueue();
                this.emit('open');
                resolve();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.emit(message.type, message.data);
                } catch (error) {
                    logger.error('Failed to parse WebSocket message:', error, event.data);
                }
            };

            this.ws.onclose = (event) => {
                logger.warn('WebSocket disconnected:', event.code, event.reason);
                this.isConnected = false;
                this.emit('close', event);
                if (event.code === 4001 || event.code === 4002) {
                    logger.error('Connection closed due to invalid token. Will not reconnect.');
                    this.emit('reconnect-failed');
                } else {
                    this._scheduleReconnect();
                }
                reject(new Error(`WebSocket disconnected with code: ${event.code}`));
            };

            this.ws.onerror = (error) => {
                logger.error('WebSocket error:', error);
                this.isConnected = false;
                this.emit('error', error);
            };
        });
    }

    _scheduleReconnect() {
        if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS || this.reconnectTimeout) return;
        
        this.reconnectAttempts++;
        logger.info(`Attempting to reconnect... (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect().catch(() => {});
        }, RECONNECT_INTERVAL_MS * Math.pow(2, this.reconnectAttempts - 1));
    }

    _flushMessageQueue() {
        while (this.messageQueue.length > 0) {
            this.send(this.messageQueue.shift());
        }
    }

    send(message) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            this.messageQueue.push(message);
        }
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            const listeners = this.eventListeners.get(event);
            const index = listeners.indexOf(callback);
            if (index > -1) listeners.splice(index, 1);
        }
    }

    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(cb => cb(data));
        }
    }

    close() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
        this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
        if (this.ws) this.ws.close();
        this.isInitialized = false;
    }
}

let instance = null;

export function getSocketClient() {
  if (!instance) {
    instance = new SocketClientImpl();
  }
  return instance;
}