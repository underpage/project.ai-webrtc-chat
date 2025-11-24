import path from 'path';
import http from 'http'; 
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws'; 
import express from 'express';
import { janusManager } from './janus/janus.client.js'; 
import { setupSignalingHandler } from './signaling/handler.js'; 
import logger from './_utils/logger.js';
import { connectWithRetry } from './_config/db.config.js';

import authRouter from './routes/auth.routes.js';
import roomRouter from './routes/room.routes.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 라우팅
app.use('/api/auth', authRouter);
app.use('/api/room', roomRouter);

// 정적 파일 서빙
const publicPath = path.join(__dirname, '../../app-ui/dist'); 
app.use(express.static(publicPath));

// 멀티페이지 라우팅
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});



app.get('/login', (req, res) => {
    res.sendFile(path.join(publicPath, 'login.html'));
});

app.get('/signup', (req, res) => {
    res.sendFile(path.join(publicPath, 'signup.html'));
});

app.get('/room', (req, res) => {
    res.sendFile(path.join(publicPath, 'room.html'));
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(publicPath, '404.html'));
});

app.use((err, req, res, next) => {
  logger.error(err, '오류 발생: %s (요청 URL: %s)', err.message || '알 수 없는 오류', req.originalUrl);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || '알 수 없는 오류'
  });
});


// --- 글로벌 예외 처리 ---
process.on('uncaughtException', (err) => {
  logger.error('⚠️ [CRITICAL] 처리되지 않은 예외 발생:', err);
  process.exit(1); // 즉시 종료
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('⚠️ [CRITICAL] 처리되지 않은 Promise Rejection 발생:', reason, promise);
  process.exit(1); // 즉시 종료
});


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

server.listen(PORT, async () => { 
  logger.info(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);

  try {
    // DB 연결
    await connectWithRetry();

    // Janus 연결 초기화
    await janusManager.connect();
    
    // WebSocket 설정
    setupSignalingHandler(wss);
    
  } catch (error) {
    logger.error('서버 초기화 실패:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('서버 종료 중...');
  await janusManager.disconnect();
  server.close(() => {
    logger.info('서버 종료 완료');
    process.exit(0);
  });
});