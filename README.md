## readvox

readvox는 Google 계정으로 로그인한 뒤, 승인된 계정이 오디오 또는 비디오 파일을 업로드해 원하는 언어로 더빙 결과를 만들고 바로 재생하거나 다운로드할 수 있는 Next.js 기반 웹앱입니다.

## 핵심 기능

- Google OAuth 로그인
- Turso allowlist 기반 승인 계정 접근 제어
- 오디오/비디오 파일 업로드
- ElevenLabs 기반 음성 전사와 타깃 언어 음성 합성
- Gemini 기반 전사 텍스트 번역
- 결과 오디오 또는 비디오 미리듣기 및 다운로드

## 서비스 흐름

1. 사용자가 Google 계정으로 로그인합니다.
2. 승인된 계정은 스튜디오에서 오디오 또는 비디오 파일을 업로드합니다.
3. 서버에서 음성을 추출하고 전사합니다.
4. 전사된 텍스트를 선택한 타깃 언어로 번역합니다.
5. 번역된 텍스트를 ElevenLabs로 음성 합성합니다.
6. 오디오 파일은 더빙 오디오로, 비디오 파일은 가능하면 더빙된 비디오로 반환합니다.

## 플랜 구성

- `free`: 최대 30초, 하루 3회
- `basic`: 최대 90초, 하루 10회
- `plus`: 최대 180초, 하루 30회
- `pro`: 최대 300초, 하루 100회

기본 과제 흐름상 실제 스튜디오 사용은 Turso 허용 목록에서 승인된 계정만 가능합니다.

## 주요 페이지

- `/`: 랜딩 페이지
- `/dashboard`: 로그인 후 상태 확인 및 바로가기
- `/studio`: 파일 업로드형 AI 더빙 스튜디오
- `/plans`: 플랜 비교 및 신청
- `/mypage`: 계정/승인 상태 확인

## 시작 방법

1. 의존성을 설치합니다.

```bash
npm install
```

2. `.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

3. Google Cloud Console에서 아래 Redirect URL을 등록합니다.

- 로컬: `http://localhost:3000/api/auth/callback/google`
- 배포: `https://readvox.vercel.app/api/auth/callback/google`

4. Turso 테이블과 기본 계정을 준비합니다.

```bash
npm run db:seed
```

기본 시드 계정:

- `kts123@estsoft.com` - `pro`
- `gyuwon05@gmail.com` - `plus`

5. 개발 서버를 실행합니다.

```bash
npm run dev
```

## 환경 변수

- `AUTH_SECRET`
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_STT_MODEL_ID` - 기본값 `scribe_v2`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` - 기본값 `gemini-2.5-flash-lite`

## Turso 스키마

```sql
CREATE TABLE IF NOT EXISTS allowlist_users (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'approved',
  requested_plan TEXT,
  requested_at TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE IF NOT EXISTS daily_generation_usage (
  email TEXT NOT NULL COLLATE NOCASE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, usage_date)
);
```

## 구현 메모

- 현재 업로드 크기는 50MB 이하로 제한했습니다.
- 비디오 업로드 시 원본 영상에 새 오디오를 다시 합쳐 비디오로 반환을 시도합니다.
- 비디오 합성에 실패하면 더빙 오디오 결과로 대체합니다.

## 검증

```bash
npm run lint
npm run build
npm run db:seed
```
