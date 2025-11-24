# GEMINI Context Prompt

이 파일은 Gemini가 프로젝트의 전체 맥락을 파악하고 코드를 생성하기 위한 **지침서(Blueprint)**입니다.
루트의 `README.md`를 기본으로 참고하되, 아래 지침을 최우선으로 따르십시오.

코드 생성 전 반드시 다음 순서로 파일을 읽으십시오:

1. Global Context (전체 이해)
- `./README.md` - 프로젝트 개요
2. Target-Specific Context
- `./app-server/README.md` - Backend  가이드
- `./app-ui/README.md` - Frontend 가이드
3. Infrastructure
- `./database/README.md`
- `./gateway/README.md` - Janus Gateway 가이드
- `./llm/README.md`


## 1. Project Overview

- **Refer to:** `./README.md` (전체 프로젝트 개요 및 아키텍처 흐름)
- **Goal:** WebRTC 화상 회의 플랫폼 프로토타입 개발
- **Core Strategy:**
  - **Media:** Janus Gateway (SFU) - VideoRoom Plugin 사용
  - **Signaling:** Node.js (Proxy) - WebSocket & Janode Library 사용
  - **AI:** Ollama (Llama 3.1) - Streaming Chat 구현



## 2. Scope of Work (Target)

코드를 생성하거나 수정해야 할 대상은 오직 아래 두 프로젝트입니다.
나머지(Gateway, DB, LLM)는 실행 환경(Infrastructure)으로서 참조만 하십시오.

**[주의]**: 이미 폴더와 일부 파일이 존재하는 경우
  - 비어있거나 템플릿 수준: 코드 덮어쓰기 허용
  - 구현된 코드가 있는 경우: 기존 코드를 분석하고 수정/확장


### Target 1: APP Server (Backend)
- **Path:** `./app-server/`
- **Stack:** Node.js v22+, Express, WebSocket(ws), Janode, MySQL2
- **Role:** Signaling Relay, Media Control, Auth, AI Gateway
- **Key Responsibilities:**
  - **Signaling Server:** 클라이언트 간 SDP/ICE 메시지 중계 (WebSocket)
  - **Janus Control:** Janode 라이브러리를 사용해 Janus Session/Handle 관리
  - **Business Logic:** 룸 참여 검증(비밀번호/인원), 인증 처리 (Mock)
  - **AI Gateway:** 클라이언트 질문을 받아 Ollama로 전달 및 스트리밍 응답 처리 (WebSocket)


### Target 2: APP UI (Frontend)
- **Path:** `./app-ui/`
- **Stack:** Vite, Vanilla JS (MPA Structure), WebSocket, WebRTC API, Nanostores, HTML5/CSS3
- **Role:** User Interface, WebRTC Client, Media Rendering
- **Key Responsibilities:**
  - **Phase 1 (우선순위):** 1:N 화상 회의, 실시간 채팅, AI 연동, 참여자 입장/퇴장
  - **Phase 2 (후순위):** 화면 공유(Screen Share) - *Phase 1 완료 후 구현*



## 3. Reference Points (READ-ONLY)

아래 파일들은 **Source of Truth (구현 기준)**이므로 절대 수정하지 말고, 정의된 내용을 준수하십시오. 


### A. Context & Implementation Guides (전체 이해 및 흐름)
- **Global Overview:** `./README.md`
- **Frontend Guide:** `./app-ui/README.md`
- **Backend Guide:** `./app-server/README.md`
- **DB Details:** `./database/README.md`
- **Gateway Details:** `./gateway/README.md`
- **LLM Details:** `./llm/README.md`


### B. Configuration & Static Assets (코드 참조 기준)
- **UI Reference:** `./app-ui/demo/` (Static Mockups)
  - *Instruction:* 이곳의 HTML/CSS 구조를 분석하여 실제 UI 구현에 반영
- **API Specification:** `./app-server/API.md`
  - *Constraint:* 모든 HTTP 응답 및 WebSocket 이벤트는 문서의 JSON 포맷을 엄격히 준수
  - *Constraint:* 구현상 필수적인 필드가 누락된 경우에만 주석과 함께 추가를 허용하고 그 외에는 변경 금지
- **Database Schema:** `./database/mysql/init/1.schema.sql`
  - *Constraint:* users, rooms, room_participants 테이블 준수
- **Janus Config:** `./gateway/conf/*.jcfg`
  - *Constraint:* 정적 테스트 룸 9999번 사용, 포트 8088(API)/8188(WS) 사용
- **AI Settings:** `./llm/models/*/Modelfile`
  - *Constraint:* 커스텀 모델 사용(`chat-assistant:1.0`)

