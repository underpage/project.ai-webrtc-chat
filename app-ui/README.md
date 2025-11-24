# APP UI

WebRTC 화상 회의 플랫폼의 사용자 인터페이스(UI) 입니다.  
사용자는 이를 통해 다자간 영상 통화 및 AI 어시스턴트와의 채팅 기능을 이용할 수 있습니다.


## 주요 기능 (To-Be)

**인터페이스 및 UI**
- Common
  - [ ] 로딩 인디케이터 (API 호출 및 소켓 연결 시 스피너)
  - [ ] 알림 모달 (성공, 실패, 경고, 확인 등 토스트 팝업)
  - [ ] 오류 페이지
- Auth
  - [ ] 로그인
  - [ ] 회원가입
- Lobby
  - [ ] 전체 회의 룸 목록, 목록 새로고침, 룸 검색 (회의 제목, 회의 목적 등)
  - [ ] 회의 룸 생성 모달 (회원 전용)
    - [ ] 비회원 참여 허용시 룸 비밀번호 입력 필드 활성화
  - [ ] 회의룸 입장 모달
    - [ ] 비회원 경우 이름, 부서, 회사명, 룸 비밀번호 입력
    - [ ] 카메라/마이크 선택 및 카메라 미리보기
- Room
  - [ ] 룸 반응형 레이아웃
    - [ ] 사이드바 열림/닫힘에 따라 메인 영역 리사이징
    - [ ] 화면 공유시 발표자 집중형 레이아웃
  - 비디오
    - [ ] 참여자 수에 따라 비디오 영역 동적 그리드 렌더링
    - [ ] 로컬 비디오(내 얼굴) 렌더링
    - [ ] 사용자 발표시 비디오 프레임 테두리 강조
  - 상단바
    - [ ] 회의 제목, 참여자 수, 회의 경과 시간 좌측에 표시
    - [ ] 호스트 경우 우측에 회의록 활성화와 회의 종료 버튼 표시
  - 사이드바 (채팅/AI/회의록 탭)
    - [ ] 탭1-일반 채팅
    - [ ] 탭2-AI 어시스턴트
      - [ ] 비회원은 로그인 필요 오버레이
      - [ ] 질문 입력시 답변 대기 UI (답변 생성중 표시)
      - [ ] 답변 실시간 출력 (스트리밍)
    - [ ] 탭3-회의록
      - [ ] 호스트가 활성화하면 뷰어가 가능하며 호스트만 회의록 저장 버튼 표시
  - 하단바
    - [ ] 미디어 제어 버튼 (비디오, 오디오, 화면 공유, 참여자, 나가기 버튼)
    - [ ] 참여자 목록 모달 처리 (접속자 목록 및 상태)
      - [ ] 참여자 강퇴 버튼 (호스트 전용)
    - [ ] 나가기 버튼 클릭시 현재 룸에서 연결 해제하고 Lobby로 이동

**기술 및 상태 관리**
- Auth
  - [ ] 로그인 성공시 사용자 정보와 토큰 상태 저장
- Lobby
  - [ ] 룸 생성시 전달받은 RoomID 저장
- Room
  - [ ] 입장 전 임시 MediaStream 획득 및 해제
  - [ ] 회의 룸 입장시 전달받은 joinToken과 feedId 저장
  - [ ] 회의 룸 입장시 전달받은 참여자 정보로 접속자 목록 초기화
- Signaling
  - [ ] APP Server WebSocket 연결 (joinToken 인증)
  - [ ] Janus VideoRoom 플러그인 joined 이벤트 처리
  - [ ] SDP Offer/Answer 교환 처리
  - [ ] ICE Candidate 교환 처리
- Media
  - [ ] MediaStream 획득 및 미디어 권한 거부 시 오류 처리
  - [ ] Remote Stream 렌더링 (상대방 비디오/오디오 연결)
  - [ ] WebRTC API를 통해 미디어 제어
  - [ ] 원격 참여자 상태 표시 (말하는 중, 음소거, 카메라 꺼짐 아이콘)
  - [ ] 비디오 품질 조절
- Chat& AI Assistant
  - [ ] 채팅 메시지 송수신 및 배열로 관리
  - [ ] AI 질의 전송 및 스트리밍 렌더링 (타이핑 효과)
    - [ ] AI 응답 타임아웃 오류 메시지 (30초 초과 시)


## 프로젝트 구성

**프로젝트 생성**
```bash
# 프로젝트 초기화
npm init -y

# 라이브러리 설치
npm install normalize.css dayjs nanostores global webrtc-adapter

# 개발 서버 실행
npm run dev
```

**프로젝트 구조**
```bash
app-ui/
├── demo/               # 화면 참고 용도  
├── public/             # 정적 자원
│   └── assets/
├── src/
│   ├── index.html
│   ├── css/            # [CSS]
│   │   ├── common/     # 공통 스타일 (모든 페이지 적용)
│   │   └── page/       # 페이지 별 스타일
│   │
│   ├── js/             # [JS]
│   │   ├── utils/     # 유틸리티
│   │   ├── api/        # API 호출
│   │   ├── libs/       # 핵심 기능
│   │   └── page/       # 페이지 별 기능
│   │
│   └── page/           # [HTML] 화면 뷰
│       ├── error/
│       ├── auth/
│       └── chat/
├── vite.config.js
├── package.json
└── README.md
```

**엔드포인트**
- 메인(로비): `http://localhost:3000/`
- 로그인: `http://localhost:3000/page/auth/login`
- 회의 룸: `http://localhost:3000/page/chat/room/:roomId`



## 프로젝트 배포
소스 코드를 정적 파일로 빌드하고 이를 APP Server에서 서빙

**배포 프로세스**
1. npm run build 명령어를 실행하여 소스 코드를 최적화된 정적 파일로 변환
2. 빌드 결과물은 프로젝트 루트의 dist/ 디렉토리에 생성
3. 생성된 dist/ 폴더의 모든 파일을 APP Server의 public/ 디렉토리로 복사

**빌드 설정**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "vite build && rm -rf ../app-server/public/* && cp -r dist/* ../app-server/public/"
  },
}
```

**빌드**
```bash
# 기본 빌드 (.env.production 로드)
npm run build

# 테스트 모드 빌드 (.env.test 파일 로드)
npm run build -- --mode test
```