import pino from 'pino';

// 현재 환경이 'production'인지 확인합니다.
const isProduction = process.env.NODE_ENV === 'production';

/**
 * @typedef {object} Logger
 * @property {function(...any): void} info - 일반 정보 로그를 출력합니다.
 * @property {function(...any): void} debug - 디버깅 관련 로그를 출력합니다.
 * @property {function(...any): void} warn - 경고 메시지 로그를 출력합니다.
 * @property {function(...any): void} error - 에러 메시지 로그를 출력합니다.
 */

/**
 * @type {Logger}
 * 애플리케이션 전반에 걸쳐 사용되는 중앙 집중식 로거 인스턴스입니다.
 * 개발 환경에서는 `pino-pretty`를 사용하여 로그를 보기 좋게 출력하며,
 * 프로덕션 환경에서는 표준 JSON 형식을 사용합니다.
 */
const logger = pino({
  // 로그 레벨을 설정합니다. 프로덕션에서는 'info', 개발에서는 'debug'를 사용합니다.
  level: isProduction ? 'info' : 'debug',
  // 프로덕션 환경이 아닌 경우(개발 환경) `pino-pretty` 트랜스포트를 사용하여 로그를 예쁘게 포맷합니다.
  transport: isProduction ? undefined : {
    target: 'pino-pretty', // 'pino-pretty'를 사용하여 로그를 콘솔에 보기 좋게 출력합니다.
    options: {
      colorize: true,          // 로그 레벨에 따라 색상을 적용합니다.
      translateTime: 'SYS:standard', // 타임스탬프를 읽기 쉬운 형식으로 변환합니다.
      ignore: 'pid,hostname',  // 출력에서 프로세스 ID와 호스트 이름을 무시하여 간결하게 만듭니다.
    },
  },
});

// 설정된 로거 인스턴스를 기본 내보내기(default export)합니다.
export default logger;
