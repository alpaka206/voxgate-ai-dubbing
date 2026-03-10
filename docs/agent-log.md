# 작업 로그

## 2026-03-09

- Next.js 기본 화면을 readvox 랜딩 구조로 교체했습니다.
- Google OAuth 로그인과 Turso allowlist 기반 접근 제어를 연결했습니다.
- ElevenLabs 음성 목록 조회와 텍스트 기반 TTS 초안을 구현했습니다.
- 시드 스크립트, `.env.example`, `README.md`, `docs/promo-links.md`를 정리했습니다.

## 2026-03-10

- 브랜드명을 `readvox`로 통일하고 한국어 UI 문구를 전체적으로 다듬었습니다.
- 대시보드, 스튜디오, 플랜, 마이페이지 구조와 상단 네비게이션을 정리했습니다.
- 플랜 체계를 `free`, `basic`, `plus`, `pro`로 확장하고 일일 사용량 테이블을 반영했습니다.
- 과제 수정본에 맞춰 핵심 기능을 텍스트 TTS에서 파일 업로드형 AI 더빙 파이프라인으로 전환했습니다.
- 오디오/비디오 업로드, ffmpeg 기반 음성 추출, ElevenLabs 전사, Gemini 번역, ElevenLabs 음성 합성, 결과 재생/다운로드 흐름을 반영했습니다.
- 승인된 계정만 스튜디오를 사용할 수 있도록 조정하고, 미승인 계정은 이용 신청을 DB에 남길 수 있게 구성했습니다.
- `README.md`, `.env.example`, `AGENTS.md`를 새 과제 기준으로 업데이트했습니다.
- ElevenLabs 전사 기본 모델을 `scribe_v2`로 변경하고, 더빙 실패 시 실제 원인을 더 직접 확인할 수 있도록 API 에러 노출을 개선했습니다.
- Next.js 서버 런타임에서 `ffmpeg-static` 경로가 `\\ROOT\\...` 형태로 잘못 해석되는 문제를 보정하고, `ffmpeg-static`을 서버 외부 패키지로 처리하도록 조정했습니다.
- 업로드 파일 크기 제한을 4MB에서 50MB로 상향하고, 관련 안내 문구와 README 설명을 함께 수정했습니다.
- 번역 계층을 OpenAI에서 Gemini REST API로 교체하고, 환경 변수 기준을 `GEMINI_API_KEY` / `GEMINI_MODEL`로 변경했습니다.
