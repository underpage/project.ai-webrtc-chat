# APP Server API

- [REST API](#rest-api)
- [WebSocket API](#websocket-api)
  - [Signaling](#signaling)
  - [Room Events](#room-events)
  - [Chat Events](#chat-events)
  - [AI Assistant Events](#ai-assistant-events)


**기본 정보**
- HTTP API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000/ws`
- Content-Type: `application/json`


**인증**
- HTTP: 헤더에 토큰 포함 `Authorization: Bearer <accessToken>`
- WebSocket: 연결 시 쿼리 파라미터 사용 `ws://...?token=<joinToken>`


**공통 에러 응답 형식**
```json
// REST
{
  "success": false,
  "message": "ERROR",
  "error": {
    "code": "ROOM_NOT_FOUND",
    "message": "회의실을 찾을 수 없습니다.",
    "details": { }
  }
}

// WebSocket
{
  "type": "error",
  "payload": {
    "success": false,
    "error": {
      "code": "AI_POLICY_VIOLATION",
      "message": "부적절한 단어가 포함되어 있어 답변할 수 없습니다.",
      "details": { }
    }
  }
}
```


**주요 에러 코드**

카테고리 | 코드 | HTTP 상태 | 설명
---|---
공통 | INVALID_REQUEST | 400 | 필수 파라미터 누락, 타입 오류 등
공통 | INTERNAL_SERVER_ERROR | 500 | 서버 내부 로직 에러
인증 | UNAUTHORIZED | 401	| 토큰 없음, 토큰 만료
인증 | FORBIDDEN    | 403 | 권한 없음
룸 | ROOM_NOT_FOUND | 404	| 존재하지 않는 룸 ID
룸 | ROOM_FULL	    | 409	| 최대 인원 초과
룸 | ROOM_CLOSED	  | 410	| 종료된 회의
룸 | INVALID_PASSWORD	| 401 | 룸 비밀번호 불일치
참여 | DUPLICATE_JOIN	| 409 | 이미 참여 중인 사용자
참여 | USER_NOT_FOUND | 404 | 존재하지 않는 사용자
Janus	| JANUS_CONNECTION_ERROR | 502 | Janus Gateway 연결 실패
Janus	| MEDIA_NEGOTIATION_FAILED | 500 | SDP/ICE 협상 실패
AI | AI_SERVICE_UNAVAILABLE | 503 | Ollama 연동 실패
AI | AI_POLICY_VIOLATION | 400 | 가드레일 위반 (금지어, 인젝션 시도)



## REST API

**응답 형식**
```json
{
  "success": true,
  "message": "OK", 
  "data": { }
}
```


### Auth 

#### 로그인

> POST /api/auth/login

**Request**
```json
{
  "userId": "user123",
  "password": "password123"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "accessToken": "token",
    "user": {
      "uid": 1,
      "userId": "user123",
      "name": "홍길동",
      "email": "user@example.com",
      "department": "부서명",
      "company": "회사명"
    }
  }
}
```


#### 회원 가입

> POST /api/auth/signup

**Request**
```json
{
  "userId": "user123",
  "password": "password123",
  "name": "홍길동",
  "email": "user@example.com",
  "department": "부서명",
  "company": "회사명"
}
```

**Response**
```json
{
  "success": true,
  "message": "회원가입이 완료되었습니다.",
  "data": {
    "userId": "user123"
  }
}
```


#### 세션 확인

> GET /api/auth/me

**Response**
```json
{
  "success": true,
  "data": {
    "userId": "user123"
  }
}
```


#### 로그아웃

> POST /api/auth/logout

**Response**
```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```



### Room

```                    
┌──────────┐   ┌───────────────┐   ┌─────────────────┐
│  Client  │ ↔ │   APP Server  │ ↔ │  Janus Gateway  │ 
└──────────┘   └───────────────┘   └─────────────────┘
```

**흐름**
1. 클라이언트가 HTTP로 룸 생성/참여 요청
2. APP Server가 Janode를 통해 Janus VideoRoom Plugin 호출
3. Janus가 처리 후 결과 반환
4. APP Server가 클라이언트에 응답 및 WebSocket으로 참여자들에게 알림


#### 룸 생성

> POST /api/rooms

**Request**
```json
{
  "title": "프로젝트 회의",
  "description": "Q4 계획 논의",
  "maxParticipants": 6,
  "roomPassword": "optional"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "roomId": "uuid",
    "hostId": "user123",
    "title": "프로젝트 회의",
  }
}
```


#### 룸 삭제

> DELETE /api/rooms/:roomId

**Response**
```json
{
  "success": true,
  "message": "룸이 삭제되었습니다."
}
```


#### 룸 참여

> POST /api/rooms/:roomId/join

**Request**
```json
{
  "roomId": "uuid",
  "password": "room password",
  "guestInfo": { "name": "게스트", "dept": "마케팅", "company": "협력사" }
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "roomId": "uuid",
    "joinToken": "token",
    "feedId": 1234,
    "role": "participant",
    "participants": [
      {
        "feedId": 5678,
        "userInfo": {
          "userId": "user456",
          "displayName": "김철수",
        }
      }
    ],
  }
}
```


#### 참여자 퇴장

> DELETE /api/rooms/:roomId/participants/me

**Response**
```json
{
  "success": true,
  "message": "룸에서 퇴장했습니다."
}
```


#### 참여자 강퇴

> DELETE /api/rooms/:roomId/participants/:userId

**Response**
```json
{
  "success": true,
  "message": "참여자가 강퇴되었습니다."
}
```


#### 룸 상세 조회

> GET /api/rooms/:roomId

**Response**
```json
{
  "success": true,
  "data": {
    "roomId": "uuid",
    "hostId": "user123",
    "title": "프로젝트 회의",
    "purpose": "Q4 계획 논의",
    "maxParticipants": 10,
    "currentParticipants": 5,
    "createdAt": "2025-01-01T10:00:00Z"
  }
}
```


#### 룸 참여자 목록 조회

> GET /api/rooms/:roomId/participants

**Response**
```json
{
  "success": true,
  "data": {
    "participants": [
      {
        "userId": "user123",
        "displayName": "홍길동",
        "role": "host",
        "joinedAt": "2025-01-02T10:00:00Z"
      },
      {
        "userId": "user123",
        "displayName": "홍길동",
        "role": "participant",
        "joinedAt": "2025-01-02T10:00:00Z"
      },
      {
        "displayName": "홍길동",
        "role": "participant",
        "guestInfo": "게스트/마케팅/협력사",
        "joinedAt": "2025-01-02T10:00:00Z"
      }
    ]
  }
}
```


#### 전체 룸 목록 조회

> GET /api/rooms

**Response**
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomId": "uuid",
        "hostId": "user123",
        "title": "프로젝트 회의",
        "purpose": "Q4 계획 논의",
        "maxParticipants": 10,
        "currentParticipants": 5,
        "createdAt": "2025-01-01T10:00:00Z"
      }
    ]
  }
}
```



## WebSocket API


### Signaling

#### SDP Offer 전송

> Client → Server

```json
{
  "type": "sdp-offer",
  "data": {
    "roomId": "uuid",
    "usage": "publish",
    "jsep": {
      "type": "offer",
      "sdp": "v=0\r\no=..."
    }
  }
}

{
  "type": "sdp-offer",
  "data": {
    "roomId": "uuid",
    "usage": "subscribe",
    "targetFeedId": 1234,
    "jsep": {
      "type": "offer",
      "sdp": "v=0\r\no=..."
    }
  }
}
```


#### SDP Answer 수신

> Server → Client

```json
{
  "type": "sdp-answer",
  "data": {
    "roomId": "uuid",
    "usage": "publish | subscribe",
    "targetFeedId": 1234,
    "jsep": {
      "type": "answer",
      "sdp": "v=0\r\no=..."
    }
  }
}
```


#### ICE Candidate 전송

> Client → Server

```json
{
  "type": "ice-candidate",
  "data": {
    "roomId": "uuid",
    "usage": "publish | subscribe",
    "targetFeedId": 1234,
    "candidate": {
      "candidate": "candidate:1 1 UDP ...",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  }
}
```


#### ICE Candidate 수신

> Server → Client

```json
{
  "type": "ice-candidate",
  "data": {
    "roomId": "uuid",
    "usage": "publish | subscribe",
    "targetFeedId": 1234,
    "candidate": {
      "candidate": "candidate:1 1 UDP ...",
      "sdpMLineIndex": 0,
      "sdpMid": "0"
    }
  }
}
```



### Room Events

#### 참여자 입장 알림

> Server → Client

```json
{
  "type": "participant-joined",
  "data": {
    "roomId": "uuid",
    "feedId": 1234,
    "user": {
      "userId": "user123",
      "displayName": "홍길동",
    }
  }
}
```


#### 미디어 제어 요청

> Client → Server

```json
{
  "type": "update-media",
  "data": {
    "roomId": "uuid",
    "audio": false,
    "video": true
  }
}
```


#### 미디어 제어 알림

> Server → Client

```json
{
  "type": "media-changed",
  "data": {
    "roomId": "uuid",
    "userId": "user123",
    "audio": false,
    "video": true
  }
}
```


#### 참여자 퇴장 알림

> Server → Client

```json
{
  "type": "participant-left",
  "data": {
    "roomId": "uuid",
    "userId": "user123",
    "reason": "left"
  }
}
```

**reason**
- `left`: 퇴장
- `kicked`: 강퇴
- `timeout`: 연결 타임아웃


#### 룸 종료 알림

> Server → Client

```json
{
  "type": "room-closed",
  "data": {
    "roomId": "uuid",
    "reason": "host_left"
  }
}
```


### Chat Events

#### 메시지 전송

> Client → Server

```json
{
  "type": "send-message",
  "data": {
    "roomId": "uuid",
    "text": "안녕하세요"
  }
}
```


#### 메시지 수신

> Server → Client

```json
{
  "type": "chat-message",
  "data": {
    "roomId": "uuid",
    "from": {
      "userId": "user123",
      "displayName": "홍길동"
    },
    "text": "안녕하세요",
    "timestamp": "2025-01-01T10:10:00Z"
  }
}
```



### AI Assistant Events

#### AI 질문 전송

> Client → Server

```json
{
  "type": "ai-query",
  "data": {
    "roomId": "uuid",
    "query": "이번 회의 요약해줘."
  }
}
```


#### AI 응답 시작

> Server → Client

```json
{
  "type": "ai-response-start",
  "data": {
    "chatId": "uuid"
  }
}
```


#### AI 응답 스트리밍

> Server → Client

```json
{
  "type": "ai-response-chunk",
  "data": {
    "chatId": "uuid",
    "chunk": "이번 회의는",
    "done": false
  }
}
```


#### AI 응답 종료

> Server → Client

```json
{
  "type": "ai-response-chunk",
  "data": {
    "chatId": "uuid",
    "chunk": "",
    "done": true
  }
}
```