### C. Environment Variables (Interface Keys)
- APP Server Keys (`./app-server/.env` 참조)
- APP UI Keys (`./app-ui/.env` 참조)



## 4. Implementation Requirements

**Common Rules**
- **Language**: JavaScript (ES Modules `import/export` 사용)
- **Framework**: Express (Server), Vanilla JS (Client)
- **Code Style**: Prettier 기본 설정 준수, 주요 로직에 한글 주석
- **Test Code**: 핵심 로직에 대한 단위 테스트(Unit Test) 코드 생성 (ex. `__tests__/*.test.js`)


### Target 1: APP Server (Backend) Logic
1. **Room Creation (Transaction):**
- [Step 1] UUID 생성 (하이픈 제거)
- [Step 2] Janus Room 생성 (`string_ids: true`)
- [Step 3] DB 저장 (실패 시 Janus Room 삭제 - Rollback)

2. **Join Process (Session):**
- [Step 1] HTTP API `/api/rooms/:roomId/join`에서 `joinToken` 발급 (UUID)
- [Step 2] DB `room_participants` 테이블에 토큰과 `userInfo` 저장 (임시 참여자)
- [Step 3] WebSocket 연결 시 클라이언트가 보낸 `joinToken` 검증
- [Step 4] Janus Publisher 등록 후 `feedId` 수신
- [Step 5] In-Memory Map(`activeRooms`)에 `joinToken`, `feedId`, `userInfo`를 매핑하여 저장 (활성 세션)
- [Step 6] `joined` 이벤트 응답 시 현재 참여자 목록(전체 feedId + userInfo) 반환

3. **Signaling Relay:**
- **Publisher (자신의 미디어 전송)**:
  - **Client → Server:** 클라이언트가 자신의 미디어를 켜기 위해 `usage: 'publish'`와 함께 SDP Offer를 전송.
  - **Server → Janus:** 서버가 Janode를 통해 Janus에 `configure` 요청 (Offer와 함께 전송).
  - **Janus → Server:** Janus가 SDP Answer를 반환.
  - **Server → Client:** Answer를 클라이언트에 중계.
- **Subscriber (다른 참여자 수신)**:
  - **Client → Server:** 클라이언트가 구독하려는 대상의 ID를 담아 `{ type: 'subscribe', targetFeedId }` 이벤트를 전송 (SDP Offer는 보내지 않음).
  - **Server → Janus:** 서버가 Janode를 통해 대상 `targetFeedId`에 대한 `start` 요청을 보냄.
  - **Janus → Server:** Janus가 Subscriber에게 SDP Offer를 반환.
  - **Server → Client:** Offer를 클라이언트에게 중계.
  - **Client → Server:** 클라이언트가 SDP Answer를 생성하여 서버에 다시 전송.
- **ICE Candidate (통합 처리)**:
  - **Payload:** `{ type: 'ice-candidate', usage: 'publish' | 'subscribe', targetFeedId?, candidate }`
  - **로직:** 서버는 `usage`와 `targetFeedId`를 확인하여 해당 Candidate를 Janus의 올바른 `Handle`로 중계함.

4. **AI Integration:**
- **요청 처리:**
  - WebSocket으로 질문 수신 → **Ollama API (`/api/chat`, `stream: true`)** 호출 (LLM 모델 규격 준수).
- **Timeout 정책 (정확성):**
  - 첫 청크 수신 대기: 10초 (Ollama가 응답을 시작하는 시간 확인)
  - 전체 응답 대기: 30초 (긴 답변 시 최대 허용 시간)
  - Timeout 발생 시: `{ type: 'ai-error', code: 'AI_TIMEOUT' }` 전송 후 메모리 정리.
- **Guard (보안):** `src/ai/llm.guard.js`를 통한 입출력 검증
  - **입력 검증:** 프롬프트 인젝션 패턴 필터링, 최대 1000자 제한.
  - **출력 검증:** 생성된 답변에서 개인정보 패턴(이메일, 전화번호 등)을 **마스킹** 처리.
- **Memory:** `chatContext`는 룸 종료 또는 사용자 퇴장 시 **즉시 삭제**하여 메모리 누수를 방지. (In-Memory Map 관리)



### Target 2: APP UI (Frontend) Logic

1. **Implementation Phases (Strict Order)**
반드시 다음 순서대로 구현을 진행해야 합니다.

