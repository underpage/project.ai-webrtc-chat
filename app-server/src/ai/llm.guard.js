// 프롬프트 인젝션 패턴
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)/i,
  /system\s*:/i,
  /you\s+are\s+now/i,
  /forget\s+(everything|instructions)/i,
  /dan\s+mode/i
];

/**
 * 사용자 입력 검증 (Input Guard)
 * @param {string} userPrompt 
 * @throws {Error} 유효하지 않은 입력 시 에러 발생
 */
export function validateInput(userPrompt) {
  if (!userPrompt || typeof userPrompt !== 'string') {
    const err = new Error("Invalid input format.");
    err.code = 'AI_POLICY_VIOLATION';
    throw err;
  }

  // 1. 길이 제한
  if (userPrompt.length > 1000) {
    const err = new Error("Query must be within 1000 characters.");
    err.code = 'AI_POLICY_VIOLATION';
    throw err;
  }

  // 2. 인젝션 패턴 검사
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(userPrompt)) {
      console.warn(`[Security] Injection attempt detected: ${userPrompt}`);
      const err = new Error("Input blocked due to security policy.");
      err.code = 'AI_POLICY_VIOLATION';
      throw err;
    }
  }
  
  return true;
}

/**
 * AI 출력 검증 및 마스킹 (Output Guard)
 * @param {string} llmResponse 
 * @returns {string} 마스킹된 응답 문자열
 */
export function sanitizeOutput(llmResponse) {
  if (!llmResponse) return "";

  let sanitized = llmResponse;

  // 1. 이메일 마스킹
  sanitized = sanitized.replace(
    /[\w\.-]+@[\w\.-]+\.\w+/g, 
    "[이메일]"
  );
  
  // 2. 전화번호 마스킹 (하이픈 유연하게 처리)
  sanitized = sanitized.replace(
    /01[0-9]-?\d{3,4}-?\d{4}/g,
    "[전화번호]"
  );
  
  // 3. 주민번호 등 추가 패턴 확장 가능

  return sanitized;
}
