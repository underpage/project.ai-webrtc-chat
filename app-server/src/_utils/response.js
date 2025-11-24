// sendResponse 는 왜 없어?

const errorMap = {
  // Common
  INVALID_REQUEST: { statusCode: 400, message: '잘못된 요청 파라미터입니다.' },
  INTERNAL_SERVER_ERROR: { statusCode: 500, message: '서버 내부 오류가 발생했습니다.' },
  // Auth
  UNAUTHORIZED: { statusCode: 401, message: '인증에 실패했거나 토큰이 유효하지 않습니다.' },
  FORBIDDEN: { statusCode: 403, message: '이 작업을 수행할 권한이 없습니다.' },
  // Room
  ROOM_NOT_FOUND: { statusCode: 404, message: '요청한 회의실을 찾을 수 없습니다.' },
  ROOM_FULL: { statusCode: 409, message: '회의실 정원이 꽉 찼습니다.' },
  ROOM_CLOSED: { statusCode: 410, message: '회의실이 종료되었습니다.' }, // Added based on API.md
  INVALID_PASSWORD: { statusCode: 401, message: '회의실 비밀번호가 올바르지 않습니다.' }, // Added based on API.md
  // Janus
  JANUS_CONNECTION_ERROR: { statusCode: 502, message: '미디어 서버 연결에 실패했습니다.' },
  MEDIA_NEGOTIATION_FAILED: { statusCode: 500, message: '미디어 협상에 실패했습니다.' }, // Added based on API.md
  // AI
  AI_SERVICE_UNAVAILABLE: { statusCode: 503, message: 'AI 서비스에 연결할 수 없습니다.' }, // Added based on API.md
  AI_POLICY_VIOLATION: { statusCode: 400, message: 'AI 정책 위반입니다 (부적절한 내용).' }, // Added based on API.md
};


/**
 * Sends a standardized success response.
 * @param {object} res - Express response object.
 * @param {object} data - The payload to send.
 * @param {string} [message='OK'] - A success message.
 * @param {number} [statusCode=200] - HTTP status code.
 */
export const sendSuccess = (res, data, message = 'OK', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};


/**
 * Sends a standardized error response.
 * @param {object} res - Express response object.
 * @param {string} errorCode - The error code from the errorMap.
 * @param {string} [details] - Optional additional error details.
 */
export const sendError = (res, errorCode, details) => {
  const errorInfo = errorMap[errorCode] || errorMap.INTERNAL_SERVER_ERROR;
  
  res.status(errorInfo.statusCode).json({
    success: false,
    message: 'ERROR',
    error: {
      code: errorCode,
      message: details || errorInfo.message,
    },
  });
};
