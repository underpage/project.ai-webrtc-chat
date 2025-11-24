USE testdb;

-- 1. 사용자 데이터 (비밀번호는 '1234'의 bcrypt 해시값)
-- 유저 1: 호스트
INSERT INTO users (user_id, password, name, department, company, email)
VALUES ('host', '1111', '김호스트', '개발팀', '테크Corp', 'host@tech.com');

-- 유저 2: 일반 회원
INSERT INTO users (user_id, password, name, department, company, email)
VALUES ('member', '1111', '이멤버', '디자인팀', '테크Corp', 'member@tech.com');


-- 2. 룸 데이터
INSERT INTO rooms (room_id, user_pk, room_password, title, purpose, max_participants)
VALUES (
    '550e8400e29b41d4a716446655440000',  -- 32자 UUID (하이픈 제거됨)
    1,                                   -- 호스트의 uid
    NULL,                                -- 공개방
    '2025년 11월 주간 개발 회의',           -- 제목
    '프로젝트 진행 상황 공유 및 이슈 체크',   -- 목적
    6                                    -- 최대 인원
);


-- 3. 회의 참여자 데이터
-- 케이스 A: 호스트 (김호스트)
INSERT INTO room_participants (room_pk, user_pk, user_role, guest_info, join_token, last_seen_at)
VALUES (
    1,                                   -- rid=1
    1,                                   -- uid=1
    'host',                              -- 역할
    NULL,                                -- 회원임
    '11111111111111111111111111111111',  -- 재접속 토큰
    NOW()
);

-- 케이스 B: 일반 회원 (이멤버)
INSERT INTO room_participants (room_pk, user_pk, user_role, guest_info, join_token, last_seen_at)
VALUES (
    1,                                   -- rid=1
    2,                                   -- uid=2
    'participant',                       -- 역할
    NULL,                                -- 회원임
    '22222222222222222222222222222222',  -- 재접속 토큰
    NOW()
);

-- 케이스 C: 비회원 (박손님) - JSON 포맷 적용
INSERT INTO room_participants (room_pk, user_pk, user_role, guest_info, join_token, last_seen_at)
VALUES (
    1,                                   -- rid=1
    NULL,                                -- 비회원
    'participant',                       -- 역할
    '{"name":"박손님", "department":"마케팅팀", "company":"협력사"}', -- JSON 문자열
    '33333333333333333333333333333333',  -- 재접속 토큰
    NOW()
);