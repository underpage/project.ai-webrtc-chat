# Janus Gateway

WebRTC 미디어 스트림을 중계하는 SFU 서버로 사용자의 미디어 패킷을 수신하여 다른 참여자들에게 라우팅합니다.

**SFU**  
: WebRTC 통신 아키텍처 중 하나로 서버가 미디어 스트림을 라우팅  



## Janus 플러그인

- VideoRoom (SFU): 다자간 화상 회의 지원 (영상을 그대로 중계)
- AudioBridge (MCU): 여러 사용자의 음성을 서버에서 하나로 합쳐서 전달 (대역폭 절약)
- TextRoom: WebRTC 데이터 채널을 이용한 실시간 채팅 및 데이터 전송


**VideoRoom API**
- `create`: 새로운 회의 룸 생성
- `destroy`: 회의 룸 제거
- `join`: 특정 룸에 참여
- `publish`: 자신의 비디오/오디오 송출 시작
- `configure`: 비트레이트 조절, 음소거 등 미디어 제어



## 프로젝트 구성

**구조**
```bash
gateway/
├── conf/
│   ├── janus.jcfg                   # 전역 설정
│   └── janus.plugin.videoroom.jcfg  # 플러그인 설정
└── docker-compose.yml
```


### 설정 파일

**janus.jcfg**
```conf
admin: {
    admin_secret = "janus_key"
    debug_level = 4
}

media: {
    rtp_port_range = "10000-10500"
    dtls_mtu = 1200
}

# Janus가 자신의 공인 IP를 찾기 위한 설정
nat: {
    stun_server = "stun.l.google.com"
    stun_port = 19302
    nice_debug = false
    ice_lite = false
    ice_tcp = false

    # 외부 서버 배포시 공인 IP 정의 필요
    # nat_1_1_mapping = "1.2.3.4"
}
```


**janus.plugin.videoroom.jcfg**
```conf
general: {
    string_ids = true
    max_publishers = 6
    admin_key = "videoroom_key"
}

# 테스트용 룸 (Janus Server RAM에 논리적 객체)
room-9999: {
    description = "Test Room"
    secret = "secret"
    publishers = 4
    bitrate = 1024000
    fir_freq = 10
    audiocodec = "opus"
    videocodec = "vp8"
    record = false
    rec_dir = "/tmp"
}
```


### 프로젝트 실행

**설치**
```bash
# 이미지 다운로드
podman pull canyan/janus-gateway:latest

# 단일 컨테이너 테스트 실행
podman run -d \
  --name janus-test \
  -p 8088:8088 \
  -p 8188:8188 \
  -p 10000-10500:10000-10500/udp \
  canyan/janus-gateway:latest

# Janus 로그 확인
podman logs janus-test

# Janus 정보 조회
curl -s http://localhost:8088/janus/info

# 컨테이너 제거
podman stop janus-test && podman rm janus-test
```


**실행**
```bash
# 컨테이너 실행
podman-compose up -d

# 로그 확인
podman logs -f janus_container

# 테스트

## 세션 생성 + 핸들 생성 (janode 사용시 janode가 관리함)
SESSION=$(curl -s -X POST http://localhost:8088/janus \
  -d '{"janus":"create","transaction":"t1"}' | jq -r '.data.id')
 
HANDLE=$(curl -s -X POST http://localhost:8088/janus/$SESSION \
  -d '{"janus":"attach","plugin":"janus.plugin.videoroom","transaction":"t2"}' | jq -r '.data.id')


## 룸 생성 테스트
curl -X POST http://localhost:8088/janus/$SESSION/$HANDLE \
  -H "Content-Type: application/json" \
  -d '{
    "janus": "message",
    "transaction": "create_room",
    "body": {
      "request": "create",
      "room": 1234,
      "description": "Test Room",
      "publishers": 6
    }
  }'

## 연결 테스트
curl -X POST http://localhost:8088/janus/$SESSION \
  -H "Content-Type: application/json" \
  -d '{
    "janus": "attach",
    "plugin": "janus.plugin.videoroom",
    "transaction": "test456"
  }'

## 룸 목록 확인
curl -X POST http://localhost:8088/janus/$SESSION/$HANDLE\
  -H "Content-Type: application/json" \
  -d '{
    "janus": "message",
    "transaction": "list_rooms",
    "body": {
      "request": "list"
    }
  }'
```


**네트워크 구성**

포트 | 프로토콜 | 용도 | 설명
---|---|---|---
8088 | TCP (HTTP)	| REST API  | 시그널링 제어
8188 | TCP (WS)	  | WebSocket | 클라이언트 연결
10000-10500 | UDP	| RTP/RTCP  | WebRTC 미디어


**방화벽 설정**
- 외부 접속이 필요한 경우 설정

```bash
# 방화벽 확인
sudo ufw status

sudo ufw allow 8088/tcp
sudo ufw allow 8188/tcp
sudo ufw allow 10000:10500/udp
```


**프로세스 우선순위 설정**
- 필요한 경우 Janus 프로세스의 CPU 우선순위를 조정

```bash
# Janus 프로세스 PID 확인
pgrep -f janus

# 우선순위 조정 (숫자가 낮을수록 우선순위가 높음)
sudo renice -n -10 -p <PID>
```