#  화상 회의 플랫폼

WebRTC 기반의 실시간 화상 회의 플랫폼으로 Janus Gateway를 활용하여 다자간 비디오/오디오 통신을 지원하며, 
AI 어시스턴트 기능을 통해 회의 중 실시간 질의응답 기능을 제공합니다.


**주요 기능**
- 실시간 화상 회의
  - 1:1 및 1:N 실시간 비디오/오디오 송수신
    - 회의록: 오디오를 텍스트로 기록 (로드맵)
  - 실시간 채팅
    - 텍스트 메시지 송수신
    - 채팅 메시지 저장: 호스트 전용
  - 회의 룸 관리
    - 회의 룸 생성: 호스트 전용
  - 미디어 제어
    - 카메라/마이크 ON/OFF
    - 비디오 품질 조절 (로드맵)
- AI 기능
  - AI 회의 어시스턴트: 사이드바에 AI 채팅창 통합
    - 질문에 대한 실시간 응답: 텍스트 질의 수준
    - 실시간 음성 회의에 대한 QA 기능 (로드맵)
  - 참가자 모니터링 (로드맵)
    - 시선 추적 및 집중도 분석: 호스트 전용

**향후 개선 사항**
- 채팅 메시지 저장: 클라이언트 재접속시 메시지 소실, 네트워크가 끊기는 경우 메시지 누락 또는 중복 문제
- 회의록: 음성 발화자와 채팅 발화자가 존재해 식별 및 순서 충돌 문제



## 기술 스택

**Frontend**
- WebRTC
- WebSocket

**Backend**
- Signaling Server: Node(Express)
- Media Server: Janus Gateway
- Janus Control: Janode

**AI**
- LLM Runtime: Ollama

**Infra**
- ICE Server: Google STUN Server



## 개념 및 용어

**WebRTC 연결 흐름**
```
┌────────────┐   ┌────────────────────┐   ┌────────────┐
│  Client A  │ ↔ │  Signaling Server  │ ↔ │  Client B  │ 
└────────────┘   └────────────────────┘   └────────────┘
      ↕                    ↕                     ↕
 STUN Server     ┌────────────────────┐     STUN Server
                 │   Janus Gateway    │
                 └────────────────────┘
```


**시그널링**  
: 브라우저와 Janus Gateway 간 연결 정보를 교환하는 과정  

1. 브라우저가 Offer/Answer를 생성해 시그널링 서버를 통해 Janus와 조건 협상
2. 브라우저가 STUN 서버를 통해 공인 IP 확인 (ICE 후보 수집)
3. 수집된 공인 IP를 교환해 브라우저와 Janus 간 연결을 수립

**Offer/Answer**  
: 브라우저와 Janus Gateway 간 SDP 연결 정보를 제안하고 수락하는 과정  

**ICE**  
: 통신 할 수 있도록 최적의 경로를 찾아 연결을 수립하는 과정 및 기술

- ICE 수집: 가능한 모든 후보를 찾는 과정
- ICE 후보: 브라우저가 찾아낸 연결 가능한 네트워크 경로
  - 로컬 IP: 운영체제 네트워크 인터페이스를 직접 조회
  - 공인 IP: STUN 서버에 요청을 보내 브라우저의 공인 IP를 응답받음
  - Relay 후보: P2P 직접 연결이 불가능할 때 TURN 서버를 통해 중계받는 경로
- ICE 연결: 수집된 후보를 시그널링 서버를 통해 교환하고 최적의 경로를 선택해 연결하는 과정

**SDP** (Session Description Protocol)  
: Offer/Answer 과정에서 사용되는 프로토콜로 미디어, 코덱, 네트워크 등 정보가 정의됨

**STUN**  
: NAT 환경에서 클라이언트의 공인 IP를 확인하는 프로토콜 및 기술



## 아키텍처

**시그널링 흐름**
```
         WebSocket            Janode                        
┌──────────┐   ┌───────────────┐   ┌─────────────────┐
│  Client  │ ↔ │   APP Server  │ ↔ │  Janus Gateway  │ 
└──────────┘   └───────────────┘   └─────────────────┘
      ↕                                     ↕
 STUN Server                           STUN Server
```

1. 브라우저에서 WebSocket을 통해 APP Server 연결
2. 클라이언트가 룸 생성/입장을 요청하면 APP Server가 Janode를 통해 Janus에 요청
3. 이때 SDP(Offer/Answer)를 교환함
  - 브라우저가 SDP 정보를 APP Server에 전송
  - APP Server가 이를 받아 Janus에 전달
  - Janus에서 자신의 SDP 정보를 APP Server에 전송
  - APP Server에서 이를 받아 브라우저에 전달
4. ICE 후보 교환 (SDP 교환 전후에 진행)


