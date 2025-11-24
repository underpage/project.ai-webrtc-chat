# LLM Runtime (AI Service)

Ollama 프레임워크를 활용하여 로컬 환경에서 LLM을 서빙하는 AI 런타임입니다.  
회의 중 발생하는 텍스트 데이터를 입력받아 실시간 인퍼런스를 수행합니다.


**Inference**  
: 학습이 완료된 AI 모델에 새 프롬프트를 주입하여 결과를 예측하거나 텍스트를 생성하는 과정


**주요 기능**
- [ ] 로컬 LLM 인퍼런스
- [ ] 화상 회의 전용 커스텀 모델
- [로드맵] 자체 API 지원 (FastAPI)
  - [로드맵] 프롬프트 템플릿 관리
  - [로드맵] 모델 라우팅



## 프로젝트 구성

**기본 정보**
- Engine: Ollama
- Base URL: http://localhost:11434
- Chat Model: llama3.1
- Embedding Model: nomic-embed-text


**Ollama API**
```bash
POST http://localhost:11434/api/chat  # 대화형 텍스트 생성
GET  http://localhost:11434/api/tags  # 설치된 모델 목록 확인
GET  http://localhost:11434/api/ps    # 실행중인 모델 목록 확인
GET  http://localhost:11434/api/show  # 모델 메타 정보 확인
```


**데이터 흐름**
```
         WebSocket             HTTP
┌──────────┐   ┌───────────────┐   ┌───────────────┐
│  Client  │ ↔ │   APP Server  │ ↔ │  LLM Runtime  │
└──────────┘   └───────────────┘   └───────────────┘
```



## 프로젝트 설치 및 실행
GPU 리소스 활용을 위해 호스트에 직접 설치해 실행

**설치 및 실행**
```bash
curl -fsSL https://ollama.com/install.sh | sh

# 모델 다운로드
ollama pull llama3.1

## 확인
ollama show llama3.1


# ollama 서버 실행
ollama serve

## 백그라운드 실행 + 로그 생성
nohup ollama serve > ./ollama.log 2>&1 &

## 실행 확인
sudo systemctl status ollama

## 실행  종료
sudo systemctl stop ollama


## 테스트
curl http://localhost:11434/api/chat -d '{
  "model": "llama3.1",
  "messages": [
    { "role": "user", "content": "Hello" }
  ],
  "stream": false
}'
```


**모델 커스터마이징**
```bash
ollama create chat-assistant:1.0 -f models/chat-assistant/Modelfile

# 테스트
curl http://localhost:11434/api/chat -d '{
  "model": "chat-assistant:1.0",
  "messages": [
      { "role": "user", "content": "오늘 연예 기사 알려줘" }
  ],
  "stream": false
}'
```