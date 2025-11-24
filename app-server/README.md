# APP Server

클라이언트와 Janus Gateway 사이를 중계하고 비즈니스 로직을 수행하는 메인 서버입니다.


**주요 기능 (To-Be)**
- Common
  - [ ] 공통 오류 처리
  - [ ] 요청 검증 미들웨어 (Joi)
  - [ ] 인증 미들웨어 (Session)
- Auth
  - [ ] 로그인/로그아웃
  - [ ] 세션 확인
  - [ ] 회원 가입
- Room
  - [ ] 회의 룸 생성 (UUID 발급 및 Janus Room 생성 요청)
  - [ ] 회의 룸 종료 (DB 상태 업데이트 및 Janus Room 제거 요청)
  - [ ] 회의 룸 입장 (비밀번호 검증 및 Join Token 발급)
  - [ ] 회의 룸 퇴장 (메모리 내 사용자 세션 정리)
  - [ ] 회의 참여자 목록 조회
  - [ ] 회의 참여자 강제 퇴장 (호스트 전용)
  - [ ] 전체 회의 룸 목록 조회
  - [ ] 회의 검색 (회의 제목, 회의 목적 기반)
- Signaling
  - [ ] WebRTC 연결 관리 (joinToken 검증)
  - [ ] SDP (Offer/Answer) 교환 중계
  - [ ] ICE 후보 교환 중계
- Janus Integration
  - [ ] VideoRoom Plugin 세션 생성 및 Attach
  - [ ] Janus Event 핸들링 (joined, leaving, unpublished 브로드캐스팅)
  - [ ] Publisher 등록 (카메라/마이크/화면공유)
  - [ ] Subscriber 활성화 (원격 스트림 수신 및 라우팅)
  - [ ] 미디어 제어 (음소거, 비디오)
  - [ ] 비디오 품질 조절
- Chat
  - [ ] 실시간 텍스트 메시지 중계 (WebSocket)
- AI Integration
  - [ ] 질의 요청 및 응답 스트리밍 (WebSocket)
  - [ ] 대화 맥락 인메모리 관리



## 정책 및 권한

**참여자 조건**
- 비회원: 룸 ID, 룸 비밀번호, 사용자 정보 (이름, 부서, 회사명)
- 회원: 룸 ID, 로그인 정보

**호스트 조건**
- 로그인 정보
- 룸 생성 여부

**호스트 권한**
- 룸 설정 및 생성
- 회의 종료
- 참가자 제어 (음소거/추방/모니터링)
- 회의록 기능 활성화
- 회의록 저장

**룸 생성 속성**
- 회의 제목
- 회의 목적
- 최대 참여 인원
- 룸 비밀번호: 비회원 참여 여부를 결정함

**룸 제거 정책**
- 호스트가 회의를 종료하는 경우 (호스트가 이탈해도 룸은 유지됨)
- 모든 사용자가 룸을 나간 경우

**재접속 조건**
- 룸 ID
- 조인 토큰: 사용자별 생성

**AI 채팅 조건**
- 로그인 정보: 비회원 사용 불가
- 룸 ID
- 조인 토큰

**AI 질의 트랜잭션**
- 조인 토큰
- 챗 ID: 질문 하나당 생성되는 식별자



## 핵심 프로세스

**룸 생성 프로세스**
1. 로그인한 사용자가 룸 생성 요청
  - 비회원 사용자 참여 허용시 룸 비밀번호 생성 필요
2. 서버에서 고유한 룸 ID(UUID)를 생성
3. 룸 ID 정보를 담아 Janus VideoRoom API를 호출해 VideoRoom 생성
4. VideoRoom이 생성되면 DB에 룸 정보 저장 (사용자를 호스트로 지정)
  - DB 저장이 실패하면 재시도하고 안되면 VideoRoom을 제거
5. 클라이언트에 룸 ID 반환

```js
const { room } = await videoRoomHandle.create({
  room: 'uuid',
  description: '룸 이름',
  publishers: 6,
  is_private: false,
  secret: process.env.JANUS_ROOM_KEY,

  videoorient_ext: true, // 모바일 회전 대응
  audiolevel_ext: true,  // 누가 말하는지 감지 (UI 표시용)
  audiolevel_event: true // 말할 때 이벤트 수신
});
```


**회의 참여 프로세스**
1. 비회원 룸 ID와 룸 비밀번호를 보유해야 함
2. 회원은 룸 ID를 보유해야 함
3. 참여자는 회의 검색 또는 URL을 통해 룸 입장 요청
  - 비회원 참여자는 비밀번호, 이름, 부서, 회사명을 입력해야 함
4. 서버는 비회원의 룸 비밀번호와 회원의 로그인 정보를 검증
5. 검증을 통과하면 재접속 식별을 위한 토큰(joinToken)을 생성 >> RDB
6. 서버가 Janus와 세션을 맺고 VideoRoom과 핸들을 연결하고 입장 요청을 보냄
7. Janus가 Feed ID를 할당하고 이를 담은 joined 이벤트를 서버로 반환
8. 서버는 수신한 Feed ID와 사용자 정보를 매핑해 서버 메모리에 저장 >> Redis(로드맵)
9. 클라이언트에 사용자의 joinToken과 feedId 정보와 회의 참여자 정보를 보냄

```js
const activeRooms = new Map();

activeRooms.set(roomId, [
  {
    "feedId": 1111,
    "joinToken": "token",
    "socketId": "WebSocket 연결 식별자",
    "userInfo": {},
    "lastSeenAt": timestamp,
  },
]);
```


