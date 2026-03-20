[한국어](./README.md) | [English](./README_EN.md)

# readvox

readvox는 업로드한 오디오 또는 비디오 파일을 다른 언어의 더빙 결과로 바꿔 주는 웹 앱입니다.

## 개요

- Demo: [https://readvox.vercel.app](https://readvox.vercel.app)
- Repository: [https://github.com/alpaka206/voxgate-ai-dubbing](https://github.com/alpaka206/voxgate-ai-dubbing)
- 한 줄 소개:
  업로드한 파일에서 음성을 추출하고, 전사와 번역을 거쳐 다른 언어의 더빙 결과를 한 번에 만들어 줍니다.

## 데모 영상

- 미리보기 영상: [readvox-preview.mp4](./public/readvox-preview.mp4)

## 핵심 기능

1. 허용 목록 기반 더빙 워크스페이스
   Google 로그인은 열려 있지만, 실제 스튜디오 사용은 Turso 허용 목록에 등록된 계정으로 제한됩니다.
2. 오디오/비디오 업로드형 더빙 파이프라인
   업로드한 파일을 음성 추출, 전사, 번역, 음성 합성 흐름으로 처리합니다.
3. 클라이언트 1분 crop + 모바일 업로드 대응
   60초를 넘는 파일은 브라우저에서 첫 1분만 잘라 업로드하고, 60초 이하인데도 큰 파일은 모바일 업로드용으로 다시 압축합니다.
4. ElevenLabs + Gemini 기반 다국어 출력
   ElevenLabs가 전사와 음성 합성을 담당하고, Gemini가 타깃 언어 번역을 담당합니다.
5. 브라우저 중심 결과 확인
   더빙 결과를 브라우저에서 바로 재생하고 다운로드할 수 있습니다.

## 기술 스택

- Frontend: Next.js App Router, React 19, Tailwind CSS v4
- Auth: next-auth + Google OAuth
- Database: Turso, `@libsql/client`
- Media processing: `ffmpeg-static`, `@ffmpeg/ffmpeg`, `@ffmpeg/util`
- AI services:
  - ElevenLabs Speech-to-Text
  - ElevenLabs Text-to-Speech
  - Gemini 2.5 Flash-Lite
- Deployment: Vercel

## AI Agent 활용 방식

- MVP 범위, 이슈 분리, 커밋 단위, 릴리스 흐름을 AI 코딩 에이전트와 함께 설계했습니다.
- 인증 흐름, 허용 목록 정책, 더빙 파이프라인 연결, UI 문구, 문서 구조를 반복적으로 정리했습니다.
- 주요 변경 이력과 판단 근거는 [docs/agent-log.md](./docs/agent-log.md)에 기록했습니다.
- `lint`, `build`, 시드 검증도 에이전트 기반 체크포인트로 진행했습니다.

## 로컬 실행

1. 의존성을 설치합니다.

```bash
npm install
```

2. `.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

3. Google OAuth callback URL을 등록합니다.

- Local: `http://localhost:3000/api/auth/callback/google`
- Production: `https://readvox.vercel.app/api/auth/callback/google`

4. Turso 스키마를 초기화하고 시드 데이터를 넣습니다.

```bash
npm run db:seed
```

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
- `BLOB_READ_WRITE_TOKEN`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_MODEL_ID`
- `ELEVENLABS_STT_MODEL_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## 아키텍처

### 처리 흐름

1. 사용자가 스튜디오에서 오디오 또는 비디오 파일과 타깃 언어, 목소리를 선택합니다.
2. 브라우저는 업로드 전에 원본 길이를 확인하고, 60초를 넘는 파일은 첫 1분만 자르거나 큰 파일은 다시 압축해 모바일에서도 올릴 수 있는 업로드용 클립을 만듭니다.
3. 브라우저가 준비된 클립만 Vercel Blob에 직접 업로드하고 `/api/dub`에는 Blob URL과 더빙 설정만 전달합니다.
4. Next.js 서버가 `ffmpeg`로 음성을 추출합니다.
5. ElevenLabs가 추출된 음성을 전사합니다.
6. Gemini가 전사문을 타깃 언어로 번역합니다.
7. ElevenLabs가 번역된 문장을 새 음성 트랙으로 합성합니다.
8. 입력이 비디오면 새 오디오를 다시 합쳐 비디오를 반환하고, 그렇지 않으면 더빙 오디오를 반환합니다.

## 주요 라우트

- `/`: 랜딩 페이지
- `/dashboard`: 계정 상태와 바로가기
- `/studio`: 보호된 더빙 워크스페이스
- `/mypage`: 계정 정보와 사용량
- `/allowlist`: 관리자용 허용 목록 관리

## 데이터 모델

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

## 검증

```bash
npm run lint
npm run build
npm run db:seed
```

## Vercel Blob 업로드 전환

- 배포 환경에서는 브라우저가 `/api/uploads`를 통해 Vercel Blob으로 파일을 직접 업로드하고, `/api/dub`에는 Blob URL과 더빙 설정만 전달합니다.
- 60초를 넘는 파일은 브라우저에서 첫 1분만 잘라 업로드하고, 60초 이하인데도 `50MB`를 넘는 파일은 브라우저에서 모바일 업로드용으로 다시 압축합니다.
- 이 준비 단계는 서버가 아니라 클라이언트에서 수행되며, 전체 원본 파일이 서버 함수 본문으로 전달되지 않습니다.
- 입력 원본은 더빙 처리 후 Blob에서 삭제하고, 결과 MP3/MP4는 Blob에 저장한 뒤 미리보기 URL과 다운로드 URL만 반환합니다.
- 이 구조를 사용하려면 Vercel 프로젝트에 Blob 스토어를 연결하고 `BLOB_READ_WRITE_TOKEN` 환경 변수를 설정해야 합니다.
- 현재 업로드용 클립 제한은 `50MB`이며, 더빙 함수 실행 시간은 배포 플랜의 함수 시간 제한 영향을 받습니다.
- 더빙 오디오는 전사 word timestamp를 기준으로 segment 단위로 다시 합성해, 문장 사이 pause와 원본 전체 길이를 최대한 유지하도록 처리합니다.

## 최근 UI 조정

- 랜딩 페이지의 Google 로그인 버튼은 Google 브랜드 버튼 규칙에 맞춘 흰색 아웃라인 버튼과 로고 배치로 정리했습니다.
- App Router 전역 `loading.tsx`를 추가해 페이지 전환 중에도 공통 로딩 UI가 보이도록 했습니다.

## Gemini quota 대응

- 번역 요청은 세그먼트마다 개별 호출하지 않고, 여러 세그먼트를 묶어 배치 단위로 Gemini에 전달합니다.
- 더빙 API는 Gemini `429` 응답이 오면 `Retry-After` 헤더나 오류 메시지의 대기 시간을 기준으로 최대 2회까지 재시도합니다.
- `GEMINI_MODEL`은 계속 환경 변수로 분리해 두어, 코드 수정 없이 quota 특성이 다른 모델로 전환할 수 있습니다.
