import 'dotenv/config';

export const janusConfig = {
  url: process.env.JANUS_URL || 'http://localhost:8088/janus',
  wsUrl: process.env.JANUS_WS_URL || 'ws://localhost:8188/janus',
  adminKey: process.env.JANUS_ADMIN_KEY,

  retry: {
    retries: 10,
    minTimeout: 1000,
    maxTimeout: 10000,
    factor: 2,
  },
  
  healthCheckInterval: 30000,
  connectionTimeout: 10000, // 10 seconds
};