**AI 채팅 프로세스**
1. 회원이 AI 채팅창에 질문을 입력 및 전송
2. 서버에서 룸 활성화 상태와 joinToken이 유효한지 검증
3. 유효하면 챗 ID(UUID)를 생성하고 답변을 추적하기 위한 상태 객체(streamingStatus) 생성
4. joinToken을 통해 대화 맥락을 저장하는 객체(chatContext)를 조회하고 없으면 새로 생성
5. 생성한 chatId를 클라이언트에 반환 (UI에 답변 대기중 생성)
6. chatContext에 이전 대화가 존재하면 N개를 잘라서 질문과 함께 AI Module에 전송
7. AI Module에서 답변 청크를 생성해 서버로 전달하면
  - 서버에서는 streamingStatus에 답변 청크를 누적하고
  - 클라이언트에는 답변 청크를 즉시 전송
8. 스트림이 끝나면 chatContext에 질문과 답변을 저장하고 streamingStatus 객체 삭제
  - AI 응답이 30초 이상 걸리면 에러를 반환하고 상태 객체 제거

```js
// 답변 관리 용도 (답변이 완료되면 삭제)
const streamingStatus = new Map<chatId, {
  chatId: '질문 식별',
  joinToken: '사용자 식별',
  prompt: '사용자 질문',
  tempResponse: '답변 누적',
  status: 'pending | streaming | done | error',
  error: null,
  startTime: timestamp,
}>;

// 대화 맥락 관리 용도 (회의가 종료되면 삭제)
// [ {질문}, {답변}, {질문}, {답변} ... ]
const chatContext = new Map<joinToken, Array<{
  role: 'user' | 'assistant',
  content: string,
  timestamp: timestamp,
}>>;

// 대화 요약 관리 용도 (로드맵)
// 대화가 길어질 경우 중요한 맥락을 저장하며 질문시 함께 전달됨
const chatSummary = new Map<joinToken, {
  summary: '중요한 맥락 저장',
  lastSummaryId: '이전 chatId를 저장해 중복 방지',
  updatedAt: timestamp,
}>;
```


**회의 종료 프로세스**
1. 정상 종료: 회의가 종료된 경우 Janus 핸들을 분리하고 퇴장 시간을 기록 >> RDB
2. 비정상 정료: 소켓 연결이 끊어지면 Janus 핸들을 분리하고 퇴장 시간을 기록 >> RDB 
3. 사용자 세션이 종료되면 streamingStatus와 chatContext 객체를 메모리에서 삭제



### AI 가드레일
```
            [입력 검증]             [출력 검증]
사용자 입력 → APP Server → Ollama → APP Server → 사용자
```

**입력 검증**
- 프롬프트 인젝션 방지: 해킹 키워드 필터링
- 금지어 필터링: 욕설, 혐오 표현 등 거부
- 길이 제한: 최대 1000자로 제한
- Rate limiting: 사용자당 분당 요청 횟수 제한

**출력 검증**
- PII 마스킹: 이메일, 전화번호, 주민번호 등 개인 정보 마스킹 처리
- 민감 키워드 필터링: 회사 기밀 정보, 보안 등 검사
- 응답 길이 제한: 답변이 비정상적으로 길어질 경우 답변 제공 중단
- 환각 방지를 위한 신뢰도 점수를 체크해 기준 미달시 답변 미제공



## 프로젝트 환경

**기술 스택**

범주 | 기술 | 버전 
---|---
Runtime | Node | 22.x
Framework | Express | 4.x
Media Controller | Janode | -
Database | MySQL | 8.0


**프로젝트 생성**
```bash
# 프로젝트 초기화
npm init -y

# 라이브러리 설치
npm install -D nodemon pino-pretty
npm install express express-session express-rate-limit cors cookie-parser ws fs-extra janode dotenv bcrypt uuid joi pino mysql2

# 개발 서버 실행
npm run dev
```


### Janode
: Janus WebSocket API를 쉽게 호출하기 위한 라이브러리

- Janus 세션 관리
- ICE Candidate 처리
- WebRTC Offer/Answer 중계
- Publisher/Subscriber 등록
- Janus 이벤트 수신
- VideoRoom 플러그인 제어



### 프로젝트 구성

**프로젝트 구조**
```bash
backend/
├── public/               # UI 빌드 결과
├── scripts/              # UI 빌드 복사 스크립트
├── src/
│   ├── _config/          # 전역: 설정
│   ├── _utils/           # 전역: 유틸리티
│   ├── _middleware/      # 전역: 미들웨어
│   ├── _schemas/         # 전역: 검증 스키마
│   ├── routes/           # MVC: 라우터
│   ├── services/         # MVC: 비즈니스 로직
│   ├── signaling/        # 도메인: WebSocket 핸들링
│   ├── janus/            # 도메인: Janus 로직
│   ├── ai/               # 도메인: AI 로직
│   └── server.js         # 진입점
├── package.json
└── README.md
```


**빌드 설정**
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "build:ui": "cd ../app-ui && npm run build",
    "copy:ui": "node scripts/deploy-ui.js",
    "deploy": "npm run build:ui && npm run copy:ui && npm start",
    "deploy:dev": "npm run build:ui && npm run copy:ui && npm run dev"
  }
}
```


**프로젝트 실행**
```bash
# 의존성 설치
npm install

# 개발 모드 실행
## UI 확인이 필요한 경우 별도 터미널에서 app-ui를 실행해야 함
npm run dev


# 개발 배포: UI 소스 수정 시 재빌드 필요 (HMR 안됨)
npm run deploy:dev

# 프로덕션 배포
npm run deploy
```