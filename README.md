## readvox

readvox는 Google 계정으로 로그인한 뒤, 허용 목록에 등록된 계정이 오디오 또는 비디오 파일을 업로드해 원하는 언어로 더빙 결과를 만들고 바로 재생하거나 다운로드할 수 있는 Next.js 기반 웹앱입니다.

## 과제 요구사항 대응

- 로그인: Google OAuth 로그인 지원
- 접근 제어: Turso 허용 목록에 등록된 이메일만 스튜디오 이용 가능
- 미허용 사용자 처리: 허용 신청 가능, manager 계정이 member로 승인 가능
- 입력: 오디오/비디오 파일 업로드 + 타깃 언어 선택
- 처리: 음성 추출 -> ElevenLabs 전사 -> Gemini 번역 -> ElevenLabs 음성 합성
- 출력: 더빙 결과 미리듣기 및 다운로드
- 배포: Vercel 배포 기준으로 구성

## 핵심 기능

- Google OAuth 로그인
- Turso allowlist 기반 승인 계정 접근 제어
- 미허용 계정의 허용 신청 접수
- manager 계정의 허용 요청 승인 및 member 추가
- 오디오/비디오 파일 업로드
- ElevenLabs 기반 음성 전사와 타깃 언어 음성 합성
- Gemini 기반 전사 텍스트 번역
- 결과 오디오 또는 비디오 미리듣기 및 다운로드

## 서비스 흐름

1. 사용자가 Google 계정으로 로그인합니다.
2. 현재 이메일이 Turso 허용 목록에 등록되어 있으면 스튜디오를 사용할 수 있습니다.
3. 허용 목록에 없는 계정은 대시보드에서 `허용 신청하기`를 눌러 승인 요청을 보낼 수 있습니다.
4. `kts123@estsoft.com`, `gyuwon05@gmail.com` manager 계정은 허용 목록 관리 페이지에서 요청을 확인하고 member 권한으로 승인할 수 있습니다.
5. 이용 가능한 계정은 스튜디오에서 오디오 또는 비디오 파일을 업로드합니다.
6. 서버에서 음성을 추출하고 전사합니다.
7. 전사된 텍스트를 선택한 타깃 언어로 번역합니다.
8. 번역된 텍스트를 ElevenLabs로 음성 합성합니다.
9. 오디오 파일은 더빙 오디오로, 비디오 파일은 가능하면 더빙된 비디오로 반환합니다.

## 이용 제한

- 하루 더빙 횟수: 10회
- 최대 파일 길이: 180초
- 업로드 크기: 50MB 이하

위 제한은 서버에서 직접 검사합니다.

- 일일 더빙 횟수: `daily_generation_usage` 테이블과 현재 사용량을 비교해 차단
- 최대 파일 길이: 업로드한 오디오/비디오의 실제 재생 길이를 검사해 차단

## 주요 페이지

- `/`: 랜딩 페이지
- `/dashboard`: 로그인 후 허용 상태, 사용량, 바로가기 확인
- `/studio`: 파일 업로드형 AI 더빙 스튜디오
- `/mypage`: 계정, 역할, 허용 상태 확인
- `/allowlist`: manager 전용 허용 요청 승인 및 member 추가

## 시작 방법

1. 의존성을 설치합니다.

```bash
npm install
```

2. `.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

3. Google Cloud Console에서 아래 Redirect URL을 등록합니다.

- 로컬: `http://localhost:3000/api/auth/callback/google`
- 배포: `https://readvox.vercel.app/api/auth/callback/google`

4. Turso DB를 현재 구조로 초기화하고 기본 계정을 다시 넣습니다.

```bash
npm run db:seed
```

`npm run db:seed`는 `allowlist_users`, `access_requests`, `daily_generation_usage` 테이블을 다시 만들기 때문에 기존 데이터가 초기화됩니다.

기본 시드 계정:

- `kts123@estsoft.com` - `manager`
- `gyuwon05@gmail.com` - `manager`

평가용 확인 흐름 예시:

1. 일반 Google 계정으로 로그인
2. 대시보드에서 허용 신청 접수 확인
3. manager 계정으로 로그인해 `/allowlist`에서 요청 승인
4. 다시 일반 계정으로 로그인해 `/studio` 접근 및 더빙 실행 확인

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
CREATE TABLE allowlist_users (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE access_requests (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

```sql
CREATE TABLE daily_generation_usage (
  email TEXT NOT NULL COLLATE NOCASE,
  usage_date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, usage_date)
);
```

## 구현 메모

- self-approval 방식은 제거했고, 미허용 사용자는 신청만 할 수 있고 manager 계정이 member로 승인합니다.
- manager 권한은 allowlist 테이블의 `role` 값으로 구분합니다.
- 비디오 업로드 시 원본 영상에 새 오디오를 다시 합쳐 비디오로 반환을 시도합니다.
- 비디오 합성에 실패하면 더빙 오디오 결과로 대체합니다.

## 검증

```bash
npm run lint
npm run build
npm run db:seed
```