- **Phase 1 (Priority - Core):**
  - **1:N 화상 회의 기본 구현:**
    - **Pre-join**: 카메라/마이크 권한 확인 및 미리보기 (Preview)
    - **Publisher**: 자신의 미디어 스트림을 Janus에 전송 (`usage: 'publish'` 명시)
    - **Subscriber**: 다른 참여자의 미디어 수신 및 렌더링 (Target `feedId` 구독)
    - **Dynamic Grid**: 참여자 수에 따른 비디오 레이아웃 자동 조정
  - **실시간 텍스트 채팅:**
    - 메시지 전송/수신 (WebSocket)
    - **채팅 메시지 DB 저장**: (UI 구현 범위에서 삭제. 서버 API 호출 여부로 대체)
  - **AI 어시스턴트:**
    - 질문 전송 및 스트리밍 응답 렌더링 (Optimistic UI 적용)
  - **참여자 입장/퇴장:**
    - `new_peer`, `peer_left` 이벤트 처리 및 참여자 목록 UI 업데이트
- **Phase 2 (Later - Extension):**
  - **화면 공유 (Screen Share):**
    - `getDisplayMedia()` API 사용
    - 화면 공유 스트림을 별도 Publisher로 전송
    - 화면 공유 수신자는 전체 화면 모드로 렌더링
  - **호스트 제어 기능:**
    - **강퇴:** `DELETE /api/rooms/:roomId/participants/:userId` 호출
    - **원격 음소거:** WebSocket을 통해 서버로 제어 요청 전송 (서버가 Janus API를 호출하여 처리)

2. **Core Logic Implementation**
- **Socket Client (Signaling):**
  - `SocketClient` 클래스 구현 (Singleton 패턴 권장)
  - **Auto-reconnect:** 연결 끊김 시 `joinToken`을 사용해 자동 재접속 시도
  - **Event Handling:** `joined`, `new_peer` 이벤트 수신 시 `FeedID`와 `UserInfo` 매핑 저장
- **WebRTC Manager (Media):**
  - `RTCPeerConnection` 및 `getUserMedia` 관리를 캡슐화한 `WebRTCManager` 클래스 구현
  - **Constraint:** Janus와 직접 통신하지 않고, 반드시 `SocketClient`를 통해 SDP/ICE를 중계
  - **Signaling:** SDP 생성 시 `usage`('publish'|'subscribe')와 `targetFeedId` 구분 처리
- **Video Rendering:**
  - **Pre-join:** 입장 전 카메라/마이크 권한 확인 및 미리보기(Preview) `<video>` 출력
  - **Dynamic Grid:** `VideoGrid.js`를 통해 참여자 수에 따라 비디오 레이아웃(Grid CSS) 자동 조정
  - **Name Tag:** 수신된 `feedId`를 매핑된 `userInfo`로 변환하여 비디오 하단에 이름 표시
- **AI Chat Integration:**
  - **Optimistic UI:** 질문 전송 즉시 화면에 빈 말풍선 렌더링
  - **Streaming:** WebSocket으로 수신되는 청크(Chunk)를 해당 말풍선에 실시간 Append

3. **UI/UX Strategy**
- **Design Reference:** `./app-ui/demo/` 경로의 정적 파일 구조와 클래스명을 분석하여 구현에 반영
- **Common UI Injection:** `header.js` 등을 작성하여 모든 페이지에 공통 헤더/메뉴 동적 주입
- **Componentization:** 반복되는 UI(Modal, Toast, Loader)는 함수형 컴포넌트로 모듈화하여 재사용



## 5. Execution Context & Constraints

코드는 아래 실행 순서와 제약 사항을 가정하고 작성되어야 합니다.

**1. Execution Order**
1. Infrastructure (DB, Gateway, LLM) Ready
2. APP Server Start
3. APP UI Start

**2. Network Constraints (DB Connection)**
- **Hostname Logic:**
  - 개발 모드(`npm run dev`): `localhost` 사용
  - 컨테이너 모드: `mysql_container` 사용
  - *Instruction:* `.env` 또는 실행 인자를 통해 DB Host를 동적으로 선택하는 로직 구현
- **Connectivity Check (Retry Logic):**
  - APP Server 시작 시 DB 연결 실패할 경우, 즉시 종료하지 말고 **5초 간격으로 5회 재시도**하는 로직을 반드시 구현 (컨테이너 구동 속도 차이 극복)

**3. Testing & Self-Correction**
- 코드를 생성한 후, 생성된 **테스트 코드(`__tests__`)를 가상으로 시뮬레이션**하십시오.
- 만약 논리적 오류(예: Janus 연결 실패 처리 누락, 변수명 불일치)가 발견되면, **스스로 수정 코드를 제시**하십시오.
