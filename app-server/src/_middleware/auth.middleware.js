import logger from '../_utils/logger.js';
import { sendError } from '../_utils/response.js';
import { findUserByAccessToken } from '../_utils/mock.users.js';

export const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('Authorization 헤더에 토큰이 제공되지 않았습니다.');
    return sendError(res, 'UNAUTHORIZED', '인증 토큰이 필요합니다.');
  }

  const user = findUserByAccessToken(token);

  if (!user) {
    logger.warn(`유효하지 않거나 만료된 토큰 수신: ${token}`);
    return sendError(res, 'UNAUTHORIZED', '유효하지 않거나 만료된 토큰입니다.');
  }
  
  req.user = user;
  
  logger.debug(`사용자 인증됨: ${req.user.userId}`);
  next();
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 'FORBIDDEN', '이 작업을 수행할 권한이 없습니다.');
    }
    next();
  };
};