**미디어 흐름**
```                    
┌────────────┐   ┌─────────────────┐   ┌────────────┐
│  Client A  │ ↔ │  Janus Gateway  │ ↔ │  Client B  │ 
└────────────┘   └─────────────────┘   └────────────┘
```

1. 브라우저 A가 자신의 영상/음성 데이터를 Janus에 전송 (UDP 프로토콜 사용)
2. Janus가 전송받은 데이터를 참여자 수만큼 복사하고 전달함 (SFU)
3. 브라우저 B가 복사된 데이터를 수신함


**AI 채팅 흐름**
```
┌──────────┐   ┌───────────────┐   ┌───────────────┐
│  Client  │ ↔ │   APP Server  │ ↔ │  LLM Runtime  │
└──────────┘   └───────────────┘   └───────────────┘
```

1. 클라이언트가 채팅창에 질문을 입력하면 WebSocket을 통해 APP Server로 전송
2. APP Server가 질문을 받아 Ollama API 호출
3. Ollama가 로컬 모델을 사용해 답변 생성
4. 답변을 청크 단위로 전달하면 APP Server가 WebSocket으로 클라이언트에 전달



### 구성 요소

**APP UI**
- 정적 파일로 빌드되어 APP Server에서 서빙
- 주요 기술: WebSocket, WebRTC
- 주요 기능
  - 사용자 인터페이스 렌더링
  - 카메라, 마이크 접근
  - 비디오, 오디오 송수신


**APP Server**
- 역할: 정적 파일 서버, API 서버, 시그널링 서버
- 주요 기술: Node(Express), Janode, WebSocket
- 주요 기능
  - 정적 파일 서빙
  - RESTful API 제공
  - WebSocket 연결 관리
  - 비즈니스 로직 처리
  - Janode를 통한 Janus 제어
  - AI 모델 연동


**Janus Gateway**
- 주요 기술: WebRTC, Video Room Plugin
- 주요 기능
  - WebRTC 신호 처리
  - 미디어 스트림 중계
  - 비디오, 오디오 라우팅
  - NAT 통과 지원
  - Video Room 플러그인으로 가상 회의실 관리


**ICE Server**
- Google STUN 서버 사용
  - stun:stun.l.google.com:19302
  - stun:stun1.l.google.com:19302
  - stun:stun2.l.google.com:19302


**LLM Runtime**
- 주요 기술: Ollama
- 주요 기능
  - 로컬 환경에서 LLM 모델 구동
  - 사용자 질의에 대한 텍스트 생성 및 인퍼런스 수행



### 프로젝트 구성

**프로젝트 구조**
- [APP Server](./app-server/README.md)
- [APP UI](./app-ui/README.md)
- [Janus Gateway](./gateway/README.md)
- [Database](./database/README.md)
- [LLM Runtime](./llm/README.md)

**실행 순서**
1. Database
2. Janus Gateway
3. LLM Runtime
4. APP Server
5. APP UI

**실행**

- 리눅스 환경
- 필수 도구: podman, podman-compose, npm

```bash
# 공용 네트워크 생성
podman network create chat-net

# 데이터베이스 실행
cd ./database/mysql
podman-compose up -d

# Janus Gateway 실행
cd ./gateway
podman-compose up -d

# Ollama 실행
nohup ollama serve > ./llm/ollama.log 2>&1 &

# APP Server 실행
cd ./app-server
npm install
npm run dev

# APP UI 실행
cd ./app-ui
npm install
npm run dev
```


**개발 환경**

구성 | 주요 기술 | 버전 | 포트
---|---|---|---
APP Server   | Node | 22.x | 3000
APP UI | Vite | - | 5173 (Proxy to APP Server)
Media Server | Janus | - | 8088, 8188, 10000-10500
Database  | MySql | 8.0 | 3306
LLM Runtime | Ollama | 0.3.x | 11434
STUN | Google STUN | - | 19302


**Git Commit 가이드라인**
```
<타입>: <간결한 설명>
```

커밋 타입 | 설명 | 예시
---|---|---
init | 초기 설정 | init: 프로젝트 구조 및 기본 설정
feat | 새 기능 추가 | feat: oo 기능 구현
fix  | 버그 수정 (잘못된 동작 수정) | fix: oo 오류 해결
refactor | 기능 개선 (코드 구조 정리, 코드 개선 등) | refactor: oo 기능 분리
chore | 빌드 설정, 파일 정리 등 기타 작업 | chore: 환경 변수 설정
test  | 테스트 코드 추가 및 수정 | test: 단위 테스트 추가
style | 코드 디자인 변경 (들여쓰기, 세미콜론 등) | style: ESLint 규칙 적용
docs  | 문서 수정 | docs: oo 추가