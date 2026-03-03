"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { formatDurationLabel, formatFileSize } from "@/lib/display";
import type { VoiceOption } from "@/lib/elevenlabs";
import type { TargetLanguage } from "@/lib/languages";

type DubbingStudioProps = {
  initialError?: string;
  initialUsedCount: number;
  maxMediaDurationSeconds: number;
  maxUploadBytes: number;
  roleLabel: string;
  targetLanguages: TargetLanguage[];
  usageLimit: number;
  voices: VoiceOption[];
};

type ResultState = {
  fileName: string;
  kind: "audio" | "video";
  url: string;
} | null;

function readDownloadFileName(contentDisposition: string | null, fallback: string) {
  if (!contentDisposition) {
    return fallback;
  }

  const match = contentDisposition.match(/filename="(.+?)"/);
  return match?.[1] ?? fallback;
}

export function DubbingStudio({
  initialError,
  initialUsedCount,
  maxMediaDurationSeconds,
  maxUploadBytes,
  roleLabel,
  targetLanguages,
  usageLimit,
  voices,
}: DubbingStudioProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [voiceId, setVoiceId] = useState(voices[0]?.id ?? "");
  const [targetLanguage, setTargetLanguage] = useState(targetLanguages[0]?.code ?? "en");
  const [error, setError] = useState(initialError ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [usedCount, setUsedCount] = useState(initialUsedCount);

  useEffect(() => {
    if (!voiceId && voices[0]) {
      setVoiceId(voices[0].id);
    }
  }, [voiceId, voices]);

  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  const remainingCount = Math.max(usageLimit - usedCount, 0);
  const canSubmit =
    !isSubmitting && Boolean(selectedFile) && Boolean(voiceId) && Boolean(targetLanguage) && remainingCount > 0;

  const fileSummary = selectedFile
    ? `${selectedFile.name} / ${formatFileSize(selectedFile.size)}`
    : null;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setSelectedFile(nextFile);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFile) {
      setError("더빙할 파일을 먼저 선택해 주세요.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("media", selectedFile);
      formData.append("targetLanguage", targetLanguage);
      formData.append("voiceId", voiceId);

      const response = await fetch("/api/dub", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "더빙 결과를 만들지 못했습니다.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const kind = response.headers.get("x-readvox-output-kind") === "video" ? "video" : "audio";
      const fileName = readDownloadFileName(
        response.headers.get("content-disposition"),
        kind === "video" ? "readvox-dubbed-video.mp4" : "readvox-dubbed-audio.mp3",
      );

      setResult((currentResult) => {
        if (currentResult?.url) {
          URL.revokeObjectURL(currentResult.url);
        }

        return {
          fileName,
          kind,
          url,
        };
      });
      setUsedCount((currentCount) => currentCount + 1);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : "더빙 결과를 만들지 못했습니다.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.18fr_0.82fr]">
      <div className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-[1.25rem] border border-border bg-[#fffaf6] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">현재 플랜</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{roleLabel}</p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-[#fffaf6] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-accent">최대 길이</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {formatDurationLabel(maxMediaDurationSeconds)}
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-[#f4fbf7] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#3c7d62]">오늘 사용</p>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {usedCount} / {usageLimit}회
            </p>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-[#eef6ff] px-4 py-4">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#2c6db2]">남은 횟수</p>
            <p className="mt-2 text-lg font-semibold text-foreground">{remainingCount}회</p>
          </div>
        </div>

        <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-3">
            <span className="text-sm font-semibold text-foreground">파일 업로드</span>
            <p className="text-sm leading-6 text-muted">
              오디오 또는 비디오 파일을 올리면 음성을 추출한 뒤 전사, 번역, 더빙 음성 생성까지 한 번에 처리합니다.
            </p>

            <label className="flex cursor-pointer flex-col gap-3 rounded-[1.5rem] border border-dashed border-[#f1c8b5] bg-[#fff8f3] px-5 py-5 transition hover:border-accent hover:bg-[#fff4ec]">
              <span className="inline-flex w-fit rounded-full bg-white px-4 py-2 text-sm font-semibold text-foreground shadow-[0_8px_20px_rgba(31,38,52,0.05)]">
                파일 선택하기
              </span>
              <span className="text-sm leading-6 text-muted">
                지원 형식: MP3, WAV, M4A, AAC, OGG, WEBM, MP4, MOV, MKV
              </span>
              <span className="text-sm leading-6 text-muted">
                배포 환경에서는 {formatFileSize(maxUploadBytes)} 이하의 짧은 샘플 파일을 권장합니다.
              </span>
              <input
                accept="audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.webm,.mp4,.mov,.mkv"
                className="hidden"
                onChange={handleFileChange}
                type="file"
              />
            </label>

            <div className="rounded-[1.25rem] border border-border bg-[#fcfbf8] px-4 py-4 text-sm text-muted">
              {fileSummary ?? "아직 선택된 파일이 없습니다."}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">타깃 언어</span>
              <select
                value={targetLanguage}
                onChange={(event) => setTargetLanguage(event.target.value)}
                className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-[#ff7f5c]/10"
              >
                {targetLanguages.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-3">
              <span className="text-sm font-semibold text-foreground">더빙 목소리</span>
              <select
                value={voiceId}
                onChange={(event) => setVoiceId(event.target.value)}
                className="w-full rounded-[1.25rem] border border-border bg-white px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-4 focus:ring-[#ff7f5c]/10"
                disabled={voices.length === 0}
              >
                {voices.length === 0 ? (
                  <option value="">현재 선택 가능한 목소리가 없습니다.</option>
                ) : (
                  voices.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      {voice.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#fffaf5_0%,#f8fcfa_100%)] px-5 py-5">
            <p className="text-sm font-semibold text-foreground">처리 흐름</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              업로드한 파일에서 음성을 추출하고, 원문을 전사한 뒤 선택한 언어로 번역해 새로운 더빙 음성을 만듭니다.
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center rounded-full bg-accent px-7 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,127,92,0.24)] transition hover:-translate-y-0.5 hover:bg-accent-strong disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-[#f4f4f1] disabled:text-muted disabled:shadow-none"
            disabled={!canSubmit}
          >
            {isSubmitting
              ? "전사 · 번역 · 더빙 생성 중..."
              : remainingCount === 0
                ? "오늘 사용 가능 횟수 소진"
                : "더빙 결과 만들기"}
          </button>
        </form>
      </div>

      <aside className="rounded-[1.75rem] border border-border bg-white/92 p-6 shadow-[0_18px_40px_rgba(31,38,52,0.05)]">
        <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,#fff4ec_0%,#ffffff_100%)] p-5">
          <p className="text-xs font-semibold tracking-[0.16em] text-accent">결과 미리보기</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            생성이 끝나면 여기에서 바로 확인할 수 있어요
          </h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            오디오는 플레이어로 듣고, 비디오는 화면에서 미리 본 뒤 결과 파일을 바로 내려받을 수 있습니다.
          </p>
        </div>

        {error ? (
          <div className="mt-5 rounded-[1.25rem] border border-[#f0b5a2] bg-[#fff2ed] px-4 py-4 text-sm leading-6 text-[#9d3b1e]">
            {error}
          </div>
        ) : null}

        {result ? (
          <div className="mt-5 space-y-4 rounded-[1.5rem] border border-border bg-[#fffdfa] px-5 py-5">
            {result.kind === "video" ? (
              <video className="aspect-video w-full rounded-[1rem] bg-black/90" controls src={result.url} />
            ) : (
              <audio className="w-full" controls src={result.url}>
                사용 중인 브라우저에서 오디오 재생을 지원하지 않습니다.
              </audio>
            )}

            <div className="rounded-[1.1rem] bg-[#f8f7f3] px-4 py-3 text-sm text-muted">
              {result.fileName}
            </div>

            <a
              href={result.url}
              download={result.fileName}
              className="inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(255,127,92,0.22)] transition hover:-translate-y-0.5 hover:bg-accent-strong"
            >
              결과 다운로드
            </a>
          </div>
        ) : (
          <div className="mt-5 rounded-[1.5rem] border border-dashed border-border bg-[#fffdfa] px-5 py-8 text-sm leading-6 text-muted">
            아직 생성된 결과가 없습니다. 왼쪽에서 파일과 언어, 목소리를 고른 뒤 더빙을 시작해 보세요.
          </div>
        )}
      </aside>
    </section>
  );
}
