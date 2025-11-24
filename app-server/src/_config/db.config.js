import mysql from 'mysql2/promise';
import logger from '../_utils/logger.js';

const dbConfig = {
  host: process.env.NODE_ENV === 'production' ? 'mysql_container' : process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

const connectWithRetry = async (retries = 5, interval = 5000) => {
  for (let i = 1; i <= retries; i++) {
    try {
      const connection = await pool.getConnection();
      logger.info('✅ 데이터베이스 연결 성공!');
      connection.release();
      return;
    } catch (error) {
      logger.error(`❌ 데이터베이스 연결 시도 ${i}회 실패: ${error.message}`);
      if (i === retries) {
        logger.error('❌ 모든 재시도 후에도 데이터베이스에 연결할 수 없습니다. 종료합니다.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, interval));
    }
  }
};

export { pool, connectWithRetry };