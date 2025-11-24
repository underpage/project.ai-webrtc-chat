const getTimestamp = () => new Date().toLocaleTimeString();

const logger = {
  info: (...args) => console.log(`[${getTimestamp()}] INFO:`, ...args),

  warn: (...args) => console.warn(`[${getTimestamp()}] WARN:`, ...args),

  error: (...args) => console.error(`[${getTimestamp()}] ERROR:`, ...args),

  debug: (...args) => {
    console.log(`[${getTimestamp()}] DEBUG:`, ...args);
  },
};

export default logger;