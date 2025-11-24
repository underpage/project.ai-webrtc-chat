#  화상 회의 플랫폼

WebRTC 기반의 실시간 화상 회의 플랫폼으로 Janus Gateway를 활용하여 다자간 비디오/오디오 통신을 지원하며,  
AI 어시스턴트 기능을 통해 회의 중 실시간 질의응답 기능을 제공합니다.


**주요 기능**
- 실시간 화상 회의
  - 1:1 및 1:N 실시간 비디오/오디오 송수신
    - 회의록: 오디오를 텍스트로 기록 (로드맵)
  - 실시간 채팅
    - 텍스트 메시지 송수신
  - 회의 룸 관리
    - 회의 룸 생성 및 삭제 (호스트 권한)
  - 미디어 제어
    - 카메라/마이크 ON/OFF
    - 비디오 품질 조절
- AI 기능
  - AI 회의 어시스턴트: 사이드바에 AI 채팅창 통합
    - 텍스트 질문에 대한 실시간 응답
    - 실시간 음성 회의에 대한 QA 기능 (로드맵)
  - 참가자 모니터링 (로드맵)
    - 시선 추적 및 집중도 분석: 호스트 전용

**향후 개선 사항**
- 회의록
  - 관리자가 회의록 활성화 여부를 제어
  - 오디오 스트리밍을 실시간으로 음성 인식하여 텍스트로 변환 및 기록
  - 채팅 메시지와 음성 기록을 시간 순서(타임스탬프)로 기록



## 기술 스택

**Frontend**
- Vanilla JS
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

1. 브라우저 A가 자신의 영상/음성 데이터를 Janus에 전송
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



### 프로젝트 구성

기능별로 독립된 5개의 하위 프로젝트로 구성되었으며, 각 구성 요소는 독립된 기술 스택과 역할을 수행합니다.

- [APP UI](./app-ui/README.md)
- [APP Server](./app-server/README.md)
- [Database](./database/README.md)
- [Janus Gateway](./gateway/README.md)
- [LLM Runtime](./llm/README.md)

**향후 개선 사항**
- APP UI 상태 관리를 위해 React같은 프레임워크 도입
- APP Server  서비스 분리 (프론트엔드 서빙 서버, API 서버, 시그널링 서버)
- TURN 서버 추가
- STT 서버 추가 (회의록)


#### APP UI
정적 파일로 빌드되어 APP Server에서 서빙

- 주요 기술: WebSocket, WebRTC
- 주요 기능
  - 사용자 인터페이스 렌더링
  - 카메라, 마이크 접근
  - 비디오, 오디오 송수신


#### APP Server
- 역할: 정적 파일 서버, API 서버, 시그널링 서버
- 주요 기술: Node(Express), Janode, WebSocket
- 주요 기능
  - 정적 파일 서빙
  - RESTful API 제공
  - WebSocket 연결 관리
  - Janus Gateway 제어


#### Janus Gateway
- 주요 기술: WebRTC, Video Room Plugin
- 주요 기능
  - WebRTC 신호 처리
  - 미디어 스트림 라우팅
  - NAT 통과 지원


#### LLM Runtime
- 주요 기술: Ollama
- 주요 기능
  - 로컬 환경에서 LLM 모델 구동
  - 사용자 질의에 대한 답변 생성



## 프로젝트 실행

### 개발 환경

**사전 준비**
- 리눅스 환경
- 필수 도구: podman, podman-compose, npm, vite


**환경 구성**

구성 | 주요 기술 | 버전 | 포트
---|---|---|---
APP UI       | Vite   | - | 5173 (Proxy to APP Server)
APP Server   | Node   | 22.x | 3000
Database     | MySql  | 8.0 | 3306
Media Server | Janus  | Latest | 8088, 8188, 10000-10500
LLM Runtime  | Ollama | 0.3.x | 11434


**환경 변수**  
외부 접속시 다음 프로젝트의 IP 설정 변경 필요

- APP UI
- APP Server
- Janus


**설정 및 실행**
- APP Server 실행 전 데이터베이스, Janus, Ollama가 먼저 실행되어야 함

```bash
# 네트워크 생성: 컨테이너는 `chat-net` 네트워크에 소속
podman network create chat-net --driver bridge --label "dns_enabled=true"

## 네트워크 확인
podman network ls | grep chat-net


# 방화벽 설정
sudo ufw allow 3000/tcp

sudo ufw allow 8088/tcp
sudo ufw allow 8188/tcp
sudo ufw allow 10000:10500/udp


# 1. 데이터베이스 실행
podman-compose -f ./database/mysql/docker-compose.yml up -d

# 2. Janus Gateway 실행
podman-compose -f ./gateway/docker-compose.yml up -d

# 3. Ollama 실행
## 모델 다운로드
ollama pull llama3.1

## 커스텀 모델 생성
ollama create chat-assistant:1.0 -f ./llm/models/chat-assistant/Modelfile

## 서버 실행
nohup ollama serve > ./llm/ollama.log 2>&1 &


# 4. APP Server 실행
cd ~/project.ai-webrtc-chat/app-server
npm install
npm run dev

# 5. APP UI 실행 (새 터미널)
cd ~/project.ai-webrtc-chat/app-ui
npm install
npm run dev
```