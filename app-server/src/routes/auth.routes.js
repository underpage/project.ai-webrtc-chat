import express from 'express';
import validate from '../_middleware/validate.middleware.js';
import { authSchema } from '../_schemas/auth.schema.js';
import { sendSuccess, sendError } from '../_utils/response.js';
import logger from '../_utils/logger.js';
import crypto from 'crypto';
import { protect } from '../_middleware/auth.middleware.js';
import { MOCK_USERS, findUserById, addUser, removeAccessToken } from '../_utils/mock.users.js';

const router = express.Router();


router.get('/test', (req, res) => {
  sendSuccess(res, {
    timestamp: new Date().toISOString(),
    endpoint: '/api/auth/test'
  }, '인증 API가 작동 중입니다!');
});


router.post('/login', validate(authSchema.login), async (req, res) => {
  try {
    const { userId, password } = req.validatedData;

    const user = findUserById(userId); 

    if (!user || user.password !== password) { 
      return sendError(res, 'UNAUTHORIZED', '유효하지 않은 사용자 ID 또는 비밀번호입니다.');
    }

    const accessToken = `mock-token-${crypto.randomBytes(16).toString('hex')}`;
    
    user.accessToken = accessToken;

    sendSuccess(res, { accessToken, user }, '로그인 성공.');
  } catch (error) {
    logger.error('로그인 중 오류 발생:', error);
    sendError(res, 'INTERNAL_SERVER_ERROR');
  }
});


router.post('/signup', validate(authSchema.signup), async (req, res) => {
  try {
    const { userId, password, name, email, department, company } = req.validatedData;

    if (findUserById(userId) || MOCK_USERS.some(u => u.email === email)) {
      return sendError(res, 'INVALID_REQUEST', '이미 존재하는 사용자 ID 또는 이메일입니다.');
    }

    const newUser = {
      uid: MOCK_USERS.length + 1,
      userId,
      password, 
      name,
      email,
      department: department || null,
      company: company || null,
      accessToken: null,
    };
    addUser(newUser);
    logger.info(`새 모의 사용자 등록: ${userId}`);

    sendSuccess(res, { userId }, '회원가입 성공. 로그인해 주세요.');
  } catch (error) {
    logger.error('회원가입 중 오류 발생:', error);
    sendError(res, 'INTERNAL_SERVER_ERROR');
  }
});


router.get('/me', protect, (req, res) => {
  if (req.user) {
    const { password, accessToken, ...userProfile } = req.user;
    sendSuccess(res, userProfile, '사용자 정보를 성공적으로 가져왔습니다.');
  } else {
    sendError(res, 'UNAUTHORIZED', '인증된 사용자를 찾을 수 없습니다.');
  }
});


router.post('/logout', protect, (req, res) => {
  if (req.user && removeAccessToken(req.user.userId)) {
    sendSuccess(res, null, '로그아웃되었습니다.');
  } else {
    sendError(res, 'INTERNAL_SERVER_ERROR', '로그아웃에 실패했습니다.');
  }
});

export default router;