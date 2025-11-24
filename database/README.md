# Database


**구성**
```bash
mysql/
├── conf.d                   # mysql 설정 파일 디렉토리
│   └── mysqld.cnf           # mysql 커스텀 설정 파일
├── init                     # 데이터베이스 초기화 파일 디렉토리
│   ├── schema.sql           # 테이블 생성 스크립트
│   └── data.sql             # 데이터 삽입 스크립트
├── .env                     # 환경 변수 파일
├── docker-compose.yml       # 컨테이너 설정 파일
└── stop-container.sh        # 컨테이너 삭제 스크립트
```


**실행**
```bash
# 컨테이너 실행
podman-compose up -d

# 컨테이너 종료
podman-compose down

# 컨테이너 삭제
./stop-container.sh mysql_container 3306

## 포트 충돌시 확인 및 강제 종료
sudo lsof -i :3306
sudo kill -9 <PID>


# 컨테이너 접속
podman exec -it mysql_container mysql -u user -p

## 전체 테이블 삭제
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS room_participants;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

## 전체 데이터 초기화
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE room_participants;
TRUNCATE TABLE rooms;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;
```



## 스키마

```
┌─────────┐  1:N  ┌─────────┐  1:N  ┌────────────────────┐
│  Users  │ ----- │  Rooms  │ ----- │  RoomParticipants  │ 
└─────────┘       └─────────┘       └────────────────────┘

- 호스트가 여러 룸 생성
- 하나의 룸에 여러 참여자 존재
```


**users**

설명 | 컬럼 | 타입 | 비고
---|---|---|---
기본키 | uid | INT | AUTO_INCREMENT
아이디 | user_id | VARCHAR(50) | UNIQUE
비밀번호 | password | VARCHAR(255) | 암호화
이름 | name | VARCHAR(50) | -
부서명 | department | VARCHAR(100)/NULL | -
회사명 | company | VARCHAR(100)/NULL | -
이메일 | email | VARCHAR(100) | -
생성일 | created_at | TIMESTAMP | CURRENT_TIMESTAMP
수정일 | updated_at | DATETIME | 수정시 갱신
마지막 로그인 | last_login_at | DATETIME | 로그인시 갱신


**rooms**

설명 | 컬럼 | 타입 | 비고
---|---|---|---
기본키 | rid | INT | AUTO_INCREMENT
룸 ID | room_id | CHAR(32) | UNIQUE UUID
호스트 PK | user_pk | INT | users.uid FK
룸 비밀번호 | room_password | VARCHAR(255)/NULL | 비회원 참여용
회의 제목 | title | VARCHAR(255)/NULL | -
회의 목적 | purpose | VARCHAR(255)/NULL | -
참여 인원 | max_participants | INT | -
생성 시간 | created_at | TIMESTAMP | CURRENT_TIMESTAMP
제거 시간 | closed_at | TIMESTAMP/NULL | 종료 시간 기록


**room_participants**
- 회의에 참여하는 참여자에 대한 정보 기록

설명 | 컬럼 | 타입 | 비고
---|---|---|---
기본키 | pid | INT | AUTO_INCREMENT
룸 PK | room_pk | INT | rooms.rid FK
참여자 PK | user_pk | INT/NULL | 회원 users.uid/비회원 NULL
참여자 역할 | user_role | ENUM(host, participant) | 호스트, 참여자
비회원 정보 | guest_info | VARCHAR(255)/NULL | 이름/부서/회사명
조인 토큰 | join_token | CHAR(32) | UNIQUE UUID 재접속을 위한 토큰 
참여 시간 | joined_at | TIMESTAMP | CURRENT_TIMESTAMP
떠난 시간 | left_at | TIMESTAMP/NULL | 종료 시간 기록
마지막 접속 시간 | last_seen_at | TIMESTAMP/NULL | 재접속 감지