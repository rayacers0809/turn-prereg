# Turn City 사전예약 봇

패널 버튼으로 사전예약 접수 → Firestore 직접 저장. 혼자서 바로 돌아감.

## 준비물
1. **봇 토큰** — 디스코드 개발자포털 > 너 앱(Turn) > Bot > Reset Token
2. **Firebase 서비스계정 키** — Firebase 콘솔(`turn-int`) > 프로젝트 설정 > 서비스 계정 > 새 비공개 키 생성 → 받은 json 을 `firebase-key.json` 으로 이 폴더에 저장
3. **서버(길드) ID** — 디스코드 개발자모드 켜고 서버 우클릭 > ID 복사

## 봇 권한 (개발자포털 > Bot)
- `applications.commands` 스코프
- 채널에 메시지 보내기 / 임베드 / 버튼 권한
- (역할 자동부여 쓸 거면) 봇 역할이 `PREREG_ROLE_ID` 역할보다 위에 있어야 함

## 로컬 실행
```bash
npm install
cp .env.example .env     # .env 채우기
# firebase-key.json 넣기
npm start
```

## Railway 배포
1. 이 폴더를 깃허브에 올리거나 Railway 에 직접 업로드
2. Variables 에 `.env` 항목 입력 (`DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `PREREG_ROLE_ID`)
3. `firebase-key.json` 은 깃에 올리지 말고:
   - 방법A) Railway 에 파일로 업로드 후 `FIREBASE_KEY=/app/firebase-key.json`
   - 방법B) json 내용을 변수로 넣고 index.js 에서 파싱 (원하면 바꿔줄게)
4. Start Command: `npm start`

## 사용법
- `/사전예약패널` (관리자) → 채널에 버튼 패널 게시
- 유저가 **사전예약** 버튼 클릭 → 신청 완료 (본인만 보임)
- `/사전예약조회` → 본인 번호/상태 확인

## 데이터
```
prereg_meta/counter   { seq }
prereg/{discordId}    { code, number, claimed, ... }
```
나중에 API · FiveM · 웹 도 이 같은 컬렉션을 보므로 그대로 연동됨.

> ⚠️ `.env`, `firebase-key.json` 은 깃허브에 올리지 마. (`.gitignore` 포함됨)
