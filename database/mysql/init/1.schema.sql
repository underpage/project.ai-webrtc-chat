CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;


CREATE DATABASE IF NOT EXISTS testdb;
USE testdb;

-- 1. 사용자 정보 테이블
CREATE TABLE IF NOT EXISTS users (
    uid         INT AUTO_INCREMENT PRIMARY KEY COMMENT '사용자 PK',
    user_id     VARCHAR(50) NOT NULL UNIQUE COMMENT '로그인 아이디',
    password    VARCHAR(255) NOT NULL COMMENT '비밀번호',
    name        VARCHAR(50) NOT NULL COMMENT '사용자 이름',
    department  VARCHAR(100) NULL COMMENT '부서명',
    company     VARCHAR(100) NULL COMMENT '회사명',
    email       VARCHAR(100) NULL COMMENT '이메일',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성일',
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '수정일',
    
    last_login_at DATETIME DEFAULT NULL COMMENT '마지막 로그인'
) COMMENT='사용자 정보를 저장하는 테이블';


-- 2. 회의 룸 정보 테이블
CREATE TABLE IF NOT EXISTS rooms (
    rid             INT AUTO_INCREMENT PRIMARY KEY COMMENT '룸 PK',
    room_id         CHAR(32) NOT NULL UNIQUE COMMENT '룸 ID (UUID 하이픈 제거)',
    user_pk         INT NOT NULL COMMENT '호스트 사용자 PK',
    room_password   VARCHAR(255) NULL COMMENT '룸 비밀번호 (비회원 참여용)',
    title           VARCHAR(255) NULL COMMENT '회의 제목',
    purpose         VARCHAR(255) NULL COMMENT '회의 목적',
    max_participants INT NOT NULL COMMENT '최대 참여 인원',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '생성 시간',
    closed_at       TIMESTAMP NULL COMMENT '종료 시간',

    FOREIGN KEY (user_pk) REFERENCES users(uid)
) COMMENT='회의 룸 정보를 저장하는 테이블';


-- 3. 회의 참여자 정보 테이블
CREATE TABLE IF NOT EXISTS room_participants (
    pid         INT AUTO_INCREMENT PRIMARY KEY COMMENT '참여자 PK',
    room_pk     INT NOT NULL COMMENT '룸 PK',
    user_pk     INT NULL COMMENT '회원 사용자 PK (비회원은 NULL)',
    user_role   ENUM('host', 'participant') NOT NULL COMMENT '참여자 역할',
    guest_info  VARCHAR(255) NULL COMMENT '비회원 정보 (JSON: 이름/부서/회사명)',
    join_token  CHAR(32) NOT NULL UNIQUE COMMENT '재접속 토큰 (UUID 하이픈 제거)',
    joined_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '참여 시간',
    left_at     TIMESTAMP NULL COMMENT '떠난 시간',
    last_seen_at TIMESTAMP NULL COMMENT '마지막 접속 시간 (배치 업데이트용)',

    FOREIGN KEY (room_pk) REFERENCES rooms(rid) ON DELETE CASCADE,
    FOREIGN KEY (user_pk) REFERENCES users(uid)
) COMMENT='회의 참여자 정보를 저장하는 테이